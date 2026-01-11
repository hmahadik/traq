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
}

// DayStats contains aggregated statistics for a day.
type DayStats struct {
	TotalSeconds    float64                   `json:"totalSeconds"`
	TotalHours      float64                   `json:"totalHours"`
	BreakCount      int                       `json:"breakCount"`
	BreakDuration   float64                   `json:"breakDuration"`    // Total AFK seconds
	LongestFocus    float64                   `json:"longestFocus"`     // Longest continuous focus seconds
	DaySpan         *DaySpan                  `json:"daySpan"`          // First to last activity time
	Breakdown       map[string]float64        `json:"breakdown"`        // category -> seconds
	BreakdownPercent map[string]float64       `json:"breakdownPercent"` // category -> percentage
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
	ID              int64   `json:"id"`
	WindowTitle     string  `json:"windowTitle"`
	AppName         string  `json:"appName"`
	StartTime       int64   `json:"startTime"`
	EndTime         int64   `json:"endTime"`
	DurationSeconds float64 `json:"durationSeconds"`
	Category        string  `json:"category"`
	HourOffset      int     `json:"hourOffset"`      // Hour of day (0-23)
	MinuteOffset    int     `json:"minuteOffset"`    // Minute within hour (0-59)
	PixelPosition   float64 `json:"pixelPosition"`   // Vertical position in pixels (0-60)
	PixelHeight     float64 `json:"pixelHeight"`     // Height in pixels
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

// calculateDayStats computes aggregated statistics for the day.
func (s *TimelineService) calculateDayStats(focusEvents []*storage.WindowFocusEvent, categories map[string]string, dayStart, dayEnd time.Time) *DayStats {
	if len(focusEvents) == 0 {
		return &DayStats{
			TotalSeconds:     0,
			TotalHours:       0,
			BreakCount:       0,
			BreakDuration:    0,
			LongestFocus:     0,
			Breakdown:        make(map[string]float64),
			BreakdownPercent: make(map[string]float64),
		}
	}

	// Calculate total time and category breakdown
	var totalSeconds float64
	breakdown := map[string]float64{
		"focus":    0,
		"meetings": 0,
		"comms":    0,
		"other":    0,
	}

	for _, event := range focusEvents {
		totalSeconds += event.DurationSeconds
		category := categories[event.AppName]
		breakdown[category] += event.DurationSeconds
	}

	// Calculate breakdown percentages
	breakdownPercent := make(map[string]float64)
	if totalSeconds > 0 {
		for category, seconds := range breakdown {
			breakdownPercent[category] = (seconds / totalSeconds) * 100.0
		}
	}

	// Calculate longest continuous focus session
	longestFocus := 0.0
	currentFocus := 0.0
	var lastEndTime int64

	// Sort events by start time
	sortedEvents := make([]*storage.WindowFocusEvent, len(focusEvents))
	copy(sortedEvents, focusEvents)
	sort.Slice(sortedEvents, func(i, j int) bool {
		return sortedEvents[i].StartTime < sortedEvents[j].StartTime
	})

	for _, event := range sortedEvents {
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

	// Calculate day span (first to last activity)
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

	// Count breaks (AFK events)
	afkEvents, _ := s.store.GetAFKEventsByTimeRange(dayStart.Unix(), dayEnd.Unix())
	breakCount := len(afkEvents)
	var breakDuration float64
	for _, afk := range afkEvents {
		if afk.EndTime.Valid {
			breakDuration += float64(afk.EndTime.Int64 - afk.StartTime)
		}
	}

	return &DayStats{
		TotalSeconds:     totalSeconds,
		TotalHours:       totalSeconds / 3600.0,
		BreakCount:       breakCount,
		BreakDuration:    breakDuration,
		LongestFocus:     longestFocus,
		DaySpan:          daySpan,
		Breakdown:        breakdown,
		BreakdownPercent: breakdownPercent,
	}
}
