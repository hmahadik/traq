package storage

import (
	"database/sql"
	"fmt"
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

// GetFocusEventsByTimeRange retrieves focus events within a time range.
func (s *Store) GetFocusEventsByTimeRange(start, end int64) ([]*WindowFocusEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, window_title, app_name, window_class,
		       start_time, end_time, duration_seconds, session_id, created_at
		FROM window_focus_events
		WHERE start_time >= ? AND start_time <= ?
		ORDER BY start_time ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query focus events by time: %w", err)
	}
	defer rows.Close()

	return scanFocusEvents(rows)
}

// GetAppUsageByTimeRange returns aggregated app usage statistics.
func (s *Store) GetAppUsageByTimeRange(start, end int64) (map[string]float64, error) {
	rows, err := s.db.Query(`
		SELECT app_name, SUM(duration_seconds) as total_duration
		FROM window_focus_events
		WHERE start_time >= ? AND start_time <= ?
		GROUP BY app_name
		ORDER BY total_duration DESC`, start, end)
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
func (s *Store) GetTopApps(start, end int64, limit int) ([]struct {
	AppName  string
	Duration float64
}, error) {
	rows, err := s.db.Query(`
		SELECT app_name, SUM(duration_seconds) as total_duration
		FROM window_focus_events
		WHERE start_time >= ? AND start_time <= ?
		GROUP BY app_name
		ORDER BY total_duration DESC
		LIMIT ?`, start, end, limit)
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
