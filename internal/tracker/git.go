package tracker

import (
	"bufio"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"traq/internal/storage"
)

// GitTracker tracks git activity in registered repositories.
type GitTracker struct {
	store           *storage.Store
	checkpointFile  string
	maxCommits      int
	onActivitySaved ActivitySavedCallback
}

// GitCheckpoint stores the last seen commit for each repository.
type GitCheckpoint struct {
	LastCommits map[int64]string `json:"last_commits"` // repo_id -> commit hash
}

// NewGitTracker creates a new GitTracker.
func NewGitTracker(store *storage.Store, dataDir string) *GitTracker {
	return &GitTracker{
		store:          store,
		checkpointFile: filepath.Join(dataDir, "git_checkpoint.json"),
		maxCommits:     100, // Max commits to fetch per poll
	}
}

// SetMaxCommits sets the maximum number of commits to fetch per poll.
func (t *GitTracker) SetMaxCommits(max int) {
	t.maxCommits = max
}

// RegisterRepository adds a repository to track.
func (t *GitTracker) RegisterRepository(path string) (*storage.GitRepository, error) {
	// Resolve to absolute path
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve path: %w", err)
	}

	// Find git root
	gitRoot, err := t.findGitRoot(absPath)
	if err != nil {
		return nil, fmt.Errorf("not a git repository: %w", err)
	}

	// Get remote URL
	remoteURL := t.getRemoteURL(gitRoot)

	// Check if already registered
	existing, err := t.store.GetGitRepositoryByPath(gitRoot)
	if err == nil && existing != nil {
		return existing, nil
	}

	// Create new repository record
	repo := &storage.GitRepository{
		Path:        gitRoot,
		Name:        filepath.Base(gitRoot),
		RemoteURL:   sql.NullString{String: remoteURL, Valid: remoteURL != ""},
		LastScanned: sql.NullInt64{Int64: 0, Valid: false},
		IsActive:    true,
	}

	id, err := t.store.SaveGitRepository(repo)
	if err != nil {
		return nil, err
	}
	repo.ID = id

	return repo, nil
}

// UnregisterRepository removes a repository from tracking.
func (t *GitTracker) UnregisterRepository(repoID int64) error {
	return t.store.SetGitRepositoryActive(repoID, false)
}

// Poll scans all registered repositories for new commits.
func (t *GitTracker) Poll(sessionID int64) ([]*storage.GitCommit, error) {
	repos, err := t.store.GetActiveGitRepositories()
	if err != nil {
		return nil, err
	}

	checkpoint, err := t.loadCheckpoint()
	if err != nil {
		checkpoint = &GitCheckpoint{LastCommits: make(map[int64]string)}
	}

	var allCommits []*storage.GitCommit

	for _, repo := range repos {
		// Skip if path doesn't exist
		if _, err := os.Stat(repo.Path); os.IsNotExist(err) {
			continue
		}

		lastCommit := checkpoint.LastCommits[repo.ID]
		commits, err := t.getNewCommits(repo, lastCommit, sessionID)
		if err != nil {
			continue // Log but continue with other repos
		}

		if len(commits) > 0 {
			// Save commits
			for _, commit := range commits {
				id, err := t.store.SaveGitCommit(commit)
				if err != nil {
					continue
				}
				commit.ID = id
				allCommits = append(allCommits, commit)
				if t.onActivitySaved != nil {
					go t.onActivitySaved("git", id, "", "", repo.Path)
				}
			}

			// Update checkpoint with newest commit
			checkpoint.LastCommits[repo.ID] = commits[0].CommitHash
		}

		// Update last scanned time
		t.store.UpdateRepositoryLastScanned(repo.ID, time.Now().Unix())
	}

	t.saveCheckpoint(checkpoint)

	return allCommits, nil
}

// getNewCommits fetches commits newer than the given hash.
func (t *GitTracker) getNewCommits(repo *storage.GitRepository, sinceHash string, sessionID int64) ([]*storage.GitCommit, error) {
	args := []string{"-C", repo.Path, "log", "--format=%H|%an|%ae|%at|%s", "-n", strconv.Itoa(t.maxCommits)}

	if sinceHash != "" {
		// Check if the hash exists
		checkCmd := exec.Command("git", "-C", repo.Path, "cat-file", "-t", sinceHash)
		if err := checkCmd.Run(); err == nil {
			args = append(args, sinceHash+"..HEAD")
		}
	}

	cmd := exec.Command("git", args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("git log failed: %w", err)
	}

	// Get current branch once for the entire batch, not per-commit
	branch := t.getCurrentBranch(repo.Path)

	var commits []*storage.GitCommit
	scanner := bufio.NewScanner(strings.NewReader(string(output)))

	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, "|", 5)
		if len(parts) != 5 {
			continue
		}

		timestamp, _ := strconv.ParseInt(parts[3], 10, 64)

		shortHash := parts[0]
		if len(shortHash) > 7 {
			shortHash = shortHash[:7]
		}

		commit := &storage.GitCommit{
			RepositoryID: repo.ID,
			CommitHash:   parts[0],
			ShortHash:    shortHash,
			AuthorName:   sql.NullString{String: parts[1], Valid: parts[1] != ""},
			AuthorEmail:  sql.NullString{String: parts[2], Valid: parts[2] != ""},
			Timestamp:    timestamp,
			Message:      parts[4],
			MessageSubject: parts[4],
			SessionID:    sql.NullInt64{Int64: sessionID, Valid: sessionID > 0},
			Branch:       sql.NullString{String: branch, Valid: branch != ""},
		}

		// Get diff stats for this commit
		stats := t.getCommitDiffStats(repo.Path, parts[0])
		commit.FilesChanged = sql.NullInt64{Int64: int64(stats.files), Valid: true}
		commit.Insertions = sql.NullInt64{Int64: int64(stats.insertions), Valid: true}
		commit.Deletions = sql.NullInt64{Int64: int64(stats.deletions), Valid: true}

		commits = append(commits, commit)
	}

	return commits, nil
}

type commitStats struct {
	files      int
	insertions int
	deletions  int
}

// getCurrentBranch returns the current branch name for a repository.
func (t *GitTracker) getCurrentBranch(repoPath string) string {
	branchCmd := exec.Command("git", "-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD")
	branchOutput, err := branchCmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(branchOutput))
}

// getCommitDiffStats returns file change statistics for a commit.
func (t *GitTracker) getCommitDiffStats(repoPath, hash string) commitStats {
	stats := commitStats{}

	// Get diff stats
	cmd := exec.Command("git", "-C", repoPath, "show", "--stat", "--format=", hash)
	output, err := cmd.Output()
	if err != nil {
		return stats
	}

	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "files changed") || strings.Contains(line, "file changed") {
			// Parse summary line: "3 files changed, 50 insertions(+), 10 deletions(-)"
			parts := strings.Split(line, ", ")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if strings.Contains(part, "file") {
					fmt.Sscanf(part, "%d", &stats.files)
				} else if strings.Contains(part, "insertion") {
					fmt.Sscanf(part, "%d", &stats.insertions)
				} else if strings.Contains(part, "deletion") {
					fmt.Sscanf(part, "%d", &stats.deletions)
				}
			}
		}
	}

	return stats
}

// findGitRoot finds the root of a git repository.
func (t *GitTracker) findGitRoot(path string) (string, error) {
	cmd := exec.Command("git", "-C", path, "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(output)), nil
}

// getRemoteURL returns the origin remote URL.
func (t *GitTracker) getRemoteURL(repoPath string) string {
	cmd := exec.Command("git", "-C", repoPath, "remote", "get-url", "origin")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}

func (t *GitTracker) loadCheckpoint() (*GitCheckpoint, error) {
	data, err := os.ReadFile(t.checkpointFile)
	if err != nil {
		return nil, err
	}

	var checkpoint GitCheckpoint
	if err := json.Unmarshal(data, &checkpoint); err != nil {
		return nil, err
	}

	return &checkpoint, nil
}

func (t *GitTracker) saveCheckpoint(checkpoint *GitCheckpoint) error {
	data, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}

	dir := filepath.Dir(t.checkpointFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(t.checkpointFile, data, 0644)
}

// Reset clears the checkpoint file.
func (t *GitTracker) Reset() error {
	return os.Remove(t.checkpointFile)
}

// GetRepositories returns all tracked repositories.
func (t *GitTracker) GetRepositories() ([]*storage.GitRepository, error) {
	return t.store.GetAllGitRepositories()
}

// GetCommitsForRepo returns recent commits for a repository.
func (t *GitTracker) GetCommitsForRepo(repoID int64, limit int) ([]*storage.GitCommit, error) {
	return t.store.GetGitCommitsByRepository(repoID, limit)
}

// GetRecentCommits returns recent commits across all repositories.
func (t *GitTracker) GetRecentCommits(limit int) ([]*storage.GitCommit, error) {
	// Get commits from all time with a limit
	return t.store.GetGitCommitsByTimeRange(0, time.Now().Unix())
}

// DiscoverRepositories searches for git repositories in the given paths up to maxDepth.
// It returns a list of newly discovered repositories (excluding already tracked ones).
func (t *GitTracker) DiscoverRepositories(searchPaths []string, maxDepth int) ([]*storage.GitRepository, error) {
	if maxDepth <= 0 {
		maxDepth = 3 // Default depth
	}

	var discovered []*storage.GitRepository

	for _, searchPath := range searchPaths {
		// Expand ~ to home directory
		expandedPath := expandPath(searchPath)

		// Check if the path exists
		info, err := os.Stat(expandedPath)
		if err != nil || !info.IsDir() {
			continue
		}

		// Walk the directory tree up to maxDepth
		repos, err := t.findGitReposInPath(expandedPath, maxDepth)
		if err != nil {
			continue
		}

		for _, repoPath := range repos {
			// Check if already tracked
			existing, err := t.store.GetGitRepositoryByPath(repoPath)
			if err == nil && existing != nil {
				continue // Skip already tracked repos
			}

			// Register the new repository
			repo, err := t.RegisterRepository(repoPath)
			if err != nil {
				continue
			}
			discovered = append(discovered, repo)
		}
	}

	return discovered, nil
}

// findGitReposInPath recursively finds git repositories up to maxDepth.
func (t *GitTracker) findGitReposInPath(rootPath string, maxDepth int) ([]string, error) {
	var repos []string

	err := filepath.WalkDir(rootPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil // Skip inaccessible directories
		}

		if !d.IsDir() {
			return nil
		}

		// Calculate current depth relative to root
		relPath, _ := filepath.Rel(rootPath, path)
		depth := 0
		if relPath != "." {
			depth = len(strings.Split(relPath, string(os.PathSeparator)))
		}

		// Check depth limit
		if depth > maxDepth {
			return filepath.SkipDir
		}

		// Skip common non-repo directories for performance
		baseName := d.Name()
		if baseName == "node_modules" || baseName == ".cache" || baseName == "vendor" ||
			baseName == "__pycache__" || baseName == ".venv" || baseName == "venv" ||
			baseName == ".npm" || baseName == ".cargo" || baseName == "target" {
			return filepath.SkipDir
		}

		// Check if this directory is a git repository
		gitDir := filepath.Join(path, ".git")
		if info, err := os.Stat(gitDir); err == nil && info.IsDir() {
			repos = append(repos, path)
			return filepath.SkipDir // Don't descend into git repos (no nested repos)
		}

		return nil
	})

	return repos, err
}

// expandPath expands ~ to home directory.
func expandPath(path string) string {
	if strings.HasPrefix(path, "~/") {
		home, err := os.UserHomeDir()
		if err == nil {
			return filepath.Join(home, path[2:])
		}
	}
	return path
}
