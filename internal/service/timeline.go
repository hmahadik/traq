package service

import (
	"time"

	"traq/internal/storage"
)

// TimelineService provides timeline and session data.
type TimelineService struct {
	store *storage.Store
}

// NewTimelineService creates a new TimelineService.
func NewTimelineService(store *storage.Store) *TimelineService {
	return &TimelineService{store: store}
}

// SessionSummary contains summary info for a session.
type SessionSummary struct {
	ID              int64    `json:"id"`
	StartTime       int64    `json:"startTime"`
	EndTime         *int64   `json:"endTime"`         // nil for ongoing sessions
	DurationSeconds *int64   `json:"durationSeconds"` // nil for ongoing sessions
	IsOngoing       bool     `json:"isOngoing"`       // true if session has no end time
	ScreenshotCount int      `json:"screenshotCount"`
	Summary         string   `json:"summary"`
	Explanation     string   `json:"explanation"`
	Confidence      string   `json:"confidence"`
	Tags            []string `json:"tags"`
	TopApps         []string `json:"topApps"`
	HasShell        bool     `json:"hasShell"`
	HasGit          bool     `json:"hasGit"`
	HasFiles        bool     `json:"hasFiles"`
	HasBrowser      bool     `json:"hasBrowser"`
}

// ScreenshotPage contains paginated screenshot results.
type ScreenshotPage struct {
	Screenshots []*storage.Screenshot `json:"screenshots"`
	Total       int64                 `json:"total"`
	Page        int                   `json:"page"`
	PerPage     int                   `json:"perPage"`
	TotalPages  int                   `json:"totalPages"`
	HasMore     bool                  `json:"hasMore"`
}

// SessionContext contains all data for a session.
type SessionContext struct {
	Session       *storage.Session             `json:"session"`
	Summary       *storage.Summary             `json:"summary"`
	Screenshots   []*storage.Screenshot        `json:"screenshots"`
	FocusEvents   []*storage.WindowFocusEvent  `json:"focusEvents"`
	ShellCommands []*storage.ShellCommand      `json:"shellCommands"`
	GitCommits    []*storage.GitCommit         `json:"gitCommits"`
	FileEvents    []*storage.FileEvent         `json:"fileEvents"`
	BrowserVisits []*storage.BrowserVisit      `json:"browserVisits"`
}

// GetSessionsForDate returns all sessions for a date.
func (s *TimelineService) GetSessionsForDate(date string) ([]*SessionSummary, error) {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	start := t.Unix()
	end := t.Add(24 * time.Hour).Unix() - 1

	sessions, err := s.store.GetSessionsByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	var summaries []*SessionSummary
	for _, sess := range sessions {
		summary := &SessionSummary{
			ID:              sess.ID,
			StartTime:       sess.StartTime,
			ScreenshotCount: sess.ScreenshotCount,
			IsOngoing:       !sess.EndTime.Valid,
		}

		if sess.EndTime.Valid {
			endTime := sess.EndTime.Int64
			summary.EndTime = &endTime
		}
		if sess.DurationSeconds.Valid {
			duration := sess.DurationSeconds.Int64
			summary.DurationSeconds = &duration
		}

		// Skip empty sessions (zero duration AND zero screenshots)
		// These are sessions that were created but never captured any data
		if !summary.IsOngoing && summary.ScreenshotCount == 0 &&
			(summary.DurationSeconds == nil || *summary.DurationSeconds == 0) {
			continue
		}

		// Get summary if exists
		if sess.SummaryID.Valid {
			sum, err := s.store.GetSummary(sess.SummaryID.Int64)
			if err == nil && sum != nil {
				summary.Summary = sum.Summary
				if sum.Explanation.Valid {
					summary.Explanation = sum.Explanation.String
				}
				if sum.Confidence.Valid {
					summary.Confidence = sum.Confidence.String
				}
				summary.Tags = sum.Tags
			}
		}

		// Get top apps from focus events
		focusEvents, _ := s.store.GetWindowFocusEventsBySession(sess.ID)
		appDurations := make(map[string]float64)
		for _, evt := range focusEvents {
			appDurations[evt.AppName] += evt.DurationSeconds
		}
		// Sort and take top 3
		for app := range appDurations {
			summary.TopApps = append(summary.TopApps, app)
			if len(summary.TopApps) >= 3 {
				break
			}
		}

		// Check for data source presence
		shellCmds, _ := s.store.GetShellCommandsBySession(sess.ID)
		summary.HasShell = len(shellCmds) > 0

		gitCommits, _ := s.store.GetGitCommitsBySession(sess.ID)
		summary.HasGit = len(gitCommits) > 0

		fileEvents, _ := s.store.GetFileEventsBySession(sess.ID)
		summary.HasFiles = len(fileEvents) > 0

		browserVisits, _ := s.store.GetBrowserVisitsBySession(sess.ID)
		summary.HasBrowser = len(browserVisits) > 0

		summaries = append(summaries, summary)
	}

	return summaries, nil
}

// GetScreenshotsForSession returns paginated screenshots for a session.
func (s *TimelineService) GetScreenshotsForSession(sessionID int64, page, perPage int) (*ScreenshotPage, error) {
	if page < 1 {
		page = 1
	}
	if perPage < 1 || perPage > 100 {
		perPage = 20
	}

	screenshots, err := s.store.GetScreenshotsBySession(sessionID)
	if err != nil {
		return nil, err
	}

	total := int64(len(screenshots))
	totalPages := int((total + int64(perPage) - 1) / int64(perPage))

	start := (page - 1) * perPage
	end := start + perPage
	if start >= len(screenshots) {
		return &ScreenshotPage{
			Screenshots: []*storage.Screenshot{},
			Total:       total,
			Page:        page,
			PerPage:     perPage,
			TotalPages:  totalPages,
			HasMore:     false,
		}, nil
	}
	if end > len(screenshots) {
		end = len(screenshots)
	}

	return &ScreenshotPage{
		Screenshots: screenshots[start:end],
		Total:       total,
		Page:        page,
		PerPage:     perPage,
		TotalPages:  totalPages,
		HasMore:     page < totalPages,
	}, nil
}

// GetScreenshotsForHour returns screenshots for a specific hour.
func (s *TimelineService) GetScreenshotsForHour(date string, hour int) ([]*storage.Screenshot, error) {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	hourStart := time.Date(t.Year(), t.Month(), t.Day(), hour, 0, 0, 0, time.Local)
	hourEnd := hourStart.Add(time.Hour)

	return s.store.GetScreenshotsByTimeRange(hourStart.Unix(), hourEnd.Unix()-1)
}

// GetSessionContext returns all context for a session.
func (s *TimelineService) GetSessionContext(sessionID int64) (*SessionContext, error) {
	session, err := s.store.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	ctx := &SessionContext{
		Session: session,
	}

	// Get summary
	if session.SummaryID.Valid {
		ctx.Summary, _ = s.store.GetSummary(session.SummaryID.Int64)
	}

	// Get screenshots
	ctx.Screenshots, _ = s.store.GetScreenshotsBySession(sessionID)

	// Get focus events
	ctx.FocusEvents, _ = s.store.GetWindowFocusEventsBySession(sessionID)

	// Get shell commands
	ctx.ShellCommands, _ = s.store.GetShellCommandsBySession(sessionID)

	// Get git commits
	ctx.GitCommits, _ = s.store.GetGitCommitsBySession(sessionID)

	// Get file events
	ctx.FileEvents, _ = s.store.GetFileEventsBySession(sessionID)

	// Get browser visits
	ctx.BrowserVisits, _ = s.store.GetBrowserVisitsBySession(sessionID)

	return ctx, nil
}

// GetRecentSessions returns the most recent sessions.
func (s *TimelineService) GetRecentSessions(limit int) ([]*storage.Session, error) {
	if limit < 1 || limit > 100 {
		limit = 10
	}

	end := time.Now().Unix()
	start := end - (30 * 24 * 60 * 60) // Last 30 days

	sessions, err := s.store.GetSessionsByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	// Return last N sessions
	if len(sessions) > limit {
		return sessions[len(sessions)-limit:], nil
	}
	return sessions, nil
}

// GetScreenshotsForDateRange returns screenshots for a date range.
func (s *TimelineService) GetScreenshotsForDateRange(startDate, endDate string, limit int) ([]*storage.Screenshot, error) {
	startT, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, err
	}
	endT, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, err
	}

	screenshots, err := s.store.GetScreenshotsByTimeRange(startT.Unix(), endT.Add(24*time.Hour).Unix()-1)
	if err != nil {
		return nil, err
	}

	if limit > 0 && len(screenshots) > limit {
		return screenshots[:limit], nil
	}
	return screenshots, nil
}
