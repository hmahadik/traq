package storage

import (
	"database/sql"
	"fmt"
)

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
