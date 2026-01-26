package tracker

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
)

// ShellTracker tracks shell command history.
type ShellTracker struct {
	platform          platform.Platform
	store             *storage.Store
	checkpointFile    string
	excludePatterns   []*regexp.Regexp
	shellTypeOverride string // If set, overrides platform detection ("auto" means use platform)
	historyPathOverride string // If set, overrides platform's default history path
}

// ShellCheckpoint stores the last read position for each history file.
type ShellCheckpoint struct {
	Offsets map[string]int64 `json:"offsets"`
}

// NewShellTracker creates a new ShellTracker.
func NewShellTracker(p platform.Platform, store *storage.Store, dataDir string) *ShellTracker {
	return &ShellTracker{
		platform:       p,
		store:          store,
		checkpointFile: filepath.Join(dataDir, "shell_checkpoint.json"),
		excludePatterns: []*regexp.Regexp{
			regexp.MustCompile(`(?i)(password|passwd|secret|token|key=|api_key|apikey|auth)`),
			regexp.MustCompile(`^(ls|cd|pwd|clear|exit|history)$`),
		},
	}
}

// AddExcludePattern adds a regex pattern to filter out commands.
func (t *ShellTracker) AddExcludePattern(pattern string) error {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return err
	}
	t.excludePatterns = append(t.excludePatterns, re)
	return nil
}

// SetExcludePatterns replaces all user-defined exclude patterns with the given list.
// The default sensitive data patterns are always retained.
func (t *ShellTracker) SetExcludePatterns(patterns []string) error {
	// Keep only the default patterns (first 2)
	t.excludePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(password|passwd|secret|token|key=|api_key|apikey|auth)`),
		regexp.MustCompile(`^(ls|cd|pwd|clear|exit|history)$`),
	}
	// Add user-defined patterns
	for _, pattern := range patterns {
		if pattern == "" {
			continue
		}
		if err := t.AddExcludePattern(pattern); err != nil {
			return err
		}
	}
	return nil
}

// GetExcludePatterns returns the current user-defined exclude patterns as strings.
// Excludes the built-in patterns (first 2).
func (t *ShellTracker) GetExcludePatterns() []string {
	var patterns []string
	// Skip the first 2 built-in patterns
	for i := 2; i < len(t.excludePatterns); i++ {
		patterns = append(patterns, t.excludePatterns[i].String())
	}
	return patterns
}

// SetShellType sets the shell type to use. Use "auto" for auto-detection.
func (t *ShellTracker) SetShellType(shellType string) {
	if shellType == "" || shellType == "auto" {
		t.shellTypeOverride = ""
	} else {
		t.shellTypeOverride = shellType
	}
}

// GetShellType returns the configured or detected shell type.
func (t *ShellTracker) GetShellType() string {
	if t.shellTypeOverride != "" {
		return t.shellTypeOverride
	}
	return t.platform.GetShellType()
}

// SetHistoryPath sets a custom path to the shell history file.
// Pass empty string to use the default platform-detected path.
func (t *ShellTracker) SetHistoryPath(path string) {
	t.historyPathOverride = path
}

// GetHistoryPathOverride returns the configured history path override, or empty if using default.
func (t *ShellTracker) GetHistoryPathOverride() string {
	return t.historyPathOverride
}

// Poll reads new commands from history and saves them.
func (t *ShellTracker) Poll(sessionID int64) ([]*storage.ShellCommand, error) {
	// Use custom history path if set, otherwise use platform default
	histPath := t.historyPathOverride
	if histPath == "" {
		histPath = t.platform.GetShellHistoryPath()
	}
	if histPath == "" {
		return nil, nil
	}

	shellType := t.GetShellType()

	// Load checkpoint
	checkpoint, err := t.loadCheckpoint()
	if err != nil {
		checkpoint = &ShellCheckpoint{Offsets: make(map[string]int64)}
	}

	offset := checkpoint.Offsets[histPath]

	// Parse history
	commands, newOffset, err := t.parseHistory(histPath, shellType, offset)
	if err != nil {
		return nil, err
	}

	// Filter and save commands
	var saved []*storage.ShellCommand
	for _, cmd := range commands {
		if t.shouldExclude(cmd.Command) {
			continue
		}

		// Check if already exists
		exists, err := t.store.CommandExists(cmd.Timestamp, cmd.Command)
		if err != nil || exists {
			continue
		}

		cmd.SessionID = sql.NullInt64{Int64: sessionID, Valid: sessionID > 0}
		id, err := t.store.SaveShellCommand(cmd)
		if err != nil {
			continue
		}
		cmd.ID = id
		saved = append(saved, cmd)
	}

	// Update checkpoint
	checkpoint.Offsets[histPath] = newOffset
	t.saveCheckpoint(checkpoint)

	return saved, nil
}

func (t *ShellTracker) parseHistory(path, shellType string, offset int64) ([]*storage.ShellCommand, int64, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, offset, err
	}
	defer file.Close()

	// Detect history file rotation/truncation: if the file is smaller than
	// our saved offset, the file was rotated and we need to read from the start.
	if offset > 0 {
		info, err := file.Stat()
		if err != nil {
			return nil, 0, err
		}
		if info.Size() < offset {
			offset = 0
		}
	}

	// Seek to offset
	if offset > 0 {
		file.Seek(offset, 0)
	}

	var commands []*storage.ShellCommand
	scanner := bufio.NewScanner(file)

	switch shellType {
	case "zsh":
		commands = t.parseZshHistory(scanner)
	case "fish":
		commands = t.parseFishHistory(scanner)
	default: // bash
		commands = t.parseBashHistory(scanner)
	}

	// Get new offset
	newOffset, _ := file.Seek(0, 1)

	return commands, newOffset, scanner.Err()
}

// parseBashHistory parses bash history format.
// Format: #timestamp\ncommand
func (t *ShellTracker) parseBashHistory(scanner *bufio.Scanner) []*storage.ShellCommand {
	var commands []*storage.ShellCommand
	var timestamp int64
	hostname, _ := os.Hostname()

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "#") {
			// Timestamp line
			ts, err := strconv.ParseInt(strings.TrimPrefix(line, "#"), 10, 64)
			if err == nil {
				timestamp = ts
			}
		} else if line != "" {
			// Command line
			if timestamp == 0 {
				timestamp = time.Now().Unix()
			}
			commands = append(commands, &storage.ShellCommand{
				Timestamp: timestamp,
				Command:   line,
				ShellType: "bash",
				Hostname:  sql.NullString{String: hostname, Valid: hostname != ""},
			})
			timestamp = 0
		}
	}

	return commands
}

// parseZshHistory parses zsh history format.
// Format: : timestamp:duration;command
func (t *ShellTracker) parseZshHistory(scanner *bufio.Scanner) []*storage.ShellCommand {
	var commands []*storage.ShellCommand
	hostname, _ := os.Hostname()

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, ": ") {
			// Parse : timestamp:duration;command
			parts := strings.SplitN(line[2:], ";", 2)
			if len(parts) != 2 {
				continue
			}

			// Parse timestamp:duration
			meta := strings.Split(parts[0], ":")
			if len(meta) < 1 {
				continue
			}

			timestamp, err := strconv.ParseInt(meta[0], 10, 64)
			if err != nil {
				timestamp = time.Now().Unix()
			}

			var duration float64
			if len(meta) >= 2 {
				dur, err := strconv.ParseFloat(meta[1], 64)
				if err == nil {
					duration = dur
				}
			}

			commands = append(commands, &storage.ShellCommand{
				Timestamp:       timestamp,
				Command:         parts[1],
				ShellType:       "zsh",
				DurationSeconds: sql.NullFloat64{Float64: duration, Valid: duration > 0},
				Hostname:        sql.NullString{String: hostname, Valid: hostname != ""},
			})
		}
	}

	return commands
}

// parseFishHistory parses fish history YAML format.
func (t *ShellTracker) parseFishHistory(scanner *bufio.Scanner) []*storage.ShellCommand {
	var commands []*storage.ShellCommand
	var current *storage.ShellCommand
	hostname, _ := os.Hostname()

	for scanner.Scan() {
		line := scanner.Text()

		if strings.HasPrefix(line, "- cmd: ") {
			if current != nil {
				commands = append(commands, current)
			}
			current = &storage.ShellCommand{
				Command:   strings.TrimPrefix(line, "- cmd: "),
				ShellType: "fish",
				Timestamp: time.Now().Unix(),
				Hostname:  sql.NullString{String: hostname, Valid: hostname != ""},
			}
		} else if current != nil && strings.HasPrefix(line, "  when: ") {
			ts, err := strconv.ParseInt(strings.TrimPrefix(line, "  when: "), 10, 64)
			if err == nil {
				current.Timestamp = ts
			}
		} else if current != nil && strings.HasPrefix(line, "  paths:") {
			// Fish stores paths for some commands, skip for now
		}
	}

	if current != nil {
		commands = append(commands, current)
	}

	return commands
}

func (t *ShellTracker) shouldExclude(command string) bool {
	for _, pattern := range t.excludePatterns {
		if pattern.MatchString(command) {
			return true
		}
	}
	return false
}

func (t *ShellTracker) loadCheckpoint() (*ShellCheckpoint, error) {
	data, err := os.ReadFile(t.checkpointFile)
	if err != nil {
		return nil, err
	}

	var checkpoint ShellCheckpoint
	if err := json.Unmarshal(data, &checkpoint); err != nil {
		return nil, err
	}

	return &checkpoint, nil
}

func (t *ShellTracker) saveCheckpoint(checkpoint *ShellCheckpoint) error {
	data, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}

	dir := filepath.Dir(t.checkpointFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(t.checkpointFile, data, 0644)
}

// Reset clears the checkpoint, causing the next poll to re-read history.
func (t *ShellTracker) Reset() error {
	return os.Remove(t.checkpointFile)
}

// GetHistoryPath returns the shell history path being tracked.
// Returns the custom path if set, otherwise the platform default.
func (t *ShellTracker) GetHistoryPath() string {
	if t.historyPathOverride != "" {
		return t.historyPathOverride
	}
	return t.platform.GetShellHistoryPath()
}


// ParsePowerShellHistory parses PowerShell history (Windows).
func ParsePowerShellHistory(path string) ([]*storage.ShellCommand, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open PowerShell history: %w", err)
	}
	defer file.Close()

	var commands []*storage.ShellCommand
	scanner := bufio.NewScanner(file)
	hostname, _ := os.Hostname()

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		commands = append(commands, &storage.ShellCommand{
			Timestamp: time.Now().Unix(),
			Command:   line,
			ShellType: "powershell",
			Hostname:  sql.NullString{String: hostname, Valid: hostname != ""},
		})
	}

	return commands, scanner.Err()
}
