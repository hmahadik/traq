package tracker

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func setupGitTestDB(t *testing.T) (*storage.Store, string) {
	tmpDir, err := os.MkdirTemp("", "traq-git-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create store: %v", err)
	}

	return store, tmpDir
}

// createTestGitRepo creates a temporary git repository with initial commits
func createTestGitRepo(t *testing.T, tmpDir string, name string) string {
	repoPath := filepath.Join(tmpDir, name)
	if err := os.MkdirAll(repoPath, 0755); err != nil {
		t.Fatalf("Failed to create repo dir: %v", err)
	}

	// Initialize git repo
	cmd := exec.Command("git", "init")
	cmd.Dir = repoPath
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to init git repo: %v", err)
	}

	// Configure git user (required for commits)
	cmd = exec.Command("git", "config", "user.email", "test@example.com")
	cmd.Dir = repoPath
	cmd.Run()

	cmd = exec.Command("git", "config", "user.name", "Test User")
	cmd.Dir = repoPath
	cmd.Run()

	return repoPath
}

// addCommitToRepo adds a commit to the test repository
func addCommitToRepo(t *testing.T, repoPath string, message string) {
	// Create or modify a file
	testFile := filepath.Join(repoPath, "test.txt")
	f, err := os.OpenFile(testFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}
	f.WriteString(message + "\n")
	f.Close()

	// Add and commit
	cmd := exec.Command("git", "add", ".")
	cmd.Dir = repoPath
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to git add: %v", err)
	}

	cmd = exec.Command("git", "commit", "-m", message)
	cmd.Dir = repoPath
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to git commit: %v", err)
	}
}

func TestGitTracker_RegisterRepository(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)

	repo, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	if repo == nil {
		t.Fatal("Expected repo to be returned")
	}

	if repo.Path != repoPath {
		t.Errorf("Expected path %s, got %s", repoPath, repo.Path)
	}

	if repo.Name != "test-repo" {
		t.Errorf("Expected name 'test-repo', got '%s'", repo.Name)
	}

	if repo.ID == 0 {
		t.Error("Expected ID to be set")
	}

	// Verify in database
	dbRepo, err := store.GetGitRepository(repo.ID)
	if err != nil {
		t.Fatalf("Failed to get repo from DB: %v", err)
	}

	if dbRepo == nil {
		t.Error("Expected repo to exist in database")
	}
}

func TestGitTracker_RegisterRepository_AlreadyRegistered(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)

	// Register twice
	repo1, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("First registration failed: %v", err)
	}

	repo2, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("Second registration failed: %v", err)
	}

	// Should return same repo
	if repo1.ID != repo2.ID {
		t.Errorf("Expected same repo ID, got %d and %d", repo1.ID, repo2.ID)
	}

	// Count should be 1
	repos, err := tracker.GetRepositories()
	if err != nil {
		t.Fatalf("GetRepositories failed: %v", err)
	}

	if len(repos) != 1 {
		t.Errorf("Expected 1 repository, got %d", len(repos))
	}
}

func TestGitTracker_RegisterRepository_NotGitRepo(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	// Create a regular directory (not a git repo)
	notRepoPath := filepath.Join(tmpDir, "not-a-repo")
	os.MkdirAll(notRepoPath, 0755)

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(notRepoPath)
	if err == nil {
		t.Error("Expected error for non-git directory")
	}
}

func TestGitTracker_RegisterRepository_NonexistentPath(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository("/nonexistent/path")
	if err == nil {
		t.Error("Expected error for nonexistent path")
	}
}

func TestGitTracker_Poll_GetsNewCommits(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")
	addCommitToRepo(t, repoPath, "Second commit")

	tracker := NewGitTracker(store, tmpDir)

	// Register repository
	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	// Create session
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Poll for commits
	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) != 2 {
		t.Errorf("Expected 2 commits, got %d", len(commits))
	}

	// Verify commits are in database
	dbCommits, err := store.GetGitCommitsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get commits: %v", err)
	}

	if len(dbCommits) != 2 {
		t.Errorf("Expected 2 commits in DB, got %d", len(dbCommits))
	}
}

func TestGitTracker_Poll_DeduplicatesCommits(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// First poll
	commits1, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("First poll failed: %v", err)
	}
	if len(commits1) != 1 {
		t.Errorf("First poll: expected 1 commit, got %d", len(commits1))
	}

	// Second poll of same commits should return 0
	commits2, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Second poll failed: %v", err)
	}
	if len(commits2) != 0 {
		t.Errorf("Second poll: expected 0 commits (dedup), got %d", len(commits2))
	}

	// Verify total count in database is still 1
	count, err := store.CountGitCommits()
	if err != nil {
		t.Fatalf("Failed to count commits: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 total commit in DB, got %d", count)
	}
}

func TestGitTracker_Poll_NewCommitsAfterPoll(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// First poll
	commits1, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("First poll failed: %v", err)
	}
	if len(commits1) != 1 {
		t.Errorf("First poll: expected 1 commit, got %d", len(commits1))
	}

	// Add new commit
	addCommitToRepo(t, repoPath, "New commit after poll")

	// Second poll should get new commit
	commits2, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Second poll failed: %v", err)
	}
	if len(commits2) != 1 {
		t.Errorf("Second poll: expected 1 new commit, got %d", len(commits2))
	}

	// Total should be 2
	count, err := store.CountGitCommits()
	if err != nil {
		t.Fatalf("Failed to count commits: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected 2 total commits in DB, got %d", count)
	}
}

func TestGitTracker_Poll_NoRegisteredRepos(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker := NewGitTracker(store, tmpDir)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) != 0 {
		t.Errorf("Expected 0 commits for no repos, got %d", len(commits))
	}
}

func TestGitTracker_Poll_RepoPathMissing(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	// Delete the repo directory
	os.RemoveAll(repoPath)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Should not error, just skip
	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll should not error for missing repo: %v", err)
	}

	if len(commits) != 0 {
		t.Errorf("Expected 0 commits for missing repo, got %d", len(commits))
	}
}

func TestGitTracker_CommitMetadata(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Test commit message")

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) == 0 {
		t.Fatal("Expected at least 1 commit")
	}

	commit := commits[0]

	// Verify commit fields
	if commit.CommitHash == "" {
		t.Error("Expected commit hash to be set")
	}
	if len(commit.CommitHash) != 40 {
		t.Errorf("Expected 40-char commit hash, got %d chars", len(commit.CommitHash))
	}
	if commit.ShortHash == "" || len(commit.ShortHash) != 7 {
		t.Errorf("Expected 7-char short hash, got '%s'", commit.ShortHash)
	}
	if commit.AuthorName.String != "Test User" {
		t.Errorf("Expected author 'Test User', got '%s'", commit.AuthorName.String)
	}
	if commit.AuthorEmail.String != "test@example.com" {
		t.Errorf("Expected email 'test@example.com', got '%s'", commit.AuthorEmail.String)
	}
	if commit.Message != "Test commit message" {
		t.Errorf("Expected message 'Test commit message', got '%s'", commit.Message)
	}
	if commit.Timestamp == 0 {
		t.Error("Expected timestamp to be set")
	}
	if commit.SessionID.Int64 != sessionID {
		t.Errorf("Expected session ID %d, got %d", sessionID, commit.SessionID.Int64)
	}
}

func TestGitTracker_CommitStats(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")

	// Create a file with multiple lines
	testFile := filepath.Join(repoPath, "test.txt")
	os.WriteFile(testFile, []byte("line1\nline2\nline3\n"), 0644)

	cmd := exec.Command("git", "add", ".")
	cmd.Dir = repoPath
	cmd.Run()

	cmd = exec.Command("git", "commit", "-m", "Add lines")
	cmd.Dir = repoPath
	cmd.Run()

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) == 0 {
		t.Fatal("Expected at least 1 commit")
	}

	commit := commits[0]

	// Verify stats are populated
	if !commit.FilesChanged.Valid {
		t.Error("Expected FilesChanged to be set")
	}
	if commit.FilesChanged.Int64 < 1 {
		t.Errorf("Expected at least 1 file changed, got %d", commit.FilesChanged.Int64)
	}
	if !commit.Insertions.Valid {
		t.Error("Expected Insertions to be set")
	}
	if commit.Insertions.Int64 < 3 {
		t.Errorf("Expected at least 3 insertions, got %d", commit.Insertions.Int64)
	}
}

func TestGitTracker_CheckpointPersistence(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// First tracker instance
	tracker1 := NewGitTracker(store, tmpDir)
	_, err = tracker1.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	commits1, err := tracker1.Poll(sessionID)
	if err != nil {
		t.Fatalf("First poll failed: %v", err)
	}
	if len(commits1) != 1 {
		t.Errorf("First poll: expected 1 commit, got %d", len(commits1))
	}

	// Add new commit
	addCommitToRepo(t, repoPath, "New commit")

	// New tracker instance (simulating restart)
	tracker2 := NewGitTracker(store, tmpDir)
	commits2, err := tracker2.Poll(sessionID)
	if err != nil {
		t.Fatalf("Second poll failed: %v", err)
	}

	// Should only get the new commit
	if len(commits2) != 1 {
		t.Errorf("Second poll: expected 1 new commit, got %d", len(commits2))
	}

	if len(commits2) == 1 && commits2[0].Message != "New commit" {
		t.Errorf("Expected 'New commit', got '%s'", commits2[0].Message)
	}
}

func TestGitTracker_Reset(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)
	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// First poll
	tracker.Poll(sessionID)

	// Reset checkpoint
	err = tracker.Reset()
	if err != nil && !os.IsNotExist(err) {
		t.Fatalf("Reset failed: %v", err)
	}

	// Create new store to avoid duplicate detection from DB
	store2, err := storage.NewStore(filepath.Join(tmpDir, "test2.db"))
	if err != nil {
		t.Fatalf("Failed to create second store: %v", err)
	}
	defer store2.Close()

	sessionID2, err := store2.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session in store2: %v", err)
	}

	tracker2 := NewGitTracker(store2, tmpDir)
	_, err = tracker2.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository in tracker2 failed: %v", err)
	}

	// Should re-read all commits
	commits, err := tracker2.Poll(sessionID2)
	if err != nil {
		t.Fatalf("Poll after reset failed: %v", err)
	}

	if len(commits) != 1 {
		t.Errorf("Expected 1 commit after reset, got %d", len(commits))
	}
}

func TestGitTracker_UnregisterRepository(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")
	addCommitToRepo(t, repoPath, "Initial commit")

	tracker := NewGitTracker(store, tmpDir)

	repo, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	// Unregister
	err = tracker.UnregisterRepository(repo.ID)
	if err != nil {
		t.Fatalf("UnregisterRepository failed: %v", err)
	}

	// Add new commit
	addCommitToRepo(t, repoPath, "After unregister")

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Poll should skip the unregistered repo
	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) != 0 {
		t.Errorf("Expected 0 commits for unregistered repo, got %d", len(commits))
	}
}

func TestGitTracker_MultipleRepositories(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repo1Path := createTestGitRepo(t, tmpDir, "repo1")
	addCommitToRepo(t, repo1Path, "Commit in repo1")

	repo2Path := createTestGitRepo(t, tmpDir, "repo2")
	addCommitToRepo(t, repo2Path, "Commit in repo2")

	tracker := NewGitTracker(store, tmpDir)

	_, err := tracker.RegisterRepository(repo1Path)
	if err != nil {
		t.Fatalf("RegisterRepository repo1 failed: %v", err)
	}

	_, err = tracker.RegisterRepository(repo2Path)
	if err != nil {
		t.Fatalf("RegisterRepository repo2 failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) != 2 {
		t.Errorf("Expected 2 commits (1 per repo), got %d", len(commits))
	}

	// Verify both repos tracked
	repos, err := tracker.GetRepositories()
	if err != nil {
		t.Fatalf("GetRepositories failed: %v", err)
	}

	if len(repos) != 2 {
		t.Errorf("Expected 2 repositories, got %d", len(repos))
	}
}

func TestGitTracker_SetMaxCommits(t *testing.T) {
	store, tmpDir := setupGitTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	repoPath := createTestGitRepo(t, tmpDir, "test-repo")

	// Create multiple commits
	for i := 1; i <= 5; i++ {
		addCommitToRepo(t, repoPath, "Commit "+string(rune('0'+i)))
	}

	tracker := NewGitTracker(store, tmpDir)
	tracker.SetMaxCommits(2)

	_, err := tracker.RegisterRepository(repoPath)
	if err != nil {
		t.Fatalf("RegisterRepository failed: %v", err)
	}

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	commits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(commits) > 2 {
		t.Errorf("Expected max 2 commits (MaxCommits=2), got %d", len(commits))
	}
}
