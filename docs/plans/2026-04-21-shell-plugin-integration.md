# Shell Plugin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture shell commands in real time across every tmux pane and terminal by installing a Traq-managed shell plugin, while preserving the existing native-history fallback path.

**Architecture:** A shell-specific plugin file is embedded in the Go binary via `//go:embed` and installed into `~/.local/share/traq/shell/`. The user's rc file gets a single fenced `source` line. The plugin appends structured TSV lines to `~/.local/share/traq/shell/history.log` when a marker file is present. The daemon's existing poll tick drains and truncates that log.

**Tech stack:** Go 1.21+, Wails v2, SQLite, shell scripting (bash/zsh/fish/PowerShell), React + TypeScript for the settings UI.

**Spec:** `docs/plans/2026-04-21-shell-plugin-integration-design.md`

---

## File Structure

**New files:**
- `internal/tracker/shellplugin/embed.go` — `//go:embed` wrapper exposing plugin contents
- `internal/tracker/shellplugin/embed/traq.bash`
- `internal/tracker/shellplugin/embed/traq.zsh`
- `internal/tracker/shellplugin/embed/traq.fish`
- `internal/tracker/shellplugin/embed/Traq.ps1`
- `internal/tracker/plugin_log.go` — parser + ingester for the Traq log file
- `internal/tracker/plugin_log_test.go`
- `internal/service/shellsetup.go` — install/uninstall/status service
- `internal/service/shellsetup_test.go`
- `frontend/src/components/settings/ShellIntegrationStrip.tsx`
- `frontend/e2e/tests/shell-integration.spec.ts`

**Modified files:**
- `internal/storage/migrations.go` — `schemaVersion` → 13; add `applyMigration13` and repair pass
- `internal/storage/models.go` — `ShellCommand` gains `TmuxContext sql.NullString`
- `internal/storage/shell.go` — `SaveShellCommand`, `scanShellCommands`, all `SELECT` lists include `tmux_context`
- `internal/tracker/shell.go` — `Poll()` reads plugin log first, then native history; builds `ShellCommand` with the new fields
- `app.go` — three new Wails bindings
- `frontend/src/api/client.ts` — shell-setup methods
- `frontend/src/api/hooks.ts` — `useShellSetupStatus`, `useInstallShellPlugin`, `useUninstallShellPlugin`
- `frontend/src/components/settings/sections/DataSourcesSettings.tsx` — mounts `<ShellIntegrationStrip />` inside Shell History card

---

## Task 1: Schema migration + model updates

**Files:**
- Modify: `internal/storage/migrations.go`
- Modify: `internal/storage/models.go`
- Modify: `internal/storage/shell.go`

- [ ] **Step 1: Write a failing test for the migration**

Create `internal/storage/migrations_shell_tmux_test.go`:

```go
package storage

import (
	"testing"
)

func TestMigration13_AddsTmuxContextColumn(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	var count int
	err := store.db.QueryRow(
		`SELECT COUNT(*) FROM pragma_table_info('shell_commands') WHERE name = 'tmux_context'`,
	).Scan(&count)
	if err != nil {
		t.Fatalf("pragma_table_info failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected tmux_context column, got count=%d", count)
	}

	var version int
	err = store.db.QueryRow(`SELECT version FROM schema_version`).Scan(&version)
	if err != nil {
		t.Fatalf("schema_version lookup failed: %v", err)
	}
	if version < 13 {
		t.Fatalf("expected schema version >= 13, got %d", version)
	}
}
```

(If `newTestStore` doesn't already exist, reuse whatever helper the existing `*_test.go` files in `internal/storage/` use — check `shell_test.go`.)

- [ ] **Step 2: Run the test, confirm it fails**

Run: `go test ./internal/storage -run TestMigration13_AddsTmuxContextColumn -v`
Expected: FAIL — column does not exist.

- [ ] **Step 3: Bump schema version + add migration function**

In `internal/storage/migrations.go`:

```go
const schemaVersion = 13
```

Add, following the pattern of `applyMigration12` (find it in the same file):

```go
// applyMigration13 adds tmux_context column to shell_commands for plugin-sourced entries.
func (s *Store) applyMigration13() error {
	var count int
	err := s.db.QueryRow(
		`SELECT COUNT(*) FROM pragma_table_info('shell_commands') WHERE name = 'tmux_context'`,
	).Scan(&count)
	if err != nil {
		return fmt.Errorf("check tmux_context column: %w", err)
	}
	if count == 0 {
		if _, err := s.db.Exec(`ALTER TABLE shell_commands ADD COLUMN tmux_context TEXT`); err != nil {
			return fmt.Errorf("add tmux_context column: %w", err)
		}
	}
	return nil
}
```

Add the dispatch block in `applyMigrations()` just below the migration 12 block:

```go
if currentVersion < 13 {
    if err := s.applyMigration13(); err != nil {
        return fmt.Errorf("failed to apply migration 13: %w", err)
    }
}
```

Add a repair call in `repairMissingTables()`:

```go
s.repairShellCommandsTable()
```

And the repair function itself, following the `repairProjectsTable` pattern:

```go
func (s *Store) repairShellCommandsTable() {
	var tableCount int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='shell_commands'`).Scan(&tableCount)
	if err != nil || tableCount == 0 {
		return
	}
	var colCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('shell_commands') WHERE name = 'tmux_context'`).Scan(&colCount)
	if err == nil && colCount == 0 {
		s.db.Exec(`ALTER TABLE shell_commands ADD COLUMN tmux_context TEXT`)
	}
}
```

Also add `tmux_context TEXT` to the `shell_commands` block in the `schema` string constant so fresh installs get the column via `CREATE TABLE`.

- [ ] **Step 4: Extend the `ShellCommand` struct**

In `internal/storage/models.go`, update the struct:

```go
type ShellCommand struct {
	ID               int64           `json:"id"`
	Timestamp        int64           `json:"timestamp"`
	Command          string          `json:"command"`
	ShellType        string          `json:"shellType"`
	WorkingDirectory sql.NullString  `json:"workingDirectory"`
	ExitCode         sql.NullInt64   `json:"exitCode"`
	DurationSeconds  sql.NullFloat64 `json:"durationSeconds"`
	Hostname         sql.NullString  `json:"hostname"`
	TmuxContext      sql.NullString  `json:"tmuxContext"`
	SessionID        sql.NullInt64   `json:"sessionId"`
	CreatedAt        int64           `json:"createdAt"`
}
```

- [ ] **Step 5: Update all `shell_commands` SQL in `internal/storage/shell.go`**

`SaveShellCommand`:

```go
func (s *Store) SaveShellCommand(cmd *ShellCommand) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO shell_commands (
			timestamp, command, shell_type, working_directory,
			exit_code, duration_seconds, hostname, tmux_context, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		cmd.Timestamp, cmd.Command, cmd.ShellType, cmd.WorkingDirectory,
		cmd.ExitCode, cmd.DurationSeconds, cmd.Hostname, cmd.TmuxContext, cmd.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert shell command: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}
	return id, nil
}
```

Every `SELECT` list (`GetShellCommandsBySession`, `GetShellCommandsByTimeRange`, `GetRecentShellCommands`, `GetAllShellCommands`, `SearchShellCommands`) needs `tmux_context` added after `hostname`.

Update `scanShellCommands`:

```go
func scanShellCommands(rows *sql.Rows) ([]*ShellCommand, error) {
	var commands []*ShellCommand
	for rows.Next() {
		cmd := &ShellCommand{}
		err := rows.Scan(
			&cmd.ID, &cmd.Timestamp, &cmd.Command, &cmd.ShellType, &cmd.WorkingDirectory,
			&cmd.ExitCode, &cmd.DurationSeconds, &cmd.Hostname, &cmd.TmuxContext,
			&cmd.SessionID, &cmd.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan shell command: %w", err)
		}
		commands = append(commands, cmd)
	}
	return commands, rows.Err()
}
```

- [ ] **Step 6: Run tests, confirm pass**

Run: `go test ./internal/storage -v`
Expected: all existing tests pass plus the new migration test.

- [ ] **Step 7: Commit**

```bash
git add internal/storage/migrations.go internal/storage/models.go internal/storage/shell.go internal/storage/migrations_shell_tmux_test.go
git commit -m "feat: add tmux_context column for shell plugin integration"
```

---

## Task 2: Plugin log parser

**Files:**
- Create: `internal/tracker/plugin_log.go`
- Create: `internal/tracker/plugin_log_test.go`

The parser reads the Traq log file, converts each TSV line into a `*storage.ShellCommand`, and truncates the log after successful ingest.

- [ ] **Step 1: Write failing tests**

Create `internal/tracker/plugin_log_test.go`:

```go
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
```

- [ ] **Step 2: Run tests, confirm they fail**

Run: `go test ./internal/tracker -run TestParsePluginLogLine -v`
Expected: FAIL — functions not defined.

- [ ] **Step 3: Write the parser**

Create `internal/tracker/plugin_log.go`:

```go
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
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `go test ./internal/tracker -run "TestParsePluginLogLine|TestIngestPluginLog" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/tracker/plugin_log.go internal/tracker/plugin_log_test.go
git commit -m "feat: parser for Traq shell plugin log format"
```

---

## Task 3: Wire the plugin log into ShellTracker.Poll()

**Files:**
- Modify: `internal/tracker/shell.go`
- Create: `internal/tracker/shell_integration_test.go`

- [ ] **Step 1: Write failing integration tests**

Create `internal/tracker/shell_integration_test.go`:

```go
package tracker

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	"traq/internal/storage"
)

// Assumes mock_platform_test.go already provides a fake platform; if the helper
// signature differs, adjust these tests to match existing conventions.

func TestShellTracker_PollReadsPluginLogWhenPresent(t *testing.T) {
	dir := t.TempDir()
	store := storage.NewTestStore(t) // or whatever helper exists
	defer store.Close()

	pluginDir := filepath.Join(dir, "shell")
	if err := os.MkdirAll(pluginDir, 0700); err != nil {
		t.Fatal(err)
	}
	logPath := filepath.Join(pluginDir, "history.log")
	content := "1\t1745000000\t0\t10\t/tmp\tmain:1\thost\tbash\tls -la\n"
	if err := os.WriteFile(logPath, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	plat := newMockPlatform("bash", "/nonexistent/history_file")
	tracker := NewShellTracker(plat, store, dir)

	saved, err := tracker.Poll(0)
	if err != nil {
		t.Fatalf("Poll: %v", err)
	}
	if len(saved) != 1 {
		t.Fatalf("expected 1 command, got %d", len(saved))
	}
	if saved[0].Command != "ls -la" {
		t.Errorf("Command: got %q", saved[0].Command)
	}
	if !saved[0].TmuxContext.Valid || saved[0].TmuxContext.String != "main:1" {
		t.Errorf("TmuxContext: got %+v", saved[0].TmuxContext)
	}
	// Log should have been truncated
	info, _ := os.Stat(logPath)
	if info.Size() != 0 {
		t.Errorf("log not truncated")
	}
}

func TestShellTracker_PollFallsBackToNativeHistory(t *testing.T) {
	dir := t.TempDir()
	store := storage.NewTestStore(t)
	defer store.Close()

	histFile := filepath.Join(dir, ".bash_history")
	content := "#1745000000\nls\n"
	if err := os.WriteFile(histFile, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	plat := newMockPlatform("bash", histFile)
	tracker := NewShellTracker(plat, store, dir)

	saved, err := tracker.Poll(0)
	if err != nil {
		t.Fatalf("Poll: %v", err)
	}
	if len(saved) != 1 || saved[0].Command != "ls" {
		t.Fatalf("unexpected saved: %+v", saved)
	}
	if saved[0].TmuxContext.Valid {
		t.Errorf("native history should not populate tmux_context")
	}
}
```

If `storage.NewTestStore(t)` doesn't exist, check what helper `internal/storage/shell_test.go` uses and mirror that signature, creating a helper if needed. Same for `newMockPlatform` — see `internal/tracker/mock_platform_test.go`.

- [ ] **Step 2: Run tests, confirm they fail**

Run: `go test ./internal/tracker -run TestShellTracker_Poll -v`
Expected: FAIL — current `Poll` doesn't know about the plugin log.

- [ ] **Step 3: Update `ShellTracker.Poll()` and add a helper for plugin-log ingestion**

In `internal/tracker/shell.go`, add near the top:

```go
// pluginLogPath returns the path to the Traq shell plugin log.
func (t *ShellTracker) pluginLogPath() string {
	return filepath.Join(filepath.Dir(t.checkpointFile), "shell", "history.log")
}
```

Replace `Poll`:

```go
func (t *ShellTracker) Poll(sessionID int64) ([]*storage.ShellCommand, error) {
	// 1. Try the Traq plugin log first (richer format, real-time)
	pluginCmds, err := readAndTruncatePluginLog(t.pluginLogPath())
	if err != nil {
		// Log-level failures should not block native fallback; surface only
		// catastrophic cases (e.g., unreadable file returned what we got).
		return nil, fmt.Errorf("plugin log: %w", err)
	}

	// 2. Also read from the native history file (fallback + commands from shells
	//    without the plugin installed). Existing behavior.
	nativeCmds, newOffset, err := t.pollNativeHistory()
	if err != nil {
		// Non-fatal: continue with plugin commands only
		nativeCmds = nil
	}

	// Merge and persist
	all := append(pluginCmds, nativeCmds...)

	var saved []*storage.ShellCommand
	for _, cmd := range all {
		if t.shouldExclude(cmd.Command) {
			continue
		}
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

	// Advance native-history checkpoint only if we actually read that source.
	if newOffset >= 0 {
		checkpoint, err := t.loadCheckpoint()
		if err != nil {
			checkpoint = &ShellCheckpoint{Offsets: make(map[string]int64)}
		}
		checkpoint.Offsets[t.currentHistoryPath()] = newOffset
		t.saveCheckpoint(checkpoint)
	}
	return saved, nil
}

// pollNativeHistory wraps the previous file-reading body of Poll. It returns
// (nil, -1, nil) if no native history path is configured.
func (t *ShellTracker) pollNativeHistory() ([]*storage.ShellCommand, int64, error) {
	histPath := t.currentHistoryPath()
	if histPath == "" {
		return nil, -1, nil
	}
	shellType := t.GetShellType()

	checkpoint, err := t.loadCheckpoint()
	if err != nil {
		checkpoint = &ShellCheckpoint{Offsets: make(map[string]int64)}
	}
	offset := checkpoint.Offsets[histPath]

	commands, newOffset, err := t.parseHistory(histPath, shellType, offset)
	if err != nil {
		return nil, -1, err
	}
	return commands, newOffset, nil
}

func (t *ShellTracker) currentHistoryPath() string {
	if t.historyPathOverride != "" {
		return t.historyPathOverride
	}
	return t.platform.GetShellHistoryPath()
}
```

- [ ] **Step 4: Run tests, confirm they pass**

Run: `go test ./internal/tracker -v`
Expected: all tests pass (the two new integration tests plus the existing shell tests).

- [ ] **Step 5: Commit**

```bash
git add internal/tracker/shell.go internal/tracker/shell_integration_test.go
git commit -m "feat: shell tracker reads plugin log before native history"
```

---

## Task 4: Bash plugin + embed machinery

**Files:**
- Create: `internal/tracker/shellplugin/embed.go`
- Create: `internal/tracker/shellplugin/embed/traq.bash`

- [ ] **Step 1: Write the bash plugin**

Create `internal/tracker/shellplugin/embed/traq.bash`:

```bash
# Traq shell integration for bash. Managed by Traq.
# Do not edit in place — reinstall via the Traq UI to update.

[[ -n "${__TRAQ_LOADED:-}" ]] && return 0
__TRAQ_LOADED=1

__traq_dir="${XDG_DATA_HOME:-$HOME/.local/share}/traq/shell"
__traq_marker="$__traq_dir/enabled"
__traq_log="$__traq_dir/history.log"
__traq_overflow="$__traq_dir/overflowed"
__traq_max_bytes=10485760  # 10 MiB

# Capture command start time via PS0 (fires before each command runs).
# EPOCHREALTIME is bash 5+; fall back to date for older bash.
if [[ -n "${EPOCHREALTIME:-}" ]]; then
    PS0='${__traq_start:=$EPOCHREALTIME}'
else
    PS0='${__traq_start:=$(date +%s)}'
fi

__traq_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\n'/\\n}"
    if [[ ${#s} -gt 4000 ]]; then
        s="${s:0:4000}…"
    fi
    printf '%s' "$s"
}

__traq_hook() {
    local exit_code=$?
    [[ -f "$__traq_marker" ]] || { unset __traq_start; return; }

    # Overflow check
    if [[ -f "$__traq_log" ]]; then
        local size
        size=$(wc -c < "$__traq_log" 2>/dev/null | tr -d ' ')
        if [[ -n "$size" && "$size" -gt "$__traq_max_bytes" ]]; then
            : > "$__traq_overflow"
            unset __traq_start
            return
        fi
    fi

    # Last command via HISTCMD-based lookup
    local cmd
    cmd=$(HISTTIMEFORMAT= builtin history 1 2>/dev/null | sed 's/^ *[0-9]* *//')
    [[ -z "$cmd" ]] && { unset __traq_start; return; }

    local ts
    ts=$(date +%s)

    local duration_ms=0
    if [[ -n "${__traq_start:-}" ]]; then
        local end now
        if [[ -n "${EPOCHREALTIME:-}" ]]; then
            end="$EPOCHREALTIME"
            duration_ms=$(awk -v s="$__traq_start" -v e="$end" 'BEGIN{printf "%.0f", (e - s) * 1000}')
        else
            now=$(date +%s)
            duration_ms=$(( (now - __traq_start) * 1000 ))
        fi
    fi

    local tmux_ctx="-"
    if [[ -n "${TMUX:-}" ]]; then
        local session window
        session=$(tmux display-message -p '#S' 2>/dev/null)
        window=$(tmux display-message -p '#I' 2>/dev/null)
        [[ -n "$session" && -n "$window" ]] && tmux_ctx="${session}:${window}"
    fi

    local hostname
    hostname=$(hostname -s 2>/dev/null || echo "-")

    mkdir -p "$__traq_dir" 2>/dev/null
    printf '1\t%s\t%s\t%s\t%s\t%s\t%s\tbash\t%s\n' \
        "$ts" "$exit_code" "$duration_ms" "$PWD" "$tmux_ctx" "$hostname" \
        "$(__traq_escape "$cmd")" \
        >> "$__traq_log"

    unset __traq_start
}

# Prepend to PROMPT_COMMAND so we run first (and don't clobber existing hooks).
case "${PROMPT_COMMAND:-}" in
    *"__traq_hook"*) ;;
    "") PROMPT_COMMAND="__traq_hook" ;;
    *) PROMPT_COMMAND="__traq_hook; $PROMPT_COMMAND" ;;
esac
```

- [ ] **Step 2: Write the embed wrapper**

Create `internal/tracker/shellplugin/embed.go`:

```go
// Package shellplugin provides embedded shell plugin scripts.
package shellplugin

import (
	"embed"
	"errors"
)

//go:embed embed/*
var files embed.FS

// ShellKind enumerates supported plugin shells.
type ShellKind string

const (
	Bash       ShellKind = "bash"
	Zsh        ShellKind = "zsh"
	Fish       ShellKind = "fish"
	PowerShell ShellKind = "powershell"
)

var errUnknownShell = errors.New("unknown shell kind")

// Filename returns the on-disk filename used when installing the plugin.
func Filename(kind ShellKind) string {
	switch kind {
	case Bash:
		return "plugin.bash"
	case Zsh:
		return "plugin.zsh"
	case Fish:
		return "plugin.fish"
	case PowerShell:
		return "plugin.ps1"
	}
	return ""
}

// Script returns the plugin contents for the given shell.
func Script(kind ShellKind) ([]byte, error) {
	var p string
	switch kind {
	case Bash:
		p = "embed/traq.bash"
	case Zsh:
		p = "embed/traq.zsh"
	case Fish:
		p = "embed/traq.fish"
	case PowerShell:
		p = "embed/Traq.ps1"
	default:
		return nil, errUnknownShell
	}
	return files.ReadFile(p)
}
```

Placeholders for zsh/fish/ps1 files are needed for the `//go:embed embed/*` directive to succeed. Create empty-but-valid placeholders:
- `internal/tracker/shellplugin/embed/traq.zsh` — single line: `# traq zsh plugin — placeholder`
- `internal/tracker/shellplugin/embed/traq.fish` — single line: `# traq fish plugin — placeholder`
- `internal/tracker/shellplugin/embed/Traq.ps1` — single line: `# traq PowerShell plugin — placeholder`

These get filled in by Tasks 10–12.

- [ ] **Step 3: Verify the package builds**

Run: `go build ./internal/tracker/shellplugin/`
Expected: no errors.

- [ ] **Step 4: Behavior test for the bash plugin**

Create `internal/tracker/shellplugin/plugin_bash_test.go`:

```go
//go:build !windows

package shellplugin

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestBashPlugin_WritesLogLine(t *testing.T) {
	if _, err := exec.LookPath("bash"); err != nil {
		t.Skip("bash not installed")
	}

	home := t.TempDir()
	shellDir := filepath.Join(home, ".local", "share", "traq", "shell")
	if err := os.MkdirAll(shellDir, 0700); err != nil {
		t.Fatal(err)
	}
	// Marker present → plugin should log
	if err := os.WriteFile(filepath.Join(shellDir, "enabled"), []byte{}, 0600); err != nil {
		t.Fatal(err)
	}

	pluginPath := filepath.Join(home, "plugin.bash")
	script, err := Script(Bash)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		t.Fatal(err)
	}

	// Run bash interactively-ish: source the plugin, run one command, exit.
	cmd := exec.Command("bash", "--noprofile", "--norc", "-c",
		`set -o history; HISTFILE=/dev/null; source "$1"; echo hello; `+
			`# PROMPT_COMMAND only fires at prompt; invoke hook manually:
			__traq_hook`,
		"--", pluginPath)
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"XDG_DATA_HOME="+filepath.Join(home, ".local", "share"),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("bash failed: %v\n%s", err, out)
	}

	logBytes, err := os.ReadFile(filepath.Join(shellDir, "history.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if !strings.Contains(string(logBytes), "\tbash\t") {
		t.Errorf("log missing bash shell marker: %s", logBytes)
	}
	if !strings.Contains(string(logBytes), "echo hello") {
		t.Errorf("log missing command: %s", logBytes)
	}
}
```

Run: `go test ./internal/tracker/shellplugin -v`
Expected: PASS on a system with bash.

- [ ] **Step 5: Commit**

```bash
git add internal/tracker/shellplugin/
git commit -m "feat: embed bash shell plugin for real-time command capture"
```

---

## Task 5: ShellSetup service — core paths, status, install/uninstall for bash

**Files:**
- Create: `internal/service/shellsetup.go`
- Create: `internal/service/shellsetup_test.go`

- [ ] **Step 1: Write failing tests for path detection and fenced-block editing**

Create `internal/service/shellsetup_test.go`:

```go
package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"traq/internal/tracker/shellplugin"
)

func newShellSetupTest(t *testing.T) (*ShellSetupService, string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, ".local", "share"))
	dataDir := filepath.Join(home, ".local", "share", "traq")
	svc := NewShellSetupService(dataDir)
	return svc, home
}

func TestInstall_CreatesPluginAndFencesRcFile(t *testing.T) {
	svc, home := newShellSetupTest(t)

	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("Install: %v", err)
	}

	pluginPath := filepath.Join(home, ".local", "share", "traq", "shell", "plugin.bash")
	if _, err := os.Stat(pluginPath); err != nil {
		t.Errorf("plugin file missing: %v", err)
	}

	rc, err := os.ReadFile(filepath.Join(home, ".bashrc"))
	if err != nil {
		t.Fatalf("read .bashrc: %v", err)
	}
	s := string(rc)
	if !strings.Contains(s, traqFenceStart) || !strings.Contains(s, traqFenceEnd) {
		t.Errorf(".bashrc missing fence: %q", s)
	}
	if !strings.Contains(s, "plugin.bash") {
		t.Errorf(".bashrc missing plugin ref: %q", s)
	}
}

func TestInstall_Idempotent(t *testing.T) {
	svc, home := newShellSetupTest(t)
	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("first install: %v", err)
	}
	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("second install: %v", err)
	}
	rc, _ := os.ReadFile(filepath.Join(home, ".bashrc"))
	count := strings.Count(string(rc), traqFenceStart)
	if count != 1 {
		t.Errorf("fence start appears %d times, want 1: %s", count, rc)
	}
}

func TestUninstall_RestoresRcFile(t *testing.T) {
	svc, home := newShellSetupTest(t)
	rcPath := filepath.Join(home, ".bashrc")
	original := "# user content above\nexport PATH=$PATH:/foo\n"
	if err := os.WriteFile(rcPath, []byte(original), 0600); err != nil {
		t.Fatal(err)
	}

	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("Install: %v", err)
	}
	if err := svc.Uninstall(shellplugin.Bash); err != nil {
		t.Fatalf("Uninstall: %v", err)
	}

	got, _ := os.ReadFile(rcPath)
	if string(got) != original {
		t.Errorf("rc file not restored\nwant: %q\ngot:  %q", original, got)
	}
	pluginPath := filepath.Join(home, ".local", "share", "traq", "shell", "plugin.bash")
	if _, err := os.Stat(pluginPath); !os.IsNotExist(err) {
		t.Errorf("plugin file not deleted")
	}
}

func TestStatus_Transitions(t *testing.T) {
	svc, _ := newShellSetupTest(t)

	st, err := svc.Status(shellplugin.Bash)
	if err != nil {
		t.Fatal(err)
	}
	if st.State != StateNotInstalled {
		t.Errorf("expected NotInstalled, got %s", st.State)
	}

	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatal(err)
	}
	svc.EnableCapture()
	st, _ = svc.Status(shellplugin.Bash)
	if st.State != StateActive {
		t.Errorf("expected Active, got %s", st.State)
	}

	svc.DisableCapture()
	st, _ = svc.Status(shellplugin.Bash)
	if st.State != StateInstalledDisabled {
		t.Errorf("expected InstalledDisabled, got %s", st.State)
	}
}
```

- [ ] **Step 2: Run, confirm fail**

Run: `go test ./internal/service -run TestInstall -v`
Expected: FAIL — no types yet.

- [ ] **Step 3: Implement the service**

Create `internal/service/shellsetup.go`:

```go
package service

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"traq/internal/tracker/shellplugin"
)

const (
	traqFenceStart = "# >>> traq shell integration >>>"
	traqFenceEnd   = "# <<< traq shell integration <<<"
	markerFilename = "enabled"
)

type SetupState string

const (
	StateNotInstalled      SetupState = "not_installed"
	StateActive            SetupState = "active"
	StateInstalledDisabled SetupState = "installed_disabled"
	StateNeedsAttention    SetupState = "needs_attention"
)

type SetupStatus struct {
	Shell      shellplugin.ShellKind `json:"shell"`
	State      SetupState            `json:"state"`
	RcPath     string                `json:"rcPath"`
	PluginPath string                `json:"pluginPath"`
	Overflowed bool                  `json:"overflowed"`
	Message    string                `json:"message"`
}

type ShellSetupService struct {
	dataDir string // e.g. ~/.local/share/traq
}

func NewShellSetupService(dataDir string) *ShellSetupService {
	return &ShellSetupService{dataDir: dataDir}
}

func (s *ShellSetupService) shellDir() string { return filepath.Join(s.dataDir, "shell") }
func (s *ShellSetupService) markerPath() string {
	return filepath.Join(s.shellDir(), markerFilename)
}
func (s *ShellSetupService) overflowPath() string {
	return filepath.Join(s.shellDir(), "overflowed")
}
func (s *ShellSetupService) pluginPath(kind shellplugin.ShellKind) string {
	return filepath.Join(s.shellDir(), shellplugin.Filename(kind))
}

// rcPathFor returns the absolute path to the user's rc file for the given shell.
func (s *ShellSetupService) rcPathFor(kind shellplugin.ShellKind) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	switch kind {
	case shellplugin.Bash:
		return filepath.Join(home, ".bashrc"), nil
	case shellplugin.Zsh:
		return filepath.Join(home, ".zshrc"), nil
	case shellplugin.Fish:
		return filepath.Join(home, ".config", "fish", "config.fish"), nil
	case shellplugin.PowerShell:
		// Caller typically resolves $PROFILE at install time; for tests we
		// fall back to a predictable path.
		return filepath.Join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"), nil
	}
	return "", errors.New("unsupported shell")
}

// sourceLine is the contents placed between the fence markers for each shell.
func sourceLine(kind shellplugin.ShellKind, pluginPath string) string {
	switch kind {
	case shellplugin.Bash, shellplugin.Zsh:
		return fmt.Sprintf(`[ -f %q ] && . %q`, pluginPath, pluginPath)
	case shellplugin.Fish:
		return fmt.Sprintf(`test -f %q; and source %q`, pluginPath, pluginPath)
	case shellplugin.PowerShell:
		return fmt.Sprintf(`if (Test-Path %q) { . %q }`, pluginPath, pluginPath)
	}
	return ""
}

func (s *ShellSetupService) Install(kind shellplugin.ShellKind) error {
	script, err := shellplugin.Script(kind)
	if err != nil {
		return fmt.Errorf("load plugin script: %w", err)
	}
	if err := os.MkdirAll(s.shellDir(), 0700); err != nil {
		return fmt.Errorf("create shell dir: %w", err)
	}
	pluginPath := s.pluginPath(kind)
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		return fmt.Errorf("write plugin: %w", err)
	}

	rcPath, err := s.rcPathFor(kind)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(rcPath), 0755); err != nil {
		return fmt.Errorf("create rc dir: %w", err)
	}

	block := strings.Join([]string{
		traqFenceStart,
		"# Managed by Traq. Do not edit between these fences.",
		sourceLine(kind, pluginPath),
		traqFenceEnd,
	}, "\n")

	if err := upsertFencedBlock(rcPath, block); err != nil {
		return fmt.Errorf("update rc file: %w", err)
	}
	return nil
}

func (s *ShellSetupService) Uninstall(kind shellplugin.ShellKind) error {
	rcPath, err := s.rcPathFor(kind)
	if err != nil {
		return err
	}
	if err := removeFencedBlock(rcPath); err != nil {
		return fmt.Errorf("update rc file: %w", err)
	}
	if err := os.Remove(s.pluginPath(kind)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove plugin: %w", err)
	}
	return nil
}

func (s *ShellSetupService) EnableCapture() error {
	if err := os.MkdirAll(s.shellDir(), 0700); err != nil {
		return err
	}
	f, err := os.OpenFile(s.markerPath(), os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	return f.Close()
}

func (s *ShellSetupService) DisableCapture() error {
	if err := os.Remove(s.markerPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *ShellSetupService) Status(kind shellplugin.ShellKind) (*SetupStatus, error) {
	rcPath, err := s.rcPathFor(kind)
	if err != nil {
		return nil, err
	}
	pluginPath := s.pluginPath(kind)

	rcHasFence := false
	if data, err := os.ReadFile(rcPath); err == nil {
		rcHasFence = bytes.Contains(data, []byte(traqFenceStart))
	}
	pluginExists := fileExists(pluginPath)
	markerExists := fileExists(s.markerPath())
	overflow := fileExists(s.overflowPath())

	status := &SetupStatus{
		Shell: kind, RcPath: rcPath, PluginPath: pluginPath, Overflowed: overflow,
	}
	switch {
	case rcHasFence && pluginExists && markerExists:
		status.State = StateActive
		status.Message = "Capturing commands from all shells."
	case rcHasFence && pluginExists && !markerExists:
		status.State = StateInstalledDisabled
		status.Message = "Plugin installed but idle. Enable Shell History to resume."
	case rcHasFence && !pluginExists:
		status.State = StateNeedsAttention
		status.Message = "Plugin file missing. Reinstall."
	case !rcHasFence:
		status.State = StateNotInstalled
		status.Message = "Install the Traq plugin for real-time capture across tmux and multiple terminals."
	}
	if overflow && status.State == StateActive {
		status.State = StateNeedsAttention
		status.Message = "Shell log hit size limit while Traq was idle. Some commands may be missing."
	}
	return status, nil
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// upsertFencedBlock atomically replaces or appends the fenced block in rcPath.
func upsertFencedBlock(rcPath, block string) error {
	existing, err := os.ReadFile(rcPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	var out bytes.Buffer
	if bytes.Contains(existing, []byte(traqFenceStart)) {
		scanner := bufio.NewScanner(bytes.NewReader(existing))
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		inside := false
		for scanner.Scan() {
			line := scanner.Text()
			switch {
			case !inside && strings.TrimSpace(line) == traqFenceStart:
				inside = true
				out.WriteString(block)
				out.WriteByte('\n')
			case inside && strings.TrimSpace(line) == traqFenceEnd:
				inside = false
			case !inside:
				out.WriteString(line)
				out.WriteByte('\n')
			}
		}
	} else {
		out.Write(existing)
		if len(existing) > 0 && !bytes.HasSuffix(existing, []byte("\n")) {
			out.WriteByte('\n')
		}
		out.WriteString(block)
		out.WriteByte('\n')
	}

	return atomicWriteFile(rcPath, out.Bytes(), 0600)
}

func removeFencedBlock(rcPath string) error {
	data, err := os.ReadFile(rcPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if !bytes.Contains(data, []byte(traqFenceStart)) {
		// Nothing to do; refuse silently. Caller can still delete the plugin file.
		return nil
	}
	var out bytes.Buffer
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	inside := false
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case !inside && strings.TrimSpace(line) == traqFenceStart:
			inside = true
		case inside && strings.TrimSpace(line) == traqFenceEnd:
			inside = false
		case !inside:
			out.WriteString(line)
			out.WriteByte('\n')
		}
	}
	return atomicWriteFile(rcPath, out.Bytes(), 0600)
}

func atomicWriteFile(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".traq.*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpPath, perm); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
```

- [ ] **Step 4: Tests pass**

Run: `go test ./internal/service -run "TestInstall|TestUninstall|TestStatus" -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/shellsetup.go internal/service/shellsetup_test.go
git commit -m "feat: shell setup service for bash with fenced-block rc editing"
```

---

## Task 6: Hook into daemon: enable/disable marker tied to Shell History config

**Files:**
- Modify: `internal/service/config.go` (or wherever the Shell History enabled toggle currently reacts)
- Modify: `internal/tracker/daemon.go` if it's what propagates the change

- [ ] **Step 1: Locate the existing Shell History toggle handler**

Run: `grep -rn "shell.*enabled\|DataSources.*shell\|shell.*Enabled" internal/ | grep -v _test`

Find where config changes cause the tracker to be re-initialized. Usually this is a setter or watcher on the config service.

- [ ] **Step 2: Add marker management**

In whatever code responds to the Shell History enabled toggle, add a call to `ShellSetupService.EnableCapture()` or `DisableCapture()` accordingly. For example, if the config service holds a `*ShellSetupService`:

```go
if cfg.DataSources.Shell.Enabled {
    _ = c.shellSetup.EnableCapture()
} else {
    _ = c.shellSetup.DisableCapture()
}
```

Wire `ShellSetupService` into `ConfigService` at construction time. Look at how `daemon` and `store` are injected today and follow the same pattern.

- [ ] **Step 3: Test: toggling config flips the marker**

Add to `internal/service/shellsetup_test.go`:

```go
func TestMarkerTiesToConfigToggle(t *testing.T) {
	svc, home := newShellSetupTest(t)
	if err := svc.EnableCapture(); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(home, ".local", "share", "traq", "shell", "enabled")
	if _, err := os.Stat(marker); err != nil {
		t.Errorf("marker missing after EnableCapture: %v", err)
	}
	if err := svc.DisableCapture(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Errorf("marker still present after DisableCapture")
	}
}
```

- [ ] **Step 4: Run all service tests**

Run: `go test ./internal/service -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/
git commit -m "feat: Shell History toggle drives plugin capture marker"
```

---

## Task 7: Wails bindings in app.go

**Files:**
- Modify: `app.go`

- [ ] **Step 1: Wire the service into `App`**

Find where other services (e.g. `ConfigService`, timeline service) are constructed in `app.go` or `main.go`. Add a field on `App`:

```go
ShellSetup *service.ShellSetupService
```

Initialize it where other services are initialized:

```go
a.ShellSetup = service.NewShellSetupService(a.platform.DataDir())
```

- [ ] **Step 2: Add the three bindings**

Append to `app.go`:

```go
// GetShellSetupStatus returns the install/enable state for a given shell.
func (a *App) GetShellSetupStatus(shell string) (*service.SetupStatus, error) {
	return a.ShellSetup.Status(shellplugin.ShellKind(shell))
}

// InstallShellPlugin installs the Traq plugin for the given shell.
func (a *App) InstallShellPlugin(shell string) error {
	return a.ShellSetup.Install(shellplugin.ShellKind(shell))
}

// UninstallShellPlugin removes the Traq plugin for the given shell.
func (a *App) UninstallShellPlugin(shell string) error {
	return a.ShellSetup.Uninstall(shellplugin.ShellKind(shell))
}
```

Add `"traq/internal/tracker/shellplugin"` to the imports.

- [ ] **Step 3: Regenerate frontend bindings**

Run: `wails generate bindings -tags webkit2_41`

If that command isn't available in this environment, start `wails dev -tags webkit2_41`, let it regenerate, then stop it.

Verify `frontend/wailsjs/go/main/App.d.ts` now declares `GetShellSetupStatus`, `InstallShellPlugin`, `UninstallShellPlugin`.

- [ ] **Step 4: Build the backend**

Run: `go build ./...`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app.go frontend/wailsjs/
git commit -m "feat: Wails bindings for shell plugin install/uninstall/status"
```

---

## Task 8: Frontend API client + React Query hooks

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/hooks.ts`

- [ ] **Step 1: Extend the API client**

In `frontend/src/api/client.ts`, add to the `api` object (match existing style):

```ts
import {
  GetShellSetupStatus,
  InstallShellPlugin,
  UninstallShellPlugin,
} from '@wailsjs/go/main/App';

// ... inside api = { ... }
shellSetup: {
  status: (shell: string) => GetShellSetupStatus(shell),
  install: (shell: string) => InstallShellPlugin(shell),
  uninstall: (shell: string) => UninstallShellPlugin(shell),
},
```

- [ ] **Step 2: Add React Query hooks**

In `frontend/src/api/hooks.ts`:

```ts
export function useShellSetupStatus(shell: string) {
  return useQuery({
    queryKey: ['shellSetup', shell],
    queryFn: () => api.shellSetup.status(shell),
    refetchInterval: 5000, // polling so UI reflects marker/plugin state changes
  });
}

export function useInstallShellPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shell: string) => api.shellSetup.install(shell),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shellSetup'] }),
  });
}

export function useUninstallShellPlugin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shell: string) => api.shellSetup.uninstall(shell),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shellSetup'] }),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: frontend API client for shell plugin setup"
```

---

## Task 9: ShellIntegrationStrip component + settings integration

**Files:**
- Create: `frontend/src/components/settings/ShellIntegrationStrip.tsx`
- Modify: `frontend/src/components/settings/sections/DataSourcesSettings.tsx`

- [ ] **Step 1: Write the component**

Create `frontend/src/components/settings/ShellIntegrationStrip.tsx`:

```tsx
import { useShellSetupStatus, useInstallShellPlugin, useUninstallShellPlugin } from '@/api/hooks';
import { Button } from '@/components/ui/button';

interface Props {
  shell: string;
}

const stateLabels: Record<string, { pill: string; className: string }> = {
  not_installed:      { pill: 'Not installed',       className: 'bg-muted text-muted-foreground' },
  active:             { pill: 'Active',              className: 'bg-green-500/20 text-green-700 dark:text-green-400' },
  installed_disabled: { pill: 'Installed (disabled)', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' },
  needs_attention:    { pill: 'Needs attention',     className: 'bg-red-500/20 text-red-700 dark:text-red-400' },
};

export function ShellIntegrationStrip({ shell }: Props) {
  const { data: status, isLoading } = useShellSetupStatus(shell);
  const install = useInstallShellPlugin();
  const uninstall = useUninstallShellPlugin();

  if (isLoading || !status) return null;

  const label = stateLabels[status.state] ?? stateLabels.not_installed;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Shell integration</span>
          <span className={`rounded-full px-2 py-0.5 text-xs ${label.className}`}>
            {label.pill}
          </span>
        </div>
        <div className="flex gap-2">
          {status.state === 'not_installed' && (
            <Button size="sm" onClick={() => install.mutate(shell)} disabled={install.isPending}>
              Install plugin
            </Button>
          )}
          {status.state === 'needs_attention' && (
            <Button size="sm" onClick={() => install.mutate(shell)} disabled={install.isPending}>
              Reinstall
            </Button>
          )}
          {(status.state === 'active' ||
            status.state === 'installed_disabled' ||
            status.state === 'needs_attention') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (window.confirm('Remove Traq shell integration?')) {
                  uninstall.mutate(shell);
                }
              }}
              disabled={uninstall.isPending}
            >
              Uninstall
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{status.message}</p>
      {status.state === 'active' && (
        <p className="text-xs text-muted-foreground">
          Open a new terminal or run <code className="rounded bg-muted px-1">source {status.rcPath}</code>{' '}
          to activate in existing shells.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount inside the Shell History card**

In `frontend/src/components/settings/sections/DataSourcesSettings.tsx`, inside the Shell History `CollapsibleCard`, before the existing `<SettingsRow label="Shell Type" ...>`:

```tsx
<ShellIntegrationStrip
  shell={config.dataSources.shell.shellType === 'auto' || !config.dataSources.shell.shellType
    ? 'bash' // default; status hook will still work, but bash is the v1 focus
    : config.dataSources.shell.shellType}
/>
```

And import:

```tsx
import { ShellIntegrationStrip } from '../ShellIntegrationStrip';
```

- [ ] **Step 3: Manual UI check**

Run: `wails dev -tags webkit2_41`

Open Settings → Data Sources → Shell History (expand). Verify the "Shell integration" strip appears with "Not installed" state. Click "Install plugin" — pill flips to "Active" after polling tick.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/settings/
git commit -m "feat: Shell integration status strip in Settings"
```

---

## Task 10: Zsh plugin

**Files:**
- Modify: `internal/tracker/shellplugin/embed/traq.zsh`
- Create: `internal/tracker/shellplugin/plugin_zsh_test.go`

- [ ] **Step 1: Write the zsh plugin**

Replace `internal/tracker/shellplugin/embed/traq.zsh`:

```bash
# Traq shell integration for zsh.

[[ -n "${__TRAQ_LOADED:-}" ]] && return 0
__TRAQ_LOADED=1

__traq_dir="${XDG_DATA_HOME:-$HOME/.local/share}/traq/shell"
__traq_marker="$__traq_dir/enabled"
__traq_log="$__traq_dir/history.log"
__traq_overflow="$__traq_dir/overflowed"
__traq_max_bytes=10485760

__traq_start=0

__traq_preexec() {
    __traq_cmd="$1"
    __traq_start=$EPOCHREALTIME
}

__traq_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\n'/\\n}"
    if (( ${#s} > 4000 )); then
        s="${s:0:4000}…"
    fi
    print -rn -- "$s"
}

__traq_precmd() {
    local exit_code=$?
    [[ -z "${__traq_cmd:-}" ]] && return
    [[ -f "$__traq_marker" ]] || { __traq_cmd=""; return; }

    if [[ -f "$__traq_log" ]]; then
        local size
        size=$(wc -c < "$__traq_log" 2>/dev/null | tr -d ' ')
        if [[ -n "$size" && "$size" -gt "$__traq_max_bytes" ]]; then
            : > "$__traq_overflow"
            __traq_cmd=""
            return
        fi
    fi

    local end duration_ms=0
    end=$EPOCHREALTIME
    duration_ms=$(awk -v s="$__traq_start" -v e="$end" 'BEGIN{printf "%.0f", (e - s) * 1000}')

    local tmux_ctx="-"
    if [[ -n "${TMUX:-}" ]]; then
        local session window
        session=$(tmux display-message -p '#S' 2>/dev/null)
        window=$(tmux display-message -p '#I' 2>/dev/null)
        [[ -n "$session" && -n "$window" ]] && tmux_ctx="${session}:${window}"
    fi

    local hostname
    hostname=$(hostname -s 2>/dev/null || echo "-")

    mkdir -p "$__traq_dir" 2>/dev/null
    printf '1\t%s\t%s\t%s\t%s\t%s\t%s\tzsh\t%s\n' \
        "$(date +%s)" "$exit_code" "$duration_ms" "$PWD" "$tmux_ctx" "$hostname" \
        "$(__traq_escape "$__traq_cmd")" \
        >> "$__traq_log"
    __traq_cmd=""
}

autoload -Uz add-zsh-hook
zmodload zsh/datetime 2>/dev/null
add-zsh-hook preexec __traq_preexec
add-zsh-hook precmd  __traq_precmd
```

- [ ] **Step 2: Add behavior test**

Create `internal/tracker/shellplugin/plugin_zsh_test.go`:

```go
//go:build !windows

package shellplugin

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestZshPlugin_WritesLogLine(t *testing.T) {
	if _, err := exec.LookPath("zsh"); err != nil {
		t.Skip("zsh not installed")
	}

	home := t.TempDir()
	shellDir := filepath.Join(home, ".local", "share", "traq", "shell")
	if err := os.MkdirAll(shellDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(shellDir, "enabled"), []byte{}, 0600); err != nil {
		t.Fatal(err)
	}

	pluginPath := filepath.Join(home, "plugin.zsh")
	script, err := Script(Zsh)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		t.Fatal(err)
	}

	// Force precmd/preexec to fire by running a command and invoking them manually.
	cmd := exec.Command("zsh", "--no-rcs", "-c",
		`source "$1"; __traq_preexec "echo hello"; __traq_precmd`,
		"--", pluginPath)
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"XDG_DATA_HOME="+filepath.Join(home, ".local", "share"),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("zsh failed: %v\n%s", err, out)
	}

	logBytes, err := os.ReadFile(filepath.Join(shellDir, "history.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if !strings.Contains(string(logBytes), "\tzsh\t") {
		t.Errorf("log missing zsh shell marker: %s", logBytes)
	}
	if !strings.Contains(string(logBytes), "echo hello") {
		t.Errorf("log missing command: %s", logBytes)
	}
}
```

- [ ] **Step 3: Run**

Run: `go test ./internal/tracker/shellplugin -v`
Expected: PASS (skipping zsh test on systems without zsh installed).

- [ ] **Step 4: Commit**

```bash
git add internal/tracker/shellplugin/
git commit -m "feat: zsh shell plugin"
```

---

## Task 11: Fish plugin

**Files:**
- Modify: `internal/tracker/shellplugin/embed/traq.fish`
- Create: `internal/tracker/shellplugin/plugin_fish_test.go`

- [ ] **Step 1: Write the fish plugin**

Replace `internal/tracker/shellplugin/embed/traq.fish`:

```fish
# Traq shell integration for fish.

if set -q __TRAQ_LOADED
    return
end
set -g __TRAQ_LOADED 1

set -g __traq_dir (test -n "$XDG_DATA_HOME"; and echo "$XDG_DATA_HOME/traq/shell"; or echo "$HOME/.local/share/traq/shell")
set -g __traq_marker "$__traq_dir/enabled"
set -g __traq_log "$__traq_dir/history.log"
set -g __traq_overflow "$__traq_dir/overflowed"
set -g __traq_max_bytes 10485760

function __traq_preexec --on-event fish_preexec
    set -g __traq_cmd $argv[1]
    set -g __traq_start (date +%s%N)
end

function __traq_postexec --on-event fish_postexec
    set -l exit_code $status
    test -f $__traq_marker; or return

    if test -f $__traq_log
        set -l size (wc -c < $__traq_log 2>/dev/null | string trim)
        if test -n "$size"; and test $size -gt $__traq_max_bytes
            touch $__traq_overflow
            return
        end
    end

    set -l duration_ms 0
    if set -q __traq_start
        set -l end (date +%s%N)
        set duration_ms (math "($end - $__traq_start) / 1000000")
    end

    set -l tmux_ctx "-"
    if set -q TMUX
        set -l s (tmux display-message -p '#S' 2>/dev/null)
        set -l w (tmux display-message -p '#I' 2>/dev/null)
        test -n "$s"; and test -n "$w"; and set tmux_ctx "$s:$w"
    end

    set -l hostname (hostname -s 2>/dev/null; or echo "-")

    # Escape: \ -> \\, then tab -> \t, newline -> \n
    set -l cmd $__traq_cmd
    set cmd (string replace -a '\\' '\\\\' -- $cmd)
    set cmd (string replace -a \t '\\t' -- $cmd)
    set cmd (string replace -a \n '\\n' -- $cmd)
    if test (string length -- $cmd) -gt 4000
        set cmd (string sub -l 4000 -- $cmd)"…"
    end

    mkdir -p $__traq_dir
    printf '1\t%s\t%s\t%s\t%s\t%s\t%s\tfish\t%s\n' \
        (date +%s) $exit_code $duration_ms $PWD $tmux_ctx $hostname $cmd \
        >> $__traq_log
end
```

- [ ] **Step 2: Add behavior test**

Create `internal/tracker/shellplugin/plugin_fish_test.go`:

```go
//go:build !windows

package shellplugin

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestFishPlugin_WritesLogLine(t *testing.T) {
	if _, err := exec.LookPath("fish"); err != nil {
		t.Skip("fish not installed")
	}

	home := t.TempDir()
	shellDir := filepath.Join(home, ".local", "share", "traq", "shell")
	if err := os.MkdirAll(shellDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(shellDir, "enabled"), []byte{}, 0600); err != nil {
		t.Fatal(err)
	}

	pluginPath := filepath.Join(home, "plugin.fish")
	script, err := Script(Fish)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command("fish", "--no-config", "-c",
		`source $argv[1]; emit fish_preexec "echo hello"; emit fish_postexec "echo hello"`,
		pluginPath)
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"XDG_DATA_HOME="+filepath.Join(home, ".local", "share"),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("fish failed: %v\n%s", err, out)
	}

	logBytes, err := os.ReadFile(filepath.Join(shellDir, "history.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if !strings.Contains(string(logBytes), "\tfish\t") {
		t.Errorf("log missing fish shell marker: %s", logBytes)
	}
}
```

- [ ] **Step 3: Commit**

```bash
git add internal/tracker/shellplugin/
git commit -m "feat: fish shell plugin"
```

---

## Task 12: PowerShell plugin

**Files:**
- Modify: `internal/tracker/shellplugin/embed/Traq.ps1`

- [ ] **Step 1: Write the PowerShell plugin**

Replace `internal/tracker/shellplugin/embed/Traq.ps1`:

```powershell
# Traq shell integration for PowerShell.

if ($global:__TRAQ_LOADED) { return }
$global:__TRAQ_LOADED = $true

$script:__traq_dir = if ($env:XDG_DATA_HOME) {
    Join-Path $env:XDG_DATA_HOME 'traq\shell'
} else {
    Join-Path $env:APPDATA 'traq\shell'
}
$script:__traq_marker  = Join-Path $__traq_dir 'enabled'
$script:__traq_log     = Join-Path $__traq_dir 'history.log'
$script:__traq_overflow = Join-Path $__traq_dir 'overflowed'
$script:__traq_max_bytes = 10485760
$script:__traq_start = 0
$script:__traq_cmd = $null

function __Traq-PreInvoke {
    param($Command)
    $script:__traq_cmd = $Command
    $script:__traq_start = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
}

function __Traq-Escape([string]$s) {
    $s = $s -replace '\\', '\\'
    $s = $s -replace "`t", '\t'
    $s = $s -replace "`n", '\n'
    if ($s.Length -gt 4000) { $s = $s.Substring(0, 4000) + '…' }
    return $s
}

function __Traq-Record {
    param([int]$ExitCode)
    if (-not (Test-Path $script:__traq_marker)) { return }

    if (Test-Path $script:__traq_log) {
        $size = (Get-Item $script:__traq_log).Length
        if ($size -gt $script:__traq_max_bytes) {
            New-Item -Path $script:__traq_overflow -ItemType File -Force | Out-Null
            return
        }
    }

    $end = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    $durationMs = if ($script:__traq_start) { $end - $script:__traq_start } else { 0 }

    $tmuxCtx = '-'
    if ($env:TMUX) {
        $s = (tmux display-message -p '#S') 2>$null
        $w = (tmux display-message -p '#I') 2>$null
        if ($s -and $w) { $tmuxCtx = "${s}:${w}" }
    }

    $hostName = try { [System.Net.Dns]::GetHostName() } catch { '-' }
    $cwd = (Get-Location).Path
    $ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $cmdEscaped = __Traq-Escape $script:__traq_cmd

    if (-not (Test-Path $script:__traq_dir)) {
        New-Item -Path $script:__traq_dir -ItemType Directory -Force | Out-Null
    }
    $line = "1`t${ts}`t${ExitCode}`t${durationMs}`t${cwd}`t${tmuxCtx}`t${hostName}`tpowershell`t${cmdEscaped}"
    Add-Content -Path $script:__traq_log -Value $line -Encoding UTF8
}

# Hook via prompt function override (simplest cross-version approach).
$__traq_prompt_original = (Get-Item function:prompt).ScriptBlock
function global:prompt {
    $ec = $LASTEXITCODE
    if ($script:__traq_cmd) {
        __Traq-Record -ExitCode ([int]($ec -is [int] ? $ec : 0))
        $script:__traq_cmd = $null
    }
    $hist = Get-History -Count 1
    if ($hist) {
        __Traq-PreInvoke $hist.CommandLine
    }
    & $__traq_prompt_original
}
```

- [ ] **Step 2: Commit**

```bash
git add internal/tracker/shellplugin/
git commit -m "feat: PowerShell shell plugin"
```

---

## Task 13: Overflow sentinel handling in UI

**Files:**
- Modify: `internal/service/shellsetup.go` (add `DismissOverflow()` and wire into app.go)
- Modify: `app.go`
- Modify: `frontend/src/api/client.ts`, `hooks.ts`
- Modify: `frontend/src/components/settings/ShellIntegrationStrip.tsx`

- [ ] **Step 1: Add service method**

In `internal/service/shellsetup.go`:

```go
func (s *ShellSetupService) DismissOverflow() error {
	if err := os.Remove(s.overflowPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
```

- [ ] **Step 2: Wails binding**

In `app.go`:

```go
func (a *App) DismissShellOverflow() error {
	return a.ShellSetup.DismissOverflow()
}
```

Regenerate bindings.

- [ ] **Step 3: Frontend hook**

In `frontend/src/api/hooks.ts`:

```ts
export function useDismissShellOverflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => DismissShellOverflow(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shellSetup'] }),
  });
}
```

- [ ] **Step 4: UI banner**

In `ShellIntegrationStrip.tsx`, when `status.overflowed` is true show a dismissible warning banner above the status strip using the hook from step 3.

- [ ] **Step 5: Commit**

```bash
git add internal/service/ app.go frontend/
git commit -m "feat: dismissible overflow banner for shell plugin log"
```

---

## Task 14: E2E + manual verification

**Files:**
- Create: `frontend/e2e/tests/shell-integration.spec.ts`

- [ ] **Step 1: Write Playwright E2E**

Create `frontend/e2e/tests/shell-integration.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Shell integration', () => {
  test('install flow flips pill from Not installed to Active', async ({ page }) => {
    await page.goto('http://localhost:34115/#/settings');
    await page.getByText('Data Sources').click();
    await page.getByText('Shell History').click();

    const strip = page.locator('text=Shell integration').locator('..').locator('..');
    await expect(strip.getByText('Not installed')).toBeVisible();

    await strip.getByRole('button', { name: 'Install plugin' }).click();
    await expect(strip.getByText('Active')).toBeVisible({ timeout: 10000 });
  });
});
```

- [ ] **Step 2: Run the E2E**

In one terminal: `wails dev -tags webkit2_41`
In another: `cd frontend && npx playwright test shell-integration.spec.ts`

Expected: PASS (with the caveat that `wails dev` must be running).

- [ ] **Step 3: Manual verification checklist**

Document these in a short `docs/plans/2026-04-21-shell-plugin-integration-manual-test.md` — run each before merging:

1. **Bash + tmux on Ubuntu:** install via UI, open two tmux panes, run different commands in each; confirm both appear in Traq's Shell History within ~10 seconds.
2. **Zsh on macOS:** same flow with zsh.
3. **Fish:** same flow.
4. **PowerShell on Windows:** install, run a few commands, verify capture.
5. **Upgrade path:** with Shell History already enabled via file-reading, install plugin. Run 3 commands. Confirm no duplicates in Traq (spot-check by timestamp + command).
6. **Uninstall:** capture rc file hash (`sha256sum ~/.bashrc`), install, uninstall, re-hash. Confirm byte-identical. Confirm `~/.local/share/traq/shell/plugin.bash` no longer exists.
7. **Toggle capture:** install, disable Shell History in Settings, run 5 commands, re-enable. Confirm 5 commands are NOT captured (marker-gating works).
8. **Overflow:** disable Shell History but keep plugin installed, write >10 MB of junk commands (in a loop), re-enable. Confirm banner appears; dismiss it.

- [ ] **Step 4: Final commit**

```bash
git add frontend/e2e/tests/shell-integration.spec.ts docs/plans/2026-04-21-shell-plugin-integration-manual-test.md
git commit -m "test: E2E + manual verification plan for shell plugin integration"
```

---

## Post-implementation

- [ ] Run full test suites:
  - `go test ./...`
  - `cd frontend && npm test`
  - `cd frontend && npx tsc --noEmit`
- [ ] `wails build -tags webkit2_41` succeeds
- [ ] Run the manual verification checklist end-to-end on at least one Linux machine with tmux
- [ ] Update `docs/guide/settings.md` or equivalent user-facing docs with a short "Shell integration" paragraph
- [ ] Open PR referencing this plan and the design doc
