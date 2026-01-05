package storage

import (
	"database/sql"
	"fmt"
)

// SaveFileEvent saves a file event to the database.
func (s *Store) SaveFileEvent(event *FileEvent) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO file_events (
			timestamp, event_type, file_path, file_name, directory,
			file_extension, file_size_bytes, watch_category, old_path, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		event.Timestamp, event.EventType, event.FilePath, event.FileName, event.Directory,
		event.FileExtension, event.FileSizeBytes, event.WatchCategory, event.OldPath, event.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert file event: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetFileEventsBySession retrieves all file events for a session.
func (s *Store) GetFileEventsBySession(sessionID int64) ([]*FileEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, event_type, file_path, file_name, directory,
		       file_extension, file_size_bytes, watch_category, old_path, session_id, created_at
		FROM file_events
		WHERE session_id = ?
		ORDER BY timestamp ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query file events: %w", err)
	}
	defer rows.Close()

	return scanFileEvents(rows)
}

// GetFileEventsByTimeRange retrieves file events within a time range.
func (s *Store) GetFileEventsByTimeRange(start, end int64) ([]*FileEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, event_type, file_path, file_name, directory,
		       file_extension, file_size_bytes, watch_category, old_path, session_id, created_at
		FROM file_events
		WHERE timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query file events by time: %w", err)
	}
	defer rows.Close()

	return scanFileEvents(rows)
}

// GetFileEventsByCategory retrieves file events for a specific category.
func (s *Store) GetFileEventsByCategory(category string, limit int) ([]*FileEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, event_type, file_path, file_name, directory,
		       file_extension, file_size_bytes, watch_category, old_path, session_id, created_at
		FROM file_events
		WHERE watch_category = ?
		ORDER BY timestamp DESC
		LIMIT ?`, category, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query file events by category: %w", err)
	}
	defer rows.Close()

	return scanFileEvents(rows)
}

// GetRecentFileEvents retrieves the most recent N file events.
func (s *Store) GetRecentFileEvents(limit int) ([]*FileEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, event_type, file_path, file_name, directory,
		       file_extension, file_size_bytes, watch_category, old_path, session_id, created_at
		FROM file_events
		ORDER BY timestamp DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query recent file events: %w", err)
	}
	defer rows.Close()

	return scanFileEvents(rows)
}

// GetFileEventStats returns statistics about file events by category.
func (s *Store) GetFileEventStats(start, end int64) (map[string]int64, error) {
	rows, err := s.db.Query(`
		SELECT watch_category, COUNT(*) as count
		FROM file_events
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY watch_category`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query file event stats: %w", err)
	}
	defer rows.Close()

	stats := make(map[string]int64)
	for rows.Next() {
		var category string
		var count int64
		if err := rows.Scan(&category, &count); err != nil {
			return nil, fmt.Errorf("failed to scan file event stats: %w", err)
		}
		stats[category] = count
	}
	return stats, rows.Err()
}

// CountFileEvents returns the total number of file events.
func (s *Store) CountFileEvents() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM file_events").Scan(&count)
	return count, err
}

// CountFileEventsByTimeRange returns the count of file events in a time range.
func (s *Store) CountFileEventsByTimeRange(start, end int64) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM file_events
		WHERE timestamp >= ? AND timestamp <= ?`, start, end).Scan(&count)
	return count, err
}

func scanFileEvents(rows *sql.Rows) ([]*FileEvent, error) {
	var events []*FileEvent
	for rows.Next() {
		event := &FileEvent{}
		err := rows.Scan(
			&event.ID, &event.Timestamp, &event.EventType, &event.FilePath, &event.FileName, &event.Directory,
			&event.FileExtension, &event.FileSizeBytes, &event.WatchCategory, &event.OldPath, &event.SessionID, &event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan file event: %w", err)
		}
		events = append(events, event)
	}
	return events, rows.Err()
}
