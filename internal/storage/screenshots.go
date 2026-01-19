package storage

import (
	"database/sql"
	"fmt"
	"strings"
)

// SaveScreenshot saves a screenshot to the database.
func (s *Store) SaveScreenshot(sc *Screenshot) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO screenshots (
			timestamp, filepath, dhash, window_title, app_name, window_class, process_pid,
			window_x, window_y, window_width, window_height,
			monitor_name, monitor_width, monitor_height, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sc.Timestamp, sc.Filepath, sc.DHash, sc.WindowTitle, sc.AppName, sc.WindowClass, sc.ProcessPID,
		sc.WindowX, sc.WindowY, sc.WindowWidth, sc.WindowHeight,
		sc.MonitorName, sc.MonitorWidth, sc.MonitorHeight, sc.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert screenshot: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	// Update session screenshot count
	if sc.SessionID.Valid {
		_, err = s.db.Exec(`
			UPDATE sessions
			SET screenshot_count = screenshot_count + 1
			WHERE id = ?`, sc.SessionID.Int64)
		if err != nil {
			return id, fmt.Errorf("failed to update session count: %w", err)
		}
	}

	return id, nil
}

// GetScreenshot retrieves a screenshot by ID.
func (s *Store) GetScreenshot(id int64) (*Screenshot, error) {
	sc := &Screenshot{}
	err := s.db.QueryRow(`
		SELECT id, timestamp, filepath, dhash, window_title, app_name, window_class, process_pid,
		       window_x, window_y, window_width, window_height,
		       monitor_name, monitor_width, monitor_height, session_id, created_at
		FROM screenshots WHERE id = ?`, id).Scan(
		&sc.ID, &sc.Timestamp, &sc.Filepath, &sc.DHash, &sc.WindowTitle, &sc.AppName, &sc.WindowClass, &sc.ProcessPID,
		&sc.WindowX, &sc.WindowY, &sc.WindowWidth, &sc.WindowHeight,
		&sc.MonitorName, &sc.MonitorWidth, &sc.MonitorHeight, &sc.SessionID, &sc.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get screenshot: %w", err)
	}
	return sc, nil
}

// GetScreenshots retrieves screenshots within a time range.
func (s *Store) GetScreenshots(start, end int64) ([]*Screenshot, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, filepath, dhash, window_title, app_name, window_class, process_pid,
		       window_x, window_y, window_width, window_height,
		       monitor_name, monitor_width, monitor_height, session_id, created_at
		FROM screenshots
		WHERE timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query screenshots: %w", err)
	}
	defer rows.Close()

	return scanScreenshots(rows)
}

// GetScreenshotsBySession retrieves all screenshots for a session.
func (s *Store) GetScreenshotsBySession(sessionID int64) ([]*Screenshot, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, filepath, dhash, window_title, app_name, window_class, process_pid,
		       window_x, window_y, window_width, window_height,
		       monitor_name, monitor_width, monitor_height, session_id, created_at
		FROM screenshots
		WHERE session_id = ?
		ORDER BY timestamp ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query screenshots by session: %w", err)
	}
	defer rows.Close()

	return scanScreenshots(rows)
}

// GetScreenshotsByDate retrieves all screenshots for a specific date.
func (s *Store) GetScreenshotsByDate(year, month, day int) ([]*Screenshot, error) {
	// Calculate start and end timestamps for the day in local time
	// This is a simplified approach - proper timezone handling would use time.Location
	dateStr := fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	rows, err := s.db.Query(`
		SELECT id, timestamp, filepath, dhash, window_title, app_name, window_class, process_pid,
		       window_x, window_y, window_width, window_height,
		       monitor_name, monitor_width, monitor_height, session_id, created_at
		FROM screenshots
		WHERE date(timestamp, 'unixepoch', 'localtime') = ?
		ORDER BY timestamp ASC`, dateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to query screenshots by date: %w", err)
	}
	defer rows.Close()

	return scanScreenshots(rows)
}

// GetLatestScreenshot retrieves the most recent screenshot.
func (s *Store) GetLatestScreenshot() (*Screenshot, error) {
	sc := &Screenshot{}
	err := s.db.QueryRow(`
		SELECT id, timestamp, filepath, dhash, window_title, app_name, window_class, process_pid,
		       window_x, window_y, window_width, window_height,
		       monitor_name, monitor_width, monitor_height, session_id, created_at
		FROM screenshots
		ORDER BY timestamp DESC
		LIMIT 1`).Scan(
		&sc.ID, &sc.Timestamp, &sc.Filepath, &sc.DHash, &sc.WindowTitle, &sc.AppName, &sc.WindowClass, &sc.ProcessPID,
		&sc.WindowX, &sc.WindowY, &sc.WindowWidth, &sc.WindowHeight,
		&sc.MonitorName, &sc.MonitorWidth, &sc.MonitorHeight, &sc.SessionID, &sc.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get latest screenshot: %w", err)
	}
	return sc, nil
}

// DeleteScreenshot deletes a screenshot by ID.
func (s *Store) DeleteScreenshot(id int64) error {
	_, err := s.db.Exec("DELETE FROM screenshots WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete screenshot: %w", err)
	}
	return nil
}

// CountScreenshots returns the total number of screenshots.
func (s *Store) CountScreenshots() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM screenshots").Scan(&count)
	return count, err
}

// CountScreenshotsByDate returns the number of screenshots for a specific date.
func (s *Store) CountScreenshotsByDate(year, month, day int) (int64, error) {
	dateStr := fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM screenshots
		WHERE date(timestamp, 'unixepoch', 'localtime') = ?`, dateStr).Scan(&count)
	return count, err
}

// GetScreenshotsByTimeRange retrieves screenshots within a time range.
func (s *Store) GetScreenshotsByTimeRange(start, end int64) ([]*Screenshot, error) {
	return s.GetScreenshots(start, end)
}

// CountScreenshotsByTimeRange returns the count of screenshots in a time range.
func (s *Store) CountScreenshotsByTimeRange(start, end int64) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM screenshots
		WHERE timestamp >= ? AND timestamp <= ?`, start, end).Scan(&count)
	return count, err
}

func scanScreenshots(rows *sql.Rows) ([]*Screenshot, error) {
	var screenshots []*Screenshot
	for rows.Next() {
		sc := &Screenshot{}
		err := rows.Scan(
			&sc.ID, &sc.Timestamp, &sc.Filepath, &sc.DHash, &sc.WindowTitle, &sc.AppName, &sc.WindowClass, &sc.ProcessPID,
			&sc.WindowX, &sc.WindowY, &sc.WindowWidth, &sc.WindowHeight,
			&sc.MonitorName, &sc.MonitorWidth, &sc.MonitorHeight, &sc.SessionID, &sc.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan screenshot: %w", err)
		}
		screenshots = append(screenshots, sc)
	}
	return screenshots, rows.Err()
}

// SetScreenshotStatus updates the memory status of a screenshot.
// Valid statuses: 'active', 'ignored'
func (s *Store) SetScreenshotStatus(id int64, status string) error {
	if status != "active" && status != "ignored" {
		return fmt.Errorf("invalid status: %s", status)
	}
	_, err := s.db.Exec(
		"UPDATE screenshots SET memory_status = ? WHERE id = ?",
		status, id,
	)
	return err
}

// SetScreenshotsStatus updates status for multiple screenshots.
func (s *Store) SetScreenshotsStatus(ids []int64, status string) error {
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
		"UPDATE screenshots SET memory_status = ? WHERE id IN (%s)",
		strings.Join(placeholders, ","),
	)
	_, err := s.db.Exec(query, args...)
	return err
}
