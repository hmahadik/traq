# Shell Plugin Integration — Design

**Date:** 2026-04-21
**Status:** Design approved, ready for implementation plan

## Problem

Traq captures shell history by polling the user's native history file (`~/.bash_history`, `~/.zsh_history`, etc.). Two bash defaults make this unreliable under tmux and multi-terminal use:

1. Bash only flushes its in-memory history to disk when the session exits. Commands run in a live tmux pane are invisible to Traq until that pane closes.
2. When a session does exit, bash overwrites `~/.bash_history` by default. In tmux with multiple panes, only the last pane to close preserves its history — the rest are lost.

The result: users running Traq inside tmux (which overlaps strongly with the power-user/developer audience) see sparse, incomplete, or empty shell-history data.

Additionally, the native history format carries minimal metadata. No current working directory, no exit code, no duration, no tmux context — information that would meaningfully improve session correlation and activity analysis.

## Goal

Ship a Traq-managed shell plugin that captures commands in real time across all terminals (including every tmux pane) and enriches them with context the native history files don't carry. Preserve today's file-reading path as a fallback so existing users aren't broken.

## Non-goals

- Capturing command *output* (not commands). Out of scope; substantially more invasive.
- Capturing environment variables or shell state beyond CWD, exit code, duration, and tmux context.
- Real-time streaming via socket/daemon. A simple append-only log with polling is sufficient at Traq's capture granularity.
- Replacing the user's history file or interfering with their normal shell history UX.

## Approach

A Traq-managed shell plugin, sourced from the user's shell rc file via a single `source` line, writes each executed command to a dedicated Traq log file (`~/.local/share/traq/shell/history.log`) as a structured TSV. Traq ingests from this log on its existing polling tick, then truncates it.

When the plugin log is present, Traq reads from it. When absent, Traq falls back to the existing native-history-file parser. This preserves behavior for users who don't install the plugin and gives power users a strict upgrade.

Plugin activity is gated by a marker file (`~/.local/share/traq/shell/enabled`). Toggling Shell History off deletes the marker; the plugin stays installed but becomes a zero-cost early-return until the marker reappears. This avoids churn on the user's rc file when toggling the feature.

Supported shells at v1: bash, zsh, fish, PowerShell (matches current tracker coverage).

## Architecture

### New components

**`internal/tracker/shellplugin/embed/`** — shell plugin files embedded in the Go binary via `//go:embed`:
- `traq.bash` — hooks `PROMPT_COMMAND`
- `traq.zsh` — hooks `precmd` / `preexec`
- `traq.fish` — hooks the `fish_postexec` event
- `Traq.ps1` — overrides the prompt function

Each plugin:
1. Returns immediately if `~/.local/share/traq/shell/enabled` is missing.
2. Captures: exit code, duration, CWD, tmux context (`$TMUX` session/window, or `-`), hostname, shell type, command.
3. Appends one TSV line to `~/.local/share/traq/shell/history.log` atomically.
4. Stops appending and writes a sentinel file (`shell/overflowed`) if the log exceeds 10 MB.

**`internal/service/shellsetup.go`** — install/uninstall/status service exposed to the frontend:
- `GetShellSetupStatus() -> { shell, pluginInstalled, markerPresent, rcPath, sourceLinePresent, overflowed }`
- `InstallShellPlugin(shell)` — writes plugin file, appends fenced source block to rc file, creates marker
- `UninstallShellPlugin(shell)` — strips fenced block from rc file, deletes plugin + marker

**`internal/tracker/plugin_log.go`** — parser and ingester for the Traq log:
- Parses TSV format (version marker first byte, tab-separated fields).
- Unescapes `\t` / `\n` sequences in the command field.
- Applies exclude patterns from `ShellTracker`.
- Inserts into `shell_commands` with new columns populated.
- Truncates the log file after successful ingest.

### Modified components

**`internal/tracker/shell.go`** — `Poll()` becomes:
1. Check for `shell/history.log`; if present and non-empty, ingest via `plugin_log.go`.
2. Otherwise (or if the log is empty), run the existing `parseHistory()` on the native history file.
3. Exclude-pattern logic stays centralized in `ShellTracker` and is applied to both sources.

Native-history checkpointing continues to advance regardless of which source was read, so a user who toggles Shell History or installs the plugin later doesn't re-ingest their entire native history.

**`internal/storage/migrations.go`** — bump `schemaVersion` from 12 to 13 and add an idempotent `ALTER TABLE` call (matching the existing Traq migration pattern — direct `s.db.Exec` with `pragma_table_info` guards, not up/down migrations). The `shell_commands` table already carries `working_directory`, `exit_code`, `duration_seconds`, and `hostname`; those fields simply aren't populated by today's native-history parser. Only one new column is needed:

```sql
ALTER TABLE shell_commands ADD COLUMN tmux_context TEXT;
```

**`internal/storage/models.go`** — `ShellCommand` gains `TmuxContext sql.NullString`. The existing `WorkingDirectory`, `ExitCode`, `DurationSeconds`, and `Hostname` fields are reused and start getting populated by the plugin-log path.

**`app.go`** — three new Wails bindings: `GetShellSetupStatus`, `InstallShellPlugin`, `UninstallShellPlugin`.

**`frontend/src/components/settings/sections/DataSourcesSettings.tsx`** — new "Shell integration" status strip inside the existing Shell History card.

## Data format

**Log path:** `~/.local/share/traq/shell/history.log` (cross-platform: `DataDir() / shell / history.log`).

**Line format:**

```
<version>\t<unix_ts>\t<exit_code>\t<duration_ms>\t<cwd>\t<tmux_ctx>\t<hostname>\t<shell>\t<command>\n
```

- `version` = `1` for the initial format. Lines with unknown versions are skipped, not errors.
- `tmux_ctx` = `<session>:<window>` when `$TMUX` is set, else `-`.
- Tabs and newlines in the command field are escaped as `\t` and `\n` so each command occupies exactly one log line.
- Single `printf >> file` write; lines under 4 KB are atomic on Linux (`PIPE_BUF`). Commands longer than 4 KB are truncated with a trailing `…` marker.

**Rotation:** Traq truncates the file to zero length after each successful ingest batch. Bounded size regardless of ingest cadence.

**Overflow:** plugin stops appending and touches `shell/overflowed` when the log exceeds 10 MB. Traq ingests what's present, clears the sentinel, and surfaces a dismissible banner in the UI noting a gap.

**File permissions:** plugin file and log file are created mode `0600`. On Windows, equivalent ACLs restrict to the current user.

## Storage layout

```
~/.local/share/traq/
├── shell/
│   ├── plugin.bash          (installed when bash plugin is active)
│   ├── plugin.zsh           (installed when zsh plugin is active)
│   ├── plugin.fish          (installed when fish plugin is active)
│   ├── plugin.ps1           (installed when PowerShell plugin is active)
│   ├── enabled              (marker; present iff Shell History is on)
│   ├── history.log          (the ingest buffer)
│   └── overflowed           (sentinel; only present after plugin hit size cap)
├── shell_checkpoint.json    (existing; continues to track native-history offset)
├── traq.db                  (existing)
└── …
```

Uninstall is `rm -rf ~/.local/share/traq/shell/` plus removing the fenced source block from the user's rc file.

## Setup UX

New status strip inside the Shell History card in `DataSourcesSettings.tsx`, visible whenever Shell History is enabled:

| State | Trigger | Helper text | Actions |
|---|---|---|---|
| Not installed | no source line in rc | "Install the Traq plugin for real-time capture across tmux and multiple terminals." | Install plugin |
| Active | source line + marker + recent log activity | "Active. Capturing commands from all shells." | Uninstall |
| Installed (disabled) | source line present, marker missing | "Plugin installed but idle. Enable Shell History to resume." | Uninstall |
| Needs attention | source line present, plugin file missing, or overflow sentinel present | Tailored message | Reinstall, Uninstall, Dismiss banner |

**Install action:**
1. Detect shell (use configured `shellType`; fall back to `$SHELL`).
2. Write plugin file to `~/.local/share/traq/shell/plugin.<shell>` at mode `0600`.
3. Locate rc file: `~/.bashrc` / `~/.zshrc` / `~/.config/fish/config.fish` / PowerShell `$PROFILE`. Create with intermediate directories if missing.
4. Append fenced block:
   ```
   # >>> traq shell integration >>>
   # Managed by Traq. Do not edit between these fences.
   [ -f "$HOME/.local/share/traq/shell/plugin.bash" ] && . "$HOME/.local/share/traq/shell/plugin.bash"
   # <<< traq shell integration <<<
   ```
5. Create marker file.
6. Show toast: "Installed. Open a new terminal or run `source ~/.bashrc` to activate."

**Uninstall action:** confirm dialog, strip fenced block from rc file (atomic: temp file + rename), delete plugin file, delete marker. If fences can't be found, refuse to edit and tell the user to remove the `source` line manually.

**No auto-install on toggle.** Enabling Shell History without installing the plugin leaves Traq in fallback mode and surfaces the Install button as a recommendation, not a requirement.

## Privacy & security

**Exclusion happens on ingest, not in the plugin.** The plugin stays minimal — no regex engine, no config to sync. `ShellTracker`'s existing exclude-pattern logic (built-in `password|passwd|secret|token|key=|api_key|apikey|auth` plus trivial-command filter plus user-defined patterns) is applied uniformly to both plugin-log and native-history sources.

**Tradeoff:** sensitive commands briefly land on disk in `history.log` before rotation. Mitigations:
- Plugin file and log file created mode `0600` (ACL-equivalent on Windows).
- Traq polls the log on the existing daemon tick cadence; "briefly" is seconds.
- Truncation after successful ingest means excluded commands are dropped during parse and never reach SQLite.

A future iteration can push exclude patterns into the plugin itself (plugin-side allow/deny) for users who want stronger pre-disk guarantees. Out of scope for v1.

**Uninstall is a true uninstall.** Fence-based edit is atomic (temp file + rename). If fences are missing, the edit is refused rather than risking dotfile corruption.

## Edge cases

- **Rc file missing:** create with just the fenced block and intermediate directories.
- **Rc file unreadable:** surface exact error in UI, show the fenced block as copy-pasteable so the user can apply manually.
- **Fenced block already present (reinstall):** replace between fences, don't duplicate.
- **Fence present but plugin file missing:** "Needs attention" state; reinstall recreates plugin file only.
- **Multiple shells per user:** status card shows each detected shell with its own state; install is per-shell.
- **Log line corruption:** unparseable lines are skipped (logged to Traq's log for debugging); ingest continues.
- **Log overflow:** sentinel file triggers a dismissible banner noting the gap.
- **Plugin sourced without marker:** plugin early-returns on first line; zero cost.
- **Tmux not in use:** `$TMUX` unset, `tmux_ctx` field = `-`.
- **Shell restart needed after install:** UI explicitly instructs user to open a new terminal or `source` the rc file. No attempt to inject into running shells.
- **Atomic rc-file writes:** write to `<rc>.traq.tmp` with matching permissions, then `os.Rename`.

## Testing

### Unit — `internal/service/shellsetup_test.go`

- Install into empty HOME → rc file created with fenced block, plugin + marker exist at mode `0600`.
- Install twice → no duplicate fenced block.
- Install when fence exists but plugin file missing → plugin file restored, fence untouched.
- Uninstall → fence region removed, plugin + marker deleted, surrounding rc file content byte-identical.
- Uninstall with missing fences → refuses edit, returns explicit error.
- Atomic write: inject fs error mid-write → original rc file intact.
- State detection: each of the four states returns the correct status struct.

### Unit — `internal/tracker/plugin_log_test.go`

- Parse well-formed TSV line with all fields populated.
- Parse line with `-` tmux context → `tmux_context` NULL.
- Parse line with escaped tabs/newlines in command → correctly unescaped.
- Parse line with unknown version marker → skipped, no error.
- Truncation: write N lines, ingest, verify file size is 0.
- Exclude patterns applied against the new format.

### Integration — `internal/tracker/shell_integration_test.go`

- Plugin log present → reads from plugin log, native history file untouched.
- Plugin log absent → falls back to native history file (existing behavior preserved).
- Both present → plugin log ingested, native-history checkpoint still advanced (so re-enable later doesn't re-ingest old commands).

### Shell-plugin behavior — `internal/tracker/shellplugin/plugin_test.go`

For each embedded plugin (bash, zsh, fish, PowerShell): spawn the shell in an isolated HOME, source the plugin, run a few commands, assert log file contents match expected format. Gated by build tag and `t.Skip` when shell binary is absent.

### E2E — `frontend/e2e/tests/shell-integration.spec.ts`

- Navigate to Settings → Data Sources → Shell History.
- Assert "Not installed" pill visible.
- Click "Install plugin" → toast, pill flips to "Active" (mocked status in test mode).
- Click "Uninstall" → confirm dialog, pill flips back to "Not installed".

### Manual test plan

- Fresh install on Ubuntu bash + tmux: verify commands across multiple panes captured in real time.
- Install on macOS zsh.
- Install on Windows PowerShell.
- Upgrade path: existing Shell History user installs plugin → no duplicate commands, no gaps around transition.
- Uninstall path: `diff` pre-install and post-uninstall `~/.bashrc` → byte-identical modulo the fenced region.

## Migration

- **Existing users on file-reading mode:** continue working unchanged. No prompt, no forced install. Status strip shows "Not installed" with a soft recommendation.
- **New install columns are nullable:** file-parsed commands leave them NULL; no backfill needed.
- **Schema migration:** bumps `schemaVersion` to 13 and adds one nullable `tmux_context` column to `shell_commands`. Forward-only, matching the existing Traq convention. Re-run safe (the codebase already has precedent for idempotent `ALTER TABLE` repair passes).

## Future extensions (not in v1)

- Plugin-side exclude patterns for pre-disk filtering.
- Richer tmux integration (pane ID, current command in each pane).
- Capture shell startup/exit events for session correlation.
- Socket-based streaming for sub-second latency (if ever needed).
- Backfill: parse existing native history files for CWD via `$OLDPWD`-like heuristics (probably not worth it).
