package storage

import (
	"testing"
)

func TestMigration14_AddsShellProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	expected := []string{"project_id", "project_confidence", "project_source"}
	for _, col := range expected {
		var count int
		err := store.db.QueryRow(
			`SELECT COUNT(*) FROM pragma_table_info('shell_commands') WHERE name = ?`,
			col,
		).Scan(&count)
		if err != nil {
			t.Fatalf("pragma_table_info(%s): %v", col, err)
		}
		if count != 1 {
			t.Errorf("expected column %s on shell_commands, got count=%d", col, count)
		}
	}

	// Assignment index should exist for project_id lookups.
	var idxCount int
	err := store.db.QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='shell_commands' AND name='idx_shell_project'`,
	).Scan(&idxCount)
	if err != nil {
		t.Fatalf("index lookup failed: %v", err)
	}
	if idxCount != 1 {
		t.Errorf("expected idx_shell_project index, got %d", idxCount)
	}

	var version int
	if err := store.db.QueryRow(`SELECT version FROM schema_version`).Scan(&version); err != nil {
		t.Fatalf("schema_version lookup failed: %v", err)
	}
	if version < 14 {
		t.Errorf("expected schema version >= 14, got %d", version)
	}
}

// Repair should add the columns even when schema_version is already stamped at 14.
func TestRepairShellCommandsTable_AddsProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Simulate a DB where schema_version is stamped but columns are missing.
	// Drop the dependent index first so we can drop the indexed column.
	if _, err := store.db.Exec(`DROP INDEX IF EXISTS idx_shell_project`); err != nil {
		t.Fatalf("drop index: %v", err)
	}
	for _, col := range []string{"project_id", "project_confidence", "project_source"} {
		if _, err := store.db.Exec(
			`ALTER TABLE shell_commands DROP COLUMN ` + col,
		); err != nil {
			t.Fatalf("drop %s: %v", col, err)
		}
	}

	store.repairShellCommandsTable()

	for _, col := range []string{"project_id", "project_confidence", "project_source"} {
		var count int
		err := store.db.QueryRow(
			`SELECT COUNT(*) FROM pragma_table_info('shell_commands') WHERE name = ?`,
			col,
		).Scan(&count)
		if err != nil {
			t.Fatalf("pragma_table_info(%s): %v", col, err)
		}
		if count != 1 {
			t.Errorf("repair did not add column %s", col)
		}
	}
}
