package storage

import (
	"database/sql"
	"fmt"
)

// CreateSession creates a new session with the given start time.
func (s *Store) CreateSession(startTime int64) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO sessions (start_time, screenshot_count)
		VALUES (?, 0)`, startTime)
	if err != nil {
		return 0, fmt.Errorf("failed to create session: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// EndSession ends a session by setting its end time and calculating duration.
func (s *Store) EndSession(id int64, endTime int64) error {
	_, err := s.db.Exec(`
		UPDATE sessions
		SET end_time = ?,
		    duration_seconds = ? - start_time
		WHERE id = ?`, endTime, endTime, id)
	if err != nil {
		return fmt.Errorf("failed to end session: %w", err)
	}
	return nil
}

// GetSession retrieves a session by ID.
func (s *Store) GetSession(id int64) (*Session, error) {
	sess := &Session{}
	err := s.db.QueryRow(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions WHERE id = ?`, id).Scan(
		&sess.ID, &sess.StartTime, &sess.EndTime, &sess.DurationSeconds,
		&sess.ScreenshotCount, &sess.SummaryID, &sess.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	return sess, nil
}

// GetCurrentSession returns the most recent open session (no end_time).
func (s *Store) GetCurrentSession() (*Session, error) {
	sess := &Session{}
	err := s.db.QueryRow(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE end_time IS NULL
		ORDER BY start_time DESC
		LIMIT 1`).Scan(
		&sess.ID, &sess.StartTime, &sess.EndTime, &sess.DurationSeconds,
		&sess.ScreenshotCount, &sess.SummaryID, &sess.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get current session: %w", err)
	}
	return sess, nil
}

// GetSessionsByDateRange retrieves sessions that overlap with the given time range.
func (s *Store) GetSessionsByDateRange(start, end int64) ([]*Session, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE start_time <= ? AND (end_time >= ? OR end_time IS NULL)
		ORDER BY start_time ASC`, end, start)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	return scanSessions(rows)
}

// GetSessionsForDate retrieves all sessions for a specific date.
func (s *Store) GetSessionsForDate(year, month, day int) ([]*Session, error) {
	dateStr := fmt.Sprintf("%04d-%02d-%02d", year, month, day)
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE date(start_time, 'unixepoch', 'localtime') = ?
		   OR date(end_time, 'unixepoch', 'localtime') = ?
		ORDER BY start_time ASC`, dateStr, dateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions by date: %w", err)
	}
	defer rows.Close()

	return scanSessions(rows)
}

// GetRecentSessions retrieves the most recent N sessions.
func (s *Store) GetRecentSessions(limit int) ([]*Session, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		ORDER BY start_time DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent sessions: %w", err)
	}
	defer rows.Close()

	return scanSessions(rows)
}

// GetLastEndedSession returns the most recently ended session.
func (s *Store) GetLastEndedSession() (*Session, error) {
	sess := &Session{}
	err := s.db.QueryRow(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE end_time IS NOT NULL
		ORDER BY end_time DESC
		LIMIT 1`).Scan(
		&sess.ID, &sess.StartTime, &sess.EndTime, &sess.DurationSeconds,
		&sess.ScreenshotCount, &sess.SummaryID, &sess.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get last ended session: %w", err)
	}
	return sess, nil
}

// SetSessionSummary links a session to a summary.
func (s *Store) SetSessionSummary(sessionID, summaryID int64) error {
	_, err := s.db.Exec(`
		UPDATE sessions SET summary_id = ? WHERE id = ?`, summaryID, sessionID)
	if err != nil {
		return fmt.Errorf("failed to set session summary: %w", err)
	}
	return nil
}

// GetSessionsWithoutSummary retrieves sessions that don't have a summary yet.
func (s *Store) GetSessionsWithoutSummary(limit int) ([]*Session, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE summary_id IS NULL AND end_time IS NOT NULL AND screenshot_count > 0
		ORDER BY start_time DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions without summary: %w", err)
	}
	defer rows.Close()

	return scanSessions(rows)
}

// CountSessions returns the total number of sessions.
func (s *Store) CountSessions() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&count)
	return count, err
}

// GetTotalActiveTime returns the sum of all session durations in seconds.
func (s *Store) GetTotalActiveTime() (int64, error) {
	var total sql.NullInt64
	err := s.db.QueryRow("SELECT SUM(duration_seconds) FROM sessions WHERE duration_seconds IS NOT NULL").Scan(&total)
	if err != nil {
		return 0, err
	}
	if !total.Valid {
		return 0, nil
	}
	return total.Int64, nil
}

// GetSessionsByTimeRange retrieves sessions within a time range.
func (s *Store) GetSessionsByTimeRange(start, end int64) ([]*Session, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE (start_time >= ? AND start_time <= ?) OR (end_time >= ? AND end_time <= ?)
		ORDER BY start_time ASC`, start, end, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions by time range: %w", err)
	}
	defer rows.Close()

	return scanSessions(rows)
}

func scanSessions(rows *sql.Rows) ([]*Session, error) {
	var sessions []*Session
	for rows.Next() {
		sess := &Session{}
		err := rows.Scan(
			&sess.ID, &sess.StartTime, &sess.EndTime, &sess.DurationSeconds,
			&sess.ScreenshotCount, &sess.SummaryID, &sess.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan session: %w", err)
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}
