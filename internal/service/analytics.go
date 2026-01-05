package service

import (
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

	// Get session count and calculate active minutes
	sessions, _ := s.store.GetSessionsByTimeRange(start, end)
	stats.TotalSessions = int64(len(sessions))

	var totalSeconds int64
	for _, sess := range sessions {
		if sess.DurationSeconds.Valid {
			totalSeconds += sess.DurationSeconds.Int64
		}
	}
	stats.ActiveMinutes = totalSeconds / 60

	// Get top apps from window focus events
	focusEvents, _ := s.store.GetWindowFocusEventsByTimeRange(start, end)
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
	}
	repos, _ := s.store.GetAllGitRepositories()
	gitStats.TotalRepos = int64(len(repos))
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
