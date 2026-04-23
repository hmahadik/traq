# AI Coding Data Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest Claude Code and opencode session activity as a new timeline lane in Traq, following the existing "parallel event lane" pattern (shell/git/browser).

**Architecture:** Two source-specific plugins behind a common `AIPlugin` interface, an `AITracker` that polls them on the daemon's existing tick, SQLite-backed `ai_sessions` + `ai_events` tables, on-read block derivation (idle-gap + mtime rescue), a new `AIEvents` map on `TimelineGridData`, and a frontend lane that renders the blocks alongside shell/git events. No transcripts stored; no effect on AFK or focus-time metrics.

**Tech Stack:** Go 1.21+, SQLite (`database/sql`), Wails v2 bindings, React 18 + TypeScript, Vitest, Go `testing`.

**Spec:** `docs/superpowers/specs/2026-04-23-ai-coding-data-source-design.md`

---

## File Structure

**New files (backend):**
- `internal/storage/ai.go` — CRUD: `UpsertAISession`, `InsertAIEvents`, `GetAISessionByFilePath`, `GetAIEventsInRange`, `GetMaxAIEventTimestamp`, `ListAISessionsForDate`.
- `internal/storage/ai_test.go` — storage tests.
- `internal/tracker/aiplugin/plugin.go` — `AIPlugin` interface, `AIEvent` struct.
- `internal/tracker/aiplugin/plugin_claude.go` — Claude JSONL tailer.
- `internal/tracker/aiplugin/plugin_claude_test.go`
- `internal/tracker/aiplugin/plugin_opencode.go` — opencode SQLite reader.
- `internal/tracker/aiplugin/plugin_opencode_test.go`
- `internal/tracker/aiplugin/testdata/claude/<slug>/<session>.jsonl` — fixtures.
- `internal/tracker/aiplugin/testdata/opencode/opencode.db` — fixture SQLite.
- `internal/tracker/ai.go` — `AITracker` orchestration.
- `internal/tracker/ai_test.go` — integration test.
- `internal/service/ai.go` — `ListAISessions`, `GetAISession`, `GetAIActivityForDay` + display types + block derivation.
- `internal/service/ai_test.go` — block derivation tests.

**New files (frontend):**
- `frontend/src/components/timeline/AIEventsLane.tsx`
- `frontend/src/components/timeline/AIEventsLane.test.tsx`
- `frontend/src/components/settings/AITrackingSection.tsx`

**Modified files:**
- `internal/storage/migrations.go` — add `applyMigration15`, bump `schemaVersion` to 15.
- `internal/service/timeline_grid.go` — add `AIEvents` to `TimelineGridData`, populate from `GetAIActivityForDay`.
- `internal/service/config.go` — add `AITrackingConfig`, extend `DataSourcesConfig`.
- `internal/tracker/daemon.go` — instantiate `AITracker` in `NewDaemon`, call `ai.Poll()` in the tick loop.
- `app.go` — `ListAISessions`, `GetAISession` Wails bindings.
- `frontend/src/api/client.ts` — `api.ai.list`, `api.ai.get`.
- `frontend/src/api/hooks.ts` — `useAISessions`, `useAISession`.
- `frontend/src/components/timeline/useTimelineData.ts` — fold `aiEvents` into the view model.
- `frontend/src/components/timeline/EventList.tsx` (or wherever shell/git lanes render) — render `AIEventsLane`.
- `frontend/src/pages/SettingsPage.tsx` — mount `AITrackingSection`.

---

## Conventions Referenced

- **Migrations:** `internal/storage/migrations.go` uses per-function `applyMigrationN`, chained in `Migrate()`. Bump `schemaVersion` const. Follow the shape of `applyMigration14`.
- **Tracker registration:** see `internal/tracker/daemon.go:58` (`shell *ShellTracker` field), `daemon.go:89` (`NewShellTracker(...)` in `NewDaemon`), `daemon.go:373` (`d.shell.Poll(session.ID)` in the tick loop).
- **Service layer shapes:** service methods return plain-type display structs (no `sql.NullString`). See `internal/service/timeline.go` `ScreenshotDisplay`.
- **Wails bindings:** `app.go` — methods on `*App`. After adding, run `wails generate bindings` or let `wails dev` regenerate.
- **Frontend API client:** `frontend/src/api/client.ts` is a thin wrapper; `frontend/src/api/hooks.ts` wraps in React Query.
- **Frontend testing:** Vitest. Examples at `frontend/src/api/hooks.test.ts`, `frontend/src/components/timeline/useTimelineData.test.ts`.

---

## Phase 1 — Storage Layer

### Task 1: Migration 15 — ai_sessions and ai_events tables

**Files:**
- Modify: `internal/storage/migrations.go`

- [ ] **Step 1: Bump schemaVersion and add migration chain entry**

In `internal/storage/migrations.go`, change the constant:

```go
const schemaVersion = 15
```

And in `Migrate()`, after the existing `applyMigration14` block, add:

```go
	if currentVersion < 15 {
		if err := s.applyMigration15(); err != nil {
			return fmt.Errorf("migration 15 failed: %w", err)
		}
	}
```

- [ ] **Step 2: Implement applyMigration15**

Append to `internal/storage/migrations.go`:

```go
func (s *Store) applyMigration15() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS ai_sessions (
			id              TEXT PRIMARY KEY,
			tool            TEXT NOT NULL,
			project_dir     TEXT,
			file_path       TEXT,
			started_at      INTEGER NOT NULL,
			last_event_at   INTEGER NOT NULL,
			event_count     INTEGER NOT NULL DEFAULT 0,
			source_offset   INTEGER NOT NULL DEFAULT 0
		);
		CREATE INDEX IF NOT EXISTS idx_ai_sessions_last_event ON ai_sessions(last_event_at);
		CREATE INDEX IF NOT EXISTS idx_ai_sessions_file_path   ON ai_sessions(file_path);

		CREATE TABLE IF NOT EXISTS ai_events (
			id           INTEGER PRIMARY KEY AUTOINCREMENT,
			session_id   TEXT NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
			tool         TEXT NOT NULL,
			kind         TEXT NOT NULL,
			timestamp    INTEGER NOT NULL,
			project_dir  TEXT
		);
		CREATE INDEX IF NOT EXISTS idx_ai_events_ts      ON ai_events(timestamp);
		CREATE INDEX IF NOT EXISTS idx_ai_events_session ON ai_events(session_id);
		CREATE INDEX IF NOT EXISTS idx_ai_events_tool_ts ON ai_events(tool, timestamp);
	`)
	return err
}
```

- [ ] **Step 3: Run existing migration tests**

Run: `go test ./internal/storage/ -run TestMigrate -v`
Expected: PASS (no migration test may exist — if so, confirm the package still builds: `go build ./internal/storage/`).

- [ ] **Step 4: Verify migration from a fresh DB**

Add this targeted test to `internal/storage/ai_test.go` (create the file):

```go
package storage

import (
	"testing"
)

func TestMigration15CreatesAITables(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	var count int
	err := store.db.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master
		WHERE type='table' AND name IN ('ai_sessions','ai_events')
	`).Scan(&count)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 AI tables, got %d", count)
	}
}
```

Run: `go test ./internal/storage/ -run TestMigration15 -v`
Expected: PASS

(If `newTestStore` doesn't exist in this package, check `internal/storage/*_test.go` for the existing helper name — probably `NewTestStore` or similar — and swap it in.)

- [ ] **Step 5: Commit**

```bash
git add internal/storage/migrations.go internal/storage/ai_test.go
git commit -m "feat(storage): migration 15 adds ai_sessions and ai_events tables"
```

---

### Task 2: Storage CRUD — ai_sessions

**Files:**
- Create: `internal/storage/ai.go`
- Modify: `internal/storage/ai_test.go`

- [ ] **Step 1: Write failing tests for AISession CRUD**

Append to `internal/storage/ai_test.go`:

```go
func TestUpsertAISessionInsertsAndUpdates(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	s := &AISession{
		ID:          "sess-1",
		Tool:        "claude",
		ProjectDir:  "/home/u/repo",
		FilePath:    "/home/u/.claude/projects/-home-u-repo/sess-1.jsonl",
		StartedAt:   1700000000,
		LastEventAt: 1700000100,
		EventCount:  5,
		SourceOffset: 2048,
	}
	if err := store.UpsertAISession(s); err != nil {
		t.Fatalf("insert: %v", err)
	}

	got, err := store.GetAISessionByFilePath(s.FilePath)
	if err != nil || got == nil {
		t.Fatalf("get after insert: got=%v err=%v", got, err)
	}
	if got.EventCount != 5 || got.SourceOffset != 2048 {
		t.Fatalf("mismatched fields: %+v", got)
	}

	s.EventCount = 9
	s.SourceOffset = 4096
	s.LastEventAt = 1700000200
	if err := store.UpsertAISession(s); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, _ = store.GetAISessionByFilePath(s.FilePath)
	if got.EventCount != 9 || got.SourceOffset != 4096 {
		t.Fatalf("update did not apply: %+v", got)
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/storage/ -run TestUpsertAISession -v`
Expected: FAIL (compile error — `AISession`, `UpsertAISession`, `GetAISessionByFilePath` undefined).

- [ ] **Step 3: Implement the types and methods**

Create `internal/storage/ai.go`:

```go
package storage

import "database/sql"

type AISession struct {
	ID           string
	Tool         string
	ProjectDir   string
	FilePath     string
	StartedAt    int64
	LastEventAt  int64
	EventCount   int
	SourceOffset int64
}

type AIEvent struct {
	ID         int64
	SessionID  string
	Tool       string
	Kind       string
	Timestamp  int64
	ProjectDir string
}

func (s *Store) UpsertAISession(sess *AISession) error {
	_, err := s.db.Exec(`
		INSERT INTO ai_sessions (id, tool, project_dir, file_path, started_at, last_event_at, event_count, source_offset)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			project_dir   = excluded.project_dir,
			file_path     = excluded.file_path,
			last_event_at = excluded.last_event_at,
			event_count   = excluded.event_count,
			source_offset = excluded.source_offset
	`, sess.ID, sess.Tool, nullableStr(sess.ProjectDir), nullableStr(sess.FilePath),
		sess.StartedAt, sess.LastEventAt, sess.EventCount, sess.SourceOffset)
	return err
}

func (s *Store) GetAISessionByFilePath(path string) (*AISession, error) {
	row := s.db.QueryRow(`
		SELECT id, tool, COALESCE(project_dir,''), COALESCE(file_path,''),
		       started_at, last_event_at, event_count, source_offset
		FROM ai_sessions WHERE file_path = ?
	`, path)
	var out AISession
	err := row.Scan(&out.ID, &out.Tool, &out.ProjectDir, &out.FilePath,
		&out.StartedAt, &out.LastEventAt, &out.EventCount, &out.SourceOffset)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `go test ./internal/storage/ -run TestUpsertAISession -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/storage/ai.go internal/storage/ai_test.go
git commit -m "feat(storage): UpsertAISession + GetAISessionByFilePath"
```

---

### Task 3: Storage CRUD — ai_events

**Files:**
- Modify: `internal/storage/ai.go`
- Modify: `internal/storage/ai_test.go`

- [ ] **Step 1: Write failing tests**

Append to `internal/storage/ai_test.go`:

```go
func TestInsertAndQueryAIEvents(t *testing.T) {
	store := newTestStore(t)
	defer store.Close()

	s := &AISession{ID: "sess-1", Tool: "claude", StartedAt: 1000, LastEventAt: 1000}
	if err := store.UpsertAISession(s); err != nil {
		t.Fatal(err)
	}

	events := []AIEvent{
		{SessionID: "sess-1", Tool: "claude", Kind: "user_prompt", Timestamp: 1010},
		{SessionID: "sess-1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1020},
		{SessionID: "sess-1", Tool: "claude", Kind: "tool_use", Timestamp: 1030},
	}
	if err := store.InsertAIEvents(events); err != nil {
		t.Fatalf("insert: %v", err)
	}

	got, err := store.GetAIEventsInRange(1000, 2000)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 events, got %d", len(got))
	}

	maxTs, err := store.GetMaxAIEventTimestamp("claude")
	if err != nil {
		t.Fatal(err)
	}
	if maxTs != 1030 {
		t.Fatalf("expected max ts 1030, got %d", maxTs)
	}
}
```

- [ ] **Step 2: Run test to verify failure**

Run: `go test ./internal/storage/ -run TestInsertAndQueryAIEvents -v`
Expected: FAIL (undefined methods).

- [ ] **Step 3: Implement methods**

Append to `internal/storage/ai.go`:

```go
func (s *Store) InsertAIEvents(events []AIEvent) error {
	if len(events) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`
		INSERT INTO ai_events (session_id, tool, kind, timestamp, project_dir)
		VALUES (?, ?, ?, ?, ?)
	`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, e := range events {
		if _, err := stmt.Exec(e.SessionID, e.Tool, e.Kind, e.Timestamp, nullableStr(e.ProjectDir)); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) GetAIEventsInRange(startUnix, endUnix int64) ([]AIEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, session_id, tool, kind, timestamp, COALESCE(project_dir,'')
		FROM ai_events
		WHERE timestamp BETWEEN ? AND ?
		ORDER BY tool, session_id, timestamp
	`, startUnix, endUnix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AIEvent
	for rows.Next() {
		var e AIEvent
		if err := rows.Scan(&e.ID, &e.SessionID, &e.Tool, &e.Kind, &e.Timestamp, &e.ProjectDir); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) GetMaxAIEventTimestamp(tool string) (int64, error) {
	var maxTs sql.NullInt64
	err := s.db.QueryRow(`SELECT MAX(timestamp) FROM ai_events WHERE tool = ?`, tool).Scan(&maxTs)
	if err != nil {
		return 0, err
	}
	if !maxTs.Valid {
		return 0, nil
	}
	return maxTs.Int64, nil
}

func (s *Store) ListAISessionsForDate(startUnix, endUnix int64) ([]AISession, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT s.id, s.tool, COALESCE(s.project_dir,''), COALESCE(s.file_path,''),
		       s.started_at, s.last_event_at, s.event_count, s.source_offset
		FROM ai_sessions s
		JOIN ai_events e ON e.session_id = s.id
		WHERE e.timestamp BETWEEN ? AND ?
		ORDER BY s.last_event_at DESC
	`, startUnix, endUnix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AISession
	for rows.Next() {
		var s AISession
		if err := rows.Scan(&s.ID, &s.Tool, &s.ProjectDir, &s.FilePath,
			&s.StartedAt, &s.LastEventAt, &s.EventCount, &s.SourceOffset); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `go test ./internal/storage/ -run TestInsertAndQueryAIEvents -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/storage/ai.go internal/storage/ai_test.go
git commit -m "feat(storage): InsertAIEvents, GetAIEventsInRange, ListAISessionsForDate, GetMaxAIEventTimestamp"
```

---

## Phase 2 — Plugin Layer

### Task 4: AIPlugin interface and shared AIEvent type

**Files:**
- Create: `internal/tracker/aiplugin/plugin.go`

- [ ] **Step 1: Create the interface file**

Create `internal/tracker/aiplugin/plugin.go`:

```go
// Package aiplugin defines the interface AI coding session trackers implement.
// Each plugin (claude, opencode) reads from an external on-disk data source and
// returns normalized events that the AITracker writes to storage.
package aiplugin

import (
	"context"
	"time"

	"traq/internal/storage"
)

// AIEvent is the in-memory representation of one atomic event from an AI tool's log.
// It is not the same as storage.AIEvent (which has an int64 timestamp and DB ID).
// The AITracker is responsible for converting + persisting these.
type AIEvent struct {
	Tool       string    // "claude" | "opencode"
	SessionID  string    // tool's native session ID
	ProjectDir string    // absolute path or "" if unknown
	Timestamp  time.Time
	Kind       string    // "user_prompt" | "assistant_turn" | "tool_use" | "message"
	FilePath   string    // source JSONL path (claude) or "" (opencode)
	// Offset is the byte position *after* this event within FilePath.
	// Claude plugin sets this so AITracker can persist source_offset;
	// opencode plugin leaves it zero.
	Offset int64
}

// AIPlugin is a single source of AI activity.
type AIPlugin interface {
	// Name returns the short tool identifier ("claude" | "opencode").
	Name() string

	// Available returns true if this tool's data directory exists on disk.
	// Plugins whose Available returns false are skipped for the session.
	Available() bool

	// Poll returns new events that have appeared since the plugin's last read.
	// It uses the store to look up resume cursors (source_offset for claude,
	// MAX(timestamp) for opencode). Implementations MUST be safe to call
	// repeatedly on the same store without re-ingesting already-persisted events.
	Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error)
}
```

- [ ] **Step 2: Build to confirm package compiles**

Run: `go build ./internal/tracker/aiplugin/`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add internal/tracker/aiplugin/plugin.go
git commit -m "feat(aiplugin): AIPlugin interface and shared AIEvent type"
```

---

### Task 5: Claude plugin — JSONL fixture + parser skeleton

**Files:**
- Create: `internal/tracker/aiplugin/testdata/claude/-home-u-repo/sess-1.jsonl`
- Create: `internal/tracker/aiplugin/plugin_claude.go`
- Create: `internal/tracker/aiplugin/plugin_claude_test.go`

- [ ] **Step 1: Write a minimal JSONL fixture**

Create `internal/tracker/aiplugin/testdata/claude/-home-u-repo/sess-1.jsonl` (note: each line is one JSON document — no trailing comma or array wrapper):

```
{"type":"file-history-snapshot","messageId":"x","snapshot":{},"isSnapshotUpdate":false}
{"type":"user","sessionId":"sess-1","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:00.000Z","message":{"role":"user","content":"hello"}}
{"type":"assistant","sessionId":"sess-1","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:05.000Z","message":{"role":"assistant","content":[{"type":"text","text":"hi"}]}}
{"type":"assistant","sessionId":"sess-1","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:10.000Z","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash"}]}}
```

- [ ] **Step 2: Write the failing parser test**

Create `internal/tracker/aiplugin/plugin_claude_test.go`:

```go
package aiplugin

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func TestClaudePluginParsesFixtureJSONL(t *testing.T) {
	root := filepath.Join("testdata", "claude")
	p := NewClaudePlugin(root)
	if !p.Available() {
		t.Fatalf("fixture dir should make plugin available")
	}

	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	events, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	if len(events) != 3 {
		t.Fatalf("expected 3 events (snapshot skipped), got %d", len(events))
	}

	want := []struct {
		kind string
		ts   string
	}{
		{"user_prompt", "2026-04-23T10:00:00Z"},
		{"assistant_turn", "2026-04-23T10:00:05Z"},
		{"tool_use", "2026-04-23T10:00:10Z"},
	}
	for i, w := range want {
		if events[i].Kind != w.kind {
			t.Errorf("event[%d].Kind = %q, want %q", i, events[i].Kind, w.kind)
		}
		ts, _ := time.Parse(time.RFC3339, w.ts)
		if !events[i].Timestamp.Equal(ts) {
			t.Errorf("event[%d].Timestamp = %v, want %v", i, events[i].Timestamp, ts)
		}
		if events[i].SessionID != "sess-1" {
			t.Errorf("event[%d].SessionID = %q", i, events[i].SessionID)
		}
		if events[i].ProjectDir != "/home/u/repo" {
			t.Errorf("event[%d].ProjectDir = %q", i, events[i].ProjectDir)
		}
		if events[i].Tool != "claude" {
			t.Errorf("event[%d].Tool = %q", i, events[i].Tool)
		}
	}
}

func TestClaudePluginResumesFromSourceOffset(t *testing.T) {
	root := filepath.Join("testdata", "claude")
	p := NewClaudePlugin(root)
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	// First poll ingests everything.
	first, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) == 0 {
		t.Fatal("expected events on first poll")
	}
	// Persist the returned events' source offset to simulate AITracker.
	persistOffsetForTest(t, store, first)

	// Second poll with nothing changed should return no new events.
	second, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 0 {
		t.Fatalf("expected 0 new events on repeat poll, got %d", len(second))
	}
}

// persistOffsetForTest mimics what AITracker does between polls: upsert the session
// row with the last event's file Offset so the next Poll resumes from there.
func persistOffsetForTest(t *testing.T, store *storage.Store, events []Event) {
	t.Helper()
	// implemented once plugin is in place — see plugin_claude.go
	// for field names. Keep this helper in the test file.
	last := events[len(events)-1]
	sess := &storage.AISession{
		ID:           last.SessionID,
		Tool:         last.Tool,
		ProjectDir:   last.ProjectDir,
		FilePath:     last.FilePath,
		StartedAt:    events[0].Timestamp.Unix(),
		LastEventAt:  last.Timestamp.Unix(),
		EventCount:   len(events),
		SourceOffset: last.Offset,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}
}

// Alias so the helper reads naturally. Keep only if it compiles cleanly;
// otherwise replace Event with AIEvent everywhere.
type Event = AIEvent
```

- [ ] **Step 3: Add in-memory test-store helper if missing**

Check whether `storage.NewInMemoryTestStore` exists:

Run: `grep -n "NewInMemoryTestStore\|newTestStore" internal/storage/*_test.go | head`

If it doesn't exist, add an exported variant in `internal/storage/testing.go` (new file):

```go
package storage

import "testing"

// NewInMemoryTestStore returns a Store backed by an ephemeral on-disk SQLite DB
// that's deleted at test end. Exported so other packages' tests can use it.
func NewInMemoryTestStore(t *testing.T) *Store {
	t.Helper()
	// reuse whatever mechanism newTestStore uses; the simplest is:
	store, err := NewStore(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Migrate(); err != nil {
		t.Fatal(err)
	}
	return store
}
```

(If `NewStore`'s signature is different, use the correct constructor. Check `internal/storage/store.go`.)

- [ ] **Step 4: Run test to verify failure**

Run: `go test ./internal/tracker/aiplugin/ -run TestClaudePlugin -v`
Expected: FAIL (undefined `NewClaudePlugin`).

- [ ] **Step 5: Implement the Claude plugin**

Create `internal/tracker/aiplugin/plugin_claude.go`:

```go
package aiplugin

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"time"

	"traq/internal/storage"
)

const toolClaude = "claude"

// ClaudePlugin tails Claude Code JSONL session files in <root>/<project-slug>/*.jsonl.
type ClaudePlugin struct {
	root string // ~/.claude/projects (or a fixture root in tests)
}

func NewClaudePlugin(root string) *ClaudePlugin {
	return &ClaudePlugin{root: root}
}

func (p *ClaudePlugin) Name() string { return toolClaude }

func (p *ClaudePlugin) Available() bool {
	info, err := os.Stat(p.root)
	return err == nil && info.IsDir()
}

// claudeLine matches the fields we care about in Claude's JSONL.
// Other fields (message body, snapshot contents) are ignored by design.
type claudeLine struct {
	Type      string    `json:"type"`
	SessionID string    `json:"sessionId"`
	CWD       string    `json:"cwd"`
	Timestamp time.Time `json:"timestamp"`
	Message   struct {
		Role    string          `json:"role"`
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

func (p *ClaudePlugin) Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error) {
	var out []AIEvent

	matches, err := filepath.Glob(filepath.Join(p.root, "*", "*.jsonl"))
	if err != nil {
		return nil, err
	}
	for _, path := range matches {
		if ctx.Err() != nil {
			return out, ctx.Err()
		}
		events, err := p.readFile(path, store)
		if err != nil {
			// Don't fail the whole poll for one bad file — log would go here if we had a logger.
			continue
		}
		out = append(out, events...)
	}
	return out, nil
}

func (p *ClaudePlugin) readFile(path string, store *storage.Store) ([]AIEvent, error) {
	sess, err := store.GetAISessionByFilePath(path)
	if err != nil {
		return nil, err
	}
	var startOffset int64
	if sess != nil {
		startOffset = sess.SourceOffset
	}

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	if _, err := f.Seek(startOffset, io.SeekStart); err != nil {
		return nil, err
	}

	var events []AIEvent
	pos := startOffset
	reader := bufio.NewReader(f)
	for {
		line, err := reader.ReadBytes('\n')
		if len(line) > 0 {
			advance := int64(len(line))
			pos += advance
			if ev, ok := parseClaudeLine(line, path, pos); ok {
				events = append(events, ev)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return events, err
		}
	}
	return events, nil
}

func parseClaudeLine(line []byte, filePath string, offsetAfter int64) (AIEvent, bool) {
	var cl claudeLine
	if err := json.Unmarshal(line, &cl); err != nil {
		return AIEvent{}, false
	}
	kind := claudeKind(&cl)
	if kind == "" {
		return AIEvent{}, false
	}
	if cl.SessionID == "" || cl.Timestamp.IsZero() {
		return AIEvent{}, false
	}
	return AIEvent{
		Tool:       toolClaude,
		SessionID:  cl.SessionID,
		ProjectDir: cl.CWD,
		Timestamp:  cl.Timestamp,
		Kind:       kind,
		FilePath:   filePath,
		Offset:     offsetAfter,
	}, true
}

func claudeKind(cl *claudeLine) string {
	switch cl.Type {
	case "user":
		return "user_prompt"
	case "assistant":
		if containsToolUse(cl.Message.Content) {
			return "tool_use"
		}
		return "assistant_turn"
	default:
		return ""
	}
}

func containsToolUse(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var items []struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &items); err != nil {
		return false
	}
	for _, it := range items {
		if it.Type == "tool_use" {
			return true
		}
	}
	return false
}
```

- [ ] **Step 6: Run tests to verify pass**

Run: `go test ./internal/tracker/aiplugin/ -run TestClaudePlugin -v`
Expected: PASS for both `TestClaudePluginParsesFixtureJSONL` and `TestClaudePluginResumesFromSourceOffset`.

- [ ] **Step 7: Commit**

```bash
git add internal/tracker/aiplugin/plugin_claude.go \
        internal/tracker/aiplugin/plugin_claude_test.go \
        internal/tracker/aiplugin/testdata/claude \
        internal/storage/testing.go
git commit -m "feat(aiplugin): Claude plugin — JSONL tailer with offset resume"
```

---

### Task 6: Claude plugin — corrupt-line resilience

**Files:**
- Modify: `internal/tracker/aiplugin/plugin_claude_test.go`

- [ ] **Step 1: Write the failing test**

Append to `plugin_claude_test.go`:

```go
func TestClaudePluginSkipsCorruptLines(t *testing.T) {
	// Build a temp dir with one file containing valid + garbage + valid.
	dir := t.TempDir()
	projDir := filepath.Join(dir, "-tmp-proj")
	if err := os.MkdirAll(projDir, 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(projDir, "sess-2.jsonl")
	content := `{"type":"user","sessionId":"s","cwd":"/t","timestamp":"2026-04-23T10:00:00Z","message":{"role":"user","content":"a"}}
NOT_JSON_GARBAGE
{"type":"assistant","sessionId":"s","cwd":"/t","timestamp":"2026-04-23T10:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"b"}]}}
`
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	p := NewClaudePlugin(dir)
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	events, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatalf("poll returned error: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 valid events (garbage skipped), got %d", len(events))
	}
}
```

Also needs imports: add `"os"` to the test file if not already there.

- [ ] **Step 2: Run test**

Run: `go test ./internal/tracker/aiplugin/ -run TestClaudePluginSkipsCorruptLines -v`
Expected: PASS (already handled by `parseClaudeLine` returning `ok=false` on unmarshal error).

- [ ] **Step 3: Commit**

```bash
git add internal/tracker/aiplugin/plugin_claude_test.go
git commit -m "test(aiplugin): claude plugin skips corrupt JSONL lines"
```

---

### Task 7: opencode plugin — SQLite reader

**Files:**
- Create: `internal/tracker/aiplugin/plugin_opencode.go`
- Create: `internal/tracker/aiplugin/plugin_opencode_test.go`
- Create: `internal/tracker/aiplugin/testdata/opencode/schema.sql` (used to build fixture DB at test time)

- [ ] **Step 1: Write the fixture DB schema**

Create `internal/tracker/aiplugin/testdata/opencode/schema.sql`:

```sql
CREATE TABLE project (
	id text PRIMARY KEY,
	worktree text NOT NULL,
	vcs text,
	name text,
	icon_url text,
	icon_color text,
	time_created integer NOT NULL,
	time_updated integer NOT NULL,
	time_initialized integer,
	sandboxes text NOT NULL,
	commands text
);

CREATE TABLE session (
	id text PRIMARY KEY,
	project_id text NOT NULL,
	parent_id text,
	slug text NOT NULL,
	directory text NOT NULL,
	title text NOT NULL,
	version text NOT NULL,
	time_created integer NOT NULL,
	time_updated integer NOT NULL
);

CREATE TABLE message (
	id text PRIMARY KEY,
	session_id text NOT NULL,
	time_created integer NOT NULL,
	time_updated integer NOT NULL,
	data text NOT NULL
);
```

(Only includes columns the plugin reads. The real DB has more; ignoring them is fine.)

- [ ] **Step 2: Write the failing test**

Create `internal/tracker/aiplugin/plugin_opencode_test.go`:

```go
package aiplugin

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"traq/internal/storage"
)

func buildOpencodeFixtureDB(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "opencode.db")

	schemaBytes, err := os.ReadFile(filepath.Join("testdata", "opencode", "schema.sql"))
	if err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(string(schemaBytes)); err != nil {
		t.Fatalf("schema exec: %v", err)
	}

	// Timestamps in milliseconds (matches real opencode).
	_, err = db.Exec(`
		INSERT INTO project (id, worktree, time_created, time_updated, sandboxes)
		VALUES ('proj-1', '/home/u/repo', 1700000000000, 1700000000000, '[]');
		INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
		VALUES ('ses_abc', 'proj-1', 'slug', '/home/u/repo', 't', '1', 1700000000000, 1700000030000);
		INSERT INTO message (id, session_id, time_created, time_updated, data)
		VALUES
			('m1', 'ses_abc', 1700000010000, 1700000010000, '{}'),
			('m2', 'ses_abc', 1700000020000, 1700000020000, '{}'),
			('m3', 'ses_abc', 1700000030000, 1700000030000, '{}');
	`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	return dbPath
}

func TestOpenCodePluginReadsMessages(t *testing.T) {
	dbPath := buildOpencodeFixtureDB(t)
	p := NewOpenCodePlugin(dbPath)
	if !p.Available() {
		t.Fatal("plugin should be available with fixture DB")
	}

	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	events, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	if len(events) != 3 {
		t.Fatalf("expected 3 events, got %d", len(events))
	}
	for _, e := range events {
		if e.Tool != "opencode" {
			t.Errorf("Tool=%q", e.Tool)
		}
		if e.SessionID != "ses_abc" {
			t.Errorf("SessionID=%q", e.SessionID)
		}
		if e.ProjectDir != "/home/u/repo" {
			t.Errorf("ProjectDir=%q", e.ProjectDir)
		}
		if e.Kind != "message" {
			t.Errorf("Kind=%q", e.Kind)
		}
	}
}

func TestOpenCodePluginResumesByMaxTimestamp(t *testing.T) {
	dbPath := buildOpencodeFixtureDB(t)
	p := NewOpenCodePlugin(dbPath)
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	// First poll reads all 3 messages.
	first, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 3 {
		t.Fatalf("expected 3, got %d", len(first))
	}

	// Simulate AITracker persisting them.
	var dbEvents []storage.AIEvent
	for _, e := range first {
		dbEvents = append(dbEvents, storage.AIEvent{
			SessionID: e.SessionID, Tool: e.Tool, Kind: e.Kind,
			Timestamp: e.Timestamp.Unix(), ProjectDir: e.ProjectDir,
		})
	}
	if err := store.UpsertAISession(&storage.AISession{
		ID: first[0].SessionID, Tool: "opencode",
		ProjectDir:  first[0].ProjectDir,
		StartedAt:   first[0].Timestamp.Unix(),
		LastEventAt: first[len(first)-1].Timestamp.Unix(),
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.InsertAIEvents(dbEvents); err != nil {
		t.Fatal(err)
	}

	// Second poll should see nothing new.
	second, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 0 {
		t.Fatalf("expected 0 new events, got %d", len(second))
	}
}
```

- [ ] **Step 3: Run to verify failure**

Run: `go test ./internal/tracker/aiplugin/ -run TestOpenCodePlugin -v`
Expected: FAIL (undefined `NewOpenCodePlugin`).

- [ ] **Step 4: Implement the plugin**

Create `internal/tracker/aiplugin/plugin_opencode.go`:

```go
package aiplugin

import (
	"context"
	"database/sql"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"traq/internal/storage"
)

const toolOpenCode = "opencode"

// OpenCodePlugin reads message timestamps from opencode's SQLite database.
// It opens the DB read-only and does not hold a long-lived connection.
type OpenCodePlugin struct {
	dbPath string
}

func NewOpenCodePlugin(dbPath string) *OpenCodePlugin {
	return &OpenCodePlugin{dbPath: dbPath}
}

func (p *OpenCodePlugin) Name() string { return toolOpenCode }

func (p *OpenCodePlugin) Available() bool {
	info, err := os.Stat(p.dbPath)
	return err == nil && !info.IsDir()
}

func (p *OpenCodePlugin) Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error) {
	sinceUnix, err := store.GetMaxAIEventTimestamp(toolOpenCode)
	if err != nil {
		return nil, err
	}
	// opencode stores milliseconds; convert the resume cursor.
	sinceMs := sinceUnix * 1000

	// sqlite3 driver: file: prefix with immutable=1 avoids locking the live DB.
	dsn := "file:" + p.dbPath + "?mode=ro&immutable=1"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.QueryContext(ctx, `
		SELECT m.session_id, s.directory, m.time_created
		FROM message m
		JOIN session s ON s.id = m.session_id
		WHERE m.time_created > ?
		ORDER BY m.time_created ASC
	`, sinceMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AIEvent
	for rows.Next() {
		var sessionID, directory string
		var tsMs int64
		if err := rows.Scan(&sessionID, &directory, &tsMs); err != nil {
			return nil, err
		}
		out = append(out, AIEvent{
			Tool:       toolOpenCode,
			SessionID:  sessionID,
			ProjectDir: directory,
			Timestamp:  time.Unix(0, tsMs*int64(time.Millisecond)),
			Kind:       "message",
		})
	}
	return out, rows.Err()
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `go test ./internal/tracker/aiplugin/ -run TestOpenCodePlugin -v`
Expected: PASS for both tests.

- [ ] **Step 6: Commit**

```bash
git add internal/tracker/aiplugin/plugin_opencode.go \
        internal/tracker/aiplugin/plugin_opencode_test.go \
        internal/tracker/aiplugin/testdata/opencode/schema.sql
git commit -m "feat(aiplugin): opencode plugin — SQLite reader with timestamp cursor"
```

---

## Phase 3 — AITracker Orchestration

### Task 8: AITracker — integration with plugins and storage

**Files:**
- Create: `internal/tracker/ai.go`
- Create: `internal/tracker/ai_test.go`

- [ ] **Step 1: Write the failing integration test**

Create `internal/tracker/ai_test.go`:

```go
package tracker

import (
	"os"
	"path/filepath"
	"testing"

	"traq/internal/storage"
	"traq/internal/tracker/aiplugin"
)

func TestAITrackerPersistsClaudeEvents(t *testing.T) {
	// Build a Claude fixture dir.
	root := t.TempDir()
	proj := filepath.Join(root, "-home-u-repo")
	if err := os.MkdirAll(proj, 0o755); err != nil {
		t.Fatal(err)
	}
	content := `{"type":"user","sessionId":"s","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:00Z","message":{"role":"user","content":"a"}}
{"type":"assistant","sessionId":"s","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:05Z","message":{"role":"assistant","content":[{"type":"text","text":"b"}]}}
`
	path := filepath.Join(proj, "s.jsonl")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	tr := NewAITracker(store, []aiplugin.AIPlugin{aiplugin.NewClaudePlugin(root)})
	if err := tr.Poll(); err != nil {
		t.Fatalf("poll: %v", err)
	}

	events, err := store.GetAIEventsInRange(0, 1<<62)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 persisted events, got %d", len(events))
	}

	sess, err := store.GetAISessionByFilePath(path)
	if err != nil || sess == nil {
		t.Fatalf("session not persisted: err=%v sess=%v", err, sess)
	}
	if sess.EventCount != 2 {
		t.Errorf("EventCount=%d want 2", sess.EventCount)
	}
	if sess.SourceOffset == 0 {
		t.Errorf("SourceOffset should be >0 after ingest")
	}

	// Second poll should be a no-op.
	if err := tr.Poll(); err != nil {
		t.Fatal(err)
	}
	after, _ := store.GetAIEventsInRange(0, 1<<62)
	if len(after) != 2 {
		t.Fatalf("expected no duplicate ingest, got %d total events", len(after))
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/tracker/ -run TestAITrackerPersists -v`
Expected: FAIL (undefined `NewAITracker`).

- [ ] **Step 3: Implement AITracker**

Create `internal/tracker/ai.go`:

```go
package tracker

import (
	"context"
	"time"

	"traq/internal/storage"
	"traq/internal/tracker/aiplugin"
)

// AITracker polls a set of AIPlugins and persists the events they return.
// It is safe to call Poll concurrently from at most one goroutine.
type AITracker struct {
	store   *storage.Store
	plugins []aiplugin.AIPlugin
}

func NewAITracker(store *storage.Store, plugins []aiplugin.AIPlugin) *AITracker {
	return &AITracker{store: store, plugins: plugins}
}

// Poll queries every available plugin once and writes new events to storage.
// Errors from a single plugin do not stop other plugins.
func (t *AITracker) Poll() error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	for _, p := range t.plugins {
		if !p.Available() {
			continue
		}
		events, err := p.Poll(ctx, t.store)
		if err != nil {
			// Log-if-we-had-a-logger — continue with other plugins.
			continue
		}
		if len(events) == 0 {
			continue
		}
		if err := t.persist(events); err != nil {
			continue
		}
	}
	return nil
}

// persist groups events by session, upserts the ai_sessions row (using the last
// event's file offset as the new source_offset), then bulk-inserts ai_events.
func (t *AITracker) persist(events []aiplugin.AIEvent) error {
	// Group by (tool, sessionID). Events within a Poll() already arrive in
	// order, but different sessions may be interleaved across files.
	type key struct{ tool, session string }
	groups := map[key][]aiplugin.AIEvent{}
	order := []key{}
	for _, e := range events {
		k := key{e.Tool, e.SessionID}
		if _, seen := groups[k]; !seen {
			order = append(order, k)
		}
		groups[k] = append(groups[k], e)
	}

	for _, k := range order {
		g := groups[k]
		last := g[len(g)-1]

		// Compute started_at by looking up existing session or using first event.
		var startedAt int64
		existing, err := t.store.GetAISessionByFilePath(last.FilePath)
		if err == nil && existing != nil {
			startedAt = existing.StartedAt
		} else {
			startedAt = g[0].Timestamp.Unix()
		}

		existingCount := 0
		if existing != nil {
			existingCount = existing.EventCount
		}

		sess := &storage.AISession{
			ID:           last.SessionID,
			Tool:         last.Tool,
			ProjectDir:   last.ProjectDir,
			FilePath:     last.FilePath,
			StartedAt:    startedAt,
			LastEventAt:  last.Timestamp.Unix(),
			EventCount:   existingCount + len(g),
			SourceOffset: last.Offset,
		}
		if err := t.store.UpsertAISession(sess); err != nil {
			return err
		}

		var dbEvents []storage.AIEvent
		for _, e := range g {
			dbEvents = append(dbEvents, storage.AIEvent{
				SessionID:  e.SessionID,
				Tool:       e.Tool,
				Kind:       e.Kind,
				Timestamp:  e.Timestamp.Unix(),
				ProjectDir: e.ProjectDir,
			})
		}
		if err := t.store.InsertAIEvents(dbEvents); err != nil {
			return err
		}
	}
	return nil
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `go test ./internal/tracker/ -run TestAITrackerPersists -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/tracker/ai.go internal/tracker/ai_test.go
git commit -m "feat(tracker): AITracker orchestrates plugins and persists events"
```

---

### Task 9: Wire AITracker into the daemon

**Files:**
- Modify: `internal/tracker/daemon.go`

- [ ] **Step 1: Add AITracker field + construction**

In `internal/tracker/daemon.go`, find the `Daemon` struct (around line 50–70) and add a field next to `shell`:

```go
	ai      *AITracker
```

In `NewDaemon`, after `shell := NewShellTracker(...)` (around line 89), add:

```go
	// Home dir lookup — opencode DB lives at ~/.local/share/opencode/opencode.db,
	// Claude sessions at ~/.claude/projects. If HOME isn't set, both plugins
	// report Available()==false and the tracker becomes a no-op.
	home, _ := os.UserHomeDir()
	aiPlugins := []aiplugin.AIPlugin{
		aiplugin.NewClaudePlugin(filepath.Join(home, ".claude", "projects")),
		aiplugin.NewOpenCodePlugin(filepath.Join(home, ".local", "share", "opencode", "opencode.db")),
	}
	ai := NewAITracker(store, aiPlugins)
```

Then add `ai: ai,` to the struct literal returned by `NewDaemon`.

Add import for `traq/internal/tracker/aiplugin`.

- [ ] **Step 2: Call ai.Poll in the daemon tick loop**

Find where `d.shell.Poll(session.ID)` is called (around line 373) and add below it:

```go
	// AI plugins are independent of the current Traq session (no session FK).
	if err := d.ai.Poll(); err != nil {
		// Non-fatal — continue the tick.
	}
```

- [ ] **Step 3: Build and run existing daemon tests**

Run: `go build ./... && go test ./internal/tracker/ -run TestDaemon -v`
Expected: build succeeds, existing daemon tests still pass.

- [ ] **Step 4: Commit**

```bash
git add internal/tracker/daemon.go
git commit -m "feat(tracker): register AITracker in daemon poll loop"
```

---

## Phase 4 — Service Layer (block derivation, display types)

### Task 10: Display types and session listing

**Files:**
- Create: `internal/service/ai.go`
- Create: `internal/service/ai_test.go`

- [ ] **Step 1: Write failing test for session listing**

Create `internal/service/ai_test.go`:

```go
package service

import (
	"testing"

	"traq/internal/storage"
)

func TestListAISessionsForDate(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	if err := store.UpsertAISession(&storage.AISession{
		ID: "s1", Tool: "claude", ProjectDir: "/a/b",
		StartedAt: 1700000000, LastEventAt: 1700000100, EventCount: 3,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.InsertAIEvents([]storage.AIEvent{
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000000},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000050},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000100},
	}); err != nil {
		t.Fatal(err)
	}

	svc := NewAIService(store)
	got, err := svc.ListAISessions("2023-11-14") // covers 1700000000 (UTC)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 session, got %d", len(got))
	}
	if got[0].ProjectName != "b" {
		t.Errorf("ProjectName=%q want %q", got[0].ProjectName, "b")
	}
	if got[0].Tool != "claude" {
		t.Errorf("Tool=%q", got[0].Tool)
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/service/ -run TestListAISessionsForDate -v`
Expected: FAIL (undefined `NewAIService`).

- [ ] **Step 3: Implement types and ListAISessions**

Create `internal/service/ai.go`:

```go
package service

import (
	"path/filepath"
	"time"

	"traq/internal/storage"
)

// Default threshold between events before a block splits (30 minutes).
const DefaultAIIdleGapSeconds = 30 * 60

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
	ID          string `json:"id"`
	Tool        string `json:"tool"`
	ProjectName string `json:"projectName"`
	ProjectDir  string `json:"projectDir"`
	StartedAt   int64  `json:"startedAt"`
	LastEventAt int64  `json:"lastEventAt"`
	EventCount  int    `json:"eventCount"`
}

type AISessionDetail struct {
	AISessionDisplay
	FilePath string `json:"filePath"`
}

type AIService struct {
	store          *storage.Store
	idleGapSeconds int
}

func NewAIService(store *storage.Store) *AIService {
	return &AIService{store: store, idleGapSeconds: DefaultAIIdleGapSeconds}
}

// SetIdleGapSeconds lets the config layer override the default at runtime.
func (s *AIService) SetIdleGapSeconds(n int) {
	if n > 0 {
		s.idleGapSeconds = n
	}
}

func (s *AIService) ListAISessions(date string) ([]AISessionDisplay, error) {
	start, end, err := dayRangeUnix(date)
	if err != nil {
		return nil, err
	}
	rows, err := s.store.ListAISessionsForDate(start, end)
	if err != nil {
		return nil, err
	}
	out := make([]AISessionDisplay, 0, len(rows))
	for _, r := range rows {
		out = append(out, AISessionDisplay{
			ID:          r.ID,
			Tool:        r.Tool,
			ProjectName: filepath.Base(r.ProjectDir),
			ProjectDir:  r.ProjectDir,
			StartedAt:   r.StartedAt,
			LastEventAt: r.LastEventAt,
			EventCount:  r.EventCount,
		})
	}
	return out, nil
}

func (s *AIService) GetAISession(id string) (*AISessionDetail, error) {
	sess, err := s.store.GetAISessionByID(id)
	if err != nil || sess == nil {
		return nil, err
	}
	return &AISessionDetail{
		AISessionDisplay: AISessionDisplay{
			ID:          sess.ID,
			Tool:        sess.Tool,
			ProjectName: filepath.Base(sess.ProjectDir),
			ProjectDir:  sess.ProjectDir,
			StartedAt:   sess.StartedAt,
			LastEventAt: sess.LastEventAt,
			EventCount:  sess.EventCount,
		},
		FilePath: sess.FilePath,
	}, nil
}

// dayRangeUnix parses a YYYY-MM-DD date (in local time) and returns the
// [startUnix, endUnix] pair covering that calendar day.
func dayRangeUnix(date string) (int64, int64, error) {
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return 0, 0, err
	}
	start := t.Unix()
	end := t.Add(24 * time.Hour).Add(-time.Second).Unix()
	return start, end, nil
}
```

Also add `GetAISessionByID` to storage. Append to `internal/storage/ai.go`:

```go
func (s *Store) GetAISessionByID(id string) (*AISession, error) {
	row := s.db.QueryRow(`
		SELECT id, tool, COALESCE(project_dir,''), COALESCE(file_path,''),
		       started_at, last_event_at, event_count, source_offset
		FROM ai_sessions WHERE id = ?
	`, id)
	var out AISession
	err := row.Scan(&out.ID, &out.Tool, &out.ProjectDir, &out.FilePath,
		&out.StartedAt, &out.LastEventAt, &out.EventCount, &out.SourceOffset)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}
```

(`dayRangeUnix` may collide with a helper elsewhere — if so, rename to `aiDayRangeUnix` and update the two call sites.)

- [ ] **Step 4: Run tests**

Run: `go test ./internal/service/ -run TestListAISessionsForDate -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/ai.go internal/service/ai_test.go internal/storage/ai.go
git commit -m "feat(service): AIService.ListAISessions + GetAISession"
```

---

### Task 11: Block derivation — idle-gap splitting

**Files:**
- Modify: `internal/service/ai.go`
- Modify: `internal/service/ai_test.go`

- [ ] **Step 1: Write failing tests**

Append to `internal/service/ai_test.go`:

```go
func TestDeriveAIBlocksSplitsOnIdleGap(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	_ = store.UpsertAISession(&storage.AISession{ID: "s1", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	// Events: cluster 1 (0, 60, 120) ... gap ... cluster 2 (4000, 4060)
	// With default 1800s gap, that's two blocks.
	events := []storage.AIEvent{
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000000},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000060},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000120},
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700004000},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700004060},
	}
	_ = store.InsertAIEvents(events)

	svc := NewAIService(store)
	blocks, err := svc.deriveBlocks(1700000000, 1700100000)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 blocks after gap split, got %d", len(blocks))
	}
	if blocks[0].SessionID != "s1" || blocks[1].SessionID != "s1" {
		t.Errorf("both blocks should reference s1")
	}
	if blocks[0].EventCount != 3 || blocks[1].EventCount != 2 {
		t.Errorf("counts: %d, %d", blocks[0].EventCount, blocks[1].EventCount)
	}
}

func TestDeriveAIBlocksSplitsPerSession(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	_ = store.UpsertAISession(&storage.AISession{ID: "s1", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	_ = store.UpsertAISession(&storage.AISession{ID: "s2", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	// Two concurrent sessions interleaved in time.
	_ = store.InsertAIEvents([]storage.AIEvent{
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000000},
		{SessionID: "s2", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000010},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000020},
		{SessionID: "s2", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000030},
	})

	svc := NewAIService(store)
	blocks, err := svc.deriveBlocks(0, 1<<62)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 per-session blocks, got %d", len(blocks))
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/service/ -run TestDeriveAIBlocks -v`
Expected: FAIL (`deriveBlocks` undefined).

- [ ] **Step 3: Implement deriveBlocks**

Append to `internal/service/ai.go`:

```go
// blockTailPadSeconds pads the end of every block so single-event blocks
// are visually non-zero on the timeline.
const blockTailPadSeconds = 30

func (s *AIService) deriveBlocks(startUnix, endUnix int64) ([]AIBlockDisplay, error) {
	events, err := s.store.GetAIEventsInRange(startUnix, endUnix)
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, nil
	}

	// Group by (tool, sessionID) in encounter order. We cannot rely on the DB
	// ordering for blocks — we need the original per-session sequence, which
	// GetAIEventsInRange already provides by ordering on (tool, session_id, timestamp).
	sessionRows := map[string]storage.AISession{}
	blocks := []AIBlockDisplay{}

	var current *AIBlockDisplay
	var prevSessionKey string
	var prevTs int64

	flush := func() {
		if current == nil {
			return
		}
		current.EndTime += blockTailPadSeconds
		blocks = append(blocks, *current)
		current = nil
	}

	for _, e := range events {
		key := e.Tool + "|" + e.SessionID
		gap := e.Timestamp - prevTs
		if current == nil || key != prevSessionKey || gap > int64(s.idleGapSeconds) {
			flush()

			// Lazy-load the session row to resolve project_dir / file_path.
			row, ok := sessionRows[e.SessionID]
			if !ok {
				rp, _ := s.store.GetAISessionByID(e.SessionID)
				if rp != nil {
					row = *rp
					sessionRows[e.SessionID] = row
				}
			}

			projectDir := e.ProjectDir
			if projectDir == "" {
				projectDir = row.ProjectDir
			}

			current = &AIBlockDisplay{
				Tool:        e.Tool,
				SessionID:   e.SessionID,
				ProjectDir:  projectDir,
				ProjectName: filepath.Base(projectDir),
				StartTime:   e.Timestamp,
				EndTime:     e.Timestamp,
				EventCount:  0,
				IsLive:      false,
			}
		}
		current.EndTime = e.Timestamp
		current.EventCount++
		prevSessionKey = key
		prevTs = e.Timestamp
	}
	flush()

	// Apply live-file rescue: for claude blocks whose session file was
	// modified recently, mark IsLive. (The split decision above has already
	// been made by this point, so rescue only affects the flag — future
	// extension can merge adjacent blocks when IsLive is true.)
	s.applyLiveFileRescue(blocks, sessionRows)

	return blocks, nil
}

func (s *AIService) applyLiveFileRescue(blocks []AIBlockDisplay, sessionRows map[string]storage.AISession) {
	threshold := time.Duration(s.idleGapSeconds/3) * time.Second
	now := time.Now()
	for i, b := range blocks {
		if b.Tool != "claude" {
			continue
		}
		row, ok := sessionRows[b.SessionID]
		if !ok || row.FilePath == "" {
			continue
		}
		info, err := osStat(row.FilePath)
		if err != nil {
			continue
		}
		if now.Sub(info.ModTime()) < threshold {
			blocks[i].IsLive = true
		}
	}
}
```

Add at the top of `ai.go` (package-level indirection for testability):

```go
import "os"

var osStat = os.Stat
```

Merge that import into the existing import block.

- [ ] **Step 4: Run tests**

Run: `go test ./internal/service/ -run TestDeriveAIBlocks -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/ai.go internal/service/ai_test.go
git commit -m "feat(service): derive AI activity blocks with idle-gap split + live-file rescue flag"
```

---

### Task 12: GetAIActivityForDay (hour bucketing)

**Files:**
- Modify: `internal/service/ai.go`
- Modify: `internal/service/ai_test.go`

- [ ] **Step 1: Write the failing test**

Append to `internal/service/ai_test.go`:

```go
func TestGetAIActivityForDayBucketsByHour(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	_ = store.UpsertAISession(&storage.AISession{ID: "s1", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	// Build events at 09:30, 09:45, 11:00 local time on 2026-04-23.
	base, _ := time.ParseInLocation("2006-01-02 15:04", "2026-04-23 09:30", time.Local)
	ts := []int64{
		base.Unix(),
		base.Add(15 * time.Minute).Unix(),
		base.Add(90 * time.Minute).Unix(), // 11:00
	}
	var events []storage.AIEvent
	for _, t := range ts {
		events = append(events, storage.AIEvent{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: t})
	}
	_ = store.InsertAIEvents(events)

	svc := NewAIService(store)
	byHour, err := svc.GetAIActivityForDay("2026-04-23")
	if err != nil {
		t.Fatal(err)
	}
	// 09:30 + 09:45 are within default gap, so one block in hour 9.
	// 11:00 is a separate block (gap > 30min), in hour 11.
	if len(byHour[9]) != 1 {
		t.Errorf("hour 9: expected 1 block, got %d", len(byHour[9]))
	}
	if len(byHour[11]) != 1 {
		t.Errorf("hour 11: expected 1 block, got %d", len(byHour[11]))
	}
}
```

- [ ] **Step 2: Run to verify failure**

Run: `go test ./internal/service/ -run TestGetAIActivityForDay -v`
Expected: FAIL.

- [ ] **Step 3: Implement GetAIActivityForDay**

Append to `internal/service/ai.go`:

```go
func (s *AIService) GetAIActivityForDay(date string) (map[int][]AIBlockDisplay, error) {
	start, end, err := dayRangeUnix(date)
	if err != nil {
		return nil, err
	}
	blocks, err := s.deriveBlocks(start, end)
	if err != nil {
		return nil, err
	}
	out := map[int][]AIBlockDisplay{}
	for _, b := range blocks {
		hr := time.Unix(b.StartTime, 0).In(time.Local).Hour()
		out[hr] = append(out[hr], b)
	}
	return out, nil
}
```

- [ ] **Step 4: Run tests**

Run: `go test ./internal/service/ -run TestGetAIActivityForDay -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/ai.go internal/service/ai_test.go
git commit -m "feat(service): GetAIActivityForDay bucketing blocks by hour"
```

---

### Task 13: Add AIEvents to TimelineGridData

**Files:**
- Modify: `internal/service/timeline_grid.go`

- [ ] **Step 1: Find the grid-building function**

Run: `grep -n "ShellEvents:\|GitEvents:" internal/service/timeline_grid.go | head`

Identify the single place where `TimelineGridData` is populated (likely a builder function around the top of the file). Note the `*storage.Store` and other dependencies it already holds.

- [ ] **Step 2: Add the field on the struct**

In `internal/service/timeline_grid.go`, in the `TimelineGridData` struct definition (around line 12), add:

```go
	AIEvents        map[int][]AIBlockDisplay  `json:"aiEvents"`
```

- [ ] **Step 3: Populate the field**

Locate the grid builder identified in Step 1. It has access to an `*storage.Store` — that's enough to construct an `AIService` inline (no refactor of the grid service required):

```go
	aiSvc := NewAIService(store)
	aiEvents, err := aiSvc.GetAIActivityForDay(date)
	if err != nil || aiEvents == nil {
		aiEvents = map[int][]AIBlockDisplay{}
	}
	grid.AIEvents = aiEvents
```

(Empty map, not nil — the frontend expects an object, not `null`. Swallowing the error here matches the treatment of other optional lanes in this builder; surface it in logs if the surrounding code already does so for shell/git.)

**Note:** if a later pass cleans up this builder, the `AIService` can be hoisted into the grid-service struct to match how `ShellTracker`/`GitTracker` are already wired. That refactor is out of scope for this task.

- [ ] **Step 4: Build and run tests**

Run: `go build ./... && go test ./internal/service/ -v`
Expected: build succeeds, tests pass.

- [ ] **Step 5: Commit**

```bash
git add internal/service/timeline_grid.go
git commit -m "feat(service): TimelineGridData exposes AIEvents map"
```

---

## Phase 5 — Wails Bindings and Settings

### Task 14: Wails bindings + settings config

**Files:**
- Modify: `app.go`
- Modify: `internal/service/config.go`

- [ ] **Step 1: Add AITrackingConfig**

In `internal/service/config.go`, find `DataSourcesConfig` (around line 164). Add a new field and type:

```go
// in DataSourcesConfig:
	AITracking *AITrackingConfig `json:"aiTracking"`
```

Add the new type:

```go
type AITrackingConfig struct {
	Enabled         bool `json:"enabled"`
	ClaudeEnabled   bool `json:"claudeEnabled"`
	OpenCodeEnabled bool `json:"openCodeEnabled"`
	IdleGapSeconds  int  `json:"idleGapSeconds"`
}
```

In the `getDefaultDataSourcesConfig()` function (around line 819), add the default:

```go
		AITracking: &AITrackingConfig{
			Enabled:         true,
			ClaudeEnabled:   true,
			OpenCodeEnabled: true,
			IdleGapSeconds:  1800,
		},
```

- [ ] **Step 2: Add the Wails bindings**

In `app.go`, add next to the other timeline / data-source bindings:

Inspect `app.go` once to confirm whether other services live as fields on `*App` (`a.configService`, `a.issueService`, etc.) or are constructed on demand:

Run: `grep -n "func (a \\*App)" app.go | head -20` and look for a neighbor binding.

**If on-demand construction is the norm** (services constructed in each method), add:

```go
func (a *App) ListAISessions(date string) ([]service.AISessionDisplay, error) {
	return service.NewAIService(a.store).ListAISessions(date)
}

func (a *App) GetAISession(id string) (*service.AISessionDetail, error) {
	return service.NewAIService(a.store).GetAISession(id)
}
```

**If services are cached fields** (e.g. `a.timelineService.GetTimelineGridData(...)`): add an `aiService *service.AIService` field to the `App` struct, initialize it in `NewApp` (or wherever peer services are constructed) with `service.NewAIService(store)`, and call it as `a.aiService.ListAISessions(date)`.

Pick one and use it consistently for both methods. Use the field `a.store` (or whatever the existing `*storage.Store` field is named — search `a\\.store\\|a\\.db` in app.go to confirm).

- [ ] **Step 3: Build**

Run: `go build ./...`
Expected: success.

- [ ] **Step 4: Regenerate bindings**

Run: `wails generate bindings -tags webkit2_41`

Verify `frontend/wailsjs/go/main/App.d.ts` now contains `ListAISessions` and `GetAISession`.

- [ ] **Step 5: Commit**

```bash
git add app.go internal/service/config.go frontend/wailsjs/
git commit -m "feat(app): Wails bindings for AI sessions + AITrackingConfig defaults"
```

---

## Phase 6 — Frontend

### Task 15: API client + React Query hooks

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/hooks.ts`

- [ ] **Step 1: Add api.ai methods**

In `frontend/src/api/client.ts`, add (alongside the existing data-source clients):

```typescript
import { ListAISessions, GetAISession } from '../../wailsjs/go/main/App';

export const ai = {
  list: (date: string) => ListAISessions(date),
  get: (id: string) => GetAISession(id),
};
```

Export as part of the `api` object:

```typescript
export const api = {
  // ...existing fields...
  ai,
};
```

- [ ] **Step 2: Add React Query hooks**

In `frontend/src/api/hooks.ts`:

```typescript
export function useAISessions(date: string) {
  return useQuery({
    queryKey: ['ai', 'sessions', date],
    queryFn: () => api.ai.list(date),
  });
}

export function useAISession(id: string | null) {
  return useQuery({
    queryKey: ['ai', 'session', id],
    queryFn: () => api.ai.get(id!),
    enabled: !!id,
  });
}
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: success (no new type errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/api/hooks.ts
git commit -m "feat(frontend): API client + React Query hooks for AI sessions"
```

---

### Task 16: Fold AI events into useTimelineData

**Files:**
- Modify: `frontend/src/components/timeline/useTimelineData.ts`
- Modify: `frontend/src/components/timeline/useTimelineData.test.ts`

- [ ] **Step 1: Write a failing test that feeds aiEvents through**

Open `frontend/src/components/timeline/useTimelineData.test.ts`. Find the `TimelineGridData`-shaped test fixture builder and add a new test block:

```typescript
  it('exposes aiEvents folded into per-hour view model', () => {
    const aiBlock = {
      tool: 'claude',
      sessionId: 's1',
      projectDir: '/home/u/repo',
      projectName: 'repo',
      startTime: Math.floor(new Date('2026-04-23T09:30:00Z').getTime() / 1000),
      endTime: Math.floor(new Date('2026-04-23T09:45:00Z').getTime() / 1000),
      eventCount: 5,
      isLive: false,
    };

    const { result } = renderHook(() => useTimelineData(buildData({
      hourlyGrid: {},
      shellEvents: {},
      aiEvents: { '9': [aiBlock] },
    })));

    const hour9 = result.current.hours.find(h => h.hour === 9);
    expect(hour9?.aiBlocks?.length).toBe(1);
    expect(hour9?.aiBlocks?.[0].tool).toBe('claude');
  });
```

(`buildData` is the existing helper in that file. If its default fixture doesn't already have an `aiEvents` key, add `aiEvents: {}` to the default so other tests keep passing.)

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- useTimelineData`
Expected: FAIL (hook doesn't surface `aiBlocks`).

- [ ] **Step 3: Update the hook**

In `frontend/src/components/timeline/useTimelineData.ts`:

1. Extend the per-hour view-model type to include `aiBlocks`:

```typescript
export interface HourViewModel {
  hour: number;
  // ...existing fields...
  aiBlocks?: AIBlockDisplay[];
}

export interface AIBlockDisplay {
  tool: string;
  sessionId: string;
  projectDir: string;
  projectName: string;
  startTime: number;
  endTime: number;
  eventCount: number;
  isLive: boolean;
}
```

2. In the reducer / builder that walks `data.shellEvents` (around line 174 per earlier grep), add an analogous loop for `data.aiEvents`:

```typescript
if (data.aiEvents) {
  for (const [hourStr, blocks] of Object.entries(data.aiEvents)) {
    const hour = Number(hourStr);
    ensureHour(hour).aiBlocks = blocks as AIBlockDisplay[];
  }
}
```

3. Update the `TimelineGridData` TypeScript type (wherever it's defined — likely `frontend/src/types/` or auto-generated) to include the new `aiEvents` field. If it's auto-generated from Go bindings, it will already be present after Task 14.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test -- useTimelineData`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/timeline/useTimelineData.ts \
        frontend/src/components/timeline/useTimelineData.test.ts
git commit -m "feat(frontend): fold AI events into timeline view model"
```

---

### Task 17: AIEventsLane component

**Files:**
- Create: `frontend/src/components/timeline/AIEventsLane.tsx`
- Create: `frontend/src/components/timeline/AIEventsLane.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `frontend/src/components/timeline/AIEventsLane.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AIEventsLane } from './AIEventsLane';

describe('AIEventsLane', () => {
  const blocks = [
    {
      tool: 'claude',
      sessionId: 's1',
      projectDir: '/home/u/traq',
      projectName: 'traq',
      startTime: 1700000000,
      endTime: 1700000600,
      eventCount: 4,
      isLive: false,
    },
    {
      tool: 'opencode',
      sessionId: 's2',
      projectDir: '/home/u/other',
      projectName: 'other',
      startTime: 1700000000,
      endTime: 1700000300,
      eventCount: 2,
      isLive: false,
    },
  ];

  it('renders one block per input', () => {
    render(<AIEventsLane blocks={blocks} hour={0} />);
    expect(screen.getAllByTestId('ai-block')).toHaveLength(2);
  });

  it('tags each block with its tool', () => {
    render(<AIEventsLane blocks={blocks} hour={0} />);
    const els = screen.getAllByTestId('ai-block');
    expect(els[0]).toHaveAttribute('data-tool', 'claude');
    expect(els[1]).toHaveAttribute('data-tool', 'opencode');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && npm test -- AIEventsLane`
Expected: FAIL (component doesn't exist).

- [ ] **Step 3: Implement the component**

Create `frontend/src/components/timeline/AIEventsLane.tsx`:

```tsx
import { Bot, Sparkles } from 'lucide-react';
import type { AIBlockDisplay } from './useTimelineData';

interface AIEventsLaneProps {
  blocks: AIBlockDisplay[];
  hour: number;
}

// Project-color assignment: stable hash of projectName to a palette index.
const PALETTE = [
  'bg-indigo-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-rose-500', 'bg-sky-500', 'bg-violet-500',
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function AIEventsLane({ blocks, hour }: AIEventsLaneProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="relative flex flex-col gap-0.5" data-hour={hour}>
      {blocks.map((b) => {
        const Icon = b.tool === 'claude' ? Sparkles : Bot;
        return (
          <div
            key={`${b.tool}-${b.sessionId}-${b.startTime}`}
            data-testid="ai-block"
            data-tool={b.tool}
            data-session-id={b.sessionId}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-white ${colorFor(b.projectName)}`}
            title={`${b.tool} · ${b.projectName} · ${b.eventCount} events`}
          >
            <Icon className="h-3 w-3" aria-hidden />
            <span className="truncate">{b.projectName}</span>
            {b.isLive && <span className="ml-auto text-[10px] opacity-80">live</span>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd frontend && npm test -- AIEventsLane`
Expected: PASS.

- [ ] **Step 5: Mount the lane in the timeline grid**

Find where shell / git lanes render per hour (search `shellEvents` usage in `EventList.tsx` or the grid component). Mount `AIEventsLane` in the same row container:

```tsx
{hour.aiBlocks && <AIEventsLane blocks={hour.aiBlocks} hour={hour.hour} />}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/timeline/AIEventsLane.tsx \
        frontend/src/components/timeline/AIEventsLane.test.tsx \
        frontend/src/components/timeline/EventList.tsx
git commit -m "feat(frontend): AIEventsLane renders per-project AI activity blocks"
```

---

### Task 18: Settings section

**Files:**
- Create: `frontend/src/components/settings/AITrackingSection.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Build the component**

Create `frontend/src/components/settings/AITrackingSection.tsx`:

```tsx
import { useConfig, useUpdateConfig } from '../../api/hooks';

export function AITrackingSection() {
  const { data: config } = useConfig();
  const update = useUpdateConfig();

  const ai = config?.dataSources?.aiTracking;
  if (!ai) return null;

  const setField = (patch: Partial<typeof ai>) =>
    update.mutate({
      ...config!,
      dataSources: {
        ...config!.dataSources,
        aiTracking: { ...ai, ...patch },
      },
    });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">AI Coding Sessions</h2>
      <p className="text-sm text-muted-foreground">
        Track Claude Code and opencode session activity on the timeline. Only timestamps
        are stored — prompts, responses, and tool arguments are never read.
      </p>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={ai.enabled}
          onChange={(e) => setField({ enabled: e.target.checked })}
        />
        Enable AI tracking
      </label>

      <label className="flex items-center gap-2 pl-6">
        <input
          type="checkbox"
          disabled={!ai.enabled}
          checked={ai.claudeEnabled}
          onChange={(e) => setField({ claudeEnabled: e.target.checked })}
        />
        Claude Code
      </label>

      <label className="flex items-center gap-2 pl-6">
        <input
          type="checkbox"
          disabled={!ai.enabled}
          checked={ai.openCodeEnabled}
          onChange={(e) => setField({ openCodeEnabled: e.target.checked })}
        />
        opencode
      </label>

      <label className="flex flex-col gap-1 pt-2">
        <span className="text-sm">Idle gap between blocks: {ai.idleGapSeconds / 60} minutes</span>
        <input
          type="range"
          min={300}
          max={3600}
          step={60}
          value={ai.idleGapSeconds}
          onChange={(e) => setField({ idleGapSeconds: Number(e.target.value) })}
        />
      </label>
    </section>
  );
}
```

(`useConfig` / `useUpdateConfig` must match the existing hook names — check `frontend/src/api/hooks.ts` and adjust.)

- [ ] **Step 2: Mount in SettingsPage**

In `frontend/src/pages/SettingsPage.tsx`, import and render `AITrackingSection` alongside the existing data-source sections.

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/settings/AITrackingSection.tsx \
        frontend/src/pages/SettingsPage.tsx
git commit -m "feat(frontend): settings section for AI tracking"
```

---

## Phase 7 — End-to-End Verification

### Task 19: Manual smoke test with wails dev

- [ ] **Step 1: Start the dev server**

Run: `wails dev -tags webkit2_41`

Expected: dev server on port 34115, frontend loads.

- [ ] **Step 2: Verify a fresh user has no AI data**

Open the Timeline page for today. Expected: no AI lane content, no crashes, no console errors about `aiEvents` being undefined.

- [ ] **Step 3: Verify a user with real Claude sessions sees data**

If you have `~/.claude/projects/` with recent sessions, wait for one daemon poll (≤30s), then reload the Timeline page.

Expected: AI blocks appear in the AI lane for hours that had Claude activity, colored by project, with a Sparkles icon.

- [ ] **Step 4: Verify the settings section renders**

Navigate to Settings. Expected: "AI Coding Sessions" section renders with three checkboxes and the slider. Toggling persists after reload.

- [ ] **Step 5: Check console for errors**

Open DevTools. Expected: no errors referencing `ai`, `AIEventsLane`, or missing fields.

- [ ] **Step 6: Commit the smoke-test checklist record if appropriate**

No code change — just confirm everything works. If issues are found, open a new task rather than amending this plan.

---

## Spec Coverage Check

Mapping spec requirements → tasks:

| Spec section | Task(s) |
|---|---|
| Architecture / package layout | Tasks 4–8 |
| Data model: `ai_sessions`, `ai_events` | Tasks 1–3 |
| Cursoring (Claude offset, opencode max-ts) | Tasks 5, 7 |
| No FK to `sessions` | Task 1 (schema) |
| No activity/AFK input | Tasks 8, 13 (no wiring into AFK/SessionManager) |
| Block derivation + idle-gap | Tasks 11, 12 |
| Live-file mtime rescue | Task 11 |
| Concurrent-session handling | Task 11 (per-session grouping test) |
| `TimelineGridData.AIEvents` | Task 13 |
| Service methods | Tasks 10–12 |
| Wails bindings | Task 14 |
| Frontend API + hooks | Task 15 |
| Frontend view model | Task 16 |
| Frontend lane component | Task 17 |
| Settings config + UI | Tasks 14, 18 |
| Privacy (no bodies read) | Tasks 5, 7 (parsers ignore content) |
| Testing posture | Tasks 2, 3, 5–8, 10–12, 16, 17 |

---

## Notes on the `ai_coding` category

The spec adds `"ai_coding"` to the analytics breakdown. That integration point (`DayStats.Breakdown`) was not reviewed during spec-writing and needs a follow-up task once the existing breakdown code is read in context. It is intentionally **not** in this plan — it's a small additive change that doesn't block any of the above, and batching it here would require guessing at the breakdown's current shape.

Open a follow-up plan entry after Task 13 is complete to:
- Read `internal/service/analytics.go` / timeline breakdown path.
- Derive AI duration per day (sum of block durations).
- Add a category entry under the existing breakdown map.
