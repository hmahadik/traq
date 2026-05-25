package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// SaveFunctionFoxProjectMapping inserts or updates a FunctionFox project mapping.
// Uses UPSERT semantics on the traq_project UNIQUE key.
// Sets created_at if insert, and always updates updated_at.
func (s *Store) SaveFunctionFoxProjectMapping(m *FunctionFoxProjectMapping) (int64, error) {
	now := time.Now().Unix()

	// If ID is 0, this is an insert; otherwise update.
	// However, we use UPSERT to handle the case where traq_project already exists.
	result, err := s.db.Exec(`
		INSERT INTO functionfox_project_mappings (
			traq_project, ff_client_id, ff_client_name,
			ff_job_id, ff_job_name, ff_task_id, ff_task_name,
			enabled, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(traq_project) DO UPDATE SET
			ff_client_id = excluded.ff_client_id,
			ff_client_name = excluded.ff_client_name,
			ff_job_id = excluded.ff_job_id,
			ff_job_name = excluded.ff_job_name,
			ff_task_id = excluded.ff_task_id,
			ff_task_name = excluded.ff_task_name,
			enabled = excluded.enabled,
			updated_at = ?
	`,
		m.TraqProject, m.FFClientID, m.FFClientName,
		m.FFJobID, m.FFJobName, m.FFTaskID, m.FFTaskName,
		boolToInt(m.Enabled), now, now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to save functionfox project mapping: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetFunctionFoxProjectMapping retrieves a mapping by traq_project name.
// Returns nil if not found (does not return ErrNoRows).
func (s *Store) GetFunctionFoxProjectMapping(traqProject string) (*FunctionFoxProjectMapping, error) {
	m := &FunctionFoxProjectMapping{}
	var enabled int

	err := s.db.QueryRow(`
		SELECT id, traq_project, ff_client_id, ff_client_name,
		       ff_job_id, ff_job_name, ff_task_id, ff_task_name,
		       enabled, created_at, updated_at
		FROM functionfox_project_mappings
		WHERE traq_project = ?
	`, traqProject).Scan(
		&m.ID, &m.TraqProject, &m.FFClientID, &m.FFClientName,
		&m.FFJobID, &m.FFJobName, &m.FFTaskID, &m.FFTaskName,
		&enabled, &m.CreatedAt, &m.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get functionfox project mapping: %w", err)
	}

	m.Enabled = intToBool(enabled)
	return m, nil
}

// ListFunctionFoxProjectMappings retrieves all project mappings, ordered by traq_project.
func (s *Store) ListFunctionFoxProjectMappings() ([]*FunctionFoxProjectMapping, error) {
	rows, err := s.db.Query(`
		SELECT id, traq_project, ff_client_id, ff_client_name,
		       ff_job_id, ff_job_name, ff_task_id, ff_task_name,
		       enabled, created_at, updated_at
		FROM functionfox_project_mappings
		ORDER BY traq_project
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query functionfox project mappings: %w", err)
	}
	defer rows.Close()

	var mappings []*FunctionFoxProjectMapping
	for rows.Next() {
		m := &FunctionFoxProjectMapping{}
		var enabled int
		err := rows.Scan(
			&m.ID, &m.TraqProject, &m.FFClientID, &m.FFClientName,
			&m.FFJobID, &m.FFJobName, &m.FFTaskID, &m.FFTaskName,
			&enabled, &m.CreatedAt, &m.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan functionfox project mapping: %w", err)
		}
		m.Enabled = intToBool(enabled)
		mappings = append(mappings, m)
	}

	return mappings, rows.Err()
}

// DeleteFunctionFoxProjectMapping removes a mapping by traq_project.
func (s *Store) DeleteFunctionFoxProjectMapping(traqProject string) error {
	_, err := s.db.Exec(
		"DELETE FROM functionfox_project_mappings WHERE traq_project = ?",
		traqProject,
	)
	if err != nil {
		return fmt.Errorf("failed to delete functionfox project mapping: %w", err)
	}
	return nil
}

// Helper functions to convert between int and bool for SQLite.
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func intToBool(i int) bool {
	return i != 0
}
