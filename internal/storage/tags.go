package storage

import (
	"database/sql"
	"fmt"
	"strings"
)

// GetAllTags returns all unique tags with their occurrence counts.
func (s *Store) GetAllTags() ([]*TagUsageInfo, error) {
	// Tags are stored as JSON arrays in the summaries table
	// We need to extract and count them
	rows, err := s.db.Query(`SELECT tags FROM summaries WHERE tags IS NOT NULL AND tags != '[]' AND tags != ''`)
	if err != nil {
		return nil, fmt.Errorf("failed to query tags: %w", err)
	}
	defer rows.Close()

	tagCounts := make(map[string]int)
	for rows.Next() {
		var tagsJSON sql.NullString
		if err := rows.Scan(&tagsJSON); err != nil {
			return nil, fmt.Errorf("failed to scan tags: %w", err)
		}
		tags := ParseJSONStringArray(tagsJSON)
		for _, tag := range tags {
			tag = strings.TrimSpace(tag)
			if tag != "" {
				tagCounts[tag]++
			}
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Convert to TagUsageInfo slice
	var result []*TagUsageInfo
	for tag, count := range tagCounts {
		result = append(result, &TagUsageInfo{
			Tag:   tag,
			Count: count,
		})
	}

	return result, nil
}

// RenameTag renames a tag across all summaries.
func (s *Store) RenameTag(oldName, newName string) (int, error) {
	oldName = strings.TrimSpace(oldName)
	newName = strings.TrimSpace(newName)

	if oldName == "" || newName == "" {
		return 0, fmt.Errorf("tag names cannot be empty")
	}
	if oldName == newName {
		return 0, nil
	}

	// Get all summaries with the old tag
	rows, err := s.db.Query(`SELECT id, tags FROM summaries WHERE tags LIKE ?`, "%"+oldName+"%")
	if err != nil {
		return 0, fmt.Errorf("failed to query summaries: %w", err)
	}
	defer rows.Close()

	var updates []struct {
		id   int64
		tags []string
	}

	for rows.Next() {
		var id int64
		var tagsJSON sql.NullString
		if err := rows.Scan(&id, &tagsJSON); err != nil {
			return 0, fmt.Errorf("failed to scan summary: %w", err)
		}

		tags := ParseJSONStringArray(tagsJSON)
		modified := false
		for i, tag := range tags {
			if tag == oldName {
				tags[i] = newName
				modified = true
			}
		}

		if modified {
			updates = append(updates, struct {
				id   int64
				tags []string
			}{id, tags})
		}
	}

	if err := rows.Err(); err != nil {
		return 0, err
	}

	// Apply updates
	for _, update := range updates {
		tagsJSON := ToJSONString(update.tags)
		_, err := s.db.Exec(`UPDATE summaries SET tags = ? WHERE id = ?`, tagsJSON, update.id)
		if err != nil {
			return 0, fmt.Errorf("failed to update summary %d: %w", update.id, err)
		}
	}

	return len(updates), nil
}

// MergeTags merges sourceTag into targetTag across all summaries.
func (s *Store) MergeTags(sourceTag, targetTag string) (int, error) {
	sourceTag = strings.TrimSpace(sourceTag)
	targetTag = strings.TrimSpace(targetTag)

	if sourceTag == "" || targetTag == "" {
		return 0, fmt.Errorf("tag names cannot be empty")
	}
	if sourceTag == targetTag {
		return 0, nil
	}

	// Get all summaries with the source tag
	rows, err := s.db.Query(`SELECT id, tags FROM summaries WHERE tags LIKE ?`, "%"+sourceTag+"%")
	if err != nil {
		return 0, fmt.Errorf("failed to query summaries: %w", err)
	}
	defer rows.Close()

	var updates []struct {
		id   int64
		tags []string
	}

	for rows.Next() {
		var id int64
		var tagsJSON sql.NullString
		if err := rows.Scan(&id, &tagsJSON); err != nil {
			return 0, fmt.Errorf("failed to scan summary: %w", err)
		}

		tags := ParseJSONStringArray(tagsJSON)
		hasTarget := false
		hasSource := false
		sourceIdx := -1

		for i, tag := range tags {
			if tag == targetTag {
				hasTarget = true
			}
			if tag == sourceTag {
				hasSource = true
				sourceIdx = i
			}
		}

		if hasSource {
			if hasTarget {
				// Remove source tag (target already exists)
				tags = append(tags[:sourceIdx], tags[sourceIdx+1:]...)
			} else {
				// Replace source with target
				tags[sourceIdx] = targetTag
			}
			updates = append(updates, struct {
				id   int64
				tags []string
			}{id, tags})
		}
	}

	if err := rows.Err(); err != nil {
		return 0, err
	}

	// Apply updates
	for _, update := range updates {
		tagsJSON := ToJSONString(update.tags)
		_, err := s.db.Exec(`UPDATE summaries SET tags = ? WHERE id = ?`, tagsJSON, update.id)
		if err != nil {
			return 0, fmt.Errorf("failed to update summary %d: %w", update.id, err)
		}
	}

	return len(updates), nil
}

// DeleteTag removes a tag from all summaries.
func (s *Store) DeleteTag(tagName string) (int, error) {
	tagName = strings.TrimSpace(tagName)

	if tagName == "" {
		return 0, fmt.Errorf("tag name cannot be empty")
	}

	// Get all summaries with this tag
	rows, err := s.db.Query(`SELECT id, tags FROM summaries WHERE tags LIKE ?`, "%"+tagName+"%")
	if err != nil {
		return 0, fmt.Errorf("failed to query summaries: %w", err)
	}
	defer rows.Close()

	var updates []struct {
		id   int64
		tags []string
	}

	for rows.Next() {
		var id int64
		var tagsJSON sql.NullString
		if err := rows.Scan(&id, &tagsJSON); err != nil {
			return 0, fmt.Errorf("failed to scan summary: %w", err)
		}

		tags := ParseJSONStringArray(tagsJSON)
		var newTags []string
		modified := false

		for _, tag := range tags {
			if tag != tagName {
				newTags = append(newTags, tag)
			} else {
				modified = true
			}
		}

		if modified {
			updates = append(updates, struct {
				id   int64
				tags []string
			}{id, newTags})
		}
	}

	if err := rows.Err(); err != nil {
		return 0, err
	}

	// Apply updates
	for _, update := range updates {
		tagsJSON := ToJSONString(update.tags)
		_, err := s.db.Exec(`UPDATE summaries SET tags = ? WHERE id = ?`, tagsJSON, update.id)
		if err != nil {
			return 0, fmt.Errorf("failed to update summary %d: %w", update.id, err)
		}
	}

	return len(updates), nil
}

// GetTagsForSession returns tags for a specific session.
func (s *Store) GetTagsForSession(sessionID int64) ([]string, error) {
	var tagsJSON sql.NullString
	err := s.db.QueryRow(`
		SELECT tags FROM summaries WHERE session_id = ?
		ORDER BY created_at DESC LIMIT 1`, sessionID).Scan(&tagsJSON)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get tags for session: %w", err)
	}

	return ParseJSONStringArray(tagsJSON), nil
}

// AddTagToSession adds a tag to a session's summary.
func (s *Store) AddTagToSession(sessionID int64, tagName string) error {
	tagName = strings.TrimSpace(tagName)
	if tagName == "" {
		return fmt.Errorf("tag name cannot be empty")
	}

	// Get existing tags
	var id int64
	var tagsJSON sql.NullString
	err := s.db.QueryRow(`
		SELECT id, tags FROM summaries WHERE session_id = ?
		ORDER BY created_at DESC LIMIT 1`, sessionID).Scan(&id, &tagsJSON)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no summary found for session %d", sessionID)
	}
	if err != nil {
		return fmt.Errorf("failed to get summary: %w", err)
	}

	tags := ParseJSONStringArray(tagsJSON)

	// Check if tag already exists
	for _, tag := range tags {
		if tag == tagName {
			return nil // Already has this tag
		}
	}

	// Add the tag
	tags = append(tags, tagName)
	newTagsJSON := ToJSONString(tags)

	_, err = s.db.Exec(`UPDATE summaries SET tags = ? WHERE id = ?`, newTagsJSON, id)
	if err != nil {
		return fmt.Errorf("failed to update tags: %w", err)
	}

	return nil
}

// RemoveTagFromSession removes a tag from a session's summary.
func (s *Store) RemoveTagFromSession(sessionID int64, tagName string) error {
	tagName = strings.TrimSpace(tagName)
	if tagName == "" {
		return fmt.Errorf("tag name cannot be empty")
	}

	// Get existing tags
	var id int64
	var tagsJSON sql.NullString
	err := s.db.QueryRow(`
		SELECT id, tags FROM summaries WHERE session_id = ?
		ORDER BY created_at DESC LIMIT 1`, sessionID).Scan(&id, &tagsJSON)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no summary found for session %d", sessionID)
	}
	if err != nil {
		return fmt.Errorf("failed to get summary: %w", err)
	}

	tags := ParseJSONStringArray(tagsJSON)

	// Remove the tag
	var newTags []string
	for _, tag := range tags {
		if tag != tagName {
			newTags = append(newTags, tag)
		}
	}

	newTagsJSON := ToJSONString(newTags)

	_, err = s.db.Exec(`UPDATE summaries SET tags = ? WHERE id = ?`, newTagsJSON, id)
	if err != nil {
		return fmt.Errorf("failed to update tags: %w", err)
	}

	return nil
}

// SetTagsForSession replaces all tags for a session.
func (s *Store) SetTagsForSession(sessionID int64, tags []string) error {
	// Trim and filter empty tags
	var cleanTags []string
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			cleanTags = append(cleanTags, tag)
		}
	}

	// Get the summary ID
	var id int64
	err := s.db.QueryRow(`
		SELECT id FROM summaries WHERE session_id = ?
		ORDER BY created_at DESC LIMIT 1`, sessionID).Scan(&id)
	if err == sql.ErrNoRows {
		return fmt.Errorf("no summary found for session %d", sessionID)
	}
	if err != nil {
		return fmt.Errorf("failed to get summary: %w", err)
	}

	tagsJSON := ToJSONString(cleanTags)

	_, err = s.db.Exec(`UPDATE summaries SET tags = ? WHERE id = ?`, tagsJSON, id)
	if err != nil {
		return fmt.Errorf("failed to update tags: %w", err)
	}

	return nil
}
