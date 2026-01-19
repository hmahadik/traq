package storage

import (
	"database/sql"
	"fmt"
	"strings"
)

// SaveFocusEvent saves a window focus event.
func (s *Store) SaveFocusEvent(event *WindowFocusEvent) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO window_focus_events (
			window_title, app_name, window_class,
			start_time, end_time, duration_seconds, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		event.WindowTitle, event.AppName, event.WindowClass,
		event.StartTime, event.EndTime, event.DurationSeconds, event.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert focus event: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetFocusEventsBySession retrieves all focus events for a session.
func (s *Store) GetFocusEventsBySession(sessionID int64) ([]*WindowFocusEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, window_title, app_name, window_class,
		       start_time, end_time, duration_seconds, session_id, created_at
		FROM window_focus_events
		WHERE session_id = ?
		ORDER BY start_time ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query focus events: %w", err)
	}
	defer rows.Close()

	return scanFocusEvents(rows)
}

// GetFocusEventsByTimeRange retrieves focus events that overlap with a time range.
// An event overlaps if it starts at or before the range ends AND ends after the range starts.
// This correctly handles events that span midnight boundaries.
func (s *Store) GetFocusEventsByTimeRange(start, end int64) ([]*WindowFocusEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, window_title, app_name, window_class,
		       start_time, end_time, duration_seconds, session_id, created_at
		FROM window_focus_events
		WHERE start_time <= ? AND end_time > ?
		ORDER BY start_time ASC`, end, start)
	if err != nil {
		return nil, fmt.Errorf("failed to query focus events by time: %w", err)
	}
	defer rows.Close()

	return scanFocusEvents(rows)
}

// GetAppUsageByTimeRange returns aggregated app usage statistics.
// Uses overlap detection to correctly handle events spanning midnight boundaries.
func (s *Store) GetAppUsageByTimeRange(start, end int64) (map[string]float64, error) {
	rows, err := s.db.Query(`
		SELECT app_name, SUM(duration_seconds) as total_duration
		FROM window_focus_events
		WHERE start_time <= ? AND end_time > ?
		GROUP BY app_name
		ORDER BY total_duration DESC`, end, start)
	if err != nil {
		return nil, fmt.Errorf("failed to query app usage: %w", err)
	}
	defer rows.Close()

	usage := make(map[string]float64)
	for rows.Next() {
		var appName string
		var duration float64
		if err := rows.Scan(&appName, &duration); err != nil {
			return nil, fmt.Errorf("failed to scan app usage: %w", err)
		}
		usage[appName] = duration
	}
	return usage, rows.Err()
}

// GetTopApps returns the top N apps by usage duration.
// Uses overlap detection to correctly handle events spanning midnight boundaries.
func (s *Store) GetTopApps(start, end int64, limit int) ([]struct {
	AppName  string
	Duration float64
}, error) {
	rows, err := s.db.Query(`
		SELECT app_name, SUM(duration_seconds) as total_duration
		FROM window_focus_events
		WHERE start_time <= ? AND end_time > ?
		GROUP BY app_name
		ORDER BY total_duration DESC
		LIMIT ?`, end, start, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query top apps: %w", err)
	}
	defer rows.Close()

	var apps []struct {
		AppName  string
		Duration float64
	}
	for rows.Next() {
		var app struct {
			AppName  string
			Duration float64
		}
		if err := rows.Scan(&app.AppName, &app.Duration); err != nil {
			return nil, fmt.Errorf("failed to scan top apps: %w", err)
		}
		apps = append(apps, app)
	}
	return apps, rows.Err()
}

// GetWindowFocusEventsByTimeRange is an alias for GetFocusEventsByTimeRange.
func (s *Store) GetWindowFocusEventsByTimeRange(start, end int64) ([]*WindowFocusEvent, error) {
	return s.GetFocusEventsByTimeRange(start, end)
}

// GetWindowFocusEventsBySession is an alias for GetFocusEventsBySession.
func (s *Store) GetWindowFocusEventsBySession(sessionID int64) ([]*WindowFocusEvent, error) {
	return s.GetFocusEventsBySession(sessionID)
}

// GetFocusEventByID retrieves a single focus event by ID.
func (s *Store) GetFocusEventByID(id int64) (*WindowFocusEvent, error) {
	event := &WindowFocusEvent{}
	err := s.db.QueryRow(`
		SELECT id, window_title, app_name, window_class,
		       start_time, end_time, duration_seconds, session_id, created_at
		FROM window_focus_events
		WHERE id = ?`, id).Scan(
		&event.ID, &event.WindowTitle, &event.AppName, &event.WindowClass,
		&event.StartTime, &event.EndTime, &event.DurationSeconds, &event.SessionID, &event.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("focus event not found: %d", id)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get focus event: %w", err)
	}
	return event, nil
}

// UpdateFocusEvent updates editable fields of a window focus event.
// Duration is recalculated from the time range.
func (s *Store) UpdateFocusEvent(id int64, windowTitle, appName string, startTime, endTime int64) error {
	durationSeconds := float64(endTime-startTime) / 1.0 // Already in seconds

	result, err := s.db.Exec(`
		UPDATE window_focus_events
		SET window_title = ?, app_name = ?, start_time = ?, end_time = ?, duration_seconds = ?
		WHERE id = ?`,
		windowTitle, appName, startTime, endTime, durationSeconds, id)
	if err != nil {
		return fmt.Errorf("failed to update focus event: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("focus event not found: %d", id)
	}
	return nil
}

// DeleteFocusEvent removes a single focus event.
func (s *Store) DeleteFocusEvent(id int64) error {
	result, err := s.db.Exec(`DELETE FROM window_focus_events WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete focus event: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("focus event not found: %d", id)
	}
	return nil
}

// DeleteFocusEvents removes multiple focus events (bulk delete).
func (s *Store) DeleteFocusEvents(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	// Build placeholder string for IN clause
	placeholders := ""
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}

	query := fmt.Sprintf(`DELETE FROM window_focus_events WHERE id IN (%s)`, placeholders)
	result, err := s.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete focus events: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("no focus events found to delete")
	}
	return nil
}

// SetFocusEventsStatus updates status for multiple focus events.
func (s *Store) SetFocusEventsStatus(ids []int64, status string) error {
	if status != "active" && status != "ignored" {
		return fmt.Errorf("invalid status: %s", status)
	}
	if len(ids) == 0 {
		return nil
	}

	placeholders := make([]string, len(ids))
	args := make([]interface{}, len(ids)+1)
	args[0] = status
	for i, id := range ids {
		placeholders[i] = "?"
		args[i+1] = id
	}

	query := fmt.Sprintf(
		"UPDATE window_focus_events SET memory_status = ? WHERE id IN (%s)",
		strings.Join(placeholders, ","),
	)
	_, err := s.db.Exec(query, args...)
	return err
}

// GetActiveFocusEventsByTimeRange returns focus events excluding ignored ones.
func (s *Store) GetActiveFocusEventsByTimeRange(startTime, endTime int64) ([]*WindowFocusEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, window_title, app_name, window_class, start_time, end_time,
		       duration_seconds, session_id, project_id, project_confidence, project_source,
		       memory_status
		FROM window_focus_events
		WHERE start_time < ? AND end_time > ?
		  AND memory_status = 'active'
		ORDER BY start_time
	`, endTime, startTime)
	if err != nil {
		return nil, fmt.Errorf("failed to query active focus events: %w", err)
	}
	defer rows.Close()

	var events []*WindowFocusEvent
	for rows.Next() {
		e := &WindowFocusEvent{}
		err := rows.Scan(
			&e.ID, &e.WindowTitle, &e.AppName, &e.WindowClass,
			&e.StartTime, &e.EndTime, &e.DurationSeconds, &e.SessionID,
			&e.ProjectID, &e.ProjectConfidence, &e.ProjectSource,
			&e.MemoryStatus,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan active focus event: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

// GetFocusEventsForBackfill retrieves focus events with project assignment info for backfill.
// Unlike GetActiveFocusEventsByTimeRange, this includes all events regardless of memory_status.
func (s *Store) GetFocusEventsForBackfill(startTime, endTime int64) ([]*WindowFocusEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, window_title, app_name, window_class, start_time, end_time,
		       duration_seconds, session_id, project_id, project_confidence, project_source,
		       COALESCE(memory_status, 'active')
		FROM window_focus_events
		WHERE start_time < ? AND end_time > ?
		ORDER BY start_time
	`, endTime, startTime)
	if err != nil {
		return nil, fmt.Errorf("failed to query focus events for backfill: %w", err)
	}
	defer rows.Close()

	var events []*WindowFocusEvent
	for rows.Next() {
		e := &WindowFocusEvent{}
		err := rows.Scan(
			&e.ID, &e.WindowTitle, &e.AppName, &e.WindowClass,
			&e.StartTime, &e.EndTime, &e.DurationSeconds, &e.SessionID,
			&e.ProjectID, &e.ProjectConfidence, &e.ProjectSource,
			&e.MemoryStatus,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan focus event for backfill: %w", err)
		}
		events = append(events, e)
	}
	return events, rows.Err()
}

func scanFocusEvents(rows *sql.Rows) ([]*WindowFocusEvent, error) {
	var events []*WindowFocusEvent
	for rows.Next() {
		event := &WindowFocusEvent{}
		err := rows.Scan(
			&event.ID, &event.WindowTitle, &event.AppName, &event.WindowClass,
			&event.StartTime, &event.EndTime, &event.DurationSeconds, &event.SessionID, &event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan focus event: %w", err)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}
