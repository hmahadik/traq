# AI Coding Data Source — Design

**Date:** 2026-04-23
**Status:** Approved for plan-writing
**Scope:** Add Claude Code and opencode as first-class data sources in Traq, rendering on the timeline alongside existing shell/git/browser/file lanes.

---

## Goals

1. Show when the user was engaged with Claude Code / opencode on the daily timeline.
2. Group activity per tool + session + project, with concurrent sessions rendered as stacked blocks.
3. Keep v1 minimal: **no transcript storage by default**, no cost/analytics page, no new AFK inputs.

## Non-goals (v1)

- Storing assistant responses, tool-call arguments, diffs, token counts, or cost.
- User-prompt text is stored **only when the user opts in** via Settings → Data Sources → AI Coding → "Store prompt text" (default off). When off, the timeline shows user-prompt markers at their timestamps but no text bodies land in the DB. When on, prompt previews become available in the events list; the toggle takes effect on next app restart.
- Dedicated AI analytics / usage page.
- Feeding AI events into AFK / focus-time detection.
- Cross-tool correlation (matching a Claude session to an opencode session in the same repo).
- Prompt search or full-text indexing.
- Live streaming updates (poll loop is sufficient).

---

## Architecture

### Package layout

```
internal/tracker/
├── ai.go                       # AITracker: poll plugins, write events, upsert ai_sessions
└── aiplugin/
    ├── plugin.go               # AIPlugin interface + shared AIEvent struct
    ├── plugin_claude.go        # tail JSONL files in ~/.claude/projects/
    ├── plugin_opencode.go      # query ~/.local/share/opencode/opencode.db
    └── testdata/               # fixture JSONLs and fixture SQLite dbs

internal/service/
└── ai.go                       # ListAISessions, GetAISession, GetAIActivityForDay

internal/storage/
└── ai.go                       # CRUD for ai_sessions, ai_events
```

The tracker runs on the same poll loop as `ShellTracker` (`internal/tracker/daemon.go`). `AITracker` iterates its registered plugins, each of which returns new `AIEvent`s since its last cursor, and writes rows.

### Plugin interface

```go
package aiplugin

type AIEvent struct {
    Tool       string    // "claude" | "opencode"
    SessionID  string
    ProjectDir string    // resolved cwd, "" if unknown
    Timestamp  time.Time
    Kind       string    // "user_prompt" | "assistant_turn" | "tool_use"
    FilePath   string    // source JSONL path (claude) or "" (opencode)
}

type AIPlugin interface {
    Name() string                                // "claude" | "opencode"
    Available() bool                             // skip if tool's data dir isn't present
    Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error)
}
```

Each plugin is responsible for its own resumption logic (see Data Model → cursoring).

---

## Data Model

Migration 9 (schema version after current head):

```sql
CREATE TABLE ai_sessions (
    id              TEXT PRIMARY KEY,            -- tool's native session ID
    tool            TEXT NOT NULL,               -- 'claude' | 'opencode'
    project_dir     TEXT,                        -- absolute path, may be NULL
    file_path       TEXT,                        -- JSONL path (claude), NULL (opencode)
    started_at      INTEGER NOT NULL,            -- unix epoch seconds
    last_event_at   INTEGER NOT NULL,
    event_count     INTEGER NOT NULL DEFAULT 0,
    source_offset   INTEGER NOT NULL DEFAULT 0   -- bytes consumed from file_path
);
CREATE INDEX idx_ai_sessions_last_event ON ai_sessions(last_event_at);

CREATE TABLE ai_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id   TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
    tool         TEXT NOT NULL,
    kind         TEXT NOT NULL,
    timestamp    INTEGER NOT NULL,
    project_dir  TEXT
);
CREATE INDEX idx_ai_events_ts      ON ai_events(timestamp);
CREATE INDEX idx_ai_events_session ON ai_events(session_id);
```

### Cursoring (resume logic)

No separate checkpoint file. Each plugin derives its cursor from the DB:

- **Claude plugin.** Each JSONL file maps 1:1 to a session. Per poll: list all `~/.claude/projects/*/*.jsonl`. For each file, `SELECT source_offset FROM ai_sessions WHERE file_path = ?`, `Seek()` there, parse to EOF, write new events, `UPDATE ai_sessions SET source_offset = <new_pos>, last_event_at = ..., event_count = ...`. New files (no row) start at offset 0 and trigger an INSERT.
- **opencode plugin.** Resume by `SELECT COALESCE(MAX(timestamp), 0) FROM ai_events WHERE tool = 'opencode'`. Query `opencode.db` for rows newer than that. Upsert `ai_sessions` rows from the result. No offset needed — the event table is the cursor.

Self-healing: deleting Traq's DB triggers a full re-ingest on next poll. Deleting a source JSONL leaves orphan `ai_sessions` / `ai_events`; the session is marked "ended" because `file_path` no longer resolves on next poll (no further offset advances possible).

### Relationship to existing `sessions`

No foreign key. `ai_sessions` is a parallel activity track alongside `git_events`, `shell_commands`, `browser_visits`. Overlap between an AI session and Traq's work sessions is computed at query time via timestamp range.

### Relationship to activity/AFK

AI events **do not** feed `AFKDetector`, `SessionManager`, or any `DayStats` field (`TotalSeconds`, `LongestFocus`, `BreakCount`). An autonomous agent running while the user is AFK does not extend focus time. AI data is a **display-only** lane. Window focus continues to be the sole human-presence signal.

---

## Timeline block derivation

Blocks are computed on read (same pattern as `ShellEvents`/`GitEvents` in `timeline_grid.go`), never materialized.

### Algorithm (per day, in `service/ai.go`)

```
events := SELECT * FROM ai_events
           WHERE timestamp BETWEEN <day_start> AND <day_end>
           ORDER BY tool, session_id, timestamp

for each (tool, session_id) group:
    start a new block with first event
    for each subsequent event:
        gap := event.ts - prev.ts
        if gap > IdleGapSeconds AND NOT session_is_live_mtime_check():
            close current block; start new block
        else:
            extend current block to event.ts
    close final block

pad each block's end by 30s so single-event blocks are visible
bucket blocks by hour for the grid (split blocks crossing hour boundaries)
```

### Idle-gap policy

- Default `IdleGapSeconds = 1800` (30 min). Configurable in settings.
- **Live-file rescue:** during derivation, for Claude sessions only, before splitting on a large gap between the last event and "now," `os.Stat` the JSONL. Concretely: if `time.Now() - mtime < IdleGapSeconds / 3`, the file was written to recently — treat the session as still live and do not split. This catches the "one long tool call, no intermediate events" case.
- opencode has no equivalent file to stat; it relies on the threshold alone. Acceptable because opencode's DB writes are more granular.

### Concurrent sessions

Grouping by `session_id` before splitting produces independent block sequences per session. The frontend stacks overlapping blocks vertically within the single AI lane (decision: option A+D — one tool-agnostic lane with a tool icon per block).

---

## Service / API surface

### Service (`internal/service/ai.go`)

```go
func (s *Service) ListAISessions(date string) ([]AISessionDisplay, error)
func (s *Service) GetAISession(id string) (*AISessionDetail, error)
func (s *Service) GetAIActivityForDay(date string) (map[int][]AIBlockDisplay, error)
```

### Display types

```go
type AIBlockDisplay struct {
    Tool        string `json:"tool"`
    SessionID   string `json:"sessionId"`
    ProjectDir  string `json:"projectDir"`
    ProjectName string `json:"projectName"`
    StartTime   int64  `json:"startTime"`
    EndTime     int64  `json:"endTime"`
    EventCount  int    `json:"eventCount"`
    IsLive      bool   `json:"isLive"`
}

type AISessionDisplay struct {
    ID            string `json:"id"`
    Tool          string `json:"tool"`
    ProjectName   string `json:"projectName"`
    ProjectDir    string `json:"projectDir"`
    StartedAt     int64  `json:"startedAt"`
    LastEventAt   int64  `json:"lastEventAt"`
    EventCount    int    `json:"eventCount"`
}

type AISessionDetail struct {
    AISessionDisplay
    FilePath string `json:"filePath"` // for "open raw transcript"
}
```

### Wails bindings (`app.go`)

```go
func (a *App) ListAISessions(date string) ([]service.AISessionDisplay, error)
func (a *App) GetAISession(id string)      (*service.AISessionDetail, error)
```

`GetTimelineGridData` gains the new map via `TimelineGridData.AIEvents` — no new method needed for the grid itself.

### TimelineGridData extension

```go
type TimelineGridData struct {
    // ...existing fields...
    AIEvents map[int][]AIBlockDisplay `json:"aiEvents"` // hour -> AI blocks
}
```

### Categorization

AI activity is reported as its own category `"ai_coding"` in analytics breakdowns, parallel to the existing `Focus` / `Meetings` / `Comms` / `Other` buckets. Implementation: extend whatever existing mechanism populates `DayStats.Breakdown` (currently derived from app categories via `service/appnames.go`) to also surface AI duration under this dedicated key, so AI activity does not distort existing categories. Exact integration point to be determined during plan-writing by reading the current breakdown code.

---

## Frontend

- `frontend/src/api/client.ts` — add `api.ai.list(date)`, `api.ai.get(id)`.
- `frontend/src/api/hooks.ts` — add `useAISessions(date)`, `useAISession(id)`.
- `frontend/src/components/timeline/AIEventsLane.tsx` — new lane component modeled on `ShellEventsLane`/`GitEventsLane`. Colors blocks by `projectName`, tool-icon per block (Claude vs opencode), stacks overlapping blocks vertically.
- Click a block → drawer with session metadata (tool, project, start/end, event count, file path) and a "Reveal in file manager" action for the JSONL path.
- No new page. Lives inside the existing Timeline grid.

---

## Settings

Extend `internal/service/config.go`:

```go
type AITrackingConfig struct {
    Enabled         bool `json:"enabled"`          // default true
    ClaudeEnabled   bool `json:"claudeEnabled"`    // default true if dir exists
    OpenCodeEnabled bool `json:"openCodeEnabled"`  // default true if dir exists
    IdleGapSeconds  int  `json:"idleGapSeconds"`   // default 1800
}
```

New settings panel `frontend/src/components/settings/AITrackingSection.tsx`:
- Master toggle.
- Per-tool toggles, auto-disabled when the on-disk data dir is not present.
- Slider for idle gap seconds.

---

## Privacy

- **By default**, only timestamps and structural fields are read (`type`, `sessionId`, `cwd`). Tool-call arguments, diffs, and assistant responses are never stored regardless of settings.
- **User-prompt text** is stored only when the `storePromptContent` setting is explicitly enabled. When off (default), the `ai_events.content` column stays NULL for every row; the `kind="user_prompt"` marker is still written so the timeline can display a prompt icon at the right timestamp, but no text body.
- When `storePromptContent` is on, prompt text is captured at mode 0600 into the Traq SQLite database. It never leaves the machine, but anyone with read access to `traq.db` can read verbatim prompt history — the Settings UI makes this explicit before the toggle is flipped.
- Source files stay in place; we store paths as references, never copies. Paths are kept internal to the Go layer and omitted from Wails bindings (`AISessionDetail.FilePath` has `json:"-"`).
- Deleting Traq's DB purges all AI-derived data.
- No network I/O anywhere in the AI pipeline.

---

## Testing

- **Unit — plugins.** Fixture JSONLs + fixture opencode SQLite in `internal/tracker/aiplugin/testdata/`. Each plugin's `Poll` is tested against:
  - empty dir / missing tool → returns no events, no error
  - single new file → full ingest
  - subsequent poll with appended lines → only new events returned
  - corrupt / truncated lines → skipped, error logged, cursor still advances
- **Integration — AITracker.** Seed a temp `~/.claude/projects/` dir, run two polls, assert rows in `ai_sessions` and `ai_events` and correct `source_offset` after each poll.
- **Service — block derivation** (`internal/service/ai_test.go`):
  - empty day
  - single burst (one block)
  - idle split at threshold (two blocks, same session_id)
  - long-mtime-active "don't split" case (one block)
  - concurrent sessions (two independent block sequences)
  - hour-boundary split for rendering
- **No new Playwright e2e in v1.** AI lane renders via the same grid mechanism covered by existing timeline e2e. Add a dedicated e2e in a follow-up.

---

## Open questions / deferred decisions

- Whether to feed `user_prompt` events into activity detection as a presence signal (currently excluded; window focus is considered sufficient).
- Whether to bridge `tool_use_start` → `tool_use_end` spans instead of relying on mtime rescue, once real-world accuracy can be measured.
- Whether to add a dedicated AI usage / analytics page — depends on whether the timeline lane alone proves sufficient in daily use.
- Per-project exclude list (e.g., "don't track sessions in `~/sandbox`").
