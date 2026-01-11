package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SaveHierarchicalSummary saves or updates a hierarchical summary.
func (s *Store) SaveHierarchicalSummary(hs *HierarchicalSummary) (int64, error) {
	userEdited := 0
	if hs.UserEdited {
		userEdited = 1
	}

	result, err := s.db.Exec(`
		INSERT INTO hierarchical_summaries (period_type, period_date, summary, user_edited, generated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(period_type, period_date) DO UPDATE SET
			summary = excluded.summary,
			user_edited = excluded.user_edited,
			generated_at = excluded.generated_at`,
		hs.PeriodType, hs.PeriodDate, hs.Summary, userEdited, hs.GeneratedAt,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save hierarchical summary: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetHierarchicalSummary retrieves a hierarchical summary by period type and date.
func (s *Store) GetHierarchicalSummary(periodType, periodDate string) (*HierarchicalSummary, error) {
	hs := &HierarchicalSummary{}
	var userEdited int

	err := s.db.QueryRow(`
		SELECT id, period_type, period_date, summary, user_edited, generated_at, created_at
		FROM hierarchical_summaries
		WHERE period_type = ? AND period_date = ?`,
		periodType, periodDate).Scan(
		&hs.ID, &hs.PeriodType, &hs.PeriodDate, &hs.Summary, &userEdited, &hs.GeneratedAt, &hs.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get hierarchical summary: %w", err)
	}

	hs.UserEdited = userEdited == 1
	return hs, nil
}

// GetHierarchicalSummaryByID retrieves a hierarchical summary by ID.
func (s *Store) GetHierarchicalSummaryByID(id int64) (*HierarchicalSummary, error) {
	hs := &HierarchicalSummary{}
	var userEdited int

	err := s.db.QueryRow(`
		SELECT id, period_type, period_date, summary, user_edited, generated_at, created_at
		FROM hierarchical_summaries WHERE id = ?`, id).Scan(
		&hs.ID, &hs.PeriodType, &hs.PeriodDate, &hs.Summary, &userEdited, &hs.GeneratedAt, &hs.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get hierarchical summary: %w", err)
	}

	hs.UserEdited = userEdited == 1
	return hs, nil
}

// ListHierarchicalSummaries retrieves all hierarchical summaries of a given period type.
func (s *Store) ListHierarchicalSummaries(periodType string, limit int) ([]*HierarchicalSummary, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := s.db.Query(`
		SELECT id, period_type, period_date, summary, user_edited, generated_at, created_at
		FROM hierarchical_summaries
		WHERE period_type = ?
		ORDER BY period_date DESC
		LIMIT ?`, periodType, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to list hierarchical summaries: %w", err)
	}
	defer rows.Close()

	var summaries []*HierarchicalSummary
	for rows.Next() {
		hs := &HierarchicalSummary{}
		var userEdited int
		err := rows.Scan(
			&hs.ID, &hs.PeriodType, &hs.PeriodDate, &hs.Summary, &userEdited, &hs.GeneratedAt, &hs.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan hierarchical summary: %w", err)
		}
		hs.UserEdited = userEdited == 1
		summaries = append(summaries, hs)
	}

	return summaries, rows.Err()
}

// UpdateHierarchicalSummary updates an existing hierarchical summary.
func (s *Store) UpdateHierarchicalSummary(hs *HierarchicalSummary) error {
	userEdited := 0
	if hs.UserEdited {
		userEdited = 1
	}

	_, err := s.db.Exec(`
		UPDATE hierarchical_summaries SET
			summary = ?, user_edited = ?, generated_at = ?
		WHERE id = ?`,
		hs.Summary, userEdited, hs.GeneratedAt, hs.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update hierarchical summary: %w", err)
	}
	return nil
}

// DeleteHierarchicalSummary deletes a hierarchical summary by ID.
func (s *Store) DeleteHierarchicalSummary(id int64) error {
	_, err := s.db.Exec("DELETE FROM hierarchical_summaries WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete hierarchical summary: %w", err)
	}
	return nil
}

// GetLatestHierarchicalSummaries retrieves the most recent summaries for each period type.
func (s *Store) GetLatestHierarchicalSummaries() (map[string]*HierarchicalSummary, error) {
	result := make(map[string]*HierarchicalSummary)

	for _, periodType := range []string{"day", "week", "month"} {
		hs := &HierarchicalSummary{}
		var userEdited int

		err := s.db.QueryRow(`
			SELECT id, period_type, period_date, summary, user_edited, generated_at, created_at
			FROM hierarchical_summaries
			WHERE period_type = ?
			ORDER BY period_date DESC
			LIMIT 1`, periodType).Scan(
			&hs.ID, &hs.PeriodType, &hs.PeriodDate, &hs.Summary, &userEdited, &hs.GeneratedAt, &hs.CreatedAt,
		)
		if err == sql.ErrNoRows {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("failed to get latest %s summary: %w", periodType, err)
		}

		hs.UserEdited = userEdited == 1
		result[periodType] = hs
	}

	return result, nil
}

// GetHierarchicalSummariesForRange retrieves summaries for a date range.
func (s *Store) GetHierarchicalSummariesForRange(periodType, startDate, endDate string) ([]*HierarchicalSummary, error) {
	rows, err := s.db.Query(`
		SELECT id, period_type, period_date, summary, user_edited, generated_at, created_at
		FROM hierarchical_summaries
		WHERE period_type = ? AND period_date >= ? AND period_date <= ?
		ORDER BY period_date ASC`, periodType, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query hierarchical summaries: %w", err)
	}
	defer rows.Close()

	var summaries []*HierarchicalSummary
	for rows.Next() {
		hs := &HierarchicalSummary{}
		var userEdited int
		err := rows.Scan(
			&hs.ID, &hs.PeriodType, &hs.PeriodDate, &hs.Summary, &userEdited, &hs.GeneratedAt, &hs.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan hierarchical summary: %w", err)
		}
		hs.UserEdited = userEdited == 1
		summaries = append(summaries, hs)
	}

	return summaries, rows.Err()
}

// MarkHierarchicalSummaryAsEdited marks a summary as user-edited.
func (s *Store) MarkHierarchicalSummaryAsEdited(id int64) error {
	_, err := s.db.Exec(`
		UPDATE hierarchical_summaries SET user_edited = 1 WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to mark summary as edited: %w", err)
	}
	return nil
}

// CountHierarchicalSummaries returns the count of summaries by period type.
func (s *Store) CountHierarchicalSummaries(periodType string) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM hierarchical_summaries WHERE period_type = ?`, periodType).Scan(&count)
	return count, err
}

// GetMissingDailySummaries returns dates that don't have daily summaries within a range.
func (s *Store) GetMissingDailySummaries(startDate, endDate string) ([]string, error) {
	// Get all existing daily summary dates
	existing := make(map[string]bool)
	rows, err := s.db.Query(`
		SELECT period_date FROM hierarchical_summaries
		WHERE period_type = 'day' AND period_date >= ? AND period_date <= ?`,
		startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query existing summaries: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var date string
		if err := rows.Scan(&date); err != nil {
			return nil, err
		}
		existing[date] = true
	}

	// Get dates that have sessions
	sessionDates := make(map[string]bool)
	sessionRows, err := s.db.Query(`
		SELECT DISTINCT date(start_time, 'unixepoch', 'localtime') as session_date
		FROM sessions
		WHERE date(start_time, 'unixepoch', 'localtime') >= ?
		  AND date(start_time, 'unixepoch', 'localtime') <= ?`,
		startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query session dates: %w", err)
	}
	defer sessionRows.Close()

	for sessionRows.Next() {
		var date string
		if err := sessionRows.Scan(&date); err != nil {
			return nil, err
		}
		sessionDates[date] = true
	}

	// Find dates with sessions but no summary
	var missing []string
	for date := range sessionDates {
		if !existing[date] {
			missing = append(missing, date)
		}
	}

	return missing, nil
}

// Helper to get current time as Unix timestamp
func now() int64 {
	return time.Now().Unix()
}
