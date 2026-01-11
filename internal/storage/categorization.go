package storage

import (
	"database/sql"
	"fmt"
	"strings"
)

// CategorizationRule represents an app categorization rule.
type CategorizationRule struct {
	ID              int64  `json:"id"`
	AppName         string `json:"appName"`
	Category        string `json:"category"` // focus, meetings, comms, other
	IsSystemDefault bool   `json:"isSystemDefault"`
	CreatedAt       int64  `json:"createdAt"`
}

// GetCategorizationRules retrieves all categorization rules from the database.
func (s *Store) GetCategorizationRules() ([]CategorizationRule, error) {
	query := `
		SELECT id, app_name, category, is_system_default, created_at
		FROM app_categorization_rules
		ORDER BY is_system_default DESC, app_name ASC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query categorization rules: %w", err)
	}
	defer rows.Close()

	var rules []CategorizationRule
	for rows.Next() {
		var rule CategorizationRule
		var isSystemDefault int
		if err := rows.Scan(&rule.ID, &rule.AppName, &rule.Category, &isSystemDefault, &rule.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan rule: %w", err)
		}
		rule.IsSystemDefault = isSystemDefault == 1
		rules = append(rules, rule)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rules: %w", err)
	}

	return rules, nil
}

// GetAppTimelineCategory retrieves the timeline v3 category for a specific app name.
// Returns the category and a boolean indicating if it was found.
// If not found, returns "other" as the default category.
func (s *Store) GetAppTimelineCategory(appName string) (string, error) {
	if appName == "" {
		return "other", nil
	}

	// Try exact match first
	query := `
		SELECT category
		FROM app_categorization_rules
		WHERE app_name = ?
		LIMIT 1
	`

	var category string
	err := s.db.QueryRow(query, appName).Scan(&category)
	if err == nil {
		return category, nil
	}
	if err != sql.ErrNoRows {
		return "", fmt.Errorf("failed to query category: %w", err)
	}

	// Try case-insensitive match
	query = `
		SELECT category
		FROM app_categorization_rules
		WHERE LOWER(app_name) = LOWER(?)
		LIMIT 1
	`

	err = s.db.QueryRow(query, appName).Scan(&category)
	if err == nil {
		return category, nil
	}
	if err != sql.ErrNoRows {
		return "", fmt.Errorf("failed to query category (case-insensitive): %w", err)
	}

	// Default to "other" if no match found
	return "other", nil
}

// GetAppTimelineCategories retrieves timeline v3 categories for multiple app names at once.
// Returns a map of appName -> category.
func (s *Store) GetAppTimelineCategories(appNames []string) (map[string]string, error) {
	if len(appNames) == 0 {
		return make(map[string]string), nil
	}

	categories := make(map[string]string)

	// Get all rules from the database
	rules, err := s.GetCategorizationRules()
	if err != nil {
		return nil, fmt.Errorf("failed to get categorization rules: %w", err)
	}

	// Create lookup maps (both exact and lowercase)
	exactMap := make(map[string]string)
	lowerMap := make(map[string]string)
	for _, rule := range rules {
		exactMap[rule.AppName] = rule.Category
		lowerMap[strings.ToLower(rule.AppName)] = rule.Category
	}

	// Categorize each app
	for _, appName := range appNames {
		if appName == "" {
			categories[appName] = "other"
			continue
		}

		// Try exact match first
		if category, found := exactMap[appName]; found {
			categories[appName] = category
			continue
		}

		// Try case-insensitive match
		if category, found := lowerMap[strings.ToLower(appName)]; found {
			categories[appName] = category
			continue
		}

		// Default to "other"
		categories[appName] = "other"
	}

	return categories, nil
}

// SetAppTimelineCategory creates or updates a timeline v3 categorization rule for an app.
func (s *Store) SetAppTimelineCategory(appName, category string) error {
	if appName == "" {
		return fmt.Errorf("app name cannot be empty")
	}

	// Validate category
	validCategories := map[string]bool{
		"focus":    true,
		"meetings": true,
		"comms":    true,
		"other":    true,
	}
	if !validCategories[category] {
		return fmt.Errorf("invalid category: %s (must be focus, meetings, comms, or other)", category)
	}

	query := `
		INSERT INTO app_categorization_rules (app_name, category, is_system_default, created_at)
		VALUES (?, ?, 0, strftime('%s', 'now'))
		ON CONFLICT(app_name) DO UPDATE SET
			category = excluded.category
	`

	_, err := s.db.Exec(query, appName, category)
	if err != nil {
		return fmt.Errorf("failed to set app category: %w", err)
	}

	return nil
}

// DeleteTimelineCategoryRule deletes a timeline v3 categorization rule for an app.
// System default rules should not be deleted through this method.
func (s *Store) DeleteTimelineCategoryRule(appName string) error {
	if appName == "" {
		return fmt.Errorf("app name cannot be empty")
	}

	query := `
		DELETE FROM app_categorization_rules
		WHERE app_name = ? AND is_system_default = 0
	`

	result, err := s.db.Exec(query, appName)
	if err != nil {
		return fmt.Errorf("failed to delete category rule: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("rule not found or is a system default")
	}

	return nil
}
