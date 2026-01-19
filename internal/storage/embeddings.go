package storage

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"time"
)

// SaveEmbedding stores or updates an embedding for an activity
func (s *Store) SaveEmbedding(eventType string, eventID int64, embedding []byte, contextText, contextHash string) error {
	_, err := s.db.Exec(`
		INSERT INTO activity_embeddings (event_type, event_id, embedding, context_text, context_hash, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(event_type, event_id) DO UPDATE SET
			embedding = excluded.embedding,
			context_text = excluded.context_text,
			context_hash = excluded.context_hash
	`, eventType, eventID, embedding, contextText, contextHash, time.Now().Unix())
	return err
}

// GetEmbedding retrieves an embedding for an activity
func (s *Store) GetEmbedding(eventType string, eventID int64) (*ActivityEmbedding, error) {
	var emb ActivityEmbedding
	err := s.db.QueryRow(`
		SELECT id, event_type, event_id, embedding, context_text, context_hash, created_at
		FROM activity_embeddings
		WHERE event_type = ? AND event_id = ?
	`, eventType, eventID).Scan(
		&emb.ID, &emb.EventType, &emb.EventID, &emb.Embedding,
		&emb.ContextText, &emb.ContextHash, &emb.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &emb, err
}

// EmbeddingWithProject holds an embedding with its project assignment
type EmbeddingWithProject struct {
	ActivityEmbedding
	ProjectID   sql.NullInt64  `json:"projectId"`
	ProjectName sql.NullString `json:"projectName"`
}

// GetAllEmbeddingsWithProjects returns all embeddings that have project assignments
func (s *Store) GetAllEmbeddingsWithProjects() ([]EmbeddingWithProject, error) {
	rows, err := s.db.Query(`
		SELECT
			e.id, e.event_type, e.event_id, e.embedding, e.context_text, e.context_hash, e.created_at,
			COALESCE(f.project_id, s.project_id) as project_id,
			p.name as project_name
		FROM activity_embeddings e
		LEFT JOIN window_focus_events f ON e.event_type = 'focus' AND e.event_id = f.id
		LEFT JOIN screenshots s ON e.event_type = 'screenshot' AND e.event_id = s.id
		LEFT JOIN projects p ON p.id = COALESCE(f.project_id, s.project_id)
		WHERE COALESCE(f.project_id, s.project_id) IS NOT NULL
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []EmbeddingWithProject
	for rows.Next() {
		var emb EmbeddingWithProject
		err := rows.Scan(
			&emb.ID, &emb.EventType, &emb.EventID, &emb.Embedding,
			&emb.ContextText, &emb.ContextHash, &emb.CreatedAt,
			&emb.ProjectID, &emb.ProjectName,
		)
		if err != nil {
			return nil, err
		}
		results = append(results, emb)
	}
	return results, rows.Err()
}

// HashContext generates a deterministic hash for embedding context
func HashContext(contextText string) string {
	hash := sha256.Sum256([]byte(contextText))
	return hex.EncodeToString(hash[:])
}
