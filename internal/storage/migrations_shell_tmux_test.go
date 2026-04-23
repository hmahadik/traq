package storage

import (
	"testing"
)

func TestMigration13_AddsTmuxContextColumn(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	var count int
	err := store.db.QueryRow(
		`SELECT COUNT(*) FROM pragma_table_info('shell_commands') WHERE name = 'tmux_context'`,
	).Scan(&count)
	if err != nil {
		t.Fatalf("pragma_table_info failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected tmux_context column, got count=%d", count)
	}

	var version int
	err = store.db.QueryRow(`SELECT version FROM schema_version`).Scan(&version)
	if err != nil {
		t.Fatalf("schema_version lookup failed: %v", err)
	}
	if version < 13 {
		t.Fatalf("expected schema version >= 13, got %d", version)
	}
}
