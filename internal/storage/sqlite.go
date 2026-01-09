package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

// Store manages the SQLite database connection.
type Store struct {
	db     *sql.DB
	dbPath string
}

// NewStore creates a new Store with a connection to the SQLite database.
func NewStore(dbPath string) (*Store, error) {
	// Ensure directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	// Open database with CGO SQLite driver
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000&_foreign_keys=ON")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Verify connection
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	store := &Store{
		db:     db,
		dbPath: dbPath,
	}

	// Run migrations
	if err := store.Migrate(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return store, nil
}

// Close closes the database connection.
func (s *Store) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

// DB returns the underlying database connection for advanced queries.
func (s *Store) DB() *sql.DB {
	return s.db
}

// Path returns the database file path.
func (s *Store) Path() string {
	return s.dbPath
}

// Transaction executes a function within a database transaction.
func (s *Store) Transaction(fn func(*sql.Tx) error) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("rollback failed: %v (original error: %w)", rbErr, err)
		}
		return err
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// Optimize runs VACUUM and ANALYZE on the database to reclaim space and update statistics.
// Returns the size reduction in bytes (positive if space was reclaimed).
func (s *Store) Optimize() (int64, error) {
	// Get size before optimization
	sizeBefore, err := s.getDatabaseSize()
	if err != nil {
		return 0, fmt.Errorf("failed to get database size before optimization: %w", err)
	}

	// Run VACUUM to reclaim space and defragment the database
	if _, err := s.db.Exec("VACUUM"); err != nil {
		return 0, fmt.Errorf("failed to run VACUUM: %w", err)
	}

	// Run ANALYZE to update query planner statistics
	if _, err := s.db.Exec("ANALYZE"); err != nil {
		return 0, fmt.Errorf("failed to run ANALYZE: %w", err)
	}

	// Get size after optimization
	sizeAfter, err := s.getDatabaseSize()
	if err != nil {
		return 0, fmt.Errorf("failed to get database size after optimization: %w", err)
	}

	return sizeBefore - sizeAfter, nil
}

// getDatabaseSize returns the current size of the database file in bytes.
func (s *Store) getDatabaseSize() (int64, error) {
	info, err := os.Stat(s.dbPath)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}
