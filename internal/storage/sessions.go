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
// Returns an error if endTime would result in a negative duration.
func (s *Store) EndSession(id int64, endTime int64) error {
	// First, get the session to validate the end time
	var startTime int64
	err := s.db.QueryRow("SELECT start_time FROM sessions WHERE id = ?", id).Scan(&startTime)
	if err != nil {
		return fmt.Errorf("failed to get session start time: %w", err)
	}

	// Validate: endTime must be >= startTime to avoid negative duration
	if endTime <= 0 || endTime < startTime {
		return fmt.Errorf("invalid end time %d: must be >= start time %d", endTime, startTime)
	}

	_, err = s.db.Exec(`
		UPDATE sessions
		SET end_time = ?,
		    duration_seconds = ? - start_time
		WHERE id = ?`, endTime, endTime, id)
	if err != nil {
		return fmt.Errorf("failed to end session: %w", err)
	}
	return nil
}

// ResumeSession clears the end time and duration to resume a session.
func (s *Store) ResumeSession(id int64) error {
	_, err := s.db.Exec(`
		UPDATE sessions
		SET end_time = NULL,
		    duration_seconds = NULL
		WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to resume session: %w", err)
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

// DeleteSession deletes a session and all its related data (screenshots, summaries, focus events, etc).
func (s *Store) DeleteSession(id int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Clear the session's summary_id reference first (sessions.summary_id -> summaries.id)
	_, err = tx.Exec("UPDATE sessions SET summary_id = NULL WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to clear session summary reference: %w", err)
	}

	// Delete related data in order (respecting foreign key constraints)
	tables := []string{
		"summaries",
		"window_focus_events",
		"afk_events",
		"shell_commands",
		"git_commits",
		"file_events",
		"browser_history",
		"issue_reports",
		"screenshots",
	}

	for _, table := range tables {
		_, err = tx.Exec(fmt.Sprintf("DELETE FROM %s WHERE session_id = ?", table), id)
		if err != nil {
			return fmt.Errorf("failed to delete from %s: %w", table, err)
		}
	}

	// Finally, delete the session itself
	_, err = tx.Exec("DELETE FROM sessions WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete session: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// CountSessions returns the total number of sessions.
func (s *Store) CountSessions() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&count)
	return count, err
}

// CloseOrphanedSessions closes any sessions that have no end_time and started more than
// maxAgeSeconds ago. This handles zombie sessions from crashes or multiple instances.
// Returns the number of sessions closed.
func (s *Store) CloseOrphanedSessions(currentTime int64, maxAgeSeconds int64) (int, error) {
	cutoff := currentTime - maxAgeSeconds

	// Find orphaned sessions and close them at their last activity time
	// Use the latest screenshot, focus event, or start_time as the end time
	result, err := s.db.Exec(`
		UPDATE sessions
		SET end_time = COALESCE(
			(SELECT MAX(timestamp) FROM screenshots WHERE session_id = sessions.id),
			(SELECT MAX(end_time) FROM window_focus_events WHERE session_id = sessions.id),
			start_time + 3600
		),
		duration_seconds = COALESCE(
			(SELECT MAX(timestamp) FROM screenshots WHERE session_id = sessions.id),
			(SELECT MAX(end_time) FROM window_focus_events WHERE session_id = sessions.id),
			start_time + 3600
		) - start_time
		WHERE end_time IS NULL AND start_time < ?`, cutoff)
	if err != nil {
		return 0, fmt.Errorf("failed to close orphaned sessions: %w", err)
	}

	count, _ := result.RowsAffected()
	return int(count), nil
}

// GetTotalActiveTime returns the sum of all session durations in seconds.
// Only counts positive durations (ignores corrupt data with negative values).
func (s *Store) GetTotalActiveTime() (int64, error) {
	var total sql.NullInt64
	err := s.db.QueryRow("SELECT SUM(duration_seconds) FROM sessions WHERE duration_seconds IS NOT NULL AND duration_seconds > 0").Scan(&total)
	if err != nil {
		return 0, err
	}
	if !total.Valid {
		return 0, nil
	}
	return total.Int64, nil
}

// GetSessionsByTimeRange retrieves sessions that overlap with a time range.
// A session overlaps if it starts at or before the range ends AND (ends after the range starts OR is ongoing).
// This correctly handles sessions that span midnight boundaries.
func (s *Store) GetSessionsByTimeRange(start, end int64) ([]*Session, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, duration_seconds, screenshot_count, summary_id, created_at
		FROM sessions
		WHERE start_time <= ? AND (end_time IS NULL OR end_time > ?)
		ORDER BY start_time ASC`, end, start)
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
