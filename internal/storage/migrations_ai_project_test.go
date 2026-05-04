package storage

import (
	"database/sql"
	"fmt"
	"testing"
)

func TestMigration19_AddsAISessionProjectColumns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	rows, err := store.DB().Query(`PRAGMA table_info(ai_sessions)`)
	if err != nil {
		t.Fatalf("PRAGMA failed: %v", err)
	}
	defer rows.Close()

	cols := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			t.Fatalf("scan: %v", err)
		}
		cols[name] = true
	}

	for _, want := range []string{"project_id", "project_confidence", "project_source"} {
		if !cols[want] {
			t.Errorf("expected ai_sessions column %q, missing", want)
		}
	}

	var version int
	if err := store.DB().QueryRow(`SELECT version FROM schema_version`).Scan(&version); err != nil {
		t.Fatal(err)
	}
	if version < 19 {
		t.Errorf("schema_version = %d, want >= 19", version)
	}

	// Index check
	var idxCount int
	if err := store.DB().QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_ai_sessions_project'`,
	).Scan(&idxCount); err != nil {
		t.Fatal(err)
	}
	if idxCount != 1 {
		t.Errorf("expected idx_ai_sessions_project, found %d", idxCount)
	}

	_ = fmt.Sprintf // silence unused-import on golangci edge cases
}
