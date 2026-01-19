package service

import (
	"time"

	"traq/internal/storage"
)

// BackfillService handles applying project patterns to historical data
type BackfillService struct {
	store    *storage.Store
	projects *ProjectAssignmentService
}

// NewBackfillService creates a new BackfillService
func NewBackfillService(store *storage.Store, projects *ProjectAssignmentService) *BackfillService {
	return &BackfillService{
		store:    store,
		projects: projects,
	}
}

// BackfillResult contains statistics from a backfill operation
type BackfillResult struct {
	TotalProcessed  int `json:"totalProcessed"`
	AutoAssigned    int `json:"autoAssigned"`
	AlreadyAssigned int `json:"alreadyAssigned"`
	NoMatch         int `json:"noMatch"`
}

// BackfillProjects applies project patterns to unassigned activities in date range
func (s *BackfillService) BackfillProjects(startDate, endDate string, minConfidence float64) (*BackfillResult, error) {
	return s.processBackfill(startDate, endDate, minConfidence, true)
}

// PreviewBackfill shows what would be assigned without committing
func (s *BackfillService) PreviewBackfill(startDate, endDate string, minConfidence float64) (*BackfillResult, error) {
	return s.processBackfill(startDate, endDate, minConfidence, false)
}

func (s *BackfillService) processBackfill(startDate, endDate string, minConfidence float64, commit bool) (*BackfillResult, error) {
	loc := time.Local

	start, err := time.ParseInLocation("2006-01-02", startDate, loc)
	if err != nil {
		return nil, err
	}
	end, err := time.ParseInLocation("2006-01-02", endDate, loc)
	if err != nil {
		return nil, err
	}
	// Include the entire end date
	end = end.Add(24 * time.Hour)

	startUnix := start.Unix()
	endUnix := end.Unix()

	// Get all focus events in range (including project assignment info)
	events, err := s.store.GetFocusEventsForBackfill(startUnix, endUnix)
	if err != nil {
		return nil, err
	}

	result := &BackfillResult{
		TotalProcessed: len(events),
	}

	for _, event := range events {
		// Skip already assigned
		if event.ProjectID.Valid && event.ProjectID.Int64 != 0 {
			result.AlreadyAssigned++
			continue
		}

		// Build context for pattern matching
		ctx := &storage.AssignmentContext{
			AppName:     event.AppName,
			WindowTitle: event.WindowTitle,
		}

		// Try to match patterns
		match := s.projects.SuggestProject(ctx)
		if match == nil || match.Confidence < minConfidence {
			result.NoMatch++
			continue
		}

		// Assign if committing
		if commit {
			err := s.store.SetEventProject("focus", event.ID, match.ProjectID, match.Confidence, "rule")
			if err != nil {
				// Log but continue
				continue
			}
		}
		result.AutoAssigned++
	}

	return result, nil
}
