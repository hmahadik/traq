package storage

import (
	"path/filepath"
	"testing"
)

// NewInMemoryTestStore returns a Store backed by an on-disk SQLite DB under
// t.TempDir() (cleaned up automatically). Migrations are applied.
func NewInMemoryTestStore(t *testing.T) *Store {
	t.Helper()
	store, err := NewStore(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	if err := store.Migrate(); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	return store
}
