package service

import (
	"fmt"
	"sort"
	"time"

	"traq/internal/storage"
)

// TimelineGridData represents the data structure for the v3 timeline grid view.
type TimelineGridData struct {
	Date             string                                    `json:"date"`
	DayStats         *DayStats                                 `json:"dayStats"`
	TopApps          []TopApp                                  `json:"topApps"`
	HourlyGrid       map[int]map[string][]ActivityBlock        `json:"hourlyGrid"` // hour -> app -> blocks
	SessionSummaries []*SessionSummaryWithPosition             `json:"sessionSummaries"`
	Categories       map[string]string                         `json:"categories"` // app -> category
	GitEvents        map[int][]GitEventDisplay                 `json:"gitEvents"`  // hour -> git events
	ShellEvents      map[int][]ShellEventDisplay               `json:"shellEvents"` // hour -> shell commands
	FileEvents       map[int][]FileEventDisplay                `json:"fileEvents"` // hour -> file events
	BrowserEvents    map[int][]BrowserEventDisplay             `json:"browserEvents"` // hour -> browser visits
	ActivityClusters map[int][]ActivityCluster                 `json:"activityClusters"` // hour -> clusters
	AFKBlocks        map[int][]AFKBlock                        `json:"afkBlocks"` // hour -> AFK blocks
}

// DayStats contains aggregated statistics for a day.
type DayStats struct {
	TotalSeconds       float64                   `json:"totalSeconds"`
	TotalHours         float64                   `json:"totalHours"`
	BreakCount         int                       `json:"breakCount"`
	BreakDuration      float64                   `json:"breakDuration"`      // Total AFK seconds
	LongestFocus       float64                   `json:"longestFocus"`       // Longest continuous focus seconds
	TimeSinceLastBreak float64                   `json:"timeSinceLastBreak"` // Seconds since last break ended (-1 if no breaks)
	DaySpan            *DaySpan                  `json:"daySpan"`            // First to last activity time
	Breakdown          map[string]float64        `json:"breakdown"`          // category -> seconds
	BreakdownPercent   map[string]float64        `json:"breakdownPercent"`   // category -> percentage
}

// DaySpan represents the time range of activity in a day.
type DaySpan struct {
	StartTime int64   `json:"startTime"`
	EndTime   int64   `json:"endTime"`
	SpanHours float64 `json:"spanHours"`
}

// TopApp represents an app with usage statistics.
type TopApp struct {
	AppName  string  `json:"appName"`
	Duration float64 `json:"duration"` // seconds
	Category string  `json:"category"`
}

// ActivityBlock represents a single focus event block in the grid.
type ActivityBlock struct {
	ID                int64   `json:"id"`
	WindowTitle       string  `json:"windowTitle"`
	AppName           string  `json:"appName"`
	StartTime         int64   `json:"startTime"`
	EndTime           int64   `json:"endTime"`
	DurationSeconds   float64 `json:"durationSeconds"`
	Category          string  `json:"category"`
	HourOffset        int     `json:"hourOffset"`                       // Hour of day (0-23)
	MinuteOffset      int     `json:"minuteOffset"`                     // Minute within hour (0-59)
	PixelPosition     float64 `json:"pixelPosition"`                    // Vertical position in pixels (0-60)
	PixelHeight       float64 `json:"pixelHeight"`                      // Height in pixels
	ProjectID         int64   `json:"projectId,omitempty"`              // Assigned project ID
	ProjectColor      string  `json:"projectColor,omitempty"`           // Project color for visual distinction
	ProjectSource     string  `json:"projectSource,omitempty"`          // 'unassigned', 'user', 'rule', 'ai'
	ProjectConfidence float64 `json:"projectConfidence,omitempty"`      // Confidence of project assignment (0-1)
}

// SessionSummaryWithPosition extends SessionSummary with positioning info for the grid.
type SessionSummaryWithPosition struct {
	SessionSummary            // Embedded session summary
	HourOffset      int       `json:"hourOffset"`      // Starting hour
	MinuteOffset    int       `json:"minuteOffset"`    // Starting minute within hour
	PixelPosition   float64   `json:"pixelPosition"`   // Vertical position in pixels
	PixelHeight     float64   `json:"pixelHeight"`     // Height in pixels (spans multiple hours if needed)
	Category        string    `json:"category"`        // Dominant category for the session
}

// GitEventDisplay represents a git commit for timeline display.
type GitEventDisplay struct {
	ID              int64   `json:"id"`
	Timestamp       int64   `json:"timestamp"`
	Message         string  `json:"message"`
	MessageSubject  string  `json:"messageSubject"`
	ShortHash       string  `json:"shortHash"`
	Repository      string  `json:"repository"`
	Branch          string  `json:"branch"`
	Insertions      int64   `json:"insertions"`
	Deletions       int64   `json:"deletions"`
	HourOffset      int     `json:"hourOffset"`      // Hour of day (0-23)
	MinuteOffset    int     `json:"minuteOffset"`    // Minute within hour (0-59)
	PixelPosition   float64 `json:"pixelPosition"`   // Vertical position in pixels (0-60)
}

// ShellEventDisplay represents a shell command for timeline display.
type ShellEventDisplay struct {
	ID               int64   `json:"id"`
	Timestamp        int64   `json:"timestamp"`
	Command          string  `json:"command"`
	ShellType        string  `json:"shellType"`
	WorkingDirectory string  `json:"workingDirectory"`
	ExitCode         int64   `json:"exitCode"`
	DurationSeconds  float64 `json:"durationSeconds"`
	HourOffset       int     `json:"hourOffset"`      // Hour of day (0-23)
	MinuteOffset     int     `json:"minuteOffset"`    // Minute within hour (0-59)
	PixelPosition    float64 `json:"pixelPosition"`   // Vertical position in pixels (0-60)
}

// FileEventDisplay represents a file system event for timeline display.
type FileEventDisplay struct {
	ID            int64   `json:"id"`
	Timestamp     int64   `json:"timestamp"`
	EventType     string  `json:"eventType"`     // create, modify, delete, rename
	FilePath      string  `json:"filePath"`
	FileName      string  `json:"fileName"`
	Directory     string  `json:"directory"`
	FileExtension string  `json:"fileExtension"`
	FileSizeBytes int64   `json:"fileSizeBytes"`
	WatchCategory string  `json:"watchCategory"` // downloads, projects, documents
	OldPath       string  `json:"oldPath"`       // For rename events
	HourOffset    int     `json:"hourOffset"`    // Hour of day (0-23)
	MinuteOffset  int     `json:"minuteOffset"`  // Minute within hour (0-59)
	PixelPosition float64 `json:"pixelPosition"` // Vertical position in pixels (0-60)
}

// BrowserEventDisplay represents a browser visit for timeline display.
type BrowserEventDisplay struct {
	ID                   int64   `json:"id"`
	Timestamp            int64   `json:"timestamp"`
	URL                  string  `json:"url"`
	Title                string  `json:"title"`
	Domain               string  `json:"domain"`
	Browser              string  `json:"browser"` // chrome, firefox, safari, edge
	VisitDurationSeconds int64   `json:"visitDurationSeconds"`
	TransitionType       string  `json:"transitionType"`
	HourOffset           int     `json:"hourOffset"`      // Hour of day (0-23)
	MinuteOffset         int     `json:"minuteOffset"`    // Minute within hour (0-59)
	PixelPosition        float64 `json:"pixelPosition"`   // Vertical position in pixels (0-60)
}

// ActivityCluster represents a group of related events that occurred in temporal proximity.
type ActivityCluster struct {
	ID              string   `json:"id"`              // Unique cluster ID
	StartTime       int64    `json:"startTime"`       // Timestamp of earliest event
	EndTime         int64    `json:"endTime"`         // Timestamp of latest event
	HourOffset      int      `json:"hourOffset"`      // Hour of day (0-23)
	MinuteOffset    int      `json:"minuteOffset"`    // Minute within hour (0-59)
	PixelPosition   float64  `json:"pixelPosition"`   // Vertical position in pixels
	PixelHeight     float64  `json:"pixelHeight"`     // Height in pixels (spans duration)
	EventCount      int      `json:"eventCount"`      // Total number of events in cluster
	GitEventIDs     []int64  `json:"gitEventIds"`     // IDs of git commits in this cluster
	ShellEventIDs   []int64  `json:"shellEventIds"`   // IDs of shell commands in this cluster
	FileEventIDs    []int64  `json:"fileEventIds"`    // IDs of file events in this cluster
	BrowserEventIDs []int64  `json:"browserEventIds"` // IDs of browser visits in this cluster
	Summary         string   `json:"summary"`         // Brief description of the cluster
}

// AFKBlock represents an AFK (away-from-keyboard) period in the timeline grid.
type AFKBlock struct {
	ID              int64   `json:"id"`
	StartTime       int64   `json:"startTime"`
	EndTime         int64   `json:"endTime"`
	DurationSeconds float64 `json:"durationSeconds"`
	TriggerType     string  `json:"triggerType"`  // idle_timeout, system_sleep, manual
	HourOffset      int     `json:"hourOffset"`   // Hour of day (0-23)
	MinuteOffset    int     `json:"minuteOffset"` // Minute within hour (0-59)
	PixelPosition   float64 `json:"pixelPosition"`// Vertical position in pixels (0-60)
	PixelHeight     float64 `json:"pixelHeight"`  // Height in pixels
}

// ============================================================================
// Week View Types
// ============================================================================

// WeekTimelineData represents the data structure for the week view.
type WeekTimelineData struct {
	StartDate string            `json:"startDate"` // Monday of the week (YYYY-MM-DD)
	EndDate   string            `json:"endDate"`   // Sunday of the week (YYYY-MM-DD)
	Days      []*WeekDayData    `json:"days"`      // 7 days (Mon-Sun)
	WeekStats *WeekSummaryStats `json:"weekStats"` // Aggregated weekly stats
}

// WeekDayData represents a single day in the week view.
type WeekDayData struct {
	Date              string             `json:"date"`              // YYYY-MM-DD
	DayOfWeek         int                `json:"dayOfWeek"`         // 0=Sunday, 6=Saturday
	DayName           string             `json:"dayName"`           // "Mon", "Tue", etc.
	IsToday           bool               `json:"isToday"`
	TotalHours        float64            `json:"totalHours"`
	TimeBlocks        []*WeekTimeBlock   `json:"timeBlocks"`        // 48 blocks (30-min each)
	HasAISummary      bool               `json:"hasAiSummary"`
	ScreenshotCount   int64              `json:"screenshotCount"`
	CategoryBreakdown map[string]float64 `json:"categoryBreakdown"` // category -> hours
}

// WeekTimeBlock represents a 30-minute block in the week view.
type WeekTimeBlock struct {
	BlockIndex       int     `json:"blockIndex"`       // 0-47 (0 = 00:00-00:30, 47 = 23:30-00:00)
	StartHour        int     `json:"startHour"`        // 0-23
	StartMinute      int     `json:"startMinute"`      // 0 or 30
	HasActivity      bool    `json:"hasActivity"`
	DominantCategory string  `json:"dominantCategory"` // "focus", "meetings", "comms", "other"
	ActiveSeconds    float64 `json:"activeSeconds"`    // Actual activity in this 30-min block
	Intensity        int     `json:"intensity"`        // 0-4 for visual intensity
}

// WeekSummaryStats contains aggregated statistics for the week.
type WeekSummaryStats struct {
	TotalHours        float64            `json:"totalHours"`
	AverageDaily      float64            `json:"averageDaily"`
	MostActiveDay     string             `json:"mostActiveDay"`     // "Monday", "Tuesday", etc.
	CategoryBreakdown map[string]float64 `json:"categoryBreakdown"` // category -> hours
}

// GetTimelineGridData retrieves all data needed for the v3 timeline grid view.
func (s *TimelineService) GetTimelineGridData(date string) (*TimelineGridData, error) {
	// Parse date to local timezone day boundaries
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	dayStart := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
	dayEnd := dayStart.AddDate(0, 0, 1).Add(-time.Second)

	// Fetch focus events for the day
	focusEvents, err := s.store.GetFocusEventsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch focus events: %w", err)
	}

	// Fetch top apps
	topAppsData, err := s.store.GetTopApps(dayStart.Unix(), dayEnd.Unix(), 6)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch top apps: %w", err)
	}

	// Get all unique app names for categorization
	appNames := make(map[string]bool)
	for _, event := range focusEvents {
		appNames[event.AppName] = true
	}
	var appNamesList []string
	for name := range appNames {
		appNamesList = append(appNamesList, name)
	}

	// Fetch categories for all apps
	categories, err := s.store.GetAppTimelineCategories(appNamesList)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch app categories: %w", err)
	}

	// Fetch all projects and build a map for O(1) color lookup
	projects, err := s.store.GetProjects()
	if err != nil {
		// Non-fatal: continue without project colors
		projects = []storage.Project{}
	}
	projectMap := make(map[int64]storage.Project)
	for _, proj := range projects {
		projectMap[proj.ID] = proj
	}

	// Build hourly grid: hour -> app -> blocks
	// IMPORTANT: Events may span midnight or hour boundaries, so we clip them
	hourlyGrid := make(map[int]map[string][]ActivityBlock)
	for _, event := range focusEvents {
		// Clip event times to day boundaries
		effectiveStart := event.StartTime
		if effectiveStart < dayStart.Unix() {
			effectiveStart = dayStart.Unix()
		}

		effectiveEnd := event.EndTime
		if effectiveEnd > dayEnd.Unix() {
			effectiveEnd = dayEnd.Unix()
		}

		// Skip if event doesn't overlap with this day after clipping
		if effectiveStart >= effectiveEnd {
			continue
		}

		startTime := time.Unix(effectiveStart, 0).In(time.Local)

		hour := startTime.Hour()
		minute := startTime.Minute()

		// Calculate pixel position and height (60px per hour)
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Use clipped duration for display
		durationSeconds := float64(effectiveEnd - effectiveStart)
		pixelHeight := (durationSeconds / 3600.0) * 60.0

		// Ensure minimum visibility (4px)
		if pixelHeight < 4 {
			pixelHeight = 4
		}

		// Get friendly display name for the app
		friendlyName := GetFriendlyAppName(event.AppName)

		block := ActivityBlock{
			ID:              event.ID,
			WindowTitle:     event.WindowTitle,
			AppName:         friendlyName,
			StartTime:       effectiveStart,
			EndTime:         effectiveEnd,
			DurationSeconds: durationSeconds,
			Category:        categories[event.AppName],
			HourOffset:      hour,
			MinuteOffset:    minute,
			PixelPosition:   pixelPosition,
			PixelHeight:     pixelHeight,
		}

		// Populate project fields if event has a project assignment
		if event.ProjectID.Valid && event.ProjectID.Int64 > 0 {
			block.ProjectID = event.ProjectID.Int64
			if proj, ok := projectMap[event.ProjectID.Int64]; ok {
				block.ProjectColor = proj.Color
			}
			if event.ProjectSource.Valid {
				block.ProjectSource = event.ProjectSource.String
			}
			if event.ProjectConfidence.Valid {
				block.ProjectConfidence = event.ProjectConfidence.Float64
			}
		}

		if hourlyGrid[hour] == nil {
			hourlyGrid[hour] = make(map[string][]ActivityBlock)
		}
		hourlyGrid[hour][friendlyName] = append(hourlyGrid[hour][friendlyName], block)
	}

	// Build top apps list with categories (use friendly names)
	topApps := make([]TopApp, 0, len(topAppsData))
	for _, app := range topAppsData {
		topApps = append(topApps, TopApp{
			AppName:  GetFriendlyAppName(app.AppName),
			Duration: app.Duration,
			Category: categories[app.AppName],
		})
	}

	// Fetch sessions for the day
	sessions, err := s.GetSessionsForDate(date)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch sessions: %w", err)
	}

	// Build session summaries with positions
	// IMPORTANT: Sessions may span midnight, so we clip them to day boundaries
	dayStartUnix := dayStart.Unix()
	dayEndUnix := dayEnd.Unix()

	sessionSummaries := make([]*SessionSummaryWithPosition, 0, len(sessions))
	for _, sess := range sessions {
		// Clip session times to day boundaries for display purposes
		effectiveStart := sess.StartTime
		if effectiveStart < dayStartUnix {
			effectiveStart = dayStartUnix // Session started before this day
		}

		var effectiveEnd int64
		if sess.EndTime != nil {
			effectiveEnd = *sess.EndTime
		} else {
			// Ongoing session - use current time or day end, whichever is earlier
			now := time.Now().Unix()
			if now > dayEndUnix {
				effectiveEnd = dayEndUnix
			} else {
				effectiveEnd = now
			}
		}
		if effectiveEnd > dayEndUnix {
			effectiveEnd = dayEndUnix // Session extends past this day
		}

		// Skip if session doesn't overlap with this day after clipping
		if effectiveStart >= effectiveEnd {
			continue
		}

		startTime := time.Unix(effectiveStart, 0).In(time.Local)

		hour := startTime.Hour()
		minute := startTime.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Use clipped duration for display
		durationSeconds := float64(effectiveEnd - effectiveStart)

		pixelHeight := (durationSeconds / 3600.0) * 60.0
		if pixelHeight < 10 {
			pixelHeight = 10 // Minimum height for session blocks
		}

		// Determine dominant category for the session based on focus events
		sessionCategory := s.getSessionDominantCategory(sess.ID, categories)

		sessionSummaries = append(sessionSummaries, &SessionSummaryWithPosition{
			SessionSummary: *sess,
			HourOffset:     hour,
			MinuteOffset:   minute,
			PixelPosition:  pixelPosition,
			PixelHeight:    pixelHeight,
			Category:       sessionCategory,
		})
	}

	// Calculate day stats
	dayStats := s.calculateDayStats(focusEvents, categories, dayStart, dayEnd)

	// Transform categories to use friendly names as keys (for frontend matching)
	friendlyCategories := make(map[string]string)
	for rawName, category := range categories {
		friendlyName := GetFriendlyAppName(rawName)
		friendlyCategories[friendlyName] = category
	}

	// Fetch git commits for the day
	gitCommits, err := s.store.GetGitCommitsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	if err != nil {
		// Non-critical: log error but continue without git events
		gitCommits = []*storage.GitCommit{}
	}

	// Build git events map: hour -> events
	gitEvents := make(map[int][]GitEventDisplay)

	// Get repository names for display
	repoMap := make(map[int64]string)
	repos, _ := s.store.GetActiveGitRepositories()
	for _, repo := range repos {
		repoMap[repo.ID] = repo.Name
	}

	for _, commit := range gitCommits {
		commitTime := time.Unix(commit.Timestamp, 0).In(time.Local)
		hour := commitTime.Hour()
		minute := commitTime.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Get repository name or use "Unknown" if not found
		repoName := repoMap[commit.RepositoryID]
		if repoName == "" {
			repoName = "Unknown"
		}

		// Get branch name
		branch := "main"
		if commit.Branch.Valid && commit.Branch.String != "" {
			branch = commit.Branch.String
		}

		// Get insertions and deletions
		insertions := int64(0)
		if commit.Insertions.Valid {
			insertions = commit.Insertions.Int64
		}
		deletions := int64(0)
		if commit.Deletions.Valid {
			deletions = commit.Deletions.Int64
		}

		gitEvent := GitEventDisplay{
			ID:             commit.ID,
			Timestamp:      commit.Timestamp,
			Message:        commit.Message,
			MessageSubject: commit.MessageSubject,
			ShortHash:      commit.ShortHash,
			Repository:     repoName,
			Branch:         branch,
			Insertions:     insertions,
			Deletions:      deletions,
			HourOffset:     hour,
			MinuteOffset:   minute,
			PixelPosition:  pixelPosition,
		}

		gitEvents[hour] = append(gitEvents[hour], gitEvent)
	}

	// Fetch shell commands for the day
	shellCommands, err := s.store.GetShellCommandsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	if err != nil {
		// Non-fatal: log and continue with empty shell events
		shellCommands = []*storage.ShellCommand{}
	}

	// Build shell events map: hour -> events
	shellEvents := make(map[int][]ShellEventDisplay)

	for _, cmd := range shellCommands {
		cmdTime := time.Unix(cmd.Timestamp, 0).In(time.Local)
		hour := cmdTime.Hour()
		minute := cmdTime.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Get working directory or use empty string
		workingDir := ""
		if cmd.WorkingDirectory.Valid {
			workingDir = cmd.WorkingDirectory.String
		}

		// Get exit code or use 0
		exitCode := int64(0)
		if cmd.ExitCode.Valid {
			exitCode = cmd.ExitCode.Int64
		}

		// Get duration or use 0
		duration := 0.0
		if cmd.DurationSeconds.Valid {
			duration = cmd.DurationSeconds.Float64
		}

		shellEvent := ShellEventDisplay{
			ID:               cmd.ID,
			Timestamp:        cmd.Timestamp,
			Command:          cmd.Command,
			ShellType:        cmd.ShellType,
			WorkingDirectory: workingDir,
			ExitCode:         exitCode,
			DurationSeconds:  duration,
			HourOffset:       hour,
			MinuteOffset:     minute,
			PixelPosition:    pixelPosition,
		}

		shellEvents[hour] = append(shellEvents[hour], shellEvent)
	}

	// Fetch file events for the day
	fileEvents_, err := s.store.GetFileEventsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	if err != nil {
		// Non-fatal: log and continue with empty file events
		fileEvents_ = []*storage.FileEvent{}
	}

	// Build file events map: hour -> events
	fileEvents := make(map[int][]FileEventDisplay)

	for _, file := range fileEvents_ {
		fileTime := time.Unix(file.Timestamp, 0).In(time.Local)
		hour := fileTime.Hour()
		minute := fileTime.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Get file extension or use empty string
		fileExt := ""
		if file.FileExtension.Valid {
			fileExt = file.FileExtension.String
		}

		// Get file size or use 0
		fileSize := int64(0)
		if file.FileSizeBytes.Valid {
			fileSize = file.FileSizeBytes.Int64
		}

		// Get old path for rename events or use empty string
		oldPath := ""
		if file.OldPath.Valid {
			oldPath = file.OldPath.String
		}

		fileEvent := FileEventDisplay{
			ID:            file.ID,
			Timestamp:     file.Timestamp,
			EventType:     file.EventType,
			FilePath:      file.FilePath,
			FileName:      file.FileName,
			Directory:     file.Directory,
			FileExtension: fileExt,
			FileSizeBytes: fileSize,
			WatchCategory: file.WatchCategory,
			OldPath:       oldPath,
			HourOffset:    hour,
			MinuteOffset:  minute,
			PixelPosition: pixelPosition,
		}

		fileEvents[hour] = append(fileEvents[hour], fileEvent)
	}

	// Fetch browser visits for the day
	browserVisits_, err := s.store.GetBrowserVisitsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	if err != nil {
		// Non-fatal: log and continue with empty browser visits
		browserVisits_ = []*storage.BrowserVisit{}
	}

	// Build browser events map: hour -> events
	browserEvents := make(map[int][]BrowserEventDisplay)

	for _, visit := range browserVisits_ {
		visitTime := time.Unix(visit.Timestamp, 0).In(time.Local)
		hour := visitTime.Hour()
		minute := visitTime.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Get title or use empty string
		title := ""
		if visit.Title.Valid {
			title = visit.Title.String
		}

		// Get visit duration or use 0
		visitDuration := int64(0)
		if visit.VisitDurationSeconds.Valid {
			visitDuration = visit.VisitDurationSeconds.Int64
		}

		// Get transition type or use empty string
		transitionType := ""
		if visit.TransitionType.Valid {
			transitionType = visit.TransitionType.String
		}

		browserEvent := BrowserEventDisplay{
			ID:                   visit.ID,
			Timestamp:            visit.Timestamp,
			URL:                  visit.URL,
			Title:                title,
			Domain:               visit.Domain,
			Browser:              visit.Browser,
			VisitDurationSeconds: visitDuration,
			TransitionType:       transitionType,
			HourOffset:           hour,
			MinuteOffset:         minute,
			PixelPosition:        pixelPosition,
		}

		browserEvents[hour] = append(browserEvents[hour], browserEvent)
	}

	// Generate activity clusters by identifying temporally related events
	activityClusters := s.generateActivityClusters(gitEvents, shellEvents, fileEvents, browserEvents, dayStart)

	// Fetch AFK events for the day
	afkEvents, err := s.store.GetAFKEventsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	if err != nil {
		// Non-fatal: log and continue with empty AFK blocks
		afkEvents = []*storage.AFKEvent{}
	}

	// Build AFK blocks map: hour -> blocks
	afkBlocks := make(map[int][]AFKBlock)

	for _, afk := range afkEvents {
		// Skip if AFK event doesn't have an end time yet (ongoing)
		if !afk.EndTime.Valid {
			continue
		}

		// Clip AFK times to day boundaries
		effectiveStart := afk.StartTime
		if effectiveStart < dayStart.Unix() {
			effectiveStart = dayStart.Unix()
		}

		effectiveEnd := afk.EndTime.Int64
		if effectiveEnd > dayEnd.Unix() {
			effectiveEnd = dayEnd.Unix()
		}

		// Skip if AFK doesn't overlap with this day after clipping
		if effectiveStart >= effectiveEnd {
			continue
		}

		startTime := time.Unix(effectiveStart, 0).In(time.Local)
		hour := startTime.Hour()
		minute := startTime.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0

		// Use clipped duration for display
		durationSeconds := float64(effectiveEnd - effectiveStart)
		pixelHeight := (durationSeconds / 3600.0) * 60.0

		// Ensure minimum visibility (4px)
		if pixelHeight < 4 {
			pixelHeight = 4
		}

		block := AFKBlock{
			ID:              afk.ID,
			StartTime:       effectiveStart,
			EndTime:         effectiveEnd,
			DurationSeconds: durationSeconds,
			TriggerType:     afk.TriggerType,
			HourOffset:      hour,
			MinuteOffset:    minute,
			PixelPosition:   pixelPosition,
			PixelHeight:     pixelHeight,
		}

		afkBlocks[hour] = append(afkBlocks[hour], block)
	}

	return &TimelineGridData{
		Date:             date,
		DayStats:         dayStats,
		TopApps:          topApps,
		HourlyGrid:       hourlyGrid,
		SessionSummaries: sessionSummaries,
		Categories:       friendlyCategories,
		GitEvents:        gitEvents,
		ShellEvents:      shellEvents,
		FileEvents:       fileEvents,
		BrowserEvents:    browserEvents,
		ActivityClusters: activityClusters,
		AFKBlocks:        afkBlocks,
	}, nil
}

// getSessionDominantCategory determines the dominant category for a session based on focus events.
func (s *TimelineService) getSessionDominantCategory(sessionID int64, categories map[string]string) string {
	focusEvents, err := s.store.GetWindowFocusEventsBySession(sessionID)
	if err != nil || len(focusEvents) == 0 {
		return "other"
	}

	categoryDurations := make(map[string]float64)
	for _, event := range focusEvents {
		category := categories[event.AppName]
		categoryDurations[category] += event.DurationSeconds
	}

	// Find the category with the most time
	var dominantCategory string
	var maxDuration float64
	for category, duration := range categoryDurations {
		if duration > maxDuration {
			maxDuration = duration
			dominantCategory = category
		}
	}

	if dominantCategory == "" {
		return "other"
	}
	return dominantCategory
}

// generateActivityClusters identifies and groups temporally related events.
// Events within 5 minutes of each other are considered potentially related.
func (s *TimelineService) generateActivityClusters(
	gitEvents map[int][]GitEventDisplay,
	shellEvents map[int][]ShellEventDisplay,
	fileEvents map[int][]FileEventDisplay,
	browserEvents map[int][]BrowserEventDisplay,
	dayStart time.Time,
) map[int][]ActivityCluster {

	// Collect all events with timestamps
	type eventWithTime struct {
		timestamp   int64
		eventType   string // "git", "shell", "file", "browser"
		eventID     int64
		hour        int
		minute      int
		pixelPos    float64
	}

	var allEvents []eventWithTime

	// Collect git events
	for _, events := range gitEvents {
		for _, e := range events {
			allEvents = append(allEvents, eventWithTime{
				timestamp: e.Timestamp,
				eventType: "git",
				eventID:   e.ID,
				hour:      e.HourOffset,
				minute:    e.MinuteOffset,
				pixelPos:  e.PixelPosition,
			})
		}
	}

	// Collect shell events
	for _, events := range shellEvents {
		for _, e := range events {
			allEvents = append(allEvents, eventWithTime{
				timestamp: e.Timestamp,
				eventType: "shell",
				eventID:   e.ID,
				hour:      e.HourOffset,
				minute:    e.MinuteOffset,
				pixelPos:  e.PixelPosition,
			})
		}
	}

	// Collect file events
	for _, events := range fileEvents {
		for _, e := range events {
			allEvents = append(allEvents, eventWithTime{
				timestamp: e.Timestamp,
				eventType: "file",
				eventID:   e.ID,
				hour:      e.HourOffset,
				minute:    e.MinuteOffset,
				pixelPos:  e.PixelPosition,
			})
		}
	}

	// Collect browser events
	for _, events := range browserEvents {
		for _, e := range events {
			allEvents = append(allEvents, eventWithTime{
				timestamp: e.Timestamp,
				eventType: "browser",
				eventID:   e.ID,
				hour:      e.HourOffset,
				minute:    e.MinuteOffset,
				pixelPos:  e.PixelPosition,
			})
		}
	}

	// Sort events by timestamp
	sort.Slice(allEvents, func(i, j int) bool {
		return allEvents[i].timestamp < allEvents[j].timestamp
	})

	// Build clusters: events within 5 minutes of each other are grouped
	clusters := make(map[int][]ActivityCluster)
	const clusterWindow = 5 * 60 // 5 minutes in seconds

	var currentCluster *ActivityCluster
	clusterID := 0

	for _, event := range allEvents {
		// If no current cluster or event is too far from cluster, start new cluster
		if currentCluster == nil || event.timestamp-currentCluster.EndTime > clusterWindow {
			// Save previous cluster if it had multiple events
			if currentCluster != nil && currentCluster.EventCount >= 2 {
				hour := currentCluster.HourOffset
				clusters[hour] = append(clusters[hour], *currentCluster)
			}

			// Start new cluster
			clusterID++
			currentCluster = &ActivityCluster{
				ID:              fmt.Sprintf("cluster-%d", clusterID),
				StartTime:       event.timestamp,
				EndTime:         event.timestamp,
				HourOffset:      event.hour,
				MinuteOffset:    event.minute,
				PixelPosition:   event.pixelPos,
				PixelHeight:     4, // Will be updated
				EventCount:      0,
				GitEventIDs:     []int64{},
				ShellEventIDs:   []int64{},
				FileEventIDs:    []int64{},
				BrowserEventIDs: []int64{},
				Summary:         "",
			}
		}

		// Add event to current cluster
		currentCluster.EventCount++
		currentCluster.EndTime = event.timestamp

		switch event.eventType {
		case "git":
			currentCluster.GitEventIDs = append(currentCluster.GitEventIDs, event.eventID)
		case "shell":
			currentCluster.ShellEventIDs = append(currentCluster.ShellEventIDs, event.eventID)
		case "file":
			currentCluster.FileEventIDs = append(currentCluster.FileEventIDs, event.eventID)
		case "browser":
			currentCluster.BrowserEventIDs = append(currentCluster.BrowserEventIDs, event.eventID)
		}

		// Update pixel height to span from first to last event
		durationMinutes := float64(currentCluster.EndTime-currentCluster.StartTime) / 60.0
		currentCluster.PixelHeight = (durationMinutes / 60.0) * 80.0 // 80px per hour
		if currentCluster.PixelHeight < 4 {
			currentCluster.PixelHeight = 4
		}

		// Generate summary
		parts := []string{}
		if len(currentCluster.GitEventIDs) > 0 {
			parts = append(parts, fmt.Sprintf("%d commit%s", len(currentCluster.GitEventIDs), pluralize(len(currentCluster.GitEventIDs))))
		}
		if len(currentCluster.ShellEventIDs) > 0 {
			parts = append(parts, fmt.Sprintf("%d command%s", len(currentCluster.ShellEventIDs), pluralize(len(currentCluster.ShellEventIDs))))
		}
		if len(currentCluster.FileEventIDs) > 0 {
			parts = append(parts, fmt.Sprintf("%d file%s", len(currentCluster.FileEventIDs), pluralize(len(currentCluster.FileEventIDs))))
		}
		if len(currentCluster.BrowserEventIDs) > 0 {
			parts = append(parts, fmt.Sprintf("%d visit%s", len(currentCluster.BrowserEventIDs), pluralize(len(currentCluster.BrowserEventIDs))))
		}

		if len(parts) > 0 {
			currentCluster.Summary = "Related: " + parts[0]
			if len(parts) > 1 {
				currentCluster.Summary += ", " + parts[1]
			}
			if len(parts) > 2 {
				currentCluster.Summary += ", +"
				for i := 2; i < len(parts); i++ {
					if i > 2 {
						currentCluster.Summary += ", "
					}
					currentCluster.Summary += parts[i]
				}
			}
		}
	}

	// Save last cluster if it had multiple events
	if currentCluster != nil && currentCluster.EventCount >= 2 {
		hour := currentCluster.HourOffset
		clusters[hour] = append(clusters[hour], *currentCluster)
	}

	return clusters
}

// pluralize returns "s" if count is not 1, otherwise empty string.
func pluralize(count int) string {
	if count == 1 {
		return ""
	}
	return "s"
}

// calculateDayStats computes aggregated statistics for the day.
func (s *TimelineService) calculateDayStats(focusEvents []*storage.WindowFocusEvent, categories map[string]string, dayStart, dayEnd time.Time) *DayStats {
	if len(focusEvents) == 0 {
		return &DayStats{
			TotalSeconds:       0,
			TotalHours:         0,
			BreakCount:         0,
			BreakDuration:      0,
			LongestFocus:       0,
			TimeSinceLastBreak: -1, // No breaks taken
			Breakdown:          make(map[string]float64),
			BreakdownPercent:   make(map[string]float64),
		}
	}

	// Get AFK events first to filter out inactive periods
	afkEvents, _ := s.store.GetAFKEventsByTimeRange(dayStart.Unix(), dayEnd.Unix())

	// Helper function to check if a time range overlaps with any AFK period
	isOverlappingAFK := func(start, end int64) bool {
		for _, afk := range afkEvents {
			if !afk.EndTime.Valid {
				continue // Skip ongoing AFK periods
			}
			afkStart := afk.StartTime
			afkEnd := afk.EndTime.Int64
			// Check for overlap: event overlaps AFK if it starts before AFK ends and ends after AFK starts
			if start < afkEnd && end > afkStart {
				return true
			}
		}
		return false
	}

	// Calculate total time and category breakdown, excluding AFK periods
	var totalSeconds float64
	breakdown := map[string]float64{
		"focus":    0,
		"meetings": 0,
		"comms":    0,
		"other":    0,
	}

	for _, event := range focusEvents {
		// Skip events that overlap with AFK periods
		if isOverlappingAFK(event.StartTime, event.EndTime) {
			continue
		}

		totalSeconds += event.DurationSeconds
		category := categories[event.AppName]
		breakdown[category] += event.DurationSeconds
	}

	// Count and categorize breaks (based on v1 logic: gaps between 3min and 2hr)
	// Sort events by start time for gap detection
	sortedEvents := make([]*storage.WindowFocusEvent, 0, len(focusEvents))
	for _, event := range focusEvents {
		if !isOverlappingAFK(event.StartTime, event.EndTime) {
			sortedEvents = append(sortedEvents, event)
		}
	}
	sort.Slice(sortedEvents, func(i, j int) bool {
		return sortedEvents[i].StartTime < sortedEvents[j].StartTime
	})

	// Calculate breaks between sessions
	const minBreakSeconds = 180   // 3 minutes
	const maxBreakSeconds = 7200  // 2 hours

	var breakCount int
	var breakDuration float64

	for i := 1; i < len(sortedEvents); i++ {
		gap := sortedEvents[i].StartTime - sortedEvents[i-1].EndTime
		if gap >= minBreakSeconds && gap <= maxBreakSeconds {
			breakCount++
			breakDuration += float64(gap)
		}
	}

	// Add breaks to the breakdown as a separate category
	breakdown["breaks"] = breakDuration
	totalSecondsWithBreaks := totalSeconds + breakDuration

	// Calculate breakdown percentages (including breaks)
	breakdownPercent := make(map[string]float64)
	if totalSecondsWithBreaks > 0 {
		for category, seconds := range breakdown {
			breakdownPercent[category] = (seconds / totalSecondsWithBreaks) * 100.0
		}
	}

	// Calculate longest continuous focus session (using only non-AFK events)
	longestFocus := 0.0
	currentFocus := 0.0
	var lastEndTime int64

	for _, event := range sortedEvents {
		// Skip events during AFK (already filtered in sortedEvents, but double-check)
		if isOverlappingAFK(event.StartTime, event.EndTime) {
			currentFocus = 0
			lastEndTime = 0
			continue
		}

		category := categories[event.AppName]

		// Only count "focus" category for longest focus calculation
		if category == "focus" {
			// Check if this continues the previous focus session (gap < 5 minutes)
			if lastEndTime > 0 && event.StartTime-lastEndTime < 300 {
				currentFocus += event.DurationSeconds
			} else {
				currentFocus = event.DurationSeconds
			}

			if currentFocus > longestFocus {
				longestFocus = currentFocus
			}
			lastEndTime = event.EndTime
		} else {
			// Non-focus activity breaks the focus streak
			currentFocus = 0
			lastEndTime = 0
		}
	}

	// Calculate day span (first to last activity, excluding AFK)
	var daySpan *DaySpan
	if len(sortedEvents) > 0 {
		firstActivity := sortedEvents[0].StartTime
		lastActivity := sortedEvents[len(sortedEvents)-1].EndTime
		spanSeconds := float64(lastActivity - firstActivity)

		daySpan = &DaySpan{
			StartTime: firstActivity,
			EndTime:   lastActivity,
			SpanHours: spanSeconds / 3600.0,
		}
	}

	// Calculate time since last break
	// Find the most recent AFK end time and calculate time elapsed
	timeSinceLastBreak := float64(-1) // -1 means no breaks taken
	if len(afkEvents) > 0 {
		// Find the latest AFK event that has ended
		var latestBreakEnd int64 = 0
		for _, afk := range afkEvents {
			if afk.EndTime.Valid && afk.EndTime.Int64 > latestBreakEnd {
				latestBreakEnd = afk.EndTime.Int64
			}
		}
		if latestBreakEnd > 0 {
			// Use current time for today, or day end for historical days
			now := time.Now().Unix()
			referenceTime := now
			if now > dayEnd.Unix() {
				// Historical day - use day end
				referenceTime = dayEnd.Unix()
			}
			timeSinceLastBreak = float64(referenceTime - latestBreakEnd)
			if timeSinceLastBreak < 0 {
				timeSinceLastBreak = 0
			}
		}
	}

	return &DayStats{
		TotalSeconds:       totalSeconds,
		TotalHours:         totalSeconds / 3600.0,
		BreakCount:         breakCount,
		BreakDuration:      breakDuration,
		LongestFocus:       longestFocus,
		TimeSinceLastBreak: timeSinceLastBreak,
		DaySpan:            daySpan,
		Breakdown:          breakdown,
		BreakdownPercent:   breakdownPercent,
	}
}

// ============================================================================
// Week View Methods
// ============================================================================

// GetWeekTimelineData retrieves aggregated data for the week view.
// startDate can be any date in the desired week; it will be normalized to Monday.
func (s *TimelineService) GetWeekTimelineData(startDate string) (*WeekTimelineData, error) {
	// Parse the input date
	t, err := time.ParseInLocation("2006-01-02", startDate, time.Local)
	if err != nil {
		return nil, fmt.Errorf("invalid date format: %w", err)
	}

	// Normalize to Monday of the week
	weekday := int(t.Weekday())
	if weekday == 0 {
		weekday = 7 // Sunday becomes 7
	}
	monday := t.AddDate(0, 0, -(weekday - 1))
	sunday := monday.AddDate(0, 0, 6)

	// Get week boundaries
	weekStart := time.Date(monday.Year(), monday.Month(), monday.Day(), 0, 0, 0, 0, time.Local)
	weekEnd := time.Date(sunday.Year(), sunday.Month(), sunday.Day(), 23, 59, 59, 0, time.Local)

	// Fetch all focus events for the entire week in one query
	focusEvents, err := s.store.GetFocusEventsByTimeRange(weekStart.Unix(), weekEnd.Unix())
	if err != nil {
		return nil, fmt.Errorf("failed to fetch focus events: %w", err)
	}

	// Get all unique app names for categorization
	appNames := make(map[string]bool)
	for _, event := range focusEvents {
		appNames[event.AppName] = true
	}
	var appNamesList []string
	for name := range appNames {
		appNamesList = append(appNamesList, name)
	}

	// Fetch categories for all apps
	categories, err := s.store.GetAppTimelineCategories(appNamesList)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch app categories: %w", err)
	}

	// Get today's date for comparison
	today := time.Now().In(time.Local)
	todayStr := today.Format("2006-01-02")

	// Build data for each day
	days := make([]*WeekDayData, 7)
	dayNames := []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
	fullDayNames := []string{"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"}

	var totalWeekHours float64
	var mostActiveDay string
	var mostActiveHours float64
	weekCategoryBreakdown := map[string]float64{
		"focus":    0,
		"meetings": 0,
		"comms":    0,
		"other":    0,
	}

	for i := 0; i < 7; i++ {
		dayDate := monday.AddDate(0, 0, i)
		dayStr := dayDate.Format("2006-01-02")

		// Calculate day boundaries
		dayStart := time.Date(dayDate.Year(), dayDate.Month(), dayDate.Day(), 0, 0, 0, 0, time.Local)
		dayEnd := dayStart.AddDate(0, 0, 1).Add(-time.Second)

		// Filter focus events for this day
		dayEvents := filterEventsByDay(focusEvents, dayStart.Unix(), dayEnd.Unix())

		// Build 48 time blocks (30-min each)
		timeBlocks := make([]*WeekTimeBlock, 48)
		for blockIdx := 0; blockIdx < 48; blockIdx++ {
			hour := blockIdx / 2
			minute := (blockIdx % 2) * 30
			timeBlocks[blockIdx] = &WeekTimeBlock{
				BlockIndex:       blockIdx,
				StartHour:        hour,
				StartMinute:      minute,
				HasActivity:      false,
				DominantCategory: "",
				ActiveSeconds:    0,
				Intensity:        0,
			}
		}

		// Aggregate events into time blocks
		dayCategoryBreakdown := map[string]float64{
			"focus":    0,
			"meetings": 0,
			"comms":    0,
			"other":    0,
		}

		for _, event := range dayEvents {
			// Clip event to day boundaries
			effectiveStart := event.StartTime
			if effectiveStart < dayStart.Unix() {
				effectiveStart = dayStart.Unix()
			}
			effectiveEnd := event.EndTime
			if effectiveEnd > dayEnd.Unix() {
				effectiveEnd = dayEnd.Unix()
			}
			if effectiveStart >= effectiveEnd {
				continue
			}

			category := categories[event.AppName]
			if category == "" {
				category = "other"
			}

			// Distribute event duration across 30-min blocks
			eventStart := time.Unix(effectiveStart, 0).In(time.Local)
			eventEnd := time.Unix(effectiveEnd, 0).In(time.Local)

			// Calculate which blocks this event spans
			startBlockIdx := eventStart.Hour()*2 + eventStart.Minute()/30
			endBlockIdx := eventEnd.Hour()*2 + eventEnd.Minute()/30
			if endBlockIdx >= 48 {
				endBlockIdx = 47
			}

			for blockIdx := startBlockIdx; blockIdx <= endBlockIdx; blockIdx++ {
				block := timeBlocks[blockIdx]

				// Calculate overlap with this block
				blockStartTime := dayStart.Add(time.Duration(blockIdx*30) * time.Minute)
				blockEndTime := blockStartTime.Add(30 * time.Minute)

				overlapStart := effectiveStart
				if overlapStart < blockStartTime.Unix() {
					overlapStart = blockStartTime.Unix()
				}
				overlapEnd := effectiveEnd
				if overlapEnd > blockEndTime.Unix() {
					overlapEnd = blockEndTime.Unix()
				}

				overlapSeconds := float64(overlapEnd - overlapStart)
				if overlapSeconds > 0 {
					block.HasActivity = true
					block.ActiveSeconds += overlapSeconds

					// Track category time for this block
					// For dominant category, we'll use a simple approach: last category wins
					// but could be enhanced to track per-category time
					block.DominantCategory = category
				}
			}

			// Track category breakdown for the day
			duration := float64(effectiveEnd - effectiveStart)
			dayCategoryBreakdown[category] += duration
		}

		// Calculate intensity for each block (0-4 based on active time)
		for _, block := range timeBlocks {
			if block.ActiveSeconds > 0 {
				// Intensity based on % of 30 minutes (1800 seconds)
				percentage := (block.ActiveSeconds / 1800.0) * 100
				switch {
				case percentage >= 80:
					block.Intensity = 4
				case percentage >= 60:
					block.Intensity = 3
				case percentage >= 40:
					block.Intensity = 2
				case percentage >= 20:
					block.Intensity = 1
				default:
					block.Intensity = 1 // At least 1 if there's any activity
				}
			}
		}

		// Calculate total hours for the day
		var dayTotalSeconds float64
		for _, secs := range dayCategoryBreakdown {
			dayTotalSeconds += secs
		}
		dayTotalHours := dayTotalSeconds / 3600.0

		// Convert category breakdown to hours
		dayCategoryHours := make(map[string]float64)
		for cat, secs := range dayCategoryBreakdown {
			dayCategoryHours[cat] = secs / 3600.0
			weekCategoryBreakdown[cat] += secs / 3600.0
		}

		// Track most active day
		if dayTotalHours > mostActiveHours {
			mostActiveHours = dayTotalHours
			mostActiveDay = fullDayNames[i]
		}
		totalWeekHours += dayTotalHours

		// Get screenshot count for the day
		screenshotCount, _ := s.store.CountScreenshotsByTimeRange(dayStart.Unix(), dayEnd.Unix())

		// Check if day has any AI summaries
		sessions, _ := s.GetSessionsForDate(dayStr)
		hasAISummary := false
		for _, sess := range sessions {
			if sess.Summary != "" {
				hasAISummary = true
				break
			}
		}

		days[i] = &WeekDayData{
			Date:              dayStr,
			DayOfWeek:         int(dayDate.Weekday()),
			DayName:           dayNames[i],
			IsToday:           dayStr == todayStr,
			TotalHours:        dayTotalHours,
			TimeBlocks:        timeBlocks,
			HasAISummary:      hasAISummary,
			ScreenshotCount:   screenshotCount,
			CategoryBreakdown: dayCategoryHours,
		}
	}

	// Calculate week stats
	activeDays := 0
	for _, day := range days {
		if day.TotalHours > 0 {
			activeDays++
		}
	}

	averageDaily := 0.0
	if activeDays > 0 {
		averageDaily = totalWeekHours / float64(activeDays)
	}

	weekStats := &WeekSummaryStats{
		TotalHours:        totalWeekHours,
		AverageDaily:      averageDaily,
		MostActiveDay:     mostActiveDay,
		CategoryBreakdown: weekCategoryBreakdown,
	}

	return &WeekTimelineData{
		StartDate: monday.Format("2006-01-02"),
		EndDate:   sunday.Format("2006-01-02"),
		Days:      days,
		WeekStats: weekStats,
	}, nil
}

// filterEventsByDay returns focus events that overlap with the given day.
func filterEventsByDay(events []*storage.WindowFocusEvent, dayStart, dayEnd int64) []*storage.WindowFocusEvent {
	var result []*storage.WindowFocusEvent
	for _, e := range events {
		// Check if event overlaps with the day
		if e.StartTime <= dayEnd && e.EndTime >= dayStart {
			result = append(result, e)
		}
	}
	return result
}
