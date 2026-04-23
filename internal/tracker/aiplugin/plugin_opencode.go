package aiplugin

import (
	"context"
	"database/sql"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"traq/internal/storage"
)

const toolOpenCode = "opencode"

// OpenCodePlugin reads message timestamps from opencode's SQLite database.
// Opens the DB read-only (immutable=1) so opencode's live process isn't
// affected. Cursors on MAX(timestamp) — opencode stores ms, we store s.
type OpenCodePlugin struct {
	dbPath string
}

func NewOpenCodePlugin(dbPath string) *OpenCodePlugin {
	return &OpenCodePlugin{dbPath: dbPath}
}

func (p *OpenCodePlugin) Name() string { return toolOpenCode }

func (p *OpenCodePlugin) Available() bool {
	info, err := os.Stat(p.dbPath)
	return err == nil && !info.IsDir()
}

func (p *OpenCodePlugin) Poll(ctx context.Context, store *storage.Store) ([]AIEvent, error) {
	sinceUnix, err := store.GetMaxAIEventTimestamp(toolOpenCode)
	if err != nil {
		return nil, err
	}
	sinceMs := sinceUnix * 1000

	dsn := "file:" + p.dbPath + "?mode=ro&immutable=1"
	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	// Select only user-role messages, joining the part table to retrieve
	// the prompt text. A single user message can have multiple text parts;
	// we concatenate them (rare in practice, but safe).
	rows, err := db.QueryContext(ctx, `
		SELECT m.id, m.session_id, s.directory, m.time_created,
		       COALESCE(group_concat(json_extract(p.data,'$.text'), CHAR(10)), '')
		FROM message m
		JOIN session s ON s.id = m.session_id
		LEFT JOIN part p ON p.message_id = m.id
		  AND json_extract(p.data,'$.type') = 'text'
		WHERE m.time_created > ?
		  AND json_extract(m.data,'$.role') = 'user'
		GROUP BY m.id
		ORDER BY m.time_created ASC
	`, sinceMs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AIEvent
	for rows.Next() {
		var msgID, sessionID, directory, content string
		var tsMs int64
		if err := rows.Scan(&msgID, &sessionID, &directory, &tsMs, &content); err != nil {
			return nil, err
		}
		out = append(out, AIEvent{
			Tool:       toolOpenCode,
			SessionID:  sessionID,
			ProjectDir: directory,
			Timestamp:  time.Unix(0, tsMs*int64(time.Millisecond)),
			Kind:       "user_prompt",
			Content:    content,
		})
	}
	return out, rows.Err()
}
