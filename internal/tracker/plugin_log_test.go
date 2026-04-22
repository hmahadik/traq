package tracker

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParsePluginLogLine_AllFields(t *testing.T) {
	line := "1\t1745000000\t0\t123\t/home/jl/repos/traq\tmain:1\thost\tbash\tgit push origin master"
	cmd, err := parsePluginLogLine(line)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Timestamp != 1745000000 {
		t.Errorf("Timestamp: got %d, want 1745000000", cmd.Timestamp)
	}
	if cmd.Command != "git push origin master" {
		t.Errorf("Command: got %q", cmd.Command)
	}
	if cmd.ShellType != "bash" {
		t.Errorf("ShellType: got %q", cmd.ShellType)
	}
	if !cmd.ExitCode.Valid || cmd.ExitCode.Int64 != 0 {
		t.Errorf("ExitCode: got %+v", cmd.ExitCode)
	}
	if !cmd.DurationSeconds.Valid || cmd.DurationSeconds.Float64 != 0.123 {
		t.Errorf("DurationSeconds: got %+v", cmd.DurationSeconds)
	}
	if !cmd.WorkingDirectory.Valid || cmd.WorkingDirectory.String != "/home/jl/repos/traq" {
		t.Errorf("WorkingDirectory: got %+v", cmd.WorkingDirectory)
	}
	if !cmd.TmuxContext.Valid || cmd.TmuxContext.String != "main:1" {
		t.Errorf("TmuxContext: got %+v", cmd.TmuxContext)
	}
	if !cmd.Hostname.Valid || cmd.Hostname.String != "host" {
		t.Errorf("Hostname: got %+v", cmd.Hostname)
	}
}

func TestParsePluginLogLine_NoTmux(t *testing.T) {
	line := "1\t1745000000\t0\t50\t/tmp\t-\thost\tzsh\tls"
	cmd, err := parsePluginLogLine(line)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.TmuxContext.Valid {
		t.Errorf("TmuxContext should be invalid for '-', got %+v", cmd.TmuxContext)
	}
}

func TestParsePluginLogLine_EscapedCommand(t *testing.T) {
	line := "1\t1745000000\t0\t0\t/tmp\t-\thost\tbash\techo line1\\nline2"
	cmd, err := parsePluginLogLine(line)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cmd.Command != "echo line1\nline2" {
		t.Errorf("Command unescape failed: got %q", cmd.Command)
	}
}

func TestParsePluginLogLine_UnknownVersion(t *testing.T) {
	line := "99\t1745000000\t0\t0\t/\t-\th\tbash\tx"
	_, err := parsePluginLogLine(line)
	if err != errUnsupportedVersion {
		t.Errorf("expected errUnsupportedVersion, got %v", err)
	}
}

func TestIngestPluginLog_TruncatesAfterRead(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "history.log")
	content := "1\t1745000000\t0\t0\t/\t-\th\tbash\tls\n" +
		"1\t1745000001\t0\t0\t/\t-\th\tbash\tpwd\n"
	if err := os.WriteFile(logPath, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	cmds, err := readAndTruncatePluginLog(logPath)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cmds) != 2 {
		t.Fatalf("got %d commands, want 2", len(cmds))
	}

	info, err := os.Stat(logPath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Size() != 0 {
		t.Errorf("log file should be truncated, size=%d", info.Size())
	}
}

func TestIngestPluginLog_MissingFile(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "missing.log")
	cmds, err := readAndTruncatePluginLog(logPath)
	if err != nil {
		t.Fatalf("missing file should not error, got %v", err)
	}
	if len(cmds) != 0 {
		t.Errorf("expected 0 commands, got %d", len(cmds))
	}
}
