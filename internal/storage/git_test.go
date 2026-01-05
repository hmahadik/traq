package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestSaveGitRepository(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{
		Path:      "/home/user/projects/test",
		Name:      "test",
		RemoteURL: sql.NullString{String: "https://github.com/user/test", Valid: true},
		IsActive:  true,
	}

	id, err := store.SaveGitRepository(repo)
	if err != nil {
		t.Fatalf("failed to save repository: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetGitRepository(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{
		Path:     "/home/user/projects/test",
		Name:     "test",
		IsActive: true,
	}
	id, _ := store.SaveGitRepository(repo)

	found, err := store.GetGitRepository(id)
	if err != nil {
		t.Fatalf("failed to get repository: %v", err)
	}
	if found == nil {
		t.Fatal("expected to find repository")
	}
	if found.Name != "test" {
		t.Errorf("expected name 'test', got %s", found.Name)
	}
}

func TestGetGitRepositoryByPath(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{
		Path:     "/home/user/projects/test",
		Name:     "test",
		IsActive: true,
	}
	store.SaveGitRepository(repo)

	found, err := store.GetGitRepositoryByPath("/home/user/projects/test")
	if err != nil {
		t.Fatalf("failed to get repository: %v", err)
	}
	if found == nil {
		t.Fatal("expected to find repository")
	}
}

func TestGetActiveGitRepositories(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create active and inactive repos
	store.SaveGitRepository(&GitRepository{
		Path:     "/path/active1",
		Name:     "active1",
		IsActive: true,
	})
	store.SaveGitRepository(&GitRepository{
		Path:     "/path/inactive",
		Name:     "inactive",
		IsActive: false,
	})
	store.SaveGitRepository(&GitRepository{
		Path:     "/path/active2",
		Name:     "active2",
		IsActive: true,
	})

	repos, err := store.GetActiveGitRepositories()
	if err != nil {
		t.Fatalf("failed to get active repos: %v", err)
	}
	if len(repos) != 2 {
		t.Errorf("expected 2 active repos, got %d", len(repos))
	}
}

func TestUpdateRepositoryLastScanned(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{
		Path:     "/home/user/projects/test",
		Name:     "test",
		IsActive: true,
	}
	id, _ := store.SaveGitRepository(repo)

	now := time.Now().Unix()
	err := store.UpdateRepositoryLastScanned(id, now)
	if err != nil {
		t.Fatalf("failed to update last scanned: %v", err)
	}

	found, _ := store.GetGitRepository(id)
	if !found.LastScanned.Valid || found.LastScanned.Int64 != now {
		t.Error("expected LastScanned to be updated")
	}
}

func TestSetGitRepositoryActive(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{
		Path:     "/home/user/projects/test",
		Name:     "test",
		IsActive: true,
	}
	id, _ := store.SaveGitRepository(repo)

	err := store.SetGitRepositoryActive(id, false)
	if err != nil {
		t.Fatalf("failed to set active: %v", err)
	}

	found, _ := store.GetGitRepository(id)
	if found.IsActive {
		t.Error("expected IsActive=false")
	}
}

func TestGetAllGitRepositories(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 3; i++ {
		store.SaveGitRepository(&GitRepository{
			Path:     "/path/repo" + string(rune('0'+i)),
			Name:     "repo" + string(rune('0'+i)),
			IsActive: true,
		})
	}

	repos, err := store.GetAllGitRepositories()
	if err != nil {
		t.Fatalf("failed to get all repos: %v", err)
	}
	if len(repos) != 3 {
		t.Errorf("expected 3 repos, got %d", len(repos))
	}
}

func TestSaveGitCommit(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{
		Path:     "/path/test",
		Name:     "test",
		IsActive: true,
	}
	repoID, _ := store.SaveGitRepository(repo)

	commit := &GitCommit{
		Timestamp:      time.Now().Unix(),
		CommitHash:     "abc123def456",
		ShortHash:      "abc123d",
		RepositoryID:   repoID,
		Message:        "Test commit message",
		MessageSubject: "Test commit",
	}

	id, err := store.SaveGitCommit(commit)
	if err != nil {
		t.Fatalf("failed to save commit: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetGitCommitsBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{Path: "/path/test", Name: "test", IsActive: true}
	repoID, _ := store.SaveGitRepository(repo)

	sessionID, _ := store.CreateSession(time.Now().Unix())

	for i := 0; i < 3; i++ {
		commit := &GitCommit{
			Timestamp:      time.Now().Unix() + int64(i),
			CommitHash:     "hash" + string(rune('0'+i)),
			ShortHash:      "h" + string(rune('0'+i)),
			RepositoryID:   repoID,
			Message:        "Test",
			MessageSubject: "Test",
			SessionID:      sql.NullInt64{Int64: sessionID, Valid: true},
		}
		store.SaveGitCommit(commit)
	}

	commits, err := store.GetGitCommitsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get commits: %v", err)
	}
	if len(commits) != 3 {
		t.Errorf("expected 3 commits, got %d", len(commits))
	}
}

func TestGetGitCommitsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{Path: "/path/test", Name: "test", IsActive: true}
	repoID, _ := store.SaveGitRepository(repo)

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		commit := &GitCommit{
			Timestamp:      now + int64(i*60),
			CommitHash:     "hash" + string(rune('0'+i)),
			ShortHash:      "h" + string(rune('0'+i)),
			RepositoryID:   repoID,
			Message:        "Test",
			MessageSubject: "Test",
		}
		store.SaveGitCommit(commit)
	}

	commits, err := store.GetGitCommitsByTimeRange(now, now+180)
	if err != nil {
		t.Fatalf("failed to get commits: %v", err)
	}
	if len(commits) != 4 {
		t.Errorf("expected 4 commits, got %d", len(commits))
	}
}

func TestGetGitCommitsByRepository(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{Path: "/path/test", Name: "test", IsActive: true}
	repoID, _ := store.SaveGitRepository(repo)

	now := time.Now().Unix()

	for i := 0; i < 3; i++ {
		commit := &GitCommit{
			Timestamp:      now + int64(i),
			CommitHash:     "hash" + string(rune('0'+i)),
			ShortHash:      "h" + string(rune('0'+i)),
			RepositoryID:   repoID,
			Message:        "Test",
			MessageSubject: "Test",
		}
		store.SaveGitCommit(commit)
	}

	commits, err := store.GetGitCommitsByRepository(repoID, 10)
	if err != nil {
		t.Fatalf("failed to get commits: %v", err)
	}
	if len(commits) != 3 {
		t.Errorf("expected 3 commits, got %d", len(commits))
	}
}

func TestCommitExists(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{Path: "/path/test", Name: "test", IsActive: true}
	repoID, _ := store.SaveGitRepository(repo)

	commit := &GitCommit{
		Timestamp:      time.Now().Unix(),
		CommitHash:     "uniquehash123",
		ShortHash:      "unique1",
		RepositoryID:   repoID,
		Message:        "Test",
		MessageSubject: "Test",
	}
	store.SaveGitCommit(commit)

	exists, err := store.CommitExists("uniquehash123", repoID)
	if err != nil {
		t.Fatalf("failed to check commit exists: %v", err)
	}
	if !exists {
		t.Error("expected commit to exist")
	}

	exists, _ = store.CommitExists("nonexistent", repoID)
	if exists {
		t.Error("expected commit not to exist")
	}
}

func TestCountGitCommits(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{Path: "/path/test", Name: "test", IsActive: true}
	repoID, _ := store.SaveGitRepository(repo)

	for i := 0; i < 3; i++ {
		commit := &GitCommit{
			Timestamp:      time.Now().Unix() + int64(i),
			CommitHash:     "hash" + string(rune('0'+i)),
			ShortHash:      "h" + string(rune('0'+i)),
			RepositoryID:   repoID,
			Message:        "Test",
			MessageSubject: "Test",
		}
		store.SaveGitCommit(commit)
	}

	count, err := store.CountGitCommits()
	if err != nil {
		t.Fatalf("failed to count commits: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestCountGitCommitsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	repo := &GitRepository{Path: "/path/test", Name: "test", IsActive: true}
	repoID, _ := store.SaveGitRepository(repo)

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		commit := &GitCommit{
			Timestamp:      now + int64(i*60),
			CommitHash:     "hash" + string(rune('0'+i)),
			ShortHash:      "h" + string(rune('0'+i)),
			RepositoryID:   repoID,
			Message:        "Test",
			MessageSubject: "Test",
		}
		store.SaveGitCommit(commit)
	}

	count, err := store.CountGitCommitsByTimeRange(now, now+120)
	if err != nil {
		t.Fatalf("failed to count commits: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}
