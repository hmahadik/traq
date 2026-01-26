package service

import (
	"sort"
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
	IsDraft         bool     `json:"isDraft"`     // True if this is an AI draft pending approval
	DraftStatus     string   `json:"draftStatus"` // 'none', 'pending', 'accepted', 'rejected'
}

// ScreenshotDisplay is the service-layer type for screenshots with friendly app names.
type ScreenshotDisplay struct {
	ID            int64  `json:"id"`
	Timestamp     int64  `json:"timestamp"`
	Filepath      string `json:"filepath"`
	WindowTitle   string `json:"windowTitle"`
	AppName       string `json:"appName"`
	SessionID     int64  `json:"sessionId"`
	MonitorWidth  int64  `json:"monitorWidth"`
	MonitorHeight int64  `json:"monitorHeight"`
}

// toScreenshotDisplay converts a storage screenshot to a display screenshot with friendly app name.
func toScreenshotDisplay(s *storage.Screenshot) *ScreenshotDisplay {
	if s == nil {
		return nil
	}
	d := &ScreenshotDisplay{
		ID:        s.ID,
		Timestamp: s.Timestamp,
		Filepath:  s.Filepath,
	}
	if s.WindowTitle.Valid {
		d.WindowTitle = s.WindowTitle.String
	}
	if s.AppName.Valid {
		d.AppName = GetFriendlyAppName(s.AppName.String)
	}
	if s.SessionID.Valid {
		d.SessionID = s.SessionID.Int64
	}
	if s.MonitorWidth.Valid {
		d.MonitorWidth = s.MonitorWidth.Int64
	}
	if s.MonitorHeight.Valid {
		d.MonitorHeight = s.MonitorHeight.Int64
	}
	return d
}

// toScreenshotDisplaySlice converts a slice of storage screenshots to display screenshots.
func toScreenshotDisplaySlice(screenshots []*storage.Screenshot) []*ScreenshotDisplay {
	result := make([]*ScreenshotDisplay, len(screenshots))
	for i, s := range screenshots {
		result[i] = toScreenshotDisplay(s)
	}
	return result
}

// ScreenshotPage contains paginated screenshot results.
type ScreenshotPage struct {
	Screenshots []*ScreenshotDisplay `json:"screenshots"`
	Total       int64                `json:"total"`
	Page        int                  `json:"page"`
	PerPage     int                  `json:"perPage"`
	TotalPages  int                  `json:"totalPages"`
	HasMore     bool                 `json:"hasMore"`
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

// EntryBlock represents an activity with project assignment for the Entries lane
type EntryBlock struct {
	ID              int64   `json:"id"`
	EventType       string  `json:"eventType"` // 'focus' or 'screenshot'
	ProjectID       int64   `json:"projectId"`
	ProjectName     string  `json:"projectName"`
	ProjectColor    string  `json:"projectColor"`
	AppName         string  `json:"appName"`
	WindowTitle     string  `json:"windowTitle"`
	StartTime       int64   `json:"startTime"`
	EndTime         int64   `json:"endTime"`
	DurationSeconds float64 `json:"durationSeconds"`
	Confidence      float64 `json:"confidence"`
	Source          string  `json:"source"` // 'user', 'rule', 'ai'
}

// GetSessionsForDate returns all sessions for a date.
func (s *TimelineService) GetSessionsForDate(date string) ([]*SessionSummary, error) {
	// Parse date in local timezone, not UTC
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return nil, err
	}

	start := t.Unix()
	end := t.AddDate(0, 0, 1).Unix() - 1

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

	// Convert to display screenshots with friendly app names
	displayScreenshots := toScreenshotDisplaySlice(screenshots)

	total := int64(len(displayScreenshots))
	totalPages := int((total + int64(perPage) - 1) / int64(perPage))

	start := (page - 1) * perPage
	end := start + perPage
	if start >= len(displayScreenshots) {
		return &ScreenshotPage{
			Screenshots: []*ScreenshotDisplay{},
			Total:       total,
			Page:        page,
			PerPage:     perPage,
			TotalPages:  totalPages,
			HasMore:     false,
		}, nil
	}
	if end > len(displayScreenshots) {
		end = len(displayScreenshots)
	}

	return &ScreenshotPage{
		Screenshots: displayScreenshots[start:end],
		Total:       total,
		Page:        page,
		PerPage:     perPage,
		TotalPages:  totalPages,
		HasMore:     page < totalPages,
	}, nil
}

// GetScreenshotsForHour returns screenshots for a specific hour with friendly app names.
func (s *TimelineService) GetScreenshotsForHour(date string, hour int) ([]*ScreenshotDisplay, error) {
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return nil, err
	}

	hourStart := time.Date(t.Year(), t.Month(), t.Day(), hour, 0, 0, 0, time.Local)
	hourEnd := hourStart.Add(time.Hour)

	screenshots, err := s.store.GetScreenshotsByTimeRange(hourStart.Unix(), hourEnd.Unix()-1)
	if err != nil {
		return nil, err
	}
	return toScreenshotDisplaySlice(screenshots), nil
}

// GetScreenshotsForDate returns all screenshots for a specific date with friendly app names.
func (s *TimelineService) GetScreenshotsForDate(date string) ([]*ScreenshotDisplay, error) {
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return nil, err
	}

	dayStart := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
	dayEnd := dayStart.AddDate(0, 0, 1)

	screenshots, err := s.store.GetScreenshotsByTimeRange(dayStart.Unix(), dayEnd.Unix()-1)
	if err != nil {
		return nil, err
	}
	return toScreenshotDisplaySlice(screenshots), nil
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

// GetEntriesForDate returns project-assigned activities for the Entries lane
func (s *TimelineService) GetEntriesForDate(date string) ([]EntryBlock, error) {
	// Parse date to get time range
	loc := time.Local
	t, err := time.ParseInLocation("2006-01-02", date, loc)
	if err != nil {
		return nil, err
	}
	startOfDay := t.Unix()
	endOfDay := t.AddDate(0, 0, 1).Unix()

	// Get all projects for name/color lookup
	projects, err := s.store.GetProjects()
	if err != nil {
		return nil, err
	}
	projectMap := make(map[int64]*storage.Project)
	for i := range projects {
		projectMap[projects[i].ID] = &projects[i]
	}

	// Get focus events with projects (only active ones)
	focusEvents, err := s.store.GetActiveFocusEventsByTimeRange(startOfDay, endOfDay)
	if err != nil {
		return nil, err
	}

	var entries []EntryBlock
	for _, fe := range focusEvents {
		if !fe.ProjectID.Valid || fe.ProjectID.Int64 == 0 {
			continue // Skip unassigned
		}

		proj := projectMap[fe.ProjectID.Int64]
		projectName := "Unknown"
		projectColor := "#888888"
		if proj != nil {
			projectName = proj.Name
			projectColor = proj.Color
		}

		confidence := 0.0
		if fe.ProjectConfidence.Valid {
			confidence = fe.ProjectConfidence.Float64
		}
		source := "user"
		if fe.ProjectSource.Valid {
			source = fe.ProjectSource.String
		}

		entries = append(entries, EntryBlock{
			ID:              fe.ID,
			EventType:       "focus",
			ProjectID:       fe.ProjectID.Int64,
			ProjectName:     projectName,
			ProjectColor:    projectColor,
			AppName:         GetFriendlyAppName(fe.AppName),
			WindowTitle:     fe.WindowTitle,
			StartTime:       fe.StartTime,
			EndTime:         fe.EndTime,
			DurationSeconds: fe.DurationSeconds,
			Confidence:      confidence,
			Source:          source,
		})
	}

	// Sort by start time
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].StartTime < entries[j].StartTime
	})

	return entries, nil
}
