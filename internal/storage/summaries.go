package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

// SaveSummary saves a summary to the database.
func (s *Store) SaveSummary(sum *Summary) (int64, error) {
	tagsJSON := ToJSONString(sum.Tags)
	screenshotIDsJSON := ToJSONString(sum.ScreenshotIDs)
	projectsJSON := toProjectsJSON(sum.Projects)

	result, err := s.db.Exec(`
		INSERT INTO summaries (
			session_id, summary, explanation, confidence, tags,
			model_used, inference_time_ms, screenshot_ids, context_json,
			projects
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sum.SessionID, sum.Summary, sum.Explanation, sum.Confidence, tagsJSON,
		sum.ModelUsed, sum.InferenceTimeMs, screenshotIDsJSON, sum.ContextJSON,
		projectsJSON,
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

// toProjectsJSON converts projects array to JSON string.
func toProjectsJSON(projects []ProjectBreakdown) string {
	if len(projects) == 0 {
		return "[]"
	}
	b, _ := json.Marshal(projects)
	return string(b)
}

// parseProjectsJSON parses projects JSON string to array.
func parseProjectsJSON(s sql.NullString) []ProjectBreakdown {
	if !s.Valid || s.String == "" || s.String == "[]" {
		return []ProjectBreakdown{}
	}
	var projects []ProjectBreakdown
	json.Unmarshal([]byte(s.String), &projects)
	return projects
}

// GetSummary retrieves a summary by ID.
func (s *Store) GetSummary(id int64) (*Summary, error) {
	sum := &Summary{}
	var tagsJSON, screenshotIDsJSON, projectsJSON sql.NullString

	err := s.db.QueryRow(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at,
		       projects
		FROM summaries WHERE id = ?`, id).Scan(
		&sum.ID, &sum.SessionID, &sum.Summary, &sum.Explanation, &sum.Confidence, &tagsJSON,
		&sum.ModelUsed, &sum.InferenceTimeMs, &screenshotIDsJSON, &sum.ContextJSON, &sum.CreatedAt,
		&projectsJSON,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get summary: %w", err)
	}

	sum.Tags = ParseJSONStringArray(tagsJSON)
	sum.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)
	sum.Projects = parseProjectsJSON(projectsJSON)

	return sum, nil
}

// GetSummaryBySession retrieves the summary for a specific session.
func (s *Store) GetSummaryBySession(sessionID int64) (*Summary, error) {
	sum := &Summary{}
	var tagsJSON, screenshotIDsJSON, projectsJSON sql.NullString

	err := s.db.QueryRow(`
		SELECT id, session_id, summary, explanation, confidence, tags,
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at,
		       projects
		FROM summaries WHERE session_id = ?
		ORDER BY created_at DESC LIMIT 1`, sessionID).Scan(
		&sum.ID, &sum.SessionID, &sum.Summary, &sum.Explanation, &sum.Confidence, &tagsJSON,
		&sum.ModelUsed, &sum.InferenceTimeMs, &screenshotIDsJSON, &sum.ContextJSON, &sum.CreatedAt,
		&projectsJSON,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get summary by session: %w", err)
	}

	sum.Tags = ParseJSONStringArray(tagsJSON)
	sum.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)
	sum.Projects = parseProjectsJSON(projectsJSON)

	return sum, nil
}

// DeleteSummary deletes a summary by ID.
func (s *Store) DeleteSummary(id int64) error {
	// Clear any session references first (sessions.summary_id -> summaries.id)
	_, err := s.db.Exec("UPDATE sessions SET summary_id = NULL WHERE summary_id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to clear session summary reference: %w", err)
	}

	_, err = s.db.Exec("DELETE FROM summaries WHERE id = ?", id)
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
		       model_used, inference_time_ms, screenshot_ids, context_json, created_at,
		       projects
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
		var tagsJSON, screenshotIDsJSON, projectsJSON sql.NullString
		err := rows.Scan(
			&sum.ID, &sum.SessionID, &sum.Summary, &sum.Explanation, &sum.Confidence, &tagsJSON,
			&sum.ModelUsed, &sum.InferenceTimeMs, &screenshotIDsJSON, &sum.ContextJSON, &sum.CreatedAt,
			&projectsJSON,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan summary: %w", err)
		}
		sum.Tags = ParseJSONStringArray(tagsJSON)
		sum.ScreenshotIDs = ParseJSONInt64Array(screenshotIDsJSON)
		sum.Projects = parseProjectsJSON(projectsJSON)
		summaries = append(summaries, sum)
	}
	return summaries, rows.Err()
}

// UpdateSummaryDraftStatus updates the draft status of a summary.
func (s *Store) UpdateSummaryDraftStatus(summaryID int64, isDraft bool, status string) error {
	isDraftInt := 0
	if isDraft {
		isDraftInt = 1
	}
	_, err := s.db.Exec(
		"UPDATE summaries SET is_draft = ?, draft_status = ? WHERE id = ?",
		isDraftInt, status, summaryID,
	)
	if err != nil {
		return fmt.Errorf("failed to update summary draft status: %w", err)
	}
	return nil
}

// UpdateFocusEventDraftStatus updates the draft status of a window focus event.
func (s *Store) UpdateFocusEventDraftStatus(activityID int64, isDraft bool, status string) error {
	isDraftInt := 0
	if isDraft {
		isDraftInt = 1
	}
	_, err := s.db.Exec(
		"UPDATE window_focus_events SET is_draft = ?, draft_status = ? WHERE id = ?",
		isDraftInt, status, activityID,
	)
	if err != nil {
		return fmt.Errorf("failed to update focus event draft status: %w", err)
	}
	return nil
}
