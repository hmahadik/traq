package storage

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
)

// testStore creates a temporary store for testing.
func testStore(t *testing.T) (*Store, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(dir, "test.db")
	store, err := NewStore(dbPath)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("failed to create store: %v", err)
	}

	cleanup := func() {
		store.Close()
		os.RemoveAll(dir)
	}

	return store, cleanup
}

func TestNewStore(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	if store == nil {
		t.Fatal("expected non-nil store")
	}
	if store.DB() == nil {
		t.Fatal("expected non-nil DB connection")
	}
}

func TestStorePath(t *testing.T) {
	dir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	dbPath := filepath.Join(dir, "test.db")
	store, err := NewStore(dbPath)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}
	defer store.Close()

	if store.Path() != dbPath {
		t.Errorf("got path %s, want %s", store.Path(), dbPath)
	}
}

func TestStoreClose(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	err := store.Close()
	if err != nil {
		t.Errorf("unexpected error closing store: %v", err)
	}

	// Second close should not error
	err = store.Close()
	if err != nil {
		t.Errorf("unexpected error on second close: %v", err)
	}
}

func TestNewStoreCreatesDirectory(t *testing.T) {
	dir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	// Use a nested path that doesn't exist
	nestedPath := filepath.Join(dir, "nested", "subdir", "test.db")
	store, err := NewStore(nestedPath)
	if err != nil {
		t.Fatalf("failed to create store with nested path: %v", err)
	}
	defer store.Close()

	// Verify directory was created
	if _, err := os.Stat(filepath.Dir(nestedPath)); os.IsNotExist(err) {
		t.Error("expected nested directory to be created")
	}
}

func TestTransaction(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create a session within a transaction
	var sessionID int64
	err := store.Transaction(func(tx *sql.Tx) error {
		result, err := tx.Exec(`INSERT INTO sessions (start_time, screenshot_count) VALUES (?, ?)`, 1000, 0)
		if err != nil {
			return err
		}
		sessionID, err = result.LastInsertId()
		return err
	})
	if err != nil {
		t.Fatalf("transaction failed: %v", err)
	}

	// Verify session exists
	session, err := store.GetSession(sessionID)
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if session == nil {
		t.Fatal("expected session to exist")
	}
}

func TestTransactionRollback(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create a session that we'll try to reference in a failing transaction
	sessionID, err := store.CreateSession(1000)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Start a transaction that will fail
	err = store.Transaction(func(tx *sql.Tx) error {
		// Delete the session
		_, err := tx.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
		if err != nil {
			return err
		}
		// Force an error to trigger rollback
		return &testError{msg: "intentional error"}
	})

	if err == nil {
		t.Fatal("expected transaction to fail")
	}

	// Session should still exist due to rollback
	session, err := store.GetSession(sessionID)
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if session == nil {
		t.Fatal("expected session to exist after rollback")
	}
}

type testError struct {
	msg string
}

func (e *testError) Error() string {
	return e.msg
}
