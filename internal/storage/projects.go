package storage

import (
	"database/sql"
	"fmt"
	"time"
)

// ============================================================================
// Project CRUD
// ============================================================================

// CreateProject creates a new project.
func (s *Store) CreateProject(name, color, description string) (*Project, error) {
	now := time.Now().Unix()
	result, err := s.db.Exec(`
		INSERT INTO projects (name, color, description, is_manual, created_at)
		VALUES (?, ?, ?, 1, ?)
	`, name, color, description, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create project: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get project id: %w", err)
	}

	return &Project{
		ID:          id,
		Name:        name,
		Color:       color,
		Description: description,
		IsManual:    true,
		CreatedAt:   now,
	}, nil
}

// GetProjects returns all projects.
func (s *Store) GetProjects() ([]Project, error) {
	rows, err := s.db.Query(`
		SELECT id, name, COALESCE(color, '#6366f1'), COALESCE(description, ''),
		       COALESCE(detection_patterns, ''), is_manual, created_at
		FROM projects
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query projects: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Color, &p.Description,
			&p.DetectionPatterns, &p.IsManual, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan project: %w", err)
		}
		projects = append(projects, p)
	}

	return projects, nil
}

// GetProject returns a single project by ID.
func (s *Store) GetProject(id int64) (*Project, error) {
	var p Project
	err := s.db.QueryRow(`
		SELECT id, name, COALESCE(color, '#6366f1'), COALESCE(description, ''),
		       COALESCE(detection_patterns, ''), is_manual, created_at
		FROM projects WHERE id = ?
	`, id).Scan(&p.ID, &p.Name, &p.Color, &p.Description,
		&p.DetectionPatterns, &p.IsManual, &p.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get project: %w", err)
	}
	return &p, nil
}

// GetProjectByName returns a project by name.
func (s *Store) GetProjectByName(name string) (*Project, error) {
	var p Project
	err := s.db.QueryRow(`
		SELECT id, name, COALESCE(color, '#6366f1'), COALESCE(description, ''),
		       COALESCE(detection_patterns, ''), is_manual, created_at
		FROM projects WHERE name = ?
	`, name).Scan(&p.ID, &p.Name, &p.Color, &p.Description,
		&p.DetectionPatterns, &p.IsManual, &p.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get project by name: %w", err)
	}
	return &p, nil
}

// UpdateProject updates a project.
func (s *Store) UpdateProject(id int64, name, color, description string) error {
	_, err := s.db.Exec(`
		UPDATE projects SET name = ?, color = ?, description = ?
		WHERE id = ?
	`, name, color, description, id)
	if err != nil {
		return fmt.Errorf("failed to update project: %w", err)
	}
	return nil
}

// DeleteProject deletes a project and clears its assignments.
func (s *Store) DeleteProject(id int64) error {
	// Clear project assignments from events (ON DELETE CASCADE handles patterns/examples)
	_, err := s.db.Exec(`UPDATE screenshots SET project_id = NULL, project_source = 'unassigned' WHERE project_id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to clear screenshot assignments: %w", err)
	}
	_, err = s.db.Exec(`UPDATE window_focus_events SET project_id = NULL, project_source = 'unassigned' WHERE project_id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to clear focus event assignments: %w", err)
	}
	_, err = s.db.Exec(`UPDATE git_commits SET project_id = NULL, project_source = 'unassigned' WHERE project_id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to clear git commit assignments: %w", err)
	}

	// Delete the project (cascades to patterns and examples)
	_, err = s.db.Exec(`DELETE FROM projects WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete project: %w", err)
	}
	return nil
}

// ============================================================================
// Project Pattern CRUD
// ============================================================================

// GetProjectPatterns returns all patterns for a project.
func (s *Store) GetProjectPatterns(projectID int64) ([]ProjectPattern, error) {
	rows, err := s.db.Query(`
		SELECT id, project_id, pattern_type, pattern_value, match_type,
		       weight, hit_count, last_used_at, created_at
		FROM project_patterns
		WHERE project_id = ?
		ORDER BY weight DESC, hit_count DESC
	`, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to query patterns: %w", err)
	}
	defer rows.Close()

	var patterns []ProjectPattern
	for rows.Next() {
		var p ProjectPattern
		var lastUsed sql.NullInt64
		if err := rows.Scan(&p.ID, &p.ProjectID, &p.PatternType, &p.PatternValue,
			&p.MatchType, &p.Weight, &p.HitCount, &lastUsed, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan pattern: %w", err)
		}
		if lastUsed.Valid {
			p.LastUsedAt = lastUsed.Int64
		}
		patterns = append(patterns, p)
	}
	return patterns, nil
}

// GetAllPatterns returns all patterns for all projects (for pattern cache).
func (s *Store) GetAllPatterns() ([]ProjectPattern, error) {
	rows, err := s.db.Query(`
		SELECT id, project_id, pattern_type, pattern_value, match_type,
		       weight, hit_count, last_used_at, created_at
		FROM project_patterns
		ORDER BY weight DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query all patterns: %w", err)
	}
	defer rows.Close()

	var patterns []ProjectPattern
	for rows.Next() {
		var p ProjectPattern
		var lastUsed sql.NullInt64
		if err := rows.Scan(&p.ID, &p.ProjectID, &p.PatternType, &p.PatternValue,
			&p.MatchType, &p.Weight, &p.HitCount, &lastUsed, &p.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan pattern: %w", err)
		}
		if lastUsed.Valid {
			p.LastUsedAt = lastUsed.Int64
		}
		patterns = append(patterns, p)
	}
	return patterns, nil
}

// UpsertPattern creates or updates a pattern.
func (s *Store) UpsertPattern(projectID int64, patternType, patternValue, matchType string, weight float64) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(`
		INSERT INTO project_patterns (project_id, pattern_type, pattern_value, match_type, weight, hit_count, last_used_at, created_at)
		VALUES (?, ?, ?, ?, ?, 1, ?, ?)
		ON CONFLICT(project_id, pattern_type, pattern_value, match_type) DO UPDATE SET
			hit_count = hit_count + 1,
			last_used_at = ?,
			weight = CASE WHEN weight < 2.0 THEN weight * 1.1 ELSE weight END
	`, projectID, patternType, patternValue, matchType, weight, now, now, now)
	if err != nil {
		return fmt.Errorf("failed to upsert pattern: %w", err)
	}
	return nil
}

// UpdatePatternWeight updates a pattern's weight.
func (s *Store) UpdatePatternWeight(patternID int64, newWeight float64) error {
	// Clamp weight between 0.1 and 2.0
	if newWeight < 0.1 {
		newWeight = 0.1
	}
	if newWeight > 2.0 {
		newWeight = 2.0
	}
	_, err := s.db.Exec(`UPDATE project_patterns SET weight = ? WHERE id = ?`, newWeight, patternID)
	if err != nil {
		return fmt.Errorf("failed to update pattern weight: %w", err)
	}
	return nil
}

// DeletePattern deletes a pattern.
func (s *Store) DeletePattern(patternID int64) error {
	_, err := s.db.Exec(`DELETE FROM project_patterns WHERE id = ?`, patternID)
	if err != nil {
		return fmt.Errorf("failed to delete pattern: %w", err)
	}
	return nil
}

// ============================================================================
// Assignment Examples CRUD
// ============================================================================

// AddAssignmentExample stores a user assignment as a few-shot example.
func (s *Store) AddAssignmentExample(projectID int64, eventType string, eventID int64, contextJSON string) error {
	now := time.Now().Unix()
	_, err := s.db.Exec(`
		INSERT INTO assignment_examples (project_id, event_type, event_id, context_json, created_at)
		VALUES (?, ?, ?, ?, ?)
	`, projectID, eventType, eventID, contextJSON, now)
	if err != nil {
		return fmt.Errorf("failed to add assignment example: %w", err)
	}
	return nil
}

// GetRecentAssignmentExamples returns recent examples for few-shot learning.
func (s *Store) GetRecentAssignmentExamples(limit int) ([]AssignmentExample, error) {
	rows, err := s.db.Query(`
		SELECT ae.id, ae.project_id, ae.event_type, ae.event_id, ae.context_json, ae.created_at
		FROM assignment_examples ae
		ORDER BY ae.created_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query assignment examples: %w", err)
	}
	defer rows.Close()

	var examples []AssignmentExample
	for rows.Next() {
		var e AssignmentExample
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.EventType, &e.EventID, &e.ContextJSON, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan assignment example: %w", err)
		}
		examples = append(examples, e)
	}
	return examples, nil
}

// GetAssignmentExamplesForProject returns examples for a specific project.
func (s *Store) GetAssignmentExamplesForProject(projectID int64, limit int) ([]AssignmentExample, error) {
	rows, err := s.db.Query(`
		SELECT id, project_id, event_type, event_id, context_json, created_at
		FROM assignment_examples
		WHERE project_id = ?
		ORDER BY created_at DESC
		LIMIT ?
	`, projectID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query project examples: %w", err)
	}
	defer rows.Close()

	var examples []AssignmentExample
	for rows.Next() {
		var e AssignmentExample
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.EventType, &e.EventID, &e.ContextJSON, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan assignment example: %w", err)
		}
		examples = append(examples, e)
	}
	return examples, nil
}

// ============================================================================
// Event Assignment CRUD
// ============================================================================

// SetEventProject sets the project assignment for an event.
func (s *Store) SetEventProject(eventType string, eventID, projectID int64, confidence float64, source string) error {
	var query string
	switch eventType {
	case "screenshot":
		query = `UPDATE screenshots SET project_id = ?, project_confidence = ?, project_source = ? WHERE id = ?`
	case "focus":
		query = `UPDATE window_focus_events SET project_id = ?, project_confidence = ?, project_source = ? WHERE id = ?`
	case "git":
		query = `UPDATE git_commits SET project_id = ?, project_confidence = ?, project_source = ? WHERE id = ?`
	default:
		return fmt.Errorf("unknown event type: %s", eventType)
	}

	var pid interface{} = projectID
	if projectID == 0 {
		pid = nil
		source = "unassigned"
		confidence = 0
	}

	_, err := s.db.Exec(query, pid, confidence, source, eventID)
	if err != nil {
		return fmt.Errorf("failed to set event project: %w", err)
	}
	return nil
}

// GetUnassignedEventCount returns count of events without project assignment.
func (s *Store) GetUnassignedEventCount() (int, error) {
	var count int
	err := s.db.QueryRow(`
		SELECT (
			SELECT COUNT(*) FROM screenshots WHERE project_source = 'unassigned' OR project_source IS NULL
		) + (
			SELECT COUNT(*) FROM window_focus_events WHERE project_source = 'unassigned' OR project_source IS NULL
		) + (
			SELECT COUNT(*) FROM git_commits WHERE project_source = 'unassigned' OR project_source IS NULL
		)
	`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count unassigned events: %w", err)
	}
	return count, nil
}

// GetProjectStats returns aggregate stats for a project.
type ProjectStats struct {
	ScreenshotCount int     `json:"screenshotCount"`
	FocusEventCount int     `json:"focusEventCount"`
	GitCommitCount  int     `json:"gitCommitCount"`
	TotalMinutes    float64 `json:"totalMinutes"`
	PatternCount    int     `json:"patternCount"`
}

func (s *Store) GetProjectStats(projectID int64) (*ProjectStats, error) {
	var stats ProjectStats

	err := s.db.QueryRow(`SELECT COUNT(*) FROM screenshots WHERE project_id = ?`, projectID).Scan(&stats.ScreenshotCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count screenshots: %w", err)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM window_focus_events WHERE project_id = ?`, projectID).Scan(&stats.FocusEventCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count focus events: %w", err)
	}

	err = s.db.QueryRow(`SELECT COALESCE(SUM(duration_seconds), 0) / 60.0 FROM window_focus_events WHERE project_id = ?`, projectID).Scan(&stats.TotalMinutes)
	if err != nil {
		return nil, fmt.Errorf("failed to sum duration: %w", err)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM git_commits WHERE project_id = ?`, projectID).Scan(&stats.GitCommitCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count git commits: %w", err)
	}

	err = s.db.QueryRow(`SELECT COUNT(*) FROM project_patterns WHERE project_id = ?`, projectID).Scan(&stats.PatternCount)
	if err != nil {
		return nil, fmt.Errorf("failed to count patterns: %w", err)
	}

	return &stats, nil
}
