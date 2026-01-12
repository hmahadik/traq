package storage

import (
	"database/sql"
	"fmt"
)

// SaveSummary saves a summary to the database.
func (s *Store) SaveSummary(sum *Summary) (int64, error) {
	tagsJSON := ToJSONString(sum.Tags)
	screenshotIDsJSON := ToJSONString(sum.ScreenshotIDs)

	result, err := s.db.Exec(`
		INSERT INTO summaries (
			session_id, summary, explanation, confidence, tags,
			model_used, inference_time_ms, screenshot_ids, context_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sum.SessionID, sum.Summary, sum.Explanation, sum.Confidence, tagsJSON,
		sum.ModelUsed, sum.InferenceTimeMs, screenshotIDsJSON, sum.ContextJSON,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert summary: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetSummary retrieves a summary by ID.
func (s *Store) GetSummary(id int64) (*Summary, error) {
	sum := &Summary{}
	var tagsJSON, screenshotIDsJSON sql.NullString

	err := s.db.QueryRow(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at
		FROM summaries WHERE id = ?`, id).Scan(
		&sum.ID, &sum.SessionID, &sum.Summary, &sum.Explanation, &sum.Confidence, &tagsJSON,
		&sum.ModelUsed, &sum.InferenceTimeMs, &screenshotIDsJSON, &sum.ContextJSON, &sum.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get summary: %w", err)
	}

	sum.Tags = ParseJSONStringArray(tagsJSON)
	sum.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)

	return sum, nil
}

// GetSummaryBySession retrieves the summary for a specific session.
func (s *Store) GetSummaryBySession(sessionID int64) (*Summary, error) {
	sum := &Summary{}
	var tagsJSON, screenshotIDsJSON sql.NullString

	err := s.db.QueryRow(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at
		FROM summaries WHERE session_id = ?
		ORDER BY created_at DESC LIMIT 1`, sessionID).Scan(
		&sum.ID, &sum.SessionID, &sum.Summary, &sum.Explanation, &sum.Confidence, &tagsJSON,
		&sum.ModelUsed, &sum.InferenceTimeMs, &screenshotIDsJSON, &sum.ContextJSON, &sum.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get summary by session: %w", err)
	}

	sum.Tags = ParseJSONStringArray(tagsJSON)
	sum.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)

	return sum, nil
}

// GetSummariesByDateRange retrieves summaries created within a time range.
func (s *Store) GetSummariesByDateRange(start, end int64) ([]*Summary, error) {
	rows, err := s.db.Query(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at
		FROM summaries
		WHERE created_at >= ? AND created_at <= ?
		ORDER BY created_at ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query summaries: %w", err)
	}
	defer rows.Close()

	return scanSummaries(rows)
}

// GetRecentSummaries retrieves the most recent N summaries.
func (s *Store) GetRecentSummaries(limit int) ([]*Summary, error) {
	rows, err := s.db.Query(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at
		FROM summaries
		ORDER BY created_at DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent summaries: %w", err)
	}
	defer rows.Close()

	return scanSummaries(rows)
}

// UpdateSummary updates an existing summary.
func (s *Store) UpdateSummary(sum *Summary) error {
	tagsJSON := ToJSONString(sum.Tags)
	screenshotIDsJSON := ToJSONString(sum.ScreenshotIDs)

	_, err := s.db.Exec(`
		UPDATE summaries SET
			summary = ?, explanation = ?, confidence = ?, tags = ?,
			model_used = ?, inference_time_ms = ?, screenshot_ids = ?, context_json = ?
		WHERE id = ?`,
		sum.Summary, sum.Explanation, sum.Confidence, tagsJSON,
		sum.ModelUsed, sum.InferenceTimeMs, screenshotIDsJSON, sum.ContextJSON, sum.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update summary: %w", err)
	}
	return nil
}

// DeleteSummary deletes a summary by ID.
func (s *Store) DeleteSummary(id int64) error {
	_, err := s.db.Exec("DELETE FROM summaries WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete summary: %w", err)
	}
	return nil
}

// CountSummaries returns the total number of summaries.
func (s *Store) CountSummaries() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM summaries").Scan(&count)
	return count, err
}

// GetSummariesForSessions retrieves summaries for multiple sessions in a single query.
// Returns a map of sessionID -> Summary for efficient lookup.
func (s *Store) GetSummariesForSessions(sessionIDs []int64) (map[int64]*Summary, error) {
	if len(sessionIDs) == 0 {
		return make(map[int64]*Summary), nil
	}

	// Build IN clause with placeholders
	placeholders := make([]interface{}, len(sessionIDs))
	for i, id := range sessionIDs {
		placeholders[i] = id
	}

	query := fmt.Sprintf(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at
		FROM summaries
		WHERE session_id IN (?%s)
		ORDER BY session_id, created_at DESC`,
		repeatPlaceholder(len(sessionIDs)-1))

	rows, err := s.db.Query(query, placeholders...)
	if err != nil {
		return nil, fmt.Errorf("failed to query summaries for sessions: %w", err)
	}
	defer rows.Close()

	summaries, err := scanSummaries(rows)
	if err != nil {
		return nil, err
	}

	// Build map, keeping only the most recent summary per session
	summaryMap := make(map[int64]*Summary)
	for _, sum := range summaries {
		if sum.SessionID.Valid {
			// Only store if not already present (already sorted by created_at DESC)
			if _, exists := summaryMap[sum.SessionID.Int64]; !exists {
				summaryMap[sum.SessionID.Int64] = sum
			}
		}
	}

	return summaryMap, nil
}

// repeatPlaceholder returns a string with N comma-separated "?" placeholders.
func repeatPlaceholder(n int) string {
	if n <= 0 {
		return ""
	}
	result := make([]byte, n*3) // ", ?" is 3 chars
	for i := 0; i < n; i++ {
		result[i*3] = ','
		result[i*3+1] = ' '
		result[i*3+2] = '?'
	}
	return string(result)
}

func scanSummaries(rows *sql.Rows) ([]*Summary, error) {
	var summaries []*Summary
	for rows.Next() {
		sum := &Summary{}
		var tagsJSON, screenshotIDsJSON sql.NullString
		err := rows.Scan(
			&sum.ID, &sum.SessionID, &sum.Summary, &sum.Explanation, &sum.Confidence, &tagsJSON,
			&sum.ModelUsed, &sum.InferenceTimeMs, &screenshotIDsJSON, &sum.ContextJSON, &sum.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan summary: %w", err)
		}
		sum.Tags = ParseJSONStringArray(tagsJSON)
		sum.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)
		summaries = append(summaries, sum)
	}
	return summaries, rows.Err()
}
