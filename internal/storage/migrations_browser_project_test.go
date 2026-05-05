package storage

import (
	"testing"
)

func TestMigration17_AddsBrowserProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	expected := []string{"project_id", "project_confidence", "project_source"}
	for _, col := range expected {
		var count int
		err := store.db.QueryRow(
			`SELECT COUNT(*) FROM pragma_table_info('browser_history') WHERE name = ?`,
			col,
		).Scan(&count)
		if err != nil {
			t.Fatalf("pragma_table_info(%s): %v", col, err)
		}
		if count != 1 {
			t.Errorf("expected column %s on browser_history, got count=%d", col, count)
		}
	}

	// Assignment index should exist for project_id lookups.
	var idxCount int
	err := store.db.QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name='browser_history' AND name='idx_browser_project'`,
	).Scan(&idxCount)
	if err != nil {
		t.Fatalf("index lookup failed: %v", err)
	}
	if idxCount != 1 {
		t.Errorf("expected idx_browser_project index, got %d", idxCount)
	}

	var version int
	if err := store.db.QueryRow(`SELECT version FROM schema_version`).Scan(&version); err != nil {
		t.Fatalf("schema_version lookup failed: %v", err)
	}
	if version < 17 {
		t.Errorf("expected schema version >= 17, got %d", version)
	}
}
