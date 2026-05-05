package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

func TestMigration18_DropsScreenshotAndShellProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for _, table := range []string{"screenshots", "shell_commands"} {
		rows, err := store.DB().Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
		if err != nil {
			t.Fatal(err)
		}
		var cols []string
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt interface{}
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
				t.Fatal(err)
			}
			cols = append(cols, name)
			if name == "project_id" || name == "project_confidence" || name == "project_source" {
				t.Errorf("table %s still has dead column %q", table, name)
			}
		}
		rows.Close()
	}
}

// TestMigration18_PopulatedUpgradePath verifies that migration 18 correctly
// drops the project columns from screenshots even when they contain data.
// Prior to migration 18 the daemon auto-assign path wrote to
// screenshots.project_id, so real upgrade DBs can have non-NULL values there.
func TestMigration18_PopulatedUpgradePath(t *testing.T) {
	dir, err := os.MkdirTemp("", "traq-migration18-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)

	dbPath := filepath.Join(dir, "test.db")
	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=ON")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Build a minimal pre-migration-18 schema: screenshots and shell_commands
	// WITH their project columns, plus the index names migration 18 will drop.
	setup := []string{
		`CREATE TABLE projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)`,
		`INSERT INTO projects (name) VALUES ('Proj A')`,
		`CREATE TABLE screenshots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp INTEGER NOT NULL,
			filepath TEXT NOT NULL,
			dhash TEXT NOT NULL,
			project_id INTEGER REFERENCES projects(id),
			project_confidence REAL DEFAULT 0,
			project_source TEXT DEFAULT 'unassigned'
		)`,
		`CREATE INDEX idx_screenshots_project ON screenshots(project_id)`,
		`CREATE TABLE shell_commands (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			command TEXT NOT NULL,
			project_id INTEGER REFERENCES projects(id),
			project_confidence REAL DEFAULT 0,
			project_source TEXT DEFAULT 'unassigned'
		)`,
		`CREATE INDEX idx_shell_project ON shell_commands(project_id)`,
		`CREATE TABLE schema_version (version INTEGER PRIMARY KEY)`,
		`INSERT INTO schema_version VALUES (17)`,
	}
	for _, stmt := range setup {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("setup: %s: %v", stmt, err)
		}
	}

	// Insert screenshots with project_id populated — the populated upgrade path.
	_, err = db.Exec(`
		INSERT INTO screenshots (timestamp, filepath, dhash, project_id, project_confidence, project_source)
		VALUES (1000, '/tmp/a.png', 'abc', 1, 0.9, 'rule'),
		       (2000, '/tmp/b.png', 'def', NULL, 0, 'unassigned')
	`)
	if err != nil {
		t.Fatalf("insert screenshots: %v", err)
	}

	store := &Store{db: db, dbPath: dbPath}
	if err := store.applyMigration18(); err != nil {
		t.Fatalf("applyMigration18 failed: %v", err)
	}

	// Project columns must be gone from both tables.
	for _, table := range []string{"screenshots", "shell_commands"} {
		rows, err := db.Query(fmt.Sprintf(`PRAGMA table_info(%s)`, table))
		if err != nil {
			t.Fatal(err)
		}
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dflt interface{}
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
				rows.Close()
				t.Fatal(err)
			}
			if name == "project_id" || name == "project_confidence" || name == "project_source" {
				t.Errorf("table %s still has column %q after migration 18", table, name)
			}
		}
		rows.Close()
	}

	// Non-project screenshot data must survive the drop.
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM screenshots`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("expected 2 screenshots after migration, got %d", count)
	}

	var ts int
	var fp, dhash string
	if err := db.QueryRow(`SELECT timestamp, filepath, dhash FROM screenshots WHERE id = 1`).Scan(&ts, &fp, &dhash); err != nil {
		t.Fatalf("read screenshot after migration: %v", err)
	}
	if ts != 1000 || fp != "/tmp/a.png" || dhash != "abc" {
		t.Errorf("screenshot data corrupted after migration: ts=%d fp=%s dhash=%s", ts, fp, dhash)
	}
}
