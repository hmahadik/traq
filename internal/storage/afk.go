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

// GetAFKEventsByTimeRange retrieves AFK events that overlap with a time range.
// An AFK event overlaps if it starts at or before the range ends AND (ends after the range starts OR is ongoing).
// This correctly handles AFK events that span midnight boundaries.
func (s *Store) GetAFKEventsByTimeRange(start, end int64) ([]*AFKEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, start_time, end_time, session_id, trigger_type, created_at
		FROM afk_events
		WHERE start_time <= ? AND (end_time IS NULL OR end_time > ?)
		ORDER BY start_time ASC`, end, start)
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

// DeleteAFKEvent deletes a single AFK event by ID.
func (s *Store) DeleteAFKEvent(id int64) error {
	result, err := s.db.Exec("DELETE FROM afk_events WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete AFK event: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no AFK event found with ID %d", id)
	}

	return nil
}

// DeleteAFKEvents deletes multiple AFK events by ID.
func (s *Store) DeleteAFKEvents(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	// Build placeholders for IN clause
	placeholders := ""
	args := make([]interface{}, len(ids))
	for i, id := range ids {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}

	query := fmt.Sprintf("DELETE FROM afk_events WHERE id IN (%s)", placeholders)

	result, err := s.db.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to delete AFK events: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no AFK events found with the given IDs")
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
