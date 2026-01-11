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

		block := ActivityBlock{
			ID:              event.ID,
			WindowTitle:     event.WindowTitle,
			AppName:         event.AppName,
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
		hourlyGrid[hour][event.AppName] = append(hourlyGrid[hour][event.AppName], block)
	}

	// Build top apps list with categories
	topApps := make([]TopApp, 0, len(topAppsData))
	for _, app := range topAppsData {
		topApps = append(topApps, TopApp{
			AppName:  app.AppName,
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

	return &TimelineGridData{
		Date:             date,
		DayStats:         dayStats,
		TopApps:          topApps,
		HourlyGrid:       hourlyGrid,
		SessionSummaries: sessionSummaries,
		Categories:       categories,
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
