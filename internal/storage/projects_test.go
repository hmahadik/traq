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

func TestProjectStats_DerivesScreenshotCount(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().Unix()

	// Focus event 10:00–10:10 attributed to Traq.
	_, err = store.DB().Exec(`
		INSERT INTO window_focus_events (start_time, end_time, duration_seconds, app_name, window_title, project_id, project_confidence, project_source)
		VALUES (?, ?, ?, 'code', 'main.go - traq', ?, 1.0, 'user')`,
		now, now+600, 600, proj.ID,
	)
	if err != nil {
		t.Fatal(err)
	}

	// Screenshot at 10:05 — overlaps the focus event, so it should be derived to Traq.
	_, err = store.DB().Exec(`INSERT INTO screenshots (timestamp, filepath, dhash) VALUES (?, '/tmp/x.png', 'h1')`, now+300)
	if err != nil {
		t.Fatal(err)
	}

	// Screenshot at 11:00 — outside any focus event, must NOT be counted.
	_, err = store.DB().Exec(`INSERT INTO screenshots (timestamp, filepath, dhash) VALUES (?, '/tmp/y.png', 'h2')`, now+3600)
	if err != nil {
		t.Fatal(err)
	}

	stats, err := store.GetProjectStats(proj.ID)
	if err != nil {
		t.Fatal(err)
	}
	if stats.ScreenshotCount != 1 {
		t.Errorf("ScreenshotCount = %d, want 1", stats.ScreenshotCount)
	}
}
