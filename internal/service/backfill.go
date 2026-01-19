package service

import (
	"strings"
	"time"

	"traq/internal/storage"
)

// BackfillService handles applying project patterns to historical data
type BackfillService struct {
	store    *storage.Store
	projects *ProjectAssignmentService
	reports  *ReportsService
}

// NewBackfillService creates a new BackfillService
func NewBackfillService(store *storage.Store, projects *ProjectAssignmentService, reports *ReportsService) *BackfillService {
	return &BackfillService{
		store:    store,
		projects: projects,
		reports:  reports,
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

	result := &BackfillResult{}

	// Build project name -> ID lookup for detection function results
	projectsByName := make(map[string]int64)
	projects, _ := s.store.GetProjects()
	for _, p := range projects {
		projectsByName[strings.ToLower(p.Name)] = p.ID
	}

	// Process focus events
	events, err := s.store.GetFocusEventsForBackfill(startUnix, endUnix)
	if err != nil {
		return nil, err
	}

	result.TotalProcessed += len(events)

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

		// Try learned patterns first
		match := s.projects.SuggestProject(ctx)
		if match != nil && match.Confidence >= minConfidence {
			if commit {
				s.store.SetEventProject("focus", event.ID, match.ProjectID, match.Confidence, "rule")
			}
			result.AutoAssigned++
			continue
		}

		// Fallback: use detection functions from reports
		if s.reports != nil {
			projectName := s.reports.DetectProjectFromWindowTitle(event.WindowTitle, event.AppName)
			if projectName != "" {
				if projectID, ok := projectsByName[strings.ToLower(projectName)]; ok {
					if commit {
						s.store.SetEventProject("focus", event.ID, projectID, 0.8, "detection")
					}
					result.AutoAssigned++
					continue
				}
			}
		}

		result.NoMatch++
	}

	// Process git commits
	commits, err := s.store.GetGitCommitsByTimeRange(startUnix, endUnix)
	if err == nil {
		repoPathCache := make(map[int64]string)

		result.TotalProcessed += len(commits)

		for _, gitCommit := range commits {
			// Skip already assigned
			if gitCommit.ProjectID.Valid && gitCommit.ProjectID.Int64 != 0 {
				result.AlreadyAssigned++
				continue
			}

			// Get repo path
			repoPath, ok := repoPathCache[gitCommit.RepositoryID]
			if !ok {
				repo, err := s.store.GetGitRepository(gitCommit.RepositoryID)
				if err == nil && repo != nil {
					repoPath = repo.Path
				}
				repoPathCache[gitCommit.RepositoryID] = repoPath
			}

			if repoPath == "" {
				result.NoMatch++
				continue
			}

			// Try learned patterns first
			ctx := &storage.AssignmentContext{
				GitRepo: repoPath,
			}
			match := s.projects.SuggestProject(ctx)
			if match != nil && match.Confidence >= minConfidence {
				if commit {
					s.store.SetEventProject("git", gitCommit.ID, match.ProjectID, match.Confidence, "rule")
				}
				result.AutoAssigned++
				continue
			}

			// Fallback: use detection functions from reports
			if s.reports != nil {
				projectName := s.reports.DetectProjectFromGitRepo(repoPath)
				if projectName != "" && projectName != "Other" {
					if projectID, ok := projectsByName[strings.ToLower(projectName)]; ok {
						if commit {
							s.store.SetEventProject("git", gitCommit.ID, projectID, 0.9, "detection")
						}
						result.AutoAssigned++
						continue
					}
				}
			}

			result.NoMatch++
		}
	}

	return result, nil
}
