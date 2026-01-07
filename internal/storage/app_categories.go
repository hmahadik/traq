package storage

import (
	"database/sql"
	"fmt"
)

// AppCategoryRecord represents an app categorization in the database.
type AppCategoryRecord struct {
	ID        int64  `json:"id"`
	AppName   string `json:"appName"`
	Category  string `json:"category"` // "productive", "neutral", or "distracting"
	CreatedAt int64  `json:"createdAt"`
	UpdatedAt int64  `json:"updatedAt"`
}

// GetAppCategory retrieves the category for a specific app.
func (s *Store) GetAppCategory(appName string) (*AppCategoryRecord, error) {
	var record AppCategoryRecord
	err := s.db.QueryRow(`
		SELECT id, app_name, category, created_at, updated_at
		FROM app_categories
		WHERE app_name = ?`,
		appName).Scan(&record.ID, &record.AppName, &record.Category, &record.CreatedAt, &record.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil // No category set for this app
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get app category: %w", err)
	}
	return &record, nil
}

// GetAllAppCategories retrieves all app categorizations.
func (s *Store) GetAllAppCategories() ([]*AppCategoryRecord, error) {
	rows, err := s.db.Query(`
		SELECT id, app_name, category, created_at, updated_at
		FROM app_categories
		ORDER BY app_name`)

	if err != nil {
		return nil, fmt.Errorf("failed to get all app categories: %w", err)
	}
	defer rows.Close()

	var categories []*AppCategoryRecord
	for rows.Next() {
		var record AppCategoryRecord
		if err := rows.Scan(&record.ID, &record.AppName, &record.Category, &record.CreatedAt, &record.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan app category row: %w", err)
		}
		categories = append(categories, &record)
	}
	return categories, rows.Err()
}

// SetAppCategory sets or updates the category for an app.
func (s *Store) SetAppCategory(appName, category string) error {
	// Validate category
	if category != "productive" && category != "neutral" && category != "distracting" {
		return fmt.Errorf("invalid category: %s (must be productive, neutral, or distracting)", category)
	}

	_, err := s.db.Exec(`
		INSERT INTO app_categories (app_name, category, created_at, updated_at)
		VALUES (?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
		ON CONFLICT(app_name) DO UPDATE SET
			category = excluded.category,
			updated_at = strftime('%s', 'now')`,
		appName, category)

	if err != nil {
		return fmt.Errorf("failed to set app category: %w", err)
	}
	return nil
}

// DeleteAppCategory removes the category for an app.
func (s *Store) DeleteAppCategory(appName string) error {
	_, err := s.db.Exec("DELETE FROM app_categories WHERE app_name = ?", appName)
	if err != nil {
		return fmt.Errorf("failed to delete app category: %w", err)
	}
	return nil
}

// GetDistinctAppNames retrieves all unique app names from focus events.
// This is useful for populating the categorization UI with apps that have been used.
func (s *Store) GetDistinctAppNames() ([]string, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT app_name
		FROM window_focus_events
		WHERE app_name != ''
		ORDER BY app_name`)

	if err != nil {
		return nil, fmt.Errorf("failed to get distinct app names: %w", err)
	}
	defer rows.Close()

	var apps []string
	for rows.Next() {
		var appName string
		if err := rows.Scan(&appName); err != nil {
			return nil, fmt.Errorf("failed to scan app name: %w", err)
		}
		apps = append(apps, appName)
	}
	return apps, rows.Err()
}
