package storage

import (
	"testing"
	"time"
)

func TestApplyPatternToEvents_GitRepoAlsoUpdatesAISessions(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	// Seed a git repository + commit at /home/jl/repos/traq.
	repoID, err := store.SaveGitRepository(&GitRepository{
		Path:     "/home/jl/repos/traq",
		Name:     "traq",
		IsActive: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().Unix()
	_, err = store.DB().Exec(`
		INSERT INTO git_commits (repository_id, commit_hash, short_hash, message, message_subject, author_name, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		repoID, "abc123", "abc123", "init", "init", "jl", now,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Seed an AI session whose project_dir matches the repo path.
	sess := &AISession{
		ID:           "session-1",
		Tool:         "claude",
		ProjectDir:   "/home/jl/repos/traq",
		FilePath:     "/tmp/session-1.jsonl",
		StartedAt:    now,
		LastEventAt:  now,
		EventCount:   1,
		SourceOffset: 0,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}

	// Apply a single git_repo pattern; expect BOTH the commit and the AI
	// session to be attributed.
	n, err := store.ApplyPatternToEvents(proj.ID, "git_repo", "traq", "contains")
	if err != nil {
		t.Fatal(err)
	}
	if n < 2 {
		t.Errorf("ApplyPatternToEvents returned %d, want >= 2 (commit + ai_session)", n)
	}

	var commitPID int64
	err = store.DB().QueryRow(`SELECT project_id FROM git_commits WHERE commit_hash = 'abc123'`).Scan(&commitPID)
	if err != nil {
		t.Fatal(err)
	}
	if commitPID != proj.ID {
		t.Errorf("git_commits.project_id = %d, want %d", commitPID, proj.ID)
	}

	var aiPID int64
	err = store.DB().QueryRow(`SELECT project_id FROM ai_sessions WHERE id = 'session-1'`).Scan(&aiPID)
	if err != nil {
		t.Fatal(err)
	}
	if aiPID != proj.ID {
		t.Errorf("ai_sessions.project_id = %d, want %d", aiPID, proj.ID)
	}
}
