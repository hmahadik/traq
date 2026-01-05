package storage

import (
	"database/sql"
	"fmt"
)

// SaveGitRepository saves or updates a git repository.
func (s *Store) SaveGitRepository(repo *GitRepository) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO git_repositories (path, name, remote_url, last_scanned, is_active)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(path) DO UPDATE SET
			name = excluded.name,
			remote_url = excluded.remote_url,
			last_scanned = excluded.last_scanned,
			is_active = excluded.is_active`,
		repo.Path, repo.Name, repo.RemoteURL, repo.LastScanned, repo.IsActive,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save git repository: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		// On conflict, get the existing ID
		err = s.db.QueryRow("SELECT id FROM git_repositories WHERE path = ?", repo.Path).Scan(&id)
		if err != nil {
			return 0, fmt.Errorf("failed to get repository ID: %w", err)
		}
	}

	return id, nil
}

// GetGitRepository retrieves a repository by ID.
func (s *Store) GetGitRepository(id int64) (*GitRepository, error) {
	repo := &GitRepository{}
	err := s.db.QueryRow(`
		SELECT id, path, name, remote_url, last_scanned, is_active, created_at
		FROM git_repositories WHERE id = ?`, id).Scan(
		&repo.ID, &repo.Path, &repo.Name, &repo.RemoteURL, &repo.LastScanned, &repo.IsActive, &repo.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get repository: %w", err)
	}
	return repo, nil
}

// GetGitRepositoryByPath retrieves a repository by path.
func (s *Store) GetGitRepositoryByPath(path string) (*GitRepository, error) {
	repo := &GitRepository{}
	err := s.db.QueryRow(`
		SELECT id, path, name, remote_url, last_scanned, is_active, created_at
		FROM git_repositories WHERE path = ?`, path).Scan(
		&repo.ID, &repo.Path, &repo.Name, &repo.RemoteURL, &repo.LastScanned, &repo.IsActive, &repo.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get repository by path: %w", err)
	}
	return repo, nil
}

// GetActiveGitRepositories retrieves all active repositories.
func (s *Store) GetActiveGitRepositories() ([]*GitRepository, error) {
	rows, err := s.db.Query(`
		SELECT id, path, name, remote_url, last_scanned, is_active, created_at
		FROM git_repositories
		WHERE is_active = 1
		ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query repositories: %w", err)
	}
	defer rows.Close()

	var repos []*GitRepository
	for rows.Next() {
		repo := &GitRepository{}
		err := rows.Scan(
			&repo.ID, &repo.Path, &repo.Name, &repo.RemoteURL, &repo.LastScanned, &repo.IsActive, &repo.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repository: %w", err)
		}
		repos = append(repos, repo)
	}
	return repos, rows.Err()
}

// UpdateRepositoryLastScanned updates the last_scanned timestamp.
func (s *Store) UpdateRepositoryLastScanned(id int64, timestamp int64) error {
	_, err := s.db.Exec("UPDATE git_repositories SET last_scanned = ? WHERE id = ?", timestamp, id)
	return err
}

// SetGitRepositoryActive sets a repository's active status.
func (s *Store) SetGitRepositoryActive(id int64, active bool) error {
	_, err := s.db.Exec("UPDATE git_repositories SET is_active = ? WHERE id = ?", active, id)
	return err
}

// GetAllGitRepositories retrieves all repositories (both active and inactive).
func (s *Store) GetAllGitRepositories() ([]*GitRepository, error) {
	rows, err := s.db.Query(`
		SELECT id, path, name, remote_url, last_scanned, is_active, created_at
		FROM git_repositories
		ORDER BY name ASC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query all repositories: %w", err)
	}
	defer rows.Close()

	var repos []*GitRepository
	for rows.Next() {
		repo := &GitRepository{}
		err := rows.Scan(
			&repo.ID, &repo.Path, &repo.Name, &repo.RemoteURL, &repo.LastScanned, &repo.IsActive, &repo.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repository: %w", err)
		}
		repos = append(repos, repo)
	}
	return repos, rows.Err()
}

// SaveGitCommit saves a git commit to the database.
func (s *Store) SaveGitCommit(commit *GitCommit) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO git_commits (
			timestamp, commit_hash, short_hash, repository_id, branch,
			message, message_subject, files_changed, insertions, deletions,
			author_name, author_email, is_merge, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(commit_hash, repository_id) DO NOTHING`,
		commit.Timestamp, commit.CommitHash, commit.ShortHash, commit.RepositoryID, commit.Branch,
		commit.Message, commit.MessageSubject, commit.FilesChanged, commit.Insertions, commit.Deletions,
		commit.AuthorName, commit.AuthorEmail, commit.IsMerge, commit.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save git commit: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetGitCommitsBySession retrieves all git commits for a session.
func (s *Store) GetGitCommitsBySession(sessionID int64) ([]*GitCommit, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, commit_hash, short_hash, repository_id, branch,
		       message, message_subject, files_changed, insertions, deletions,
		       author_name, author_email, is_merge, session_id, created_at
		FROM git_commits
		WHERE session_id = ?
		ORDER BY timestamp ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query git commits: %w", err)
	}
	defer rows.Close()

	return scanGitCommits(rows)
}

// GetGitCommitsByTimeRange retrieves git commits within a time range.
func (s *Store) GetGitCommitsByTimeRange(start, end int64) ([]*GitCommit, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, commit_hash, short_hash, repository_id, branch,
		       message, message_subject, files_changed, insertions, deletions,
		       author_name, author_email, is_merge, session_id, created_at
		FROM git_commits
		WHERE timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query git commits by time: %w", err)
	}
	defer rows.Close()

	return scanGitCommits(rows)
}

// GetGitCommitsByRepository retrieves commits for a specific repository.
func (s *Store) GetGitCommitsByRepository(repoID int64, limit int) ([]*GitCommit, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, commit_hash, short_hash, repository_id, branch,
		       message, message_subject, files_changed, insertions, deletions,
		       author_name, author_email, is_merge, session_id, created_at
		FROM git_commits
		WHERE repository_id = ?
		ORDER BY timestamp DESC
		LIMIT ?`, repoID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query repository commits: %w", err)
	}
	defer rows.Close()

	return scanGitCommits(rows)
}

// CommitExists checks if a commit already exists.
func (s *Store) CommitExists(commitHash string, repoID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM git_commits WHERE commit_hash = ? AND repository_id = ?)`,
		commitHash, repoID).Scan(&exists)
	return exists, err
}

// CountGitCommits returns the total number of git commits.
func (s *Store) CountGitCommits() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM git_commits").Scan(&count)
	return count, err
}

// CountGitCommitsByTimeRange returns the count of commits in a time range.
func (s *Store) CountGitCommitsByTimeRange(start, end int64) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM git_commits
		WHERE timestamp >= ? AND timestamp <= ?`, start, end).Scan(&count)
	return count, err
}

func scanGitCommits(rows *sql.Rows) ([]*GitCommit, error) {
	var commits []*GitCommit
	for rows.Next() {
		commit := &GitCommit{}
		err := rows.Scan(
			&commit.ID, &commit.Timestamp, &commit.CommitHash, &commit.ShortHash, &commit.RepositoryID, &commit.Branch,
			&commit.Message, &commit.MessageSubject, &commit.FilesChanged, &commit.Insertions, &commit.Deletions,
			&commit.AuthorName, &commit.AuthorEmail, &commit.IsMerge, &commit.SessionID, &commit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan git commit: %w", err)
		}
		commits = append(commits, commit)
	}
	return commits, rows.Err()
}
