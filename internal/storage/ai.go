package storage

import "database/sql"

// AISession represents one AI coding session (Claude Code or opencode).
// SourceOffset is tool-specific cursor state: byte offset into the JSONL file
// for claude, unused (0) for opencode which cursors on MAX(timestamp).
type AISession struct {
	ID           string
	Tool         string
	ProjectDir   string
	FilePath     string
	StartedAt    int64
	LastEventAt  int64
	EventCount   int
	SourceOffset int64
}

// AIEvent is one atomic turn within an AI session (user prompt, assistant
// turn, tool use, or generic "message"). Timestamp is unix seconds.
type AIEvent struct {
	ID         int64
	SessionID  string
	Tool       string
	Kind       string
	Timestamp  int64
	ProjectDir string
	Content    string // empty unless this is a user prompt
}

func (s *Store) UpsertAISession(sess *AISession) error {
	_, err := s.db.Exec(`
		INSERT INTO ai_sessions (id, tool, project_dir, file_path, started_at, last_event_at, event_count, source_offset)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			project_dir   = excluded.project_dir,
			file_path     = excluded.file_path,
			last_event_at = excluded.last_event_at,
			event_count   = excluded.event_count,
			source_offset = excluded.source_offset
	`, sess.ID, sess.Tool, aiNullableStr(sess.ProjectDir), aiNullableStr(sess.FilePath),
		sess.StartedAt, sess.LastEventAt, sess.EventCount, sess.SourceOffset)
	return err
}

func (s *Store) GetAISessionByFilePath(path string) (*AISession, error) {
	if path == "" {
		return nil, nil
	}
	row := s.db.QueryRow(`
		SELECT id, tool, COALESCE(project_dir,''), COALESCE(file_path,''),
		       started_at, last_event_at, event_count, source_offset
		FROM ai_sessions WHERE file_path = ?
	`, path)
	return scanAISession(row)
}

func (s *Store) GetAISessionByID(id string) (*AISession, error) {
	row := s.db.QueryRow(`
		SELECT id, tool, COALESCE(project_dir,''), COALESCE(file_path,''),
		       started_at, last_event_at, event_count, source_offset
		FROM ai_sessions WHERE id = ?
	`, id)
	return scanAISession(row)
}

func scanAISession(row *sql.Row) (*AISession, error) {
	var out AISession
	err := row.Scan(&out.ID, &out.Tool, &out.ProjectDir, &out.FilePath,
		&out.StartedAt, &out.LastEventAt, &out.EventCount, &out.SourceOffset)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) InsertAIEvents(events []AIEvent) error {
	if len(events) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	stmt, err := tx.Prepare(`
		INSERT INTO ai_events (session_id, tool, kind, timestamp, project_dir, content)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()
	for _, e := range events {
		if _, err := stmt.Exec(e.SessionID, e.Tool, e.Kind, e.Timestamp, aiNullableStr(e.ProjectDir), aiNullableStr(e.Content)); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (s *Store) GetAIEventsInRange(startUnix, endUnix int64) ([]AIEvent, error) {
	rows, err := s.db.Query(`
		SELECT id, session_id, tool, kind, timestamp, COALESCE(project_dir,''), COALESCE(content,'')
		FROM ai_events
		WHERE timestamp BETWEEN ? AND ?
		ORDER BY tool, session_id, timestamp
	`, startUnix, endUnix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AIEvent
	for rows.Next() {
		var e AIEvent
		if err := rows.Scan(&e.ID, &e.SessionID, &e.Tool, &e.Kind, &e.Timestamp, &e.ProjectDir, &e.Content); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) GetMaxAIEventTimestamp(tool string) (int64, error) {
	var maxTs sql.NullInt64
	err := s.db.QueryRow(`SELECT MAX(timestamp) FROM ai_events WHERE tool = ?`, tool).Scan(&maxTs)
	if err != nil {
		return 0, err
	}
	if !maxTs.Valid {
		return 0, nil
	}
	return maxTs.Int64, nil
}

func (s *Store) ListAISessionsForDate(startUnix, endUnix int64) ([]AISession, error) {
	rows, err := s.db.Query(`
		SELECT DISTINCT s.id, s.tool, COALESCE(s.project_dir,''), COALESCE(s.file_path,''),
		       s.started_at, s.last_event_at, s.event_count, s.source_offset
		FROM ai_sessions s
		JOIN ai_events e ON e.session_id = s.id
		WHERE e.timestamp BETWEEN ? AND ?
		ORDER BY s.last_event_at DESC
	`, startUnix, endUnix)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AISession
	for rows.Next() {
		var s AISession
		if err := rows.Scan(&s.ID, &s.Tool, &s.ProjectDir, &s.FilePath,
			&s.StartedAt, &s.LastEventAt, &s.EventCount, &s.SourceOffset); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func aiNullableStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}
