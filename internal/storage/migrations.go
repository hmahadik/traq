package storage

import (
	"fmt"
)

const schemaVersion = 11

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
    window_class TEXT,
    process_pid INTEGER,
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
CREATE INDEX IF NOT EXISTS idx_screenshots_session_ts ON screenshots(session_id, timestamp);

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
CREATE INDEX IF NOT EXISTS idx_sessions_time_range ON sessions(start_time, end_time);

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
CREATE INDEX IF NOT EXISTS idx_focus_app ON window_focus_events(app_name);
CREATE INDEX IF NOT EXISTS idx_focus_end ON window_focus_events(end_time);

CREATE TABLE IF NOT EXISTS afk_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    session_id INTEGER REFERENCES sessions(id),
    trigger_type TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_afk_start ON afk_events(start_time);
CREATE INDEX IF NOT EXISTS idx_afk_session ON afk_events(session_id);
CREATE INDEX IF NOT EXISTS idx_afk_end ON afk_events(end_time);

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
CREATE INDEX IF NOT EXISTS idx_files_extension ON file_events(file_extension);
CREATE INDEX IF NOT EXISTS idx_files_event_type ON file_events(event_type);

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
CREATE INDEX IF NOT EXISTS idx_browser_domain_ts ON browser_history(domain, timestamp);

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

CREATE TABLE IF NOT EXISTS app_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('productive', 'neutral', 'distracting')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_app_categories_name ON app_categories(app_name);
CREATE INDEX IF NOT EXISTS idx_app_categories_category ON app_categories(category);

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

	// Apply incremental migrations
	if currentVersion < 2 {
		// Migration v2: Add window_class column to screenshots table
		if err := s.applyMigration2(); err != nil {
			return fmt.Errorf("failed to apply migration 2: %w", err)
		}
	}
	if currentVersion < 3 {
		// Migration v3: Add process_pid column to screenshots table
		if err := s.applyMigration3(); err != nil {
			return fmt.Errorf("failed to apply migration 3: %w", err)
		}
	}
	if currentVersion < 4 {
		// Migration v4: Add afk_events table
		if err := s.applyMigration4(); err != nil {
			return fmt.Errorf("failed to apply migration 4: %w", err)
		}
	}
	if currentVersion < 5 {
		// Migration v5: Add app_categorization_rules table for timeline v3 grid view
		if err := s.applyMigration5(); err != nil {
			return fmt.Errorf("failed to apply migration 5: %w", err)
		}
	}
	if currentVersion < 6 {
		// Migration v6: Add hierarchical_summaries and projects tables
		if err := s.applyMigration6(); err != nil {
			return fmt.Errorf("failed to apply migration 6: %w", err)
		}
	}
	if currentVersion < 7 {
		// Migration v7: Add issue_reports table for crash/manual issue reporting
		if err := s.applyMigration7(); err != nil {
			return fmt.Errorf("failed to apply migration 7: %w", err)
		}
	}
	if currentVersion < 8 {
		// Migration v8: Add projects column to summaries table for AI-detected project breakdowns
		if err := s.applyMigration8(); err != nil {
			return fmt.Errorf("failed to apply migration 8: %w", err)
		}
	}
	if currentVersion < 9 {
		// Migration v9: Add project assignment support with learning
		if err := s.applyMigration9(); err != nil {
			return fmt.Errorf("failed to apply migration 9: %w", err)
		}
	}
	if currentVersion < 10 {
		// Migration v10: Add memory_status for activity hiding and report config
		if err := s.applyMigration10(); err != nil {
			return fmt.Errorf("failed to apply migration 10: %w", err)
		}
	}
	if currentVersion < 11 {
		// Migration v11: Add activity_embeddings table for semantic similarity search
		if err := s.applyMigration11(); err != nil {
			return fmt.Errorf("failed to apply migration 11: %w", err)
		}
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

	// Run repair checks for tables that might be missing due to partial migrations
	s.repairMissingTables()

	return nil
}

// repairMissingTables creates any tables or columns that might be missing due to partial migration failures.
// This is a safety net for databases that have the schema version set but are missing tables/columns.
func (s *Store) repairMissingTables() {
	// Repair missing columns in projects table (migration 9 may have failed partially)
	s.repairProjectsTable()
	// Repair missing columns in window_focus_events table (migrations 9 & 10)
	s.repairFocusEventsTable()
	// Repair missing columns in screenshots table (migrations 9 & 10)
	s.repairScreenshotsTable()
	// Check and create project_patterns table if missing
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='project_patterns'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`
			CREATE TABLE IF NOT EXISTS project_patterns (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				pattern_type TEXT NOT NULL,
				pattern_value TEXT NOT NULL,
				match_type TEXT NOT NULL DEFAULT 'contains',
				weight REAL DEFAULT 1.0,
				hit_count INTEGER DEFAULT 1,
				last_used_at INTEGER,
				created_at INTEGER DEFAULT (strftime('%s', 'now')),
				UNIQUE(project_id, pattern_type, pattern_value, match_type)
			)
		`)
		s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_project_patterns_lookup ON project_patterns(pattern_type, pattern_value)`)
		s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_project_patterns_project ON project_patterns(project_id)`)
	}

	// Check and create assignment_examples table if missing
	err = s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='assignment_examples'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`
			CREATE TABLE IF NOT EXISTS assignment_examples (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
				event_type TEXT NOT NULL,
				event_id INTEGER NOT NULL,
				context_json TEXT NOT NULL,
				created_at INTEGER DEFAULT (strftime('%s', 'now'))
			)
		`)
		s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_assignment_examples_project ON assignment_examples(project_id)`)
		s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_assignment_examples_created ON assignment_examples(created_at)`)
	}
}

// repairProjectsTable adds missing columns to the projects table.
// This repairs databases where migration 9's ALTER TABLE statements failed silently.
func (s *Store) repairProjectsTable() {
	// Check if projects table exists first
	var tableCount int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='projects'`).Scan(&tableCount)
	if err != nil || tableCount == 0 {
		return // Table doesn't exist, nothing to repair
	}

	// Check and add 'color' column if missing
	var colorCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name = 'color'`).Scan(&colorCount)
	if err == nil && colorCount == 0 {
		s.db.Exec(`ALTER TABLE projects ADD COLUMN color TEXT DEFAULT '#6366f1'`)
	}

	// Check and add 'description' column if missing
	var descCount int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('projects') WHERE name = 'description'`).Scan(&descCount)
	if err == nil && descCount == 0 {
		s.db.Exec(`ALTER TABLE projects ADD COLUMN description TEXT`)
	}
}

// repairFocusEventsTable adds missing columns to window_focus_events table.
// This repairs databases where migration 9's or 10's ALTER TABLE statements failed silently.
func (s *Store) repairFocusEventsTable() {
	// Check if table exists
	var tableCount int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='window_focus_events'`).Scan(&tableCount)
	if err != nil || tableCount == 0 {
		return
	}

	// Migration 9 columns
	var count int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('window_focus_events') WHERE name = 'project_id'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('window_focus_events') WHERE name = 'project_confidence'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN project_confidence REAL DEFAULT 0.0`)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('window_focus_events') WHERE name = 'project_source'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN project_source TEXT DEFAULT 'unassigned'`)
	}

	// Migration 10 column
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('window_focus_events') WHERE name = 'memory_status'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN memory_status TEXT NOT NULL DEFAULT 'active'`)
	}

	// Create indexes if missing
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_focus_project ON window_focus_events(project_id)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_focus_memory_status ON window_focus_events(memory_status)`)
}

// repairScreenshotsTable adds missing columns to screenshots table.
// This repairs databases where migration 9's or 10's ALTER TABLE statements failed silently.
func (s *Store) repairScreenshotsTable() {
	// Check if table exists
	var tableCount int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='screenshots'`).Scan(&tableCount)
	if err != nil || tableCount == 0 {
		return
	}

	// Migration 9 columns
	var count int
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('screenshots') WHERE name = 'project_id'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE screenshots ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('screenshots') WHERE name = 'project_confidence'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE screenshots ADD COLUMN project_confidence REAL DEFAULT 0.0`)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('screenshots') WHERE name = 'project_source'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE screenshots ADD COLUMN project_source TEXT DEFAULT 'unassigned'`)
	}

	// Migration 10 column
	err = s.db.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('screenshots') WHERE name = 'memory_status'`).Scan(&count)
	if err == nil && count == 0 {
		s.db.Exec(`ALTER TABLE screenshots ADD COLUMN memory_status TEXT NOT NULL DEFAULT 'active'`)
	}

	// Create indexes if missing
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_screenshots_project ON screenshots(project_id)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_screenshot_memory_status ON screenshots(memory_status)`)
}

// applyMigration2 adds window_class column to screenshots table.
func (s *Store) applyMigration2() error {
	// Check if column already exists
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM pragma_table_info('screenshots') WHERE name = 'window_class'
	`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check column existence: %w", err)
	}
	if count > 0 {
		return nil // Column already exists
	}

	// Add the window_class column
	_, err = s.db.Exec(`ALTER TABLE screenshots ADD COLUMN window_class TEXT`)
	if err != nil {
		return fmt.Errorf("failed to add window_class column: %w", err)
	}
	return nil
}

// applyMigration3 adds process_pid column to screenshots table.
func (s *Store) applyMigration3() error {
	// Check if column already exists
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM pragma_table_info('screenshots') WHERE name = 'process_pid'
	`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check column existence: %w", err)
	}
	if count > 0 {
		return nil // Column already exists
	}

	// Add the process_pid column
	_, err = s.db.Exec(`ALTER TABLE screenshots ADD COLUMN process_pid INTEGER`)
	if err != nil {
		return fmt.Errorf("failed to add process_pid column: %w", err)
	}
	return nil
}

// GetSchemaVersion returns the current schema version.
func (s *Store) GetSchemaVersion() (int, error) {
	var version int
	err := s.db.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&version)
	return version, err
}

// applyMigration4 creates the afk_events table.
func (s *Store) applyMigration4() error {
	// Check if table already exists
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='afk_events'
	`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check table existence: %w", err)
	}
	if count > 0 {
		return nil // Table already exists
	}

	// Create the afk_events table
	_, err = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS afk_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			start_time INTEGER NOT NULL,
			end_time INTEGER,
			session_id INTEGER REFERENCES sessions(id),
			trigger_type TEXT NOT NULL,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);
		CREATE INDEX IF NOT EXISTS idx_afk_start ON afk_events(start_time);
		CREATE INDEX IF NOT EXISTS idx_afk_session ON afk_events(session_id);
		CREATE INDEX IF NOT EXISTS idx_afk_end ON afk_events(end_time);
	`)
	if err != nil {
		return fmt.Errorf("failed to create afk_events table: %w", err)
	}
	return nil
}

// applyMigration5 creates the app_categorization_rules table for timeline v3 grid view.
func (s *Store) applyMigration5() error {
	// Check if table already exists
	var count int
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='app_categorization_rules'
	`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check table existence: %w", err)
	}
	if count > 0 {
		return nil // Table already exists
	}

	// Create the app_categorization_rules table
	_, err = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS app_categorization_rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			app_name TEXT NOT NULL,
			category TEXT NOT NULL CHECK(category IN ('focus', 'meetings', 'comms', 'other')),
			is_system_default INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (strftime('%s', 'now')),
			UNIQUE(app_name)
		);
		CREATE INDEX IF NOT EXISTS idx_categorization_app ON app_categorization_rules(app_name);
		CREATE INDEX IF NOT EXISTS idx_categorization_category ON app_categorization_rules(category);
	`)
	if err != nil {
		return fmt.Errorf("failed to create app_categorization_rules table: %w", err)
	}

	// Seed default categorization rules
	defaultRules := []struct {
		appName  string
		category string
	}{
		// Focus apps
		{"Code", "focus"},
		{"code", "focus"},
		{"VSCode", "focus"},
		{"Visual Studio Code", "focus"},
		{"Vim", "focus"},
		{"vim", "focus"},
		{"Neovim", "focus"},
		{"nvim", "focus"},
		{"Terminal", "focus"},
		{"terminal", "focus"},
		{"Gnome-terminal", "focus"},
		{"Konsole", "focus"},
		{"Alacritty", "focus"},
		{"iTerm2", "focus"},
		{"IntelliJ IDEA", "focus"},
		{"PyCharm", "focus"},
		{"WebStorm", "focus"},
		{"Sublime Text", "focus"},
		{"Atom", "focus"},
		{"Emacs", "focus"},
		{"emacs", "focus"},

		// Meetings apps
		{"Zoom", "meetings"},
		{"zoom", "meetings"},
		{"Google Meet", "meetings"},
		{"meet.google.com", "meetings"},
		{"Microsoft Teams", "meetings"},
		{"teams.microsoft.com", "meetings"},
		{"Calendar", "meetings"},
		{"calendar.google.com", "meetings"},
		{"Skype", "meetings"},
		{"WebEx", "meetings"},

		// Communication apps
		{"Slack", "comms"},
		{"slack", "comms"},
		{"Discord", "comms"},
		{"discord", "comms"},
		{"Mail", "comms"},
		{"Thunderbird", "comms"},
		{"Gmail", "comms"},
		{"mail.google.com", "comms"},
		{"Outlook", "comms"},
		{"outlook.office.com", "comms"},
		{"Telegram", "comms"},
		{"WhatsApp", "comms"},
		{"Signal", "comms"},
	}

	for _, rule := range defaultRules {
		_, err = s.db.Exec(`
			INSERT OR IGNORE INTO app_categorization_rules (app_name, category, is_system_default, created_at)
			VALUES (?, ?, 1, strftime('%s', 'now'))
		`, rule.appName, rule.category)
		if err != nil {
			return fmt.Errorf("failed to seed default rule for %s: %w", rule.appName, err)
		}
	}

	return nil
}

// applyMigration6 creates the hierarchical_summaries and projects tables.
func (s *Store) applyMigration6() error {
	// Create hierarchical_summaries table
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS hierarchical_summaries (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			period_type TEXT NOT NULL CHECK(period_type IN ('day', 'week', 'month')),
			period_date TEXT NOT NULL,
			summary TEXT NOT NULL,
			user_edited INTEGER DEFAULT 0,
			generated_at INTEGER NOT NULL,
			created_at INTEGER DEFAULT (strftime('%s', 'now')),
			UNIQUE(period_type, period_date)
		);
		CREATE INDEX IF NOT EXISTS idx_hier_summaries_period ON hierarchical_summaries(period_type, period_date);
	`)
	if err != nil {
		return fmt.Errorf("failed to create hierarchical_summaries table: %w", err)
	}

	// Create projects table
	_, err = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			detection_patterns TEXT,
			is_manual INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);
		CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
	`)
	if err != nil {
		return fmt.Errorf("failed to create projects table: %w", err)
	}

	return nil
}

// applyMigration7 creates the issue_reports table for crash/manual issue reporting.
func (s *Store) applyMigration7() error {
	// Create issue_reports table
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS issue_reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			report_type TEXT NOT NULL CHECK(report_type IN ('crash', 'manual')),
			error_message TEXT,
			stack_trace TEXT,
			screenshot_ids TEXT,
			session_id INTEGER REFERENCES sessions(id),
			user_description TEXT,
			app_version TEXT,
			page_route TEXT,
			webhook_sent INTEGER DEFAULT 0,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		);
		CREATE INDEX IF NOT EXISTS idx_issue_reports_type ON issue_reports(report_type);
		CREATE INDEX IF NOT EXISTS idx_issue_reports_created ON issue_reports(created_at);
	`)
	if err != nil {
		return fmt.Errorf("failed to create issue_reports table: %w", err)
	}

	return nil
}

// applyMigration8 adds the projects column to summaries table for AI-detected project breakdowns.
func (s *Store) applyMigration8() error {
	// Add projects column to summaries table (JSON array of project breakdowns)
	_, err := s.db.Exec(`ALTER TABLE summaries ADD COLUMN projects TEXT`)
	if err != nil {
		// Column might already exist if schema was recreated
		return nil
	}

	return nil
}

// applyMigration9 adds project assignment support with pattern learning.
// - Adds project_id, project_confidence, project_source columns to event tables
// - Creates project_patterns table for learned matching rules
// - Creates assignment_examples table for few-shot AI learning
// - Adds color and description columns to projects table
func (s *Store) applyMigration9() error {
	// 1. Add color and description columns to projects table
	s.db.Exec(`ALTER TABLE projects ADD COLUMN color TEXT DEFAULT '#6366f1'`)
	s.db.Exec(`ALTER TABLE projects ADD COLUMN description TEXT`)

	// 2. Add project assignment columns to screenshots
	s.db.Exec(`ALTER TABLE screenshots ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
	s.db.Exec(`ALTER TABLE screenshots ADD COLUMN project_confidence REAL DEFAULT 0.0`)
	s.db.Exec(`ALTER TABLE screenshots ADD COLUMN project_source TEXT DEFAULT 'unassigned'`)

	// 3. Add project assignment columns to window_focus_events
	s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
	s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN project_confidence REAL DEFAULT 0.0`)
	s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN project_source TEXT DEFAULT 'unassigned'`)

	// 4. Add project assignment columns to git_commits
	s.db.Exec(`ALTER TABLE git_commits ADD COLUMN project_id INTEGER REFERENCES projects(id)`)
	s.db.Exec(`ALTER TABLE git_commits ADD COLUMN project_confidence REAL DEFAULT 0.0`)
	s.db.Exec(`ALTER TABLE git_commits ADD COLUMN project_source TEXT DEFAULT 'unassigned'`)

	// 5. Create project_patterns table for learned matching rules
	// Use separate statements because SQLite/Go doesn't handle multi-statement well
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS project_patterns (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			pattern_type TEXT NOT NULL,
			pattern_value TEXT NOT NULL,
			match_type TEXT NOT NULL DEFAULT 'contains',
			weight REAL DEFAULT 1.0,
			hit_count INTEGER DEFAULT 1,
			last_used_at INTEGER,
			created_at INTEGER DEFAULT (strftime('%s', 'now')),
			UNIQUE(project_id, pattern_type, pattern_value, match_type)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create project_patterns table: %w", err)
	}

	// Create indexes separately
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_project_patterns_lookup ON project_patterns(pattern_type, pattern_value)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_project_patterns_project ON project_patterns(project_id)`)

	// 6. Create assignment_examples table for few-shot AI learning
	_, err = s.db.Exec(`
		CREATE TABLE IF NOT EXISTS assignment_examples (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			event_type TEXT NOT NULL,
			event_id INTEGER NOT NULL,
			context_json TEXT NOT NULL,
			created_at INTEGER DEFAULT (strftime('%s', 'now'))
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create assignment_examples table: %w", err)
	}

	// Create indexes separately
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_assignment_examples_project ON assignment_examples(project_id)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_assignment_examples_created ON assignment_examples(created_at)`)

	// 7. Create indexes for project_id lookups on event tables
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_screenshots_project ON screenshots(project_id)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_focus_project ON window_focus_events(project_id)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_git_project ON git_commits(project_id)`)

	return nil
}

// applyMigration10 adds memory_status column to event tables and report config.
// - memory_status: 'active' (default) or 'ignored' - used to hide activities from view
// - reports.include_unassigned config: controls whether unassigned activities appear in reports
func (s *Store) applyMigration10() error {
	// 1. Add memory_status column to window_focus_events
	s.db.Exec(`ALTER TABLE window_focus_events ADD COLUMN memory_status TEXT NOT NULL DEFAULT 'active'`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_focus_memory_status ON window_focus_events(memory_status)`)

	// 2. Add memory_status column to screenshots
	s.db.Exec(`ALTER TABLE screenshots ADD COLUMN memory_status TEXT NOT NULL DEFAULT 'active'`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_screenshot_memory_status ON screenshots(memory_status)`)

	// 3. Add default config for report behavior
	_, err := s.db.Exec(`INSERT OR IGNORE INTO config (key, value) VALUES ('reports.include_unassigned', 'true')`)
	if err != nil {
		return fmt.Errorf("failed to insert reports.include_unassigned config: %w", err)
	}

	return nil
}

// applyMigration11 creates the activity_embeddings table for semantic similarity search.
// This table stores vector embeddings for activity context, enabling intelligent project assignment.
func (s *Store) applyMigration11() error {
	// Create activity_embeddings table
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS activity_embeddings (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event_type TEXT NOT NULL,
			event_id INTEGER NOT NULL,
			embedding BLOB NOT NULL,
			context_text TEXT NOT NULL,
			context_hash TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			UNIQUE(event_type, event_id)
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create activity_embeddings table: %w", err)
	}

	// Create indexes
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_event ON activity_embeddings(event_type, event_id)`)
	s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON activity_embeddings(context_hash)`)

	return nil
}
