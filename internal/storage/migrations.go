package storage

import (
	"fmt"
)

const schemaVersion = 1

const schema = `
-- ============================================================================
-- Core Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    filepath TEXT NOT NULL,
    dhash TEXT NOT NULL,
    window_title TEXT,
    app_name TEXT,
    window_x INTEGER,
    window_y INTEGER,
    window_width INTEGER,
    window_height INTEGER,
    monitor_name TEXT,
    monitor_width INTEGER,
    monitor_height INTEGER,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON screenshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_screenshots_session ON screenshots(session_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_dhash ON screenshots(dhash);

CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_seconds INTEGER,
    screenshot_count INTEGER DEFAULT 0,
    summary_id INTEGER REFERENCES summaries(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_start ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_end ON sessions(end_time);

CREATE TABLE IF NOT EXISTS summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id),
    summary TEXT NOT NULL,
    explanation TEXT,
    confidence TEXT,
    tags TEXT,
    model_used TEXT NOT NULL,
    inference_time_ms INTEGER,
    screenshot_ids TEXT,
    context_json TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id);

CREATE TABLE IF NOT EXISTS window_focus_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_title TEXT NOT NULL,
    app_name TEXT NOT NULL,
    window_class TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration_seconds REAL NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_focus_session ON window_focus_events(session_id);
CREATE INDEX IF NOT EXISTS idx_focus_start ON window_focus_events(start_time);

-- ============================================================================
-- Extended Data Sources
-- ============================================================================

CREATE TABLE IF NOT EXISTS shell_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    command TEXT NOT NULL,
    shell_type TEXT NOT NULL,
    working_directory TEXT,
    exit_code INTEGER,
    duration_seconds REAL,
    hostname TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_shell_timestamp ON shell_commands(timestamp);
CREATE INDEX IF NOT EXISTS idx_shell_session ON shell_commands(session_id);

CREATE TABLE IF NOT EXISTS git_repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    remote_url TEXT,
    last_scanned INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS git_commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    commit_hash TEXT NOT NULL,
    short_hash TEXT NOT NULL,
    repository_id INTEGER REFERENCES git_repositories(id),
    branch TEXT,
    message TEXT NOT NULL,
    message_subject TEXT NOT NULL,
    files_changed INTEGER,
    insertions INTEGER,
    deletions INTEGER,
    author_name TEXT,
    author_email TEXT,
    is_merge INTEGER DEFAULT 0,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(commit_hash, repository_id)
);

CREATE INDEX IF NOT EXISTS idx_git_timestamp ON git_commits(timestamp);
CREATE INDEX IF NOT EXISTS idx_git_session ON git_commits(session_id);
CREATE INDEX IF NOT EXISTS idx_git_repo ON git_commits(repository_id);

CREATE TABLE IF NOT EXISTS file_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    directory TEXT NOT NULL,
    file_extension TEXT,
    file_size_bytes INTEGER,
    watch_category TEXT NOT NULL,
    old_path TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_files_timestamp ON file_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_files_session ON file_events(session_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON file_events(watch_category);

CREATE TABLE IF NOT EXISTS browser_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    domain TEXT NOT NULL,
    browser TEXT NOT NULL,
    visit_duration_seconds INTEGER,
    transition_type TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_browser_timestamp ON browser_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_browser_session ON browser_history(session_id);
CREATE INDEX IF NOT EXISTS idx_browser_domain ON browser_history(domain);

-- ============================================================================
-- Reports & Configuration
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    time_range TEXT NOT NULL,
    report_type TEXT NOT NULL,
    format TEXT NOT NULL,
    content TEXT,
    filepath TEXT,
    start_time INTEGER,
    end_time INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- Schema Version
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER DEFAULT (strftime('%s', 'now'))
);
`

// Migrate applies any pending database migrations.
func (s *Store) Migrate() error {
	// Check current schema version
	var currentVersion int
	err := s.db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&currentVersion)
	if err != nil {
		// Table doesn't exist yet, that's fine
		currentVersion = 0
	}

	if currentVersion >= schemaVersion {
		return nil // Already up to date
	}

	// Apply schema
	if _, err := s.db.Exec(schema); err != nil {
		return fmt.Errorf("failed to apply schema: %w", err)
	}

	// Record schema version
	if currentVersion == 0 {
		_, err = s.db.Exec("INSERT OR REPLACE INTO schema_version (version) VALUES (?)", schemaVersion)
	} else {
		_, err = s.db.Exec("UPDATE schema_version SET version = ?, applied_at = strftime('%s', 'now')", schemaVersion)
	}
	if err != nil {
		return fmt.Errorf("failed to update schema version: %w", err)
	}

	return nil
}

// GetSchemaVersion returns the current schema version.
func (s *Store) GetSchemaVersion() (int, error) {
	var version int
	err := s.db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&version)
	return version, err
}
