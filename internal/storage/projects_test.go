package storage

import (
	"testing"
	"time"
)

func TestApplyPatternToEvents_GitRepoUpdatesCommits(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	repoID, err := store.SaveGitRepository(&GitRepository{
		Path:     "/home/jl/repos/traq",
		Name:     "traq",
		IsActive: true,
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = store.DB().Exec(`
		INSERT INTO git_commits (repository_id, commit_hash, short_hash, message, message_subject, author_name, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		repoID, "abc123", "abc123", "init", "init", "jl", time.Now().Unix(),
	)
	if err != nil {
		t.Fatal(err)
	}

	n, err := store.ApplyPatternToEvents(proj.ID, "git_repo", "traq", "contains")
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("ApplyPatternToEvents returned %d, want 1", n)
	}

	var pid int64
	err = store.DB().QueryRow(`SELECT project_id FROM git_commits WHERE commit_hash = 'abc123'`).Scan(&pid)
	if err != nil {
		t.Fatal(err)
	}
	if pid != proj.ID {
		t.Errorf("git_commit project_id = %d, want %d", pid, proj.ID)
	}
}

func TestApplyPatternToEvents_DomainUpdatesBrowserHistory(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Acme", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.DB().Exec(`
		INSERT INTO browser_history (timestamp, url, title, domain, browser)
		VALUES (?, ?, ?, ?, ?)`,
		time.Now().Unix(), "https://docs.acme.com/x", "Acme Docs", "docs.acme.com", "chrome",
	)
	if err != nil {
		t.Fatal(err)
	}

	n, err := store.ApplyPatternToEvents(proj.ID, "domain", "acme.com", "contains")
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Errorf("ApplyPatternToEvents returned %d, want 1", n)
	}

	var pid int64
	err = store.DB().QueryRow(`SELECT project_id FROM browser_history`).Scan(&pid)
	if err != nil {
		t.Fatal(err)
	}
	if pid != proj.ID {
		t.Errorf("browser_history project_id = %d, want %d", pid, proj.ID)
	}
}
