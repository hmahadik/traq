package service

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"traq/internal/storage"
)

// AnalyticsService provides analytics and statistics.
type AnalyticsService struct {
	store *storage.Store
}

// NewAnalyticsService creates a new AnalyticsService.
func NewAnalyticsService(store *storage.Store) *AnalyticsService {
	return &AnalyticsService{store: store}
}

// DailyStats contains statistics for a single day.
type DailyStats struct {
	Date             string       `json:"date"`
	TotalScreenshots int64        `json:"totalScreenshots"`
	TotalSessions    int64        `json:"totalSessions"`
	ActiveMinutes    int64        `json:"activeMinutes"`
	TopApps          []*AppUsage  `json:"topApps"`
	ShellCommands    int64        `json:"shellCommands"`
	GitCommits       int64        `json:"gitCommits"`
	FilesModified    int64        `json:"filesModified"`
	SitesVisited     int64        `json:"sitesVisited"`
}

// WeeklyStats contains statistics for a week.
type WeeklyStats struct {
	StartDate   string        `json:"startDate"`
	EndDate     string        `json:"endDate"`
	DailyStats  []*DailyStats `json:"dailyStats"`
	TotalActive int64         `json:"totalActive"`
	Averages    *DailyStats   `json:"averages"`
}

// MonthlyStats contains statistics for a month.
type MonthlyStats struct {
	Year        int           `json:"year"`
	Month       int           `json:"month"`
	StartDate   string        `json:"startDate"`
	EndDate     string        `json:"endDate"`
	DailyStats  []*DailyStats `json:"dailyStats"`
	WeeklyStats []*WeekStats  `json:"weeklyStats"`
	TotalActive int64         `json:"totalActive"`
	Averages    *DailyStats   `json:"averages"`
}

// WeekStats represents summary stats for a single week within a month.
type WeekStats struct {
	WeekNumber  int   `json:"weekNumber"`  // 1-5 within the month
	StartDate   string `json:"startDate"`
	EndDate     string `json:"endDate"`
	TotalActive int64  `json:"totalActive"` // Total active minutes for the week
	ActiveDays  int    `json:"activeDays"`  // Number of days with activity
}

// AppUsage represents usage statistics for an application.
type AppUsage struct {
	AppName         string  `json:"appName"`
	DurationSeconds float64 `json:"durationSeconds"`
	Percentage      float64 `json:"percentage"`
	FocusCount      int64   `json:"focusCount"`
}

// HourlyActivity represents activity for an hour.
type HourlyActivity struct {
	Hour            int   `json:"hour"`
	ScreenshotCount int64 `json:"screenshotCount"`
	ActiveMinutes   int64 `json:"activeMinutes"`
}

// CalendarDay represents activity for a single calendar day.
type CalendarDay struct {
	Date       string `json:"date"`
	DayOfMonth int    `json:"dayOfMonth"`
	Screenshots int64  `json:"screenshots"`
	Sessions   int64  `json:"sessions"`
	Intensity  int    `json:"intensity"` // 0-4 for heatmap coloring
}

// CalendarData represents a month of calendar data.
type CalendarData struct {
	Year       int            `json:"year"`
	Month      int            `json:"month"`
	Days       []*CalendarDay `json:"days"`
	FirstDay   int            `json:"firstDay"` // Day of week for 1st (0=Sunday)
	TotalDays  int            `json:"totalDays"`
}

// DataSourceStats contains statistics from all data sources.
type DataSourceStats struct {
	Shell   *ShellStats   `json:"shell"`
	Git     *GitStats     `json:"git"`
	Files   *FileStats    `json:"files"`
	Browser *BrowserStats `json:"browser"`
}

// ShellStats contains shell command statistics.
type ShellStats struct {
	TotalCommands int64             `json:"totalCommands"`
	TopCommands   []*CommandUsage   `json:"topCommands"`
	ShellTypes    map[string]int64  `json:"shellTypes"`
}

// CommandUsage represents usage of a command.
type CommandUsage struct {
	Command string `json:"command"`
	Count   int64  `json:"count"`
}

// GitStats contains git statistics.
type GitStats struct {
	TotalCommits   int64         `json:"totalCommits"`
	TotalRepos     int64         `json:"totalRepos"`
	TotalInsertions int64        `json:"totalInsertions"`
	TotalDeletions int64         `json:"totalDeletions"`
	TopRepos       []*RepoUsage  `json:"topRepos"`
}

// RepoUsage represents activity in a repository.
type RepoUsage struct {
	RepoName   string `json:"repoName"`
	CommitCount int64 `json:"commitCount"`
	Insertions int64  `json:"insertions"`
	Deletions  int64  `json:"deletions"`
}

// FileStats contains file event statistics.
type FileStats struct {
	TotalEvents    int64            `json:"totalEvents"`
	EventsByType   map[string]int64 `json:"eventsByType"`
	TopExtensions  map[string]int64 `json:"topExtensions"`
}

// BrowserStats contains browser history statistics.
type BrowserStats struct {
	TotalVisits    int64            `json:"totalVisits"`
	UniqueDomains  int64            `json:"uniqueDomains"`
	TopDomains     []*DomainUsage   `json:"topDomains"`
	BrowserCounts  map[string]int64 `json:"browserCounts"`
}

// DomainUsage represents visits to a domain.
type DomainUsage struct {
	Domain     string `json:"domain"`
	VisitCount int64  `json:"visitCount"`
}

// AppCategory represents how an app is categorized for productivity.
type AppCategory string

const (
	CategoryProductive   AppCategory = "productive"
	CategoryNeutral      AppCategory = "neutral"
	CategoryDistracting  AppCategory = "distracting"
)

// ProductivityScore represents productivity analysis for a time period.
type ProductivityScore struct {
	Score                int     `json:"score"`                // 1-5 rating
	ProductiveMinutes    int64   `json:"productiveMinutes"`
	NeutralMinutes       int64   `json:"neutralMinutes"`
	DistractingMinutes   int64   `json:"distractingMinutes"`
	TotalMinutes         int64   `json:"totalMinutes"`
	ProductivePercentage float64 `json:"productivePercentage"`
}

// HourlyFocus represents focus quality for a specific hour.
type HourlyFocus struct {
	Hour            int     `json:"hour"`            // 0-23
	ContextSwitches int     `json:"contextSwitches"` // Number of app/window changes
	FocusQuality    float64 `json:"focusQuality"`    // 0-100 percentage
	FocusLabel      string  `json:"focusLabel"`      // "Excellent", "Good", "Fair", "Poor", "Very Poor"
}

// TagUsage represents usage statistics for an activity tag.
type TagUsage struct {
	Tag          string  `json:"tag"`
	SessionCount int     `json:"sessionCount"` // Number of sessions with this tag
	TotalMinutes int64   `json:"totalMinutes"` // Total time across sessions with this tag
	Percentage   float64 `json:"percentage"`   // Percentage of total tagged time
}

// WindowUsage represents usage statistics for a specific window.
type WindowUsage struct {
	WindowTitle     string  `json:"windowTitle"`
	AppName         string  `json:"appName"`
	DurationSeconds float64 `json:"durationSeconds"`
	Percentage      float64 `json:"percentage"`
	FocusCount      int64   `json:"focusCount"`
}

// GetDailyStats returns statistics for a specific date.
func (s *AnalyticsService) GetDailyStats(date string) (*DailyStats, error) {
	// Parse date to get start/end timestamps
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	start := t.Unix()
	end := t.Add(24 * time.Hour).Unix() - 1

	stats := &DailyStats{Date: date}

	// Get screenshot count
	stats.TotalScreenshots, _ = s.store.CountScreenshotsByTimeRange(start, end)

	// Get session count
	sessions, _ := s.store.GetSessionsByTimeRange(start, end)
	stats.TotalSessions = int64(len(sessions))

	// Calculate active minutes from focus events (excludes AFK periods)
	// Focus events only record time when user is actively interacting with windows
	focusEvents, _ := s.store.GetWindowFocusEventsByTimeRange(start, end)
	var totalActiveSeconds float64
	for _, evt := range focusEvents {
		if evt.DurationSeconds > 0 {
			totalActiveSeconds += evt.DurationSeconds
		}
	}
	stats.ActiveMinutes = int64(totalActiveSeconds / 60)

	// Get top apps from the same focus events (already fetched above)
	appDurations := make(map[string]float64)
	for _, evt := range focusEvents {
		appDurations[evt.AppName] += evt.DurationSeconds
	}

	// Convert to sorted list
	stats.TopApps = s.sortAppUsage(appDurations)

	// Get data source counts
	stats.ShellCommands, _ = s.store.CountShellCommandsByTimeRange(start, end)
	stats.GitCommits, _ = s.store.CountGitCommitsByTimeRange(start, end)
	stats.FilesModified, _ = s.store.CountFileEventsByTimeRange(start, end)
	stats.SitesVisited, _ = s.store.CountUniqueDomainsByTimeRange(start, end)

	return stats, nil
}

// GetWeeklyStats returns statistics for a week starting from the given date.
func (s *AnalyticsService) GetWeeklyStats(startDate string) (*WeeklyStats, error) {
	t, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, err
	}

	stats := &WeeklyStats{
		StartDate: startDate,
		EndDate:   t.AddDate(0, 0, 6).Format("2006-01-02"),
	}

	var totalActive int64
	for i := 0; i < 7; i++ {
		day := t.AddDate(0, 0, i)
		dayStats, err := s.GetDailyStats(day.Format("2006-01-02"))
		if err != nil {
			continue
		}
		stats.DailyStats = append(stats.DailyStats, dayStats)
		totalActive += dayStats.ActiveMinutes
	}
	stats.TotalActive = totalActive

	return stats, nil
}

// GetMonthlyStats returns statistics for a month (year and month number).
func (s *AnalyticsService) GetMonthlyStats(year, month int) (*MonthlyStats, error) {
	// Get first and last day of month
	firstDay := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	lastDay := firstDay.AddDate(0, 1, -1)
	daysInMonth := lastDay.Day()

	stats := &MonthlyStats{
		Year:      year,
		Month:     month,
		StartDate: firstDay.Format("2006-01-02"),
		EndDate:   lastDay.Format("2006-01-02"),
	}

	// Get daily stats for each day in the month
	var totalActive int64
	var totalScreenshots int64
	var totalSessions int64
	var activeDays int

	for day := 1; day <= daysInMonth; day++ {
		date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
		dayStats, err := s.GetDailyStats(date.Format("2006-01-02"))
		if err != nil {
			continue
		}
		stats.DailyStats = append(stats.DailyStats, dayStats)
		totalActive += dayStats.ActiveMinutes

		// Track active days
		if dayStats.ActiveMinutes > 0 {
			activeDays++
		}

		// Aggregate for averages
		totalScreenshots += dayStats.TotalScreenshots
		totalSessions += dayStats.TotalSessions
	}

	stats.TotalActive = totalActive

	// Calculate averages (only for active days)
	if activeDays > 0 {
		stats.Averages = &DailyStats{
			Date:             "average",
			TotalScreenshots: totalScreenshots / int64(activeDays),
			TotalSessions:    totalSessions / int64(activeDays),
			ActiveMinutes:    totalActive / int64(activeDays),
		}
	}

	// Calculate weekly breakdown
	stats.WeeklyStats = s.calculateWeeklyBreakdown(stats.DailyStats, firstDay)

	return stats, nil
}

// calculateWeeklyBreakdown groups daily stats into weeks within the month.
func (s *AnalyticsService) calculateWeeklyBreakdown(dailyStats []*DailyStats, monthStart time.Time) []*WeekStats {
	var weeks []*WeekStats
	weekNumber := 1
	var currentWeek *WeekStats

	for i, dayStat := range dailyStats {
		dayDate, _ := time.Parse("2006-01-02", dayStat.Date)
		dayOfWeek := int(dayDate.Weekday())

		// Start new week on Sunday or first day of month
		if currentWeek == nil || (dayOfWeek == 0 && i > 0) {
			if currentWeek != nil {
				weeks = append(weeks, currentWeek)
				weekNumber++
			}
			currentWeek = &WeekStats{
				WeekNumber: weekNumber,
				StartDate:  dayStat.Date,
			}
		}

		// Add to current week
		currentWeek.EndDate = dayStat.Date
		currentWeek.TotalActive += dayStat.ActiveMinutes
		if dayStat.ActiveMinutes > 0 {
			currentWeek.ActiveDays++
		}
	}

	// Add final week
	if currentWeek != nil {
		weeks = append(weeks, currentWeek)
	}

	return weeks
}

// GetCalendarHeatmap returns calendar data for a month.
func (s *AnalyticsService) GetCalendarHeatmap(year, month int) (*CalendarData, error) {
	firstOfMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	lastOfMonth := firstOfMonth.AddDate(0, 1, -1)

	cal := &CalendarData{
		Year:      year,
		Month:     month,
		FirstDay:  int(firstOfMonth.Weekday()),
		TotalDays: lastOfMonth.Day(),
	}

	// Get max values for intensity scaling
	var maxScreenshots int64

	for day := 1; day <= cal.TotalDays; day++ {
		dayStart := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.Local)
		dayEnd := dayStart.Add(24 * time.Hour)

		screenshots, _ := s.store.CountScreenshotsByTimeRange(dayStart.Unix(), dayEnd.Unix()-1)
		sessions, _ := s.store.GetSessionsByTimeRange(dayStart.Unix(), dayEnd.Unix()-1)

		if screenshots > maxScreenshots {
			maxScreenshots = screenshots
		}

		cal.Days = append(cal.Days, &CalendarDay{
			Date:       dayStart.Format("2006-01-02"),
			DayOfMonth: day,
			Screenshots: screenshots,
			Sessions:   int64(len(sessions)),
		})
	}

	// Calculate intensity (0-4) based on activity
	for _, day := range cal.Days {
		if maxScreenshots > 0 {
			day.Intensity = int(float64(day.Screenshots) / float64(maxScreenshots) * 4)
			if day.Screenshots > 0 && day.Intensity == 0 {
				day.Intensity = 1
			}
		}
	}

	return cal, nil
}

// GetAppUsage returns application usage for a time range.
func (s *AnalyticsService) GetAppUsage(start, end int64) ([]*AppUsage, error) {
	focusEvents, err := s.store.GetWindowFocusEventsByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	appDurations := make(map[string]float64)
	appCounts := make(map[string]int64)
	for _, evt := range focusEvents {
		appDurations[evt.AppName] += evt.DurationSeconds
		appCounts[evt.AppName]++
	}

	apps := s.sortAppUsage(appDurations)
	for _, app := range apps {
		app.FocusCount = appCounts[app.AppName]
	}

	return apps, nil
}

// GetHourlyActivity returns hourly activity breakdown for a date.
func (s *AnalyticsService) GetHourlyActivity(date string) ([]*HourlyActivity, error) {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	var activity []*HourlyActivity
	for hour := 0; hour < 24; hour++ {
		hourStart := time.Date(t.Year(), t.Month(), t.Day(), hour, 0, 0, 0, time.Local)
		hourEnd := hourStart.Add(time.Hour)

		screenshots, _ := s.store.CountScreenshotsByTimeRange(hourStart.Unix(), hourEnd.Unix()-1)

		activity = append(activity, &HourlyActivity{
			Hour:            hour,
			ScreenshotCount: screenshots,
			ActiveMinutes:   screenshots / 2, // Rough estimate based on 30-second interval
		})
	}

	return activity, nil
}

// GetDataSourceStats returns statistics from all data sources.
func (s *AnalyticsService) GetDataSourceStats(start, end int64) (*DataSourceStats, error) {
	stats := &DataSourceStats{}

	// Shell stats
	shellCommands, _ := s.store.GetShellCommandsByTimeRange(start, end)
	shellStats := &ShellStats{
		TotalCommands: int64(len(shellCommands)),
		ShellTypes:    make(map[string]int64),
	}
	cmdCounts := make(map[string]int64)
	for _, cmd := range shellCommands {
		shellStats.ShellTypes[cmd.ShellType]++
		// Extract base command
		cmdCounts[cmd.Command]++
	}
	// Get top 10 commands
	for cmd, count := range cmdCounts {
		shellStats.TopCommands = append(shellStats.TopCommands, &CommandUsage{
			Command: cmd,
			Count:   count,
		})
	}
	stats.Shell = shellStats

	// Git stats
	gitCommits, _ := s.store.GetGitCommitsByTimeRange(start, end)
	gitStats := &GitStats{
		TotalCommits: int64(len(gitCommits)),
	}
	repoCounts := make(map[int64]*RepoUsage)
	for _, commit := range gitCommits {
		if commit.Insertions.Valid {
			gitStats.TotalInsertions += commit.Insertions.Int64
		}
		if commit.Deletions.Valid {
			gitStats.TotalDeletions += commit.Deletions.Int64
		}
		if _, ok := repoCounts[commit.RepositoryID]; !ok {
			repoCounts[commit.RepositoryID] = &RepoUsage{}
		}
		repoCounts[commit.RepositoryID].CommitCount++
		if commit.Insertions.Valid {
			repoCounts[commit.RepositoryID].Insertions += commit.Insertions.Int64
		}
		if commit.Deletions.Valid {
			repoCounts[commit.RepositoryID].Deletions += commit.Deletions.Int64
		}
	}
	repos, _ := s.store.GetAllGitRepositories()
	gitStats.TotalRepos = int64(len(repos))
	// Build TopRepos by matching repo IDs to names
	repoNameMap := make(map[int64]string)
	for _, repo := range repos {
		repoNameMap[repo.ID] = repo.Name
	}
	for repoID, usage := range repoCounts {
		if name, ok := repoNameMap[repoID]; ok {
			usage.RepoName = name
			gitStats.TopRepos = append(gitStats.TopRepos, usage)
		}
	}
	stats.Git = gitStats

	// File stats
	fileEvents, _ := s.store.GetFileEventsByTimeRange(start, end)
	fileStats := &FileStats{
		TotalEvents:   int64(len(fileEvents)),
		EventsByType:  make(map[string]int64),
		TopExtensions: make(map[string]int64),
	}
	for _, evt := range fileEvents {
		fileStats.EventsByType[evt.EventType]++
		if evt.FileExtension.Valid {
			fileStats.TopExtensions[evt.FileExtension.String]++
		}
	}
	stats.Files = fileStats

	// Browser stats
	browserStats := &BrowserStats{
		BrowserCounts: make(map[string]int64),
	}
	browserStats.TotalVisits, _ = s.store.CountBrowserVisitsByTimeRange(start, end)
	browserStats.UniqueDomains, _ = s.store.CountUniqueDomainsByTimeRange(start, end)
	topDomains, _ := s.store.GetTopDomains(start, end, 10)
	for _, d := range topDomains {
		browserStats.TopDomains = append(browserStats.TopDomains, &DomainUsage{
			Domain:     d.Domain,
			VisitCount: d.VisitCount,
		})
	}
	stats.Browser = browserStats

	return stats, nil
}

// categorizeApp returns the productivity category for an app name.
// First checks user-defined categories from database, then falls back to defaults.
func (s *AnalyticsService) categorizeApp(appName string) AppCategory {
	// Try to get user-defined category from database
	appCategory, err := s.store.GetAppCategory(appName)
	if err == nil && appCategory != nil {
		return AppCategory(appCategory.Category)
	}

	// Fall back to default categorization based on common apps
	productive := map[string]bool{
		"Code":          true,
		"code":          true,
		"vim":           true,
		"nvim":          true,
		"emacs":         true,
		"IntelliJ IDEA": true,
		"PyCharm":       true,
		"GoLand":        true,
		"Terminal":      true,
		"gnome-terminal": true,
		"iTerm2":        true,
		"alacritty":     true,
		"kitty":         true,
		"Postman":       true,
		"Insomnia":      true,
		"DataGrip":      true,
		"DBeaver":       true,
		"TablePlus":     true,
		"Figma":         true,
		"Sketch":        true,
	}

	distracting := map[string]bool{
		"YouTube":       true,
		"Netflix":       true,
		"Reddit":        true,
		"Twitter":       true,
		"Facebook":      true,
		"Instagram":     true,
		"TikTok":        true,
		"Twitch":        true,
		"Discord":       true,
		"Slack":         true, // Can be work but often distracting
		"Steam":         true,
		"Spotify":       true,
		"Music":         true,
	}

	if productive[appName] {
		return CategoryProductive
	}
	if distracting[appName] {
		return CategoryDistracting
	}
	return CategoryNeutral
}

// GetProductivityScore calculates productivity score for a date.
func (s *AnalyticsService) GetProductivityScore(date string) (*ProductivityScore, error) {
	// Parse date to get start/end timestamps
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	start := t.Unix()
	end := t.Add(24 * time.Hour).Unix() - 1

	// Get all focus events for the day
	focusEvents, err := s.store.GetWindowFocusEventsByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	score := &ProductivityScore{}

	// Categorize and sum durations
	for _, evt := range focusEvents {
		minutes := int64(evt.DurationSeconds / 60)

		category := s.categorizeApp(evt.AppName)
		switch category {
		case CategoryProductive:
			score.ProductiveMinutes += minutes
		case CategoryDistracting:
			score.DistractingMinutes += minutes
		case CategoryNeutral:
			score.NeutralMinutes += minutes
		}
	}

	score.TotalMinutes = score.ProductiveMinutes + score.NeutralMinutes + score.DistractingMinutes

	// Calculate percentage
	if score.TotalMinutes > 0 {
		score.ProductivePercentage = (float64(score.ProductiveMinutes) / float64(score.TotalMinutes)) * 100
	}

	// Calculate score (1-5) based on productive percentage
	// 80%+ = 5, 60-80% = 4, 40-60% = 3, 20-40% = 2, <20% = 1
	switch {
	case score.ProductivePercentage >= 80:
		score.Score = 5
	case score.ProductivePercentage >= 60:
		score.Score = 4
	case score.ProductivePercentage >= 40:
		score.Score = 3
	case score.ProductivePercentage >= 20:
		score.Score = 2
	default:
		score.Score = 1
	}

	return score, nil
}

// sortAppUsage converts duration map to sorted slice with percentages.
func (s *AnalyticsService) sortAppUsage(appDurations map[string]float64) []*AppUsage {
	var totalDuration float64
	for _, dur := range appDurations {
		totalDuration += dur
	}

	var apps []*AppUsage
	for app, dur := range appDurations {
		pct := 0.0
		if totalDuration > 0 {
			pct = (dur / totalDuration) * 100
		}
		apps = append(apps, &AppUsage{
			AppName:         app,
			DurationSeconds: dur,
			Percentage:      pct,
		})
	}

	// Sort by duration descending
	for i := 0; i < len(apps); i++ {
		for j := i + 1; j < len(apps); j++ {
			if apps[j].DurationSeconds > apps[i].DurationSeconds {
				apps[i], apps[j] = apps[j], apps[i]
			}
		}
	}

	// Return top 10
	if len(apps) > 10 {
		return apps[:10]
	}
	return apps
}

// GetFocusDistribution calculates hourly focus quality based on context switches.
// Lower context switches indicate better focus.
func (s *AnalyticsService) GetFocusDistribution(date string) ([]*HourlyFocus, error) {
	// Parse date to get start/end timestamps
	layout := "2006-01-02"
	t, err := time.Parse(layout, date)
	if err != nil {
		return nil, err
	}

	startTime := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).Unix()
	endTime := time.Date(t.Year(), t.Month(), t.Day(), 23, 59, 59, 0, t.Location()).Unix()

	// Get all focus events for the day
	events, err := s.store.GetFocusEventsByTimeRange(startTime, endTime)
	if err != nil {
		return nil, err
	}

	// Initialize hourly data (0-23 hours)
	hourlyData := make(map[int]*HourlyFocus)
	for hour := 0; hour < 24; hour++ {
		hourlyData[hour] = &HourlyFocus{
			Hour:            hour,
			ContextSwitches: 0,
			FocusQuality:    0,
			FocusLabel:      "No Activity",
		}
	}

	// Count context switches per hour
	// Each focus event represents a context switch (change of window/app)
	for _, event := range events {
		eventTime := time.Unix(event.StartTime, 0)
		hour := eventTime.Hour()

		if data, exists := hourlyData[hour]; exists {
			data.ContextSwitches++
		}
	}

	// Calculate focus quality based on context switches
	// Scoring logic:
	// 0-2 switches = Excellent (100%)
	// 3-5 switches = Good (75%)
	// 6-10 switches = Fair (50%)
	// 11-20 switches = Poor (25%)
	// 20+ switches = Very Poor (10%)
	result := make([]*HourlyFocus, 24)
	for hour := 0; hour < 24; hour++ {
		data := hourlyData[hour]
		switches := data.ContextSwitches

		// Calculate quality
		var quality float64
		var label string

		if switches == 0 {
			quality = 0
			label = "No Activity"
		} else if switches <= 2 {
			quality = 100
			label = "Excellent"
		} else if switches <= 5 {
			quality = 75
			label = "Good"
		} else if switches <= 10 {
			quality = 50
			label = "Fair"
		} else if switches <= 20 {
			quality = 25
			label = "Poor"
		} else {
			quality = 10
			label = "Very Poor"
		}

		data.FocusQuality = quality
		data.FocusLabel = label
		result[hour] = data
	}

	return result, nil
}

// GetActivityTags extracts and aggregates tags from session summaries for a given date.
// Returns top tags sorted by total time spent, useful for understanding activity distribution.
func (s *AnalyticsService) GetActivityTags(date string) ([]*TagUsage, error) {
	// Parse date to get start/end timestamps
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	start := t.Unix()
	end := t.Add(24 * time.Hour).Unix() - 1

	// Get all sessions for the day
	sessions, err := s.store.GetSessionsByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	// Get summaries for these sessions
	tagDurations := make(map[string]int64)  // tag -> total minutes
	tagSessions := make(map[string]int)     // tag -> session count

	for _, session := range sessions {
		// Get summary for this session
		summary, err := s.store.GetSummaryBySession(session.ID)
		if err != nil || summary == nil {
			continue
		}

		// Calculate session duration in minutes
		sessionMinutes := int64(0)
		if session.DurationSeconds.Valid && session.DurationSeconds.Int64 > 0 {
			sessionMinutes = session.DurationSeconds.Int64 / 60
		}

		// Tags are already parsed as []string from database
		for _, tag := range summary.Tags {
			tagDurations[tag] += sessionMinutes
			tagSessions[tag]++
		}
	}

	// Calculate total time for percentage calculation
	var totalMinutes int64
	for _, duration := range tagDurations {
		totalMinutes += duration
	}

	// Convert to sorted slice
	var tags []*TagUsage
	for tag, duration := range tagDurations {
		percentage := 0.0
		if totalMinutes > 0 {
			percentage = (float64(duration) / float64(totalMinutes)) * 100
		}

		tags = append(tags, &TagUsage{
			Tag:          tag,
			SessionCount: tagSessions[tag],
			TotalMinutes: duration,
			Percentage:   percentage,
		})
	}

	// Sort by total minutes descending
	for i := 0; i < len(tags); i++ {
		for j := i + 1; j < len(tags); j++ {
			if tags[j].TotalMinutes > tags[i].TotalMinutes {
				tags[i], tags[j] = tags[j], tags[i]
			}
		}
	}

	// Return top 10 tags
	if len(tags) > 10 {
		return tags[:10], nil
	}

	return tags, nil
}

// GetTopWindows returns the most used windows for a time range, grouped by window title.
// Windows are ranked by total duration and include the app name, total time, and occurrence count.
func (s *AnalyticsService) GetTopWindows(start, end int64, limit int) ([]*WindowUsage, error) {
	// Get all window focus events for the time range
	focusEvents, err := s.store.GetWindowFocusEventsByTimeRange(start, end)
	if err != nil {
		return nil, err
	}

	// Aggregate durations and counts by window title
	windowDurations := make(map[string]float64)
	windowCounts := make(map[string]int64)
	windowApps := make(map[string]string) // window title -> app name (most recent)

	for _, evt := range focusEvents {
		// Use window title as key (windows can have different apps theoretically)
		key := evt.WindowTitle
		windowDurations[key] += evt.DurationSeconds
		windowCounts[key]++
		windowApps[key] = evt.AppName // Keep track of the app (use last seen)
	}

	// Calculate total duration for percentage calculation
	var totalDuration float64
	for _, dur := range windowDurations {
		totalDuration += dur
	}

	// Convert to slice
	var windows []*WindowUsage
	for windowTitle, duration := range windowDurations {
		percentage := 0.0
		if totalDuration > 0 {
			percentage = (duration / totalDuration) * 100
		}

		windows = append(windows, &WindowUsage{
			WindowTitle:     windowTitle,
			AppName:         windowApps[windowTitle],
			DurationSeconds: duration,
			Percentage:      percentage,
			FocusCount:      windowCounts[windowTitle],
		})
	}

	// Sort by duration descending
	for i := 0; i < len(windows); i++ {
		for j := i + 1; j < len(windows); j++ {
			if windows[j].DurationSeconds > windows[i].DurationSeconds {
				windows[i], windows[j] = windows[j], windows[i]
			}
		}
	}

	// Return top N
	if limit > 0 && len(windows) > limit {
		return windows[:limit], nil
	}
	return windows, nil
}

// ExportAnalytics exports analytics data in the specified format.
// Supports: "csv", "html", "json"
func (s *AnalyticsService) ExportAnalytics(date, viewMode, format string) (string, error) {
	switch viewMode {
	case "day":
		return s.exportDailyAnalytics(date, format)
	case "week":
		return s.exportWeeklyAnalytics(date, format)
	case "month":
		// Parse year and month from date string (YYYY-MM-DD)
		t, err := time.Parse("2006-01-02", date)
		if err != nil {
			return "", err
		}
		return s.exportMonthlyAnalytics(t.Year(), int(t.Month()), format)
	default:
		return s.exportDailyAnalytics(date, format)
	}
}

// exportDailyAnalytics exports daily analytics in the specified format.
func (s *AnalyticsService) exportDailyAnalytics(date, format string) (string, error) {
	stats, err := s.GetDailyStats(date)
	if err != nil {
		return "", err
	}

	// Parse date to get start/end timestamps for GetAppUsage
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return "", err
	}
	start := t.Unix()
	end := t.Add(24 * time.Hour).Unix() - 1

	appUsage, err := s.GetAppUsage(start, end)
	if err != nil {
		return "", err
	}

	hourlyActivity, err := s.GetHourlyActivity(date)
	if err != nil {
		return "", err
	}

	switch format {
	case "csv":
		return s.exportDailyCSV(stats, appUsage, hourlyActivity), nil
	case "html":
		return s.exportDailyHTML(stats, appUsage, hourlyActivity), nil
	case "json":
		return s.exportDailyJSON(stats, appUsage, hourlyActivity), nil
	default:
		return s.exportDailyCSV(stats, appUsage, hourlyActivity), nil
	}
}

// exportWeeklyAnalytics exports weekly analytics in the specified format.
func (s *AnalyticsService) exportWeeklyAnalytics(date, format string) (string, error) {
	stats, err := s.GetWeeklyStats(date)
	if err != nil {
		return "", err
	}

	switch format {
	case "csv":
		return s.exportWeeklyCSV(stats), nil
	case "html":
		return s.exportWeeklyHTML(stats), nil
	case "json":
		return s.exportWeeklyJSON(stats), nil
	default:
		return s.exportWeeklyCSV(stats), nil
	}
}

// exportMonthlyAnalytics exports monthly analytics in the specified format.
func (s *AnalyticsService) exportMonthlyAnalytics(year, month int, format string) (string, error) {
	stats, err := s.GetMonthlyStats(year, month)
	if err != nil {
		return "", err
	}

	switch format {
	case "csv":
		return s.exportMonthlyCSV(stats), nil
	case "html":
		return s.exportMonthlyHTML(stats), nil
	case "json":
		return s.exportMonthlyJSON(stats), nil
	default:
		return s.exportMonthlyCSV(stats), nil
	}
}

// Helper functions for CSV export

func (s *AnalyticsService) exportDailyCSV(stats *DailyStats, appUsage []*AppUsage, hourlyActivity []*HourlyActivity) string {
	var csv strings.Builder
	
	// Summary section
	csv.WriteString("Daily Analytics Summary\n")
	csv.WriteString(fmt.Sprintf("Date,%s\n", stats.Date))
	csv.WriteString(fmt.Sprintf("Active Time (minutes),%d\n", stats.ActiveMinutes))
	csv.WriteString(fmt.Sprintf("Total Sessions,%d\n", stats.TotalSessions))
	csv.WriteString(fmt.Sprintf("Total Screenshots,%d\n", stats.TotalScreenshots))
	csv.WriteString(fmt.Sprintf("Shell Commands,%d\n", stats.ShellCommands))
	csv.WriteString(fmt.Sprintf("Git Commits,%d\n", stats.GitCommits))
	csv.WriteString(fmt.Sprintf("Files Modified,%d\n", stats.FilesModified))
	csv.WriteString(fmt.Sprintf("Sites Visited,%d\n\n", stats.SitesVisited))
	
	// App usage section
	csv.WriteString("Application Usage\n")
	csv.WriteString("App Name,Duration (seconds),Percentage,Focus Count\n")
	for _, app := range appUsage {
		csv.WriteString(fmt.Sprintf("%s,%.2f,%.2f%%,%d\n", 
			app.AppName, app.DurationSeconds, app.Percentage, app.FocusCount))
	}
	csv.WriteString("\n")
	
	// Hourly activity section
	csv.WriteString("Hourly Activity\n")
	csv.WriteString("Hour,Screenshots,Active Minutes\n")
	for _, hour := range hourlyActivity {
		csv.WriteString(fmt.Sprintf("%d:00,%d,%d\n", 
			hour.Hour, hour.ScreenshotCount, hour.ActiveMinutes))
	}
	
	return csv.String()
}

func (s *AnalyticsService) exportWeeklyCSV(stats *WeeklyStats) string {
	var csv strings.Builder
	
	csv.WriteString("Weekly Analytics Summary\n")
	csv.WriteString(fmt.Sprintf("Week,%s to %s\n", stats.StartDate, stats.EndDate))
	csv.WriteString(fmt.Sprintf("Total Active Time (minutes),%d\n\n", stats.TotalActive))
	
	if stats.Averages != nil {
		csv.WriteString("Average Daily Stats\n")
		csv.WriteString(fmt.Sprintf("Active Time (minutes),%d\n", stats.Averages.ActiveMinutes))
		csv.WriteString(fmt.Sprintf("Sessions,%d\n", stats.Averages.TotalSessions))
		csv.WriteString(fmt.Sprintf("Screenshots,%d\n\n", stats.Averages.TotalScreenshots))
	}
	
	csv.WriteString("Daily Breakdown\n")
	csv.WriteString("Date,Active Minutes,Sessions,Screenshots,Shell Commands,Git Commits\n")
	for _, day := range stats.DailyStats {
		csv.WriteString(fmt.Sprintf("%s,%d,%d,%d,%d,%d\n",
			day.Date, day.ActiveMinutes, day.TotalSessions, day.TotalScreenshots,
			day.ShellCommands, day.GitCommits))
	}
	
	return csv.String()
}

func (s *AnalyticsService) exportMonthlyCSV(stats *MonthlyStats) string {
	var csv strings.Builder
	
	csv.WriteString("Monthly Analytics Summary\n")
	csv.WriteString(fmt.Sprintf("Month,%d-%02d\n", stats.Year, stats.Month))
	csv.WriteString(fmt.Sprintf("Period,%s to %s\n", stats.StartDate, stats.EndDate))
	csv.WriteString(fmt.Sprintf("Total Active Time (minutes),%d\n\n", stats.TotalActive))
	
	if stats.Averages != nil {
		csv.WriteString("Average Daily Stats\n")
		csv.WriteString(fmt.Sprintf("Active Time (minutes),%d\n", stats.Averages.ActiveMinutes))
		csv.WriteString(fmt.Sprintf("Sessions,%d\n", stats.Averages.TotalSessions))
		csv.WriteString(fmt.Sprintf("Screenshots,%d\n\n", stats.Averages.TotalScreenshots))
	}
	
	csv.WriteString("Weekly Breakdown\n")
	csv.WriteString("Week,Start Date,End Date,Total Active (minutes),Active Days\n")
	for _, week := range stats.WeeklyStats {
		csv.WriteString(fmt.Sprintf("%d,%s,%s,%d,%d\n",
			week.WeekNumber, week.StartDate, week.EndDate, week.TotalActive, week.ActiveDays))
	}
	
	return csv.String()
}

// Helper functions for JSON export

func (s *AnalyticsService) exportDailyJSON(stats *DailyStats, appUsage []*AppUsage, hourlyActivity []*HourlyActivity) string {
	data := map[string]interface{}{
		"summary":        stats,
		"appUsage":       appUsage,
		"hourlyActivity": hourlyActivity,
	}
	jsonBytes, _ := json.MarshalIndent(data, "", "  ")
	return string(jsonBytes)
}

func (s *AnalyticsService) exportWeeklyJSON(stats *WeeklyStats) string {
	jsonBytes, _ := json.MarshalIndent(stats, "", "  ")
	return string(jsonBytes)
}

func (s *AnalyticsService) exportMonthlyJSON(stats *MonthlyStats) string {
	jsonBytes, _ := json.MarshalIndent(stats, "", "  ")
	return string(jsonBytes)
}

// Helper functions for HTML export

func (s *AnalyticsService) exportDailyHTML(stats *DailyStats, appUsage []*AppUsage, hourlyActivity []*HourlyActivity) string {
	var html strings.Builder
	
	html.WriteString("<!DOCTYPE html><html><head>")
	html.WriteString("<meta charset='UTF-8'>")
	html.WriteString("<title>Daily Analytics - " + stats.Date + "</title>")
	html.WriteString("<style>")
	html.WriteString("body { font-family: Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 20px; }")
	html.WriteString("h1 { color: #333; border-bottom: 3px solid #4a9eff; padding-bottom: 10px; }")
	html.WriteString("h2 { color: #666; margin-top: 30px; }")
	html.WriteString("table { width: 100%; border-collapse: collapse; margin-top: 15px; }")
	html.WriteString("th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }")
	html.WriteString("th { background-color: #4a9eff; color: white; }")
	html.WriteString("tr:hover { background-color: #f5f5f5; }")
	html.WriteString(".summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }")
	html.WriteString(".stat { display: inline-block; margin: 10px 20px 10px 0; }")
	html.WriteString(".stat-label { color: #666; font-size: 14px; }")
	html.WriteString(".stat-value { font-size: 24px; font-weight: bold; color: #333; }")
	html.WriteString("</style></head><body>")
	
	html.WriteString(fmt.Sprintf("<h1>Daily Analytics - %s</h1>", stats.Date))
	
	html.WriteString("<div class='summary'>")
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Active Time</div><div class='stat-value'>%d min</div></div>", stats.ActiveMinutes))
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Sessions</div><div class='stat-value'>%d</div></div>", stats.TotalSessions))
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Screenshots</div><div class='stat-value'>%d</div></div>", stats.TotalScreenshots))
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Shell Commands</div><div class='stat-value'>%d</div></div>", stats.ShellCommands))
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Git Commits</div><div class='stat-value'>%d</div></div>", stats.GitCommits))
	html.WriteString("</div>")
	
	html.WriteString("<h2>Application Usage</h2>")
	html.WriteString("<table><thead><tr><th>Application</th><th>Duration</th><th>Percentage</th><th>Focus Count</th></tr></thead><tbody>")
	for _, app := range appUsage {
		minutes := int(app.DurationSeconds / 60)
		html.WriteString(fmt.Sprintf("<tr><td>%s</td><td>%d min</td><td>%.1f%%</td><td>%d</td></tr>", 
			app.AppName, minutes, app.Percentage, app.FocusCount))
	}
	html.WriteString("</tbody></table>")
	
	html.WriteString("<h2>Hourly Activity</h2>")
	html.WriteString("<table><thead><tr><th>Hour</th><th>Screenshots</th><th>Active Minutes</th></tr></thead><tbody>")
	for _, hour := range hourlyActivity {
		if hour.ScreenshotCount > 0 || hour.ActiveMinutes > 0 {
			html.WriteString(fmt.Sprintf("<tr><td>%d:00</td><td>%d</td><td>%d</td></tr>", 
				hour.Hour, hour.ScreenshotCount, hour.ActiveMinutes))
		}
	}
	html.WriteString("</tbody></table>")
	
	html.WriteString("</body></html>")
	return html.String()
}

func (s *AnalyticsService) exportWeeklyHTML(stats *WeeklyStats) string {
	var html strings.Builder
	
	html.WriteString("<!DOCTYPE html><html><head>")
	html.WriteString("<meta charset='UTF-8'>")
	html.WriteString(fmt.Sprintf("<title>Weekly Analytics - %s to %s</title>", stats.StartDate, stats.EndDate))
	html.WriteString("<style>")
	html.WriteString("body { font-family: Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 20px; }")
	html.WriteString("h1 { color: #333; border-bottom: 3px solid #4a9eff; padding-bottom: 10px; }")
	html.WriteString("h2 { color: #666; margin-top: 30px; }")
	html.WriteString("table { width: 100%; border-collapse: collapse; margin-top: 15px; }")
	html.WriteString("th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }")
	html.WriteString("th { background-color: #4a9eff; color: white; }")
	html.WriteString("tr:hover { background-color: #f5f5f5; }")
	html.WriteString(".summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }")
	html.WriteString(".stat { display: inline-block; margin: 10px 20px 10px 0; }")
	html.WriteString(".stat-label { color: #666; font-size: 14px; }")
	html.WriteString(".stat-value { font-size: 24px; font-weight: bold; color: #333; }")
	html.WriteString("</style></head><body>")
	
	html.WriteString(fmt.Sprintf("<h1>Weekly Analytics - %s to %s</h1>", stats.StartDate, stats.EndDate))
	
	html.WriteString("<div class='summary'>")
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Total Active Time</div><div class='stat-value'>%d min</div></div>", stats.TotalActive))
	if stats.Averages != nil {
		html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Avg Daily Active</div><div class='stat-value'>%d min</div></div>", stats.Averages.ActiveMinutes))
		html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Avg Sessions</div><div class='stat-value'>%d</div></div>", stats.Averages.TotalSessions))
	}
	html.WriteString("</div>")
	
	html.WriteString("<h2>Daily Breakdown</h2>")
	html.WriteString("<table><thead><tr><th>Date</th><th>Active Time</th><th>Sessions</th><th>Screenshots</th><th>Shell Commands</th><th>Git Commits</th></tr></thead><tbody>")
	for _, day := range stats.DailyStats {
		html.WriteString(fmt.Sprintf("<tr><td>%s</td><td>%d min</td><td>%d</td><td>%d</td><td>%d</td><td>%d</td></tr>",
			day.Date, day.ActiveMinutes, day.TotalSessions, day.TotalScreenshots, day.ShellCommands, day.GitCommits))
	}
	html.WriteString("</tbody></table>")
	
	html.WriteString("</body></html>")
	return html.String()
}

func (s *AnalyticsService) exportMonthlyHTML(stats *MonthlyStats) string {
	var html strings.Builder
	
	html.WriteString("<!DOCTYPE html><html><head>")
	html.WriteString("<meta charset='UTF-8'>")
	html.WriteString(fmt.Sprintf("<title>Monthly Analytics - %d-%02d</title>", stats.Year, stats.Month))
	html.WriteString("<style>")
	html.WriteString("body { font-family: Arial, sans-serif; max-width: 1200px; margin: 40px auto; padding: 20px; }")
	html.WriteString("h1 { color: #333; border-bottom: 3px solid #4a9eff; padding-bottom: 10px; }")
	html.WriteString("h2 { color: #666; margin-top: 30px; }")
	html.WriteString("table { width: 100%; border-collapse: collapse; margin-top: 15px; }")
	html.WriteString("th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }")
	html.WriteString("th { background-color: #4a9eff; color: white; }")
	html.WriteString("tr:hover { background-color: #f5f5f5; }")
	html.WriteString(".summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }")
	html.WriteString(".stat { display: inline-block; margin: 10px 20px 10px 0; }")
	html.WriteString(".stat-label { color: #666; font-size: 14px; }")
	html.WriteString(".stat-value { font-size: 24px; font-weight: bold; color: #333; }")
	html.WriteString("</style></head><body>")
	
	html.WriteString(fmt.Sprintf("<h1>Monthly Analytics - %d-%02d</h1>", stats.Year, stats.Month))
	
	html.WriteString("<div class='summary'>")
	html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Total Active Time</div><div class='stat-value'>%d min</div></div>", stats.TotalActive))
	if stats.Averages != nil {
		html.WriteString(fmt.Sprintf("<div class='stat'><div class='stat-label'>Avg Daily Active</div><div class='stat-value'>%d min</div></div>", stats.Averages.ActiveMinutes))
	}
	html.WriteString("</div>")
	
	html.WriteString("<h2>Weekly Breakdown</h2>")
	html.WriteString("<table><thead><tr><th>Week</th><th>Period</th><th>Active Time</th><th>Active Days</th></tr></thead><tbody>")
	for _, week := range stats.WeeklyStats {
		html.WriteString(fmt.Sprintf("<tr><td>Week %d</td><td>%s to %s</td><td>%d min</td><td>%d</td></tr>",
			week.WeekNumber, week.StartDate, week.EndDate, week.TotalActive, week.ActiveDays))
	}
	html.WriteString("</tbody></table>")
	
	html.WriteString("</body></html>")
	return html.String()
}
