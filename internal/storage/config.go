package storage

import (
	"database/sql"
	"fmt"
)

// GetConfig retrieves a config value by key.
func (s *Store) GetConfig(key string) (string, error) {
	var value string
	err := s.db.QueryRow("SELECT value FROM config WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get config: %w", err)
	}
	return value, nil
}

// SetConfig sets a config value.
func (s *Store) SetConfig(key, value string) error {
	_, err := s.db.Exec(`
		INSERT INTO config (key, value, updated_at)
		VALUES (?, ?, strftime('%s', 'now'))
		ON CONFLICT(key) DO UPDATE SET
			value = excluded.value,
			updated_at = strftime('%s', 'now')`, key, value)
	if err != nil {
		return fmt.Errorf("failed to set config: %w", err)
	}
	return nil
}

// GetAllConfig retrieves all config values.
func (s *Store) GetAllConfig() (map[string]string, error) {
	rows, err := s.db.Query("SELECT key, value FROM config")
	if err != nil {
		return nil, fmt.Errorf("failed to get all config: %w", err)
	}
	defer rows.Close()

	config := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, fmt.Errorf("failed to scan config row: %w", err)
		}
		config[key] = value
	}
	return config, rows.Err()
}

// DeleteConfig deletes a config value by key.
func (s *Store) DeleteConfig(key string) error {
	_, err := s.db.Exec("DELETE FROM config WHERE key = ?", key)
	if err != nil {
		return fmt.Errorf("failed to delete config: %w", err)
	}
	return nil
}
