# AI Coding Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI coding sessions (Claude Code, opencode) first-class for project attribution — assignable in the timeline, attributable by existing `git_repo` rules, and credited in reports — using the existing `ai_sessions.project_dir` filesystem path as the strong intrinsic signal.

**Architecture:** Add `project_id`/`project_confidence`/`project_source` columns to **`ai_sessions`** (not `ai_events` — attribution is per-session, never per-turn). Reuse existing `git_repo` rules: when `ApplyPatternToEvents` dispatches a `git_repo` rule, it now updates BOTH `git_commits` AND `ai_sessions` whose `project_dir` matches the pattern. A single `contains traq` rule attributes git commits AND AI sessions for the Traq project — no duplicate rule maintenance. Manual assignment from the timeline targets the session even when the user selected one event row.

**Tech Stack:** Go 1.21 + Wails v2, SQLite, React 18 + TypeScript. Builds on the attribution-cleanup branch (master is at migration v18 after that lands; this plan adds v19).

---

## File Map

**Modified (backend):**
- `internal/storage/migrations.go` — add migration v19 (ai_sessions project columns)
- `internal/storage/ai.go` — extend `AISession` struct with project fields; update SELECT/Scan in `scanAISession`, `ListAISessionsForDate`; add `GetAISessionsForBackfill`, `SetAISessionProject`
- `internal/storage/projects.go` — extend `SetEventProject` with `"ai"` case (resolves event→session); extend `applyPatternToGitCommits` dispatch to also call new `applyPatternToAISessions`; update `DeleteProject` to clear ai_sessions
- `internal/service/backfill.go` — add fourth pass over ai_sessions
- `internal/service/project_assignment.go` — add `case "ai"` to `ExtractEventContext` (resolves event_id → session.project_dir)
- `internal/service/reports.go` — add `AISessions []*storage.AISession` to `EnhancedReportContext`, populate from `ListAISessionsForDate`, add ai-sessions aggregation pass to `groupActivitiesByProject`

**Modified (frontend):**
- `frontend/src/components/timeline/ProjectAssignDialog.tsx` — extend `ASSIGNABLE_EVENT_TYPES` to include `'ai'`; update copy

**Tests (new + modified):**
- `internal/storage/migrations_ai_project_test.go` — TDD coverage for migration v19
- `internal/storage/ai_project_test.go` — `TestSetEventProject_AI` (event→session resolution), `TestSetAISessionProject_Direct`
- `internal/storage/projects_ai_test.go` — `TestApplyPatternToEvents_GitRepoAlsoUpdatesAISessions`
- `internal/service/backfill_test.go` — extend with `TestBackfill_AssignsAISessionsByProjectDir`

---

## Pre-flight

### Task 0: Sanity-check current state

- [ ] **Step 1: Confirm migration v18 has landed**

Run from worktree root:

```bash
sqlite3 ~/.local/share/traq/traq.db "PRAGMA user_version;"
```

Expected: `18` (after attribution-cleanup branch merges) or higher.

If lower, this plan is on a stale branch — rebase first.

- [ ] **Step 2: Confirm `ai_sessions` has data worth attributing**

```bash
sqlite3 ~/.local/share/traq/traq.db "SELECT COUNT(*), COUNT(DISTINCT project_dir) FROM ai_sessions;"
```

Expected: nonzero. If zero, the schema work is still valid; backfill just no-ops.

- [ ] **Step 3: Note baseline test results**

Run: `go test ./internal/...` from repo root.

Expected: PASS. Capture as regression baseline.

---

## Phase 1: Schema + storage primitives

### Task 1: Migration v19 — add project columns to `ai_sessions`

**Files:**
- Modify: `internal/storage/migrations.go` (add `applyMigration19` and the `currentVersion < 19` block; bump `schemaVersion` const from 18 → 19)

- [ ] **Step 1: Write a failing migration test**

Add `internal/storage/migrations_ai_project_test.go`:

```go
package storage

import (
	"database/sql"
	"fmt"
	"testing"
)

func TestMigration19_AddsAISessionProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	rows, err := store.DB().Query(`PRAGMA table_info(ai_sessions)`)
	if err != nil {
		t.Fatalf("PRAGMA failed: %v", err)
	}
	defer rows.Close()

	cols := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan: %v", err)
		}
		cols[name] = true
	}

	for _, want := range []string{"project_id", "project_confidence", "project_source"} {
		if !cols[want] {
			t.Errorf("expected ai_sessions column %q, missing", want)
		}
	}

	var version int
	if err := store.DB().QueryRow(`SELECT version FROM schema_version`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version < 19 {
		t.Errorf("schema_version = %d, want >= 19", version)
	}

	// Index check
	var idxCount int
	if err := store.DB().QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_ai_sessions_project'`,
	).Scan(&idxCount); err != nil {
		t.Fatal(err)
	}
	if idxCount != 1 {
		t.Errorf("expected idx_ai_sessions_project, found %d", idxCount)
	}

	_ = fmt.Sprintf // silence unused-import on golangci edge cases
}
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
go test ./internal/storage/ -run TestMigration19_AddsAISessionProjectColumns -v
```

Expected: FAIL — columns missing.

- [ ] **Step 3: Implement the migration**

In `internal/storage/migrations.go`:

a. Bump the `schemaVersion` const at the top from `18` to `19`.

b. Add the dispatch block after the `currentVersion < 18` block:

```go
if currentVersion < 19 {
	// Migration v19: Add project attribution columns to ai_sessions so
	// AI coding time can be credited to projects via git_repo rules
	// (matched against project_dir).
	if err := s.applyMigration19(); err != nil {
		return fmt.Errorf("failed to apply migration 19: %w", err)
	}
}
```

c. Add the implementation alongside other `applyMigrationN` functions:

```go
// applyMigration19 adds project_id/project_confidence/project_source to
// ai_sessions. Like git_commits and browser_history, ai_sessions has an
// intrinsic strong project identity (project_dir = filesystem path of the
// session's repo), so attribution is stored directly rather than derived.
func (s *Store) applyMigration19() error {
	stmts := []struct {
		probe string
		alter string
	}{
		{
			`SELECT COUNT(*) FROM pragma_table_info('ai_sessions') WHERE name = 'project_id'`,
			`ALTER TABLE ai_sessions ADD COLUMN project_id INTEGER REFERENCES projects(id)`,
		},
		{
			`SELECT COUNT(*) FROM pragma_table_info('ai_sessions') WHERE name = 'project_confidence'`,
			`ALTER TABLE ai_sessions ADD COLUMN project_confidence REAL DEFAULT 0`,
		},
		{
			`SELECT COUNT(*) FROM pragma_table_info('ai_sessions') WHERE name = 'project_source'`,
			`ALTER TABLE ai_sessions ADD COLUMN project_source TEXT DEFAULT 'unassigned'`,
		},
	}
	for _, p := range stmts {
		var n int
		if err := s.db.QueryRow(p.probe).Scan(&n); err != nil {
			return fmt.Errorf("migration 19 probe failed: %w", err)
		}
		if n == 0 {
			if _, err := s.db.Exec(p.alter); err != nil {
				return fmt.Errorf("migration 19 alter failed: %w", err)
			}
		}
	}
	if _, err := s.db.Exec(
		`CREATE INDEX IF NOT EXISTS idx_ai_sessions_project ON ai_sessions(project_id)`,
	); err != nil {
		return fmt.Errorf("migration 19 index failed: %w", err)
	}
	return nil
}
```

(The pragma-guarded ALTER pattern matches `applyMigration14` / `applyMigration17` for idempotence and repair-safety.)

- [ ] **Step 4: Run test, verify PASS**

```bash
go test ./internal/storage/ -run TestMigration19_AddsAISessionProjectColumns -v
```

Expected: PASS.

- [ ] **Step 5: Run full storage suite**

```bash
go test ./internal/storage/...
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add internal/storage/migrations.go internal/storage/migrations_ai_project_test.go
git commit -m "feat(storage): add project columns to ai_sessions (migration 19)"
```

---

### Task 2: Extend `AISession` model + `SetAISessionProject` storage helper

**Files:**
- Modify: `internal/storage/ai.go` (struct + scan + new helper)
- Modify: `internal/storage/projects.go` (add `case "ai"` to `SetEventProject` that resolves event → session)

The `AISession` primary key is TEXT (the tool's native session ID). The frontend dialog passes integer event IDs to `SetEventProject`. We bridge the two: `case "ai"` joins `ai_events.session_id` → `ai_sessions.id` and updates the session.

- [ ] **Step 1: Write failing tests**

Add `internal/storage/ai_project_test.go`:

```go
package storage

import (
	"testing"
)

func TestSetAISessionProject_Direct(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	sess := &AISession{
		ID:           "claude-abc123",
		Tool:         "claude",
		ProjectDir:   "/home/jl/repos/traq",
		FilePath:     "/home/jl/.claude/sessions/abc.jsonl",
		StartedAt:    100,
		LastEventAt:  200,
		EventCount:   5,
		SourceOffset: 0,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}

	if err := store.SetAISessionProject(sess.ID, proj.ID, 0.95, "rule"); err != nil {
		t.Fatalf("SetAISessionProject: %v", err)
	}

	got, err := store.GetAISessionByID(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProjectID.Valid || got.ProjectID.Int64 != proj.ID {
		t.Errorf("ProjectID = %v, want %d", got.ProjectID, proj.ID)
	}
	if !got.ProjectConfidence.Valid || got.ProjectConfidence.Float64 != 0.95 {
		t.Errorf("ProjectConfidence = %v, want 0.95", got.ProjectConfidence)
	}
	if !got.ProjectSource.Valid || got.ProjectSource.String != "rule" {
		t.Errorf("ProjectSource = %v, want rule", got.ProjectSource)
	}
}

func TestSetEventProject_AI_ResolvesToSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	sess := &AISession{
		ID:          "claude-xyz",
		Tool:        "claude",
		ProjectDir:  "/home/jl/repos/traq",
		StartedAt:   100,
		LastEventAt: 200,
		EventCount:  1,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}

	res, err := store.DB().Exec(`
		INSERT INTO ai_events (session_id, tool, kind, timestamp, project_dir)
		VALUES (?, 'claude', 'message', 150, '/home/jl/repos/traq')`,
		sess.ID,
	)
	if err != nil {
		t.Fatal(err)
	}
	eventID, _ := res.LastInsertId()

	// Manual-assign path: SetEventProject("ai", <ai_events.id>, ...) attributes the SESSION.
	if err := store.SetEventProject("ai", eventID, proj.ID, 0.9, "user"); err != nil {
		t.Fatalf("SetEventProject(ai): %v", err)
	}

	got, err := store.GetAISessionByID(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProjectID.Valid || got.ProjectID.Int64 != proj.ID {
		t.Errorf("session ProjectID = %v, want %d (assignment must propagate to session)", got.ProjectID, proj.ID)
	}
}
```

- [ ] **Step 2: Run tests, verify FAIL**

```bash
go test ./internal/storage/ -run TestSetAISessionProject_Direct -v
go test ./internal/storage/ -run TestSetEventProject_AI_ResolvesToSession -v
```

Expected: FAIL (struct fields don't exist; helper doesn't exist; case doesn't exist).

- [ ] **Step 3: Extend the `AISession` struct**

In `internal/storage/ai.go`, after `SourceOffset`:

```go
type AISession struct {
	ID           string
	Tool         string
	ProjectDir   string
	FilePath     string
	StartedAt    int64
	LastEventAt  int64
	EventCount   int
	SourceOffset int64

	ProjectID         sql.NullInt64
	ProjectConfidence sql.NullFloat64
	ProjectSource     sql.NullString
}
```

- [ ] **Step 4: Update SELECT + Scan sites**

Update `GetAISessionByFilePath`, `GetAISessionByID`, `ListAISessionsForDate` queries to include the three new columns at the end, and update `scanAISession` (and the inline scan in `ListAISessionsForDate`) accordingly.

`scanAISession`:

```go
func scanAISession(row *sql.Row) (*AISession, error) {
	var out AISession
	err := row.Scan(&out.ID, &out.Tool, &out.ProjectDir, &out.FilePath,
		&out.StartedAt, &out.LastEventAt, &out.EventCount, &out.SourceOffset,
		&out.ProjectID, &out.ProjectConfidence, &out.ProjectSource)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}
```

`GetAISessionByFilePath` SELECT:

```go
SELECT id, tool, COALESCE(project_dir,''), COALESCE(file_path,''),
       started_at, last_event_at, event_count, source_offset,
       project_id, project_confidence, project_source
FROM ai_sessions WHERE file_path = ?
```

Same shape for `GetAISessionByID`. For `ListAISessionsForDate`, update both the SELECT and the inline `rows.Scan(...)` call to include the three new fields at the end.

- [ ] **Step 5: Add `SetAISessionProject`**

In `internal/storage/ai.go`:

```go
// SetAISessionProject sets the project assignment for an AI session.
// Mirrors SetEventProject's behavior for setting/clearing assignments.
func (s *Store) SetAISessionProject(sessionID string, projectID int64, confidence float64, source string) error {
	var pid any = projectID
	if projectID == 0 {
		pid = nil
		source = "unassigned"
		confidence = 0
	}
	_, err := s.db.Exec(`
		UPDATE ai_sessions
		SET project_id = ?, project_confidence = ?, project_source = ?
		WHERE id = ?`,
		pid, confidence, source, sessionID,
	)
	if err != nil {
		return fmt.Errorf("set ai session project: %w", err)
	}
	return nil
}
```

(Add `"fmt"` to imports if not already there.)

- [ ] **Step 6: Add `case "ai"` to `SetEventProject`**

In `internal/storage/projects.go`, before `default:` in the switch:

```go
case "ai":
	// AI events are attributed at the SESSION level. The eventID is an
	// ai_events.id; resolve to the parent session and update there.
	var sessionID string
	if err := s.db.QueryRow(`SELECT session_id FROM ai_events WHERE id = ?`, eventID).Scan(&sessionID); err != nil {
		return fmt.Errorf("resolve ai_event %d to session: %w", eventID, err)
	}
	return s.SetAISessionProject(sessionID, projectID, confidence, source)
```

(Note: this case `return`s directly, bypassing the `var pid interface{} = projectID` block below — `SetAISessionProject` handles the unassign normalization itself. This early-return is intentional.)

- [ ] **Step 7: Run tests, verify PASS**

```bash
go test ./internal/storage/...
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add internal/storage/
git commit -m "feat(storage): SetEventProject ai path + AISession project fields"
```

---

### Task 3: Reuse `git_repo` rules to attribute ai_sessions by project_dir

**Files:**
- Modify: `internal/storage/projects.go` (extend `applyPatternToGitCommits` dispatch OR add a parallel `applyPatternToAISessions` and call both for `git_repo`)

The elegant property of this design: a single `git_repo` rule attributes both git commits AND AI sessions. The user creates one rule, both writers update.

- [ ] **Step 1: Write failing test**

Add `internal/storage/projects_ai_test.go`:

```go
package storage

import (
	"testing"
)

func TestApplyPatternToEvents_GitRepoAlsoUpdatesAISessions(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	// Seed a git repo + commit for the existing dispatch path
	repoID, err := store.SaveGitRepository(&GitRepository{Path: "/home/jl/repos/traq"})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.DB().Exec(`
		INSERT INTO git_commits (repository_id, commit_hash, short_hash, message, message_subject, author_name, timestamp)
		VALUES (?, 'abc123', 'abc123', 'msg', 'msg', 'jl', 100)`,
		repoID,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Seed an AI session in the same project_dir
	sess := &AISession{
		ID:          "claude-traq",
		Tool:        "claude",
		ProjectDir:  "/home/jl/repos/traq",
		StartedAt:   100,
		LastEventAt: 200,
		EventCount:  3,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}

	// Apply ONE git_repo rule. It must update BOTH git_commits and ai_sessions.
	n, err := store.ApplyPatternToEvents(proj.ID, "git_repo", "traq", "contains")
	if err != nil {
		t.Fatal(err)
	}
	if n < 2 {
		t.Errorf("ApplyPatternToEvents returned %d, want >=2 (1 commit + 1 ai_session)", n)
	}

	// Both writers attributed
	var commitProj int64
	if err := store.DB().QueryRow(`SELECT project_id FROM git_commits WHERE commit_hash = 'abc123'`).Scan(&commitProj); err != nil {
		t.Fatal(err)
	}
	if commitProj != proj.ID {
		t.Errorf("git_commit project_id = %d, want %d", commitProj, proj.ID)
	}

	got, err := store.GetAISessionByID(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProjectID.Valid || got.ProjectID.Int64 != proj.ID {
		t.Errorf("ai_session ProjectID = %v, want %d", got.ProjectID, proj.ID)
	}
}
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
go test ./internal/storage/ -run TestApplyPatternToEvents_GitRepoAlsoUpdatesAISessions -v
```

Expected: FAIL — only git_commits updates, ai_sessions still NULL.

- [ ] **Step 3: Add `applyPatternToAISessions`**

In `internal/storage/projects.go`, alongside the other `applyPatternTo*` functions:

```go
// applyPatternToAISessions matches a git_repo pattern against ai_sessions.project_dir.
// Reuses the same pattern shape as applyPatternToGitCommits so a single
// git_repo rule attributes both writers.
func (s *Store) applyPatternToAISessions(projectID int64, patternValue, matchType string) (int, error) {
	if matchType == "regex" {
		return 0, fmt.Errorf("regex match type is not supported for git_repo patterns; use exact, contains, prefix, or suffix")
	}
	cond, params, _ := buildPatternMatchConditionForField("project_dir", patternValue, matchType)
	query := fmt.Sprintf(`
		UPDATE ai_sessions
		SET project_id = ?, project_confidence = 1.0, project_source = 'rule'
		WHERE %s AND project_id IS NULL
	`, cond)
	args := append([]any{projectID}, params...)
	res, err := s.db.Exec(query, args...)
	if err != nil {
		return 0, fmt.Errorf("apply git_repo pattern to ai_sessions: %w", err)
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}
```

- [ ] **Step 4: Update the `git_repo` dispatch to call both writers**

In `ApplyPatternToEvents`, change the `git_repo` case from:

```go
case "git_repo":
	return s.applyPatternToGitCommits(projectID, patternValue, matchType)
```

To:

```go
case "git_repo":
	commits, err := s.applyPatternToGitCommits(projectID, patternValue, matchType)
	if err != nil {
		return commits, err
	}
	sessions, err := s.applyPatternToAISessions(projectID, patternValue, matchType)
	return commits + sessions, err
```

- [ ] **Step 5: Run test, verify PASS**

```bash
go test ./internal/storage/ -run TestApplyPatternToEvents_GitRepoAlsoUpdatesAISessions -v
```

Expected: PASS.

- [ ] **Step 6: Update `DeleteProject` to clear ai_sessions**

In `DeleteProject`, after the focus_events and git_commits clears, add:

```go
_, err = s.db.Exec(`UPDATE ai_sessions SET project_id = NULL, project_source = 'unassigned' WHERE project_id = ?`, id)
if err != nil {
	return fmt.Errorf("failed to clear ai session assignments: %w", err)
}
```

- [ ] **Step 7: Run all storage tests**

```bash
go test ./internal/storage/...
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add internal/storage/projects.go internal/storage/projects_ai_test.go
git commit -m "feat(storage): git_repo rules also attribute ai_sessions by project_dir"
```

---

## Phase 2: Service layer

### Task 4: Backfill pass for AI sessions

**Files:**
- Modify: `internal/storage/ai.go` (add `GetAISessionsForBackfill`)
- Modify: `internal/service/backfill.go` (add fourth pass)
- Modify: `internal/service/backfill_test.go` (add coverage)

- [ ] **Step 1: Add `GetAISessionsForBackfill` storage helper**

In `internal/storage/ai.go`:

```go
// GetAISessionsForBackfill returns AI sessions whose last_event_at falls in
// [start, end] AND that don't yet have a project assignment. Sessions are
// the unit of attribution; events inherit from their session.
func (s *Store) GetAISessionsForBackfill(start, end int64) ([]AISession, error) {
	rows, err := s.db.Query(`
		SELECT id, tool, COALESCE(project_dir,''), COALESCE(file_path,''),
		       started_at, last_event_at, event_count, source_offset,
		       project_id, project_confidence, project_source
		FROM ai_sessions
		WHERE last_event_at BETWEEN ? AND ?
		  AND project_id IS NULL
		ORDER BY last_event_at ASC`,
		start, end,
	)
	if err != nil {
		return nil, fmt.Errorf("query ai sessions for backfill: %w", err)
	}
	defer rows.Close()
	var out []AISession
	for rows.Next() {
		var sess AISession
		if err := rows.Scan(&sess.ID, &sess.Tool, &sess.ProjectDir, &sess.FilePath,
			&sess.StartedAt, &sess.LastEventAt, &sess.EventCount, &sess.SourceOffset,
			&sess.ProjectID, &sess.ProjectConfidence, &sess.ProjectSource); err != nil {
			return nil, err
		}
		out = append(out, sess)
	}
	return out, rows.Err()
}
```

- [ ] **Step 2: Write failing test**

Append to `internal/service/backfill_test.go`:

```go
func TestBackfill_AssignsAISessionsByProjectDir(t *testing.T) {
	store, projects, reports, cleanup := setupBackfillTest(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	// One git_repo rule for "traq" — should attribute both git commits and ai sessions.
	if _, err := projects.CreateProjectRule(ProjectRuleInput{
		ProjectID:    proj.ID,
		PatternType:  "git_repo",
		PatternValue: "traq",
		MatchType:    "contains",
		Weight:       1.0,
	}); err != nil {
		t.Fatal(err)
	}

	// Wait for pattern cache debounce (matches the existing browser test pattern).
	time.Sleep(1100 * time.Millisecond)

	now := time.Now().Unix()
	if err := store.UpsertAISession(&storage.AISession{
		ID:          "claude-test",
		Tool:        "claude",
		ProjectDir:  "/home/jl/repos/traq",
		StartedAt:   now - 600,
		LastEventAt: now,
		EventCount:  3,
	}); err != nil {
		t.Fatal(err)
	}

	backfill := NewBackfillService(store, projects, reports)
	res, err := backfill.BackfillProjects(
		time.Unix(now-3600, 0).Format("2006-01-02"),
		time.Unix(now+3600, 0).Format("2006-01-02"),
		0.3,
	)
	if err != nil {
		t.Fatal(err)
	}
	if res.AutoAssigned < 1 {
		t.Errorf("expected ≥1 ai session assigned, got %d", res.AutoAssigned)
	}

	got, err := store.GetAISessionByID("claude-test")
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProjectID.Valid || got.ProjectID.Int64 != proj.ID {
		t.Errorf("ai_session project_id = %v, want %d", got.ProjectID, proj.ID)
	}
}
```

(The helper `setupBackfillTest` is what the existing `TestBackfill_AssignsBrowserVisitsByDomain` uses — if it doesn't exist as a helper, factor out the setup boilerplate from the existing test into a helper as a tiny refactor first, then both tests use it. If factoring is too disruptive, just inline the setup the same way the browser test does.)

- [ ] **Step 3: Run test, verify FAIL**

```bash
go test ./internal/service/ -run TestBackfill_AssignsAISessionsByProjectDir -v
```

Expected: FAIL — backfill ignores ai_sessions.

- [ ] **Step 4: Add the fourth pass in backfill.go**

In `internal/service/backfill.go`, after the browser-visits pass and before `return result, nil`:

```go
// Process AI sessions
sessions, err := s.store.GetAISessionsForBackfill(startUnix, endUnix)
if err == nil {
	result.TotalProcessed += len(sessions)
	for _, sess := range sessions {
		if sess.ProjectDir == "" {
			result.NoMatch++
			continue
		}
		// AI sessions match the same git_repo rules as commits — pass project_dir
		// in as the GitRepo signal so SuggestProject's pattern match works uniformly.
		ctx := &storage.AssignmentContext{
			GitRepo:  sess.ProjectDir,
			FilePath: sess.ProjectDir,
		}
		match := s.projects.SuggestProject(ctx)
		if match != nil && match.Confidence >= minConfidence {
			if commit {
				_ = s.store.SetAISessionProject(sess.ID, match.ProjectID, match.Confidence, "rule")
			}
			result.AutoAssigned++
			continue
		}
		result.NoMatch++
	}
}
```

(Direct call to `SetAISessionProject` since we have the session ID; `SetEventProject("ai", ...)` would require an ai_events.id and an extra join.)

- [ ] **Step 5: Run test, verify PASS**

```bash
go test ./internal/service/ -run TestBackfill_AssignsAISessionsByProjectDir -v
```

Expected: PASS.

- [ ] **Step 6: Run full service tests**

```bash
go test ./internal/service/...
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add internal/storage/ai.go internal/service/backfill.go internal/service/backfill_test.go
git commit -m "feat(backfill): assign AI sessions by project_dir"
```

---

### Task 5: `ExtractEventContext` `"ai"` case (for manual assign learning)

**Files:**
- Modify: `internal/service/project_assignment.go` (add `case "ai"` to `ExtractEventContext`)

When the user manually assigns an AI event, `ManualAssign` calls `ExtractEventContext` to gather signals for pattern learning. The context should populate `GitRepo` (from session's project_dir) so the system can learn `git_repo` patterns from the assignment.

- [ ] **Step 1: Add the case**

In `internal/service/project_assignment.go`, in `ExtractEventContext`, before `default:`:

```go
case "ai":
	// eventID is ai_events.id; resolve via session_id to ai_sessions.project_dir.
	var projectDir, sessionID string
	err := s.store.DB().QueryRow(`
		SELECT s.id, COALESCE(s.project_dir, '')
		FROM ai_events e
		JOIN ai_sessions s ON s.id = e.session_id
		WHERE e.id = ?
	`, eventID).Scan(&sessionID, &projectDir)
	if err != nil {
		return nil, err
	}
	ctx.GitRepo = projectDir
	ctx.FilePath = projectDir
```

- [ ] **Step 2: Run all tests**

```bash
go test ./internal/...
```

Expected: PASS (no behavioral test added — covered by the manual smoke test in Task 8).

- [ ] **Step 3: Commit**

```bash
git add internal/service/project_assignment.go
git commit -m "refactor: ExtractEventContext supports ai event type"
```

---

### Task 6: Reports — credit AI session time to projects

**Files:**
- Modify: `internal/service/reports.go` (`EnhancedReportContext`, `buildEnhancedReportContext`, `groupActivitiesByProject`)

- [ ] **Step 1: Add `AISessions` field to `EnhancedReportContext`**

In `internal/service/reports.go`, in the `EnhancedReportContext` struct (around line 111-128), add:

```go
AISessions []*storage.AISession   // NEW
```

(Place it next to `BrowserVisits`.)

- [ ] **Step 2: Populate it in `buildEnhancedReportContext`**

In `buildEnhancedReportContext`, after the browser visits block:

```go
// Get AI coding sessions for project attribution
aiSessions, err := s.store.ListAISessionsForDate(tr.Start, tr.End)
if err == nil {
	// Convert []AISession → []*AISession for context consistency
	ctx.AISessions = make([]*storage.AISession, len(aiSessions))
	for i := range aiSessions {
		ctx.AISessions[i] = &aiSessions[i]
	}
}
```

(The error is swallowed to match the surrounding pattern of optional context.)

- [ ] **Step 3: Add AI session aggregation pass in `groupActivitiesByProject`**

In `groupActivitiesByProject` in `reports.go`, AFTER the browser-visits pass and BEFORE the "Add unassigned time to Other" calculation, add:

```go
// AI session pass: attribute AI coding time. Each session contributes
// (last_event_at - started_at) seconds to its project. If unassigned at
// report time, fall back to learned git_repo patterns matching project_dir.
aiProjectByID := make(map[int64]string)
for _, sess := range ctx.AISessions {
	durSec := float64(sess.LastEventAt - sess.StartedAt)
	if durSec <= 0 {
		continue
	}

	var projectName string
	if sess.ProjectID.Valid && sess.ProjectID.Int64 != 0 {
		if name, cached := aiProjectByID[sess.ProjectID.Int64]; cached {
			projectName = name
		} else {
			p, err := s.store.GetProject(sess.ProjectID.Int64)
			if err != nil {
				log.Printf("groupActivitiesByProject: ai session lookup project_id=%d failed: %v", sess.ProjectID.Int64, err)
			} else if p != nil {
				projectName = p.Name
			}
			aiProjectByID[sess.ProjectID.Int64] = projectName
		}
	} else if sess.ProjectDir != "" {
		// Fallback: try learned git_repo patterns at report time.
		projectName = s.detectProjectFromLearnedPatterns(&storage.AssignmentContext{
			GitRepo:  sess.ProjectDir,
			FilePath: sess.ProjectDir,
		})
	}
	if projectName == "" {
		continue
	}

	project := getProject(projectName)
	project.DurationSeconds += durSec
}
```

(Uses its own `aiProjectByID` cache — separate from the browser-visit pass's `projectByID` so the two passes are independent.)

- [ ] **Step 4: Run all tests**

```bash
go test ./internal/...
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add internal/service/reports.go
git commit -m "feat(reports): credit AI session time to projects via ai_sessions.project_id"
```

---

## Phase 3: Frontend

### Task 7: Allow manual project assign for AI events in the timeline

**Files:**
- Modify: `frontend/src/components/timeline/ProjectAssignDialog.tsx`

- [ ] **Step 1: Extend the whitelist**

Replace:

```typescript
const ASSIGNABLE_EVENT_TYPES = ['activity', 'focus', 'git', 'browser'];
```

With:

```typescript
const ASSIGNABLE_EVENT_TYPES = ['activity', 'focus', 'git', 'browser', 'ai'];
```

- [ ] **Step 2: Update the dialog copy**

In the same file, find the "Cannot Assign to Project" error path:

```tsx
<p className="mt-2">
  Only <strong>activity</strong>, <strong>git commit</strong>, and <strong>browser visit</strong> events can be assigned to projects.
</p>
```

Replace with:

```tsx
<p className="mt-2">
  Only <strong>activity</strong>, <strong>git commit</strong>, <strong>browser visit</strong>, and <strong>AI coding</strong> events can be assigned to projects.
</p>
```

- [ ] **Step 3: Build to verify**

```bash
cd frontend && npm run build
```

Expected: success (vite build clean; pre-existing TS errors unchanged).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/timeline/ProjectAssignDialog.tsx
git commit -m "feat(frontend): allow project assign for AI coding events"
```

---

## Phase 4: Verify end-to-end

### Task 8: Smoke test

- [ ] **Step 1: Start dev server**

Run: `wails dev -tags webkit2_41`. Confirm port 34115 loads. Confirm Migration 19 ran in startup logs.

- [ ] **Step 2: Verify schema**

```bash
sqlite3 ~/.local/share/traq/traq.db "PRAGMA table_info(ai_sessions);"
```

Expected: `project_id`, `project_confidence`, `project_source` present.

- [ ] **Step 3: Manual assignment via timeline**

Select an AI coding event row in the timeline. Click "Assign to Project". Confirm the dialog opens (no longer the "Cannot Assign" error). Pick a project. After save, run:

```bash
sqlite3 ~/.local/share/traq/traq.db "SELECT id, project_id, project_source FROM ai_sessions WHERE project_id IS NOT NULL ORDER BY last_event_at DESC LIMIT 3;"
```

Expected: at least one row with the project you picked, source = `'user'`.

- [ ] **Step 4: Rule-based attribution**

In Settings → Projects, find a project that has a `git_repo` rule (e.g., `contains traq`). If none exists, create one. Run a backfill from Settings over the last 7 days, min confidence 0.3.

```bash
sqlite3 ~/.local/share/traq/traq.db "SELECT COUNT(*) FROM ai_sessions WHERE project_source = 'rule';"
```

Expected: nonzero — confirms the git_repo rule attributed AI sessions in addition to git commits.

- [ ] **Step 5: Reports show AI time**

Generate a Detailed report covering today on the Reports page. Confirm:

- Projects that had AI coding activity show their AI time included in the project totals (compared to before this branch).
- "Other" no longer absorbs all AI session time.

- [ ] **Step 6: Commit (if smoke testing surfaced fixes)**

```bash
git status
git add -u && git commit -m "fix: resolve smoke-test issues found during AI attribution"
```

---

## Out of scope (intentional)

- **Per-event AI attribution.** Sessions are the unit of attribution. A single session covers one project for its lifetime. If a user is somehow doing AI work for two projects in one session, that's an unusual workflow and we don't subdivide.
- **A separate `ai_project_dir` pattern type.** We deliberately reuse `git_repo` rules because the basename match (`contains traq` matches both `/home/jl/repos/traq` and `/home/jl/.../traq`) works uniformly. A dedicated pattern type would force users to maintain two parallel rule sets for the same intent.
- **AI events without a session.** All ingest paths produce `ai_events` with a `session_id` FK to `ai_sessions`. If that invariant breaks, that's an ingest bug, not an attribution bug.
- **Time accounting precision.** AI session duration is computed as `last_event_at - started_at`, which over-counts long idle gaps within a session. The existing `AIService.AISessionBlocks` does idle-gap-broken clustering for display; reports use the simpler whole-session duration to keep the attribution path uniform with git commits (which also lack a duration model). Revisit if user feedback indicates the inflation is misleading.
