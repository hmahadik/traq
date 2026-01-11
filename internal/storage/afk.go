package storage

import (
	"database/sql"
	"fmt"
)

// CreateAFKEvent creates a new AFK event and returns its ID.
func (s *Store) CreateAFKEvent(event *AFKEvent) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO afk_events (start_time, end_time, session_id, trigger_type)
		VALUES (?, ?, ?, ?)`,
		event.StartTime, event.EndTime, event.SessionID, event.TriggerType,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert AFK event: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// UpdateAFKEventEnd updates the end time of an AFK event.
func (s *Store) UpdateAFKEventEnd(id int64, endTime int64) error {
	_, err := s.db.Exec(`
		UPDATE afk_events SET end_time = ? WHERE id = ?`,
		endTime, id,
	)
	if err != nil {
		return fmt.Errorf("failed to update AFK event end time: %w", err)
	}
	return nil
}

// GetAFKEvent retrieves a single AFK event by ID.
func (s *Store) GetAFKEvent(id int64) (*AFKEvent, error) {
	row := s.db.QueryRow(`
		SELECT id, start_time, end_time, session_id, trigger_type, created_at
		FROM afk_events WHERE id = ?`, id)

	event := &AFKEvent{}
	err := row.Scan(
		&event.ID, &event.StartTime, &event.EndTime,
		&event.SessionID, &event.TriggerType, &event.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan AFK event: %w", err)
	}
	return event, nil
}

// GetAFKEventsByTimeRange retrieves AFK events within a time range.
func (s *Store) GetAFKEventsByTimeRange(start, end int64) ([]*AFKEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, session_id, trigger_type, created_at
		FROM afk_events
		WHERE start_time >= ? AND start_time <= ?
		ORDER BY start_time ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query AFK events: %w", err)
	}
	defer rows.Close()

	return scanAFKEvents(rows)
}

// GetAFKEventsBySession retrieves AFK events for a specific session.
func (s *Store) GetAFKEventsBySession(sessionID int64) ([]*AFKEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, session_id, trigger_type, created_at
		FROM afk_events
		WHERE session_id = ?
		ORDER BY start_time ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query AFK events by session: %w", err)
	}
	defer rows.Close()

	return scanAFKEvents(rows)
}

// GetCurrentAFKEvent retrieves the current ongoing AFK event (if any).
// Used for crash recovery - close orphaned events on startup.
func (s *Store) GetCurrentAFKEvent() (*AFKEvent, error) {
	row := s.db.QueryRow(`
		SELECT id, start_time, end_time, session_id, trigger_type, created_at
		FROM afk_events
		WHERE end_time IS NULL
		ORDER BY start_time DESC
		LIMIT 1`)

	event := &AFKEvent{}
	err := row.Scan(
		&event.ID, &event.StartTime, &event.EndTime,
		&event.SessionID, &event.TriggerType, &event.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to scan current AFK event: %w", err)
	}
	return event, nil
}

// CloseOrphanedAFKEvents closes any AFK events that don't have an end time.
// This handles crash recovery by assuming user returned at the given time.
func (s *Store) CloseOrphanedAFKEvents(endTime int64) error {
	_, err := s.db.Exec(`
		UPDATE afk_events SET end_time = ? WHERE end_time IS NULL`, endTime)
	if err != nil {
		return fmt.Errorf("failed to close orphaned AFK events: %w", err)
	}
	return nil
}

func scanAFKEvents(rows *sql.Rows) ([]*AFKEvent, error) {
	var events []*AFKEvent
	for rows.Next() {
		event := &AFKEvent{}
		err := rows.Scan(
			&event.ID, &event.StartTime, &event.EndTime,
			&event.SessionID, &event.TriggerType, &event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan AFK event: %w", err)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}
