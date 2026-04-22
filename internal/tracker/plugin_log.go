package tracker

import (
	"bufio"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"

	"traq/internal/storage"
)

var errUnsupportedVersion = errors.New("unsupported plugin log version")

const pluginLogVersion = "1"

// parsePluginLogLine parses a single TSV line from the Traq plugin log.
// Format: <version>\t<ts>\t<exit>\t<duration_ms>\t<cwd>\t<tmux>\t<host>\t<shell>\t<command>
func parsePluginLogLine(line string) (*storage.ShellCommand, error) {
	parts := strings.SplitN(line, "\t", 9)
	if len(parts) != 9 {
		return nil, fmt.Errorf("expected 9 TSV fields, got %d", len(parts))
	}
	if parts[0] != pluginLogVersion {
		return nil, errUnsupportedVersion
	}

	ts, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return nil, fmt.Errorf("parse timestamp: %w", err)
	}

	cmd := &storage.ShellCommand{
		Timestamp: ts,
		ShellType: parts[7],
		Command:   unescapeCommand(parts[8]),
	}

	if exitCode, err := strconv.ParseInt(parts[2], 10, 64); err == nil {
		cmd.ExitCode = sql.NullInt64{Int64: exitCode, Valid: true}
	}
	if durMs, err := strconv.ParseInt(parts[3], 10, 64); err == nil {
		cmd.DurationSeconds = sql.NullFloat64{Float64: float64(durMs) / 1000.0, Valid: true}
	}
	if parts[4] != "" && parts[4] != "-" {
		cmd.WorkingDirectory = sql.NullString{String: parts[4], Valid: true}
	}
	if parts[5] != "" && parts[5] != "-" {
		cmd.TmuxContext = sql.NullString{String: parts[5], Valid: true}
	}
	if parts[6] != "" && parts[6] != "-" {
		cmd.Hostname = sql.NullString{String: parts[6], Valid: true}
	}
	return cmd, nil
}

func unescapeCommand(s string) string {
	// Reverse the plugin's escaping: \t -> tab, \n -> newline, \\ -> \.
	var b strings.Builder
	b.Grow(len(s))
	i := 0
	for i < len(s) {
		if s[i] == '\\' && i+1 < len(s) {
			switch s[i+1] {
			case 't':
				b.WriteByte('\t')
				i += 2
				continue
			case 'n':
				b.WriteByte('\n')
				i += 2
				continue
			case '\\':
				b.WriteByte('\\')
				i += 2
				continue
			}
		}
		b.WriteByte(s[i])
		i++
	}
	return b.String()
}

// readAndTruncatePluginLog reads all commands from the plugin log, then truncates the file.
// Returns (nil, nil) if the file does not exist.
func readAndTruncatePluginLog(path string) ([]*storage.ShellCommand, error) {
	f, err := os.OpenFile(path, os.O_RDWR, 0600)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("open plugin log: %w", err)
	}
	defer f.Close()

	var commands []*storage.ShellCommand
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}
		cmd, err := parsePluginLogLine(line)
		if err != nil {
			// Skip malformed or unsupported lines silently; corrupt lines
			// should never block ingestion of valid ones.
			continue
		}
		commands = append(commands, cmd)
	}
	if err := scanner.Err(); err != nil {
		return commands, fmt.Errorf("scan plugin log: %w", err)
	}

	if err := f.Truncate(0); err != nil {
		return commands, fmt.Errorf("truncate plugin log: %w", err)
	}
	return commands, nil
}
