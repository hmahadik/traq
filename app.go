package main

import (
	"context"
	"log"
	"path/filepath"
	"time"

	"traq/internal/platform"
	"traq/internal/service"
	"traq/internal/storage"
	"traq/internal/tracker"
)

// App struct holds the application state and services
type App struct {
	ctx   context.Context
	ready bool // Set to true after startup completes

	// Core components
	platform platform.Platform
	store    *storage.Store
	daemon   *tracker.Daemon

	// Services (exposed to frontend via Wails bindings)
	Analytics   *service.AnalyticsService
	Timeline    *service.TimelineService
	Reports     *service.ReportsService
	Config      *service.ConfigService
	Screenshots *service.ScreenshotService
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// IsReady returns true if the app has finished initializing.
// Frontend can call this to check if the app is ready for API calls.
func (a *App) IsReady() bool {
	return a.ready
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Initialize platform
	a.platform = platform.New()

	// Ensure data directory exists
	dataDir := a.platform.DataDir()
	dbPath := filepath.Join(dataDir, "data.db")

	// Initialize storage
	var err error
	a.store, err = storage.NewStore(dbPath)
	if err != nil {
		log.Printf("Failed to initialize storage: %v", err)
		return
	}

	// Run migrations
	if err := a.store.Migrate(); err != nil {
		log.Printf("Failed to run migrations: %v", err)
	}

	// Initialize services
	a.Analytics = service.NewAnalyticsService(a.store)
	a.Timeline = service.NewTimelineService(a.store)
	a.Screenshots = service.NewScreenshotService(a.store, dataDir)
	a.Config = service.NewConfigService(a.store, a.platform, nil) // daemon set later

	// Initialize daemon with default config
	daemonConfig := tracker.DefaultDaemonConfig(dataDir)
	a.daemon, err = tracker.NewDaemon(daemonConfig, a.store, a.platform)
	if err != nil {
		log.Printf("Failed to initialize daemon: %v", err)
	} else {
		// Link daemon to config service
		a.Config.SetDaemon(a.daemon)

		// Auto-register current working directory as git repo (if applicable)
		a.daemon.AutoRegisterGitRepo()

		// Auto-watch Downloads folder for file events
		a.daemon.AutoWatchDownloads()

		// Start daemon
		if err := a.daemon.Start(); err != nil {
			log.Printf("Failed to start daemon: %v", err)
		}
	}

	// Initialize reports service (after timeline service)
	a.Reports = service.NewReportsService(a.store, a.Timeline)

	// Mark as ready
	a.ready = true
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	// Stop daemon gracefully
	if a.daemon != nil {
		if err := a.daemon.Stop(); err != nil {
			log.Printf("Error stopping daemon: %v", err)
		}
	}

	// Close storage
	if a.store != nil {
		if err := a.store.Close(); err != nil {
			log.Printf("Error closing storage: %v", err)
		}
	}
}

// beforeClose is called when the user tries to close the app
func (a *App) beforeClose(ctx context.Context) bool {
	// Return false to allow the app to close
	// Return true to prevent the app from closing
	return false
}

// ============================================================================
// Daemon Control Methods (exposed to frontend)
// ============================================================================

// GetDaemonStatus returns the current daemon status.
func (a *App) GetDaemonStatus() (*service.DaemonStatus, error) {
	if a.Config == nil {
		return nil, nil
	}
	return a.Config.GetDaemonStatus()
}

// StartTracking starts the tracking daemon.
func (a *App) StartTracking() error {
	if a.Config == nil {
		return nil
	}
	return a.Config.StartDaemon()
}

// StopTracking stops the tracking daemon.
func (a *App) StopTracking() error {
	if a.Config == nil {
		return nil
	}
	return a.Config.StopDaemon()
}

// RestartTracking restarts the tracking daemon with updated config.
func (a *App) RestartTracking() error {
	if a.Config == nil {
		return nil
	}
	return a.Config.RestartDaemon()
}

// ForceCapture forces an immediate screenshot capture.
func (a *App) ForceCapture() (string, error) {
	if a.daemon == nil {
		return "", nil
	}
	result, err := a.daemon.ForceCapture()
	if err != nil {
		return "", err
	}
	return result.Filepath, nil
}

// ============================================================================
// Analytics Methods (exposed to frontend)
// ============================================================================

// GetDailyStats returns statistics for a specific date.
func (a *App) GetDailyStats(date string) (*service.DailyStats, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetDailyStats(date)
}

// GetWeeklyStats returns statistics for a week.
func (a *App) GetWeeklyStats(startDate string) (*service.WeeklyStats, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetWeeklyStats(startDate)
}

// GetMonthlyStats returns statistics for a month.
func (a *App) GetMonthlyStats(year, month int) (*service.MonthlyStats, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetMonthlyStats(year, month)
}

// ExportAnalytics exports analytics data in the specified format.
// viewMode can be "day", "week", or "month"
// format can be "csv", "html", or "json"
func (a *App) ExportAnalytics(date, viewMode, format string) (string, error) {
	if a.Analytics == nil {
		return "", nil
	}
	return a.Analytics.ExportAnalytics(date, viewMode, format)
}

// GetCalendarHeatmap returns calendar data for a month.
func (a *App) GetCalendarHeatmap(year, month int) (*service.CalendarData, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetCalendarHeatmap(year, month)
}

// GetAppUsage returns application usage for a time range.
func (a *App) GetAppUsage(start, end int64) ([]*service.AppUsage, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetAppUsage(start, end)
}

// GetHourlyActivity returns hourly activity for a date.
func (a *App) GetHourlyActivity(date string) ([]*service.HourlyActivity, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetHourlyActivity(date)
}

// GetDataSourceStats returns statistics from all data sources.
func (a *App) GetDataSourceStats(start, end int64) (*service.DataSourceStats, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetDataSourceStats(start, end)
}

// GetProductivityScore calculates productivity score for a date.
func (a *App) GetProductivityScore(date string) (*service.ProductivityScore, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetProductivityScore(date)
}

// GetFocusDistribution calculates hourly focus quality for a date.
func (a *App) GetFocusDistribution(date string) ([]*service.HourlyFocus, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetFocusDistribution(date)
}

// GetActivityTags extracts and aggregates activity tags for a date.
func (a *App) GetActivityTags(date string) ([]*service.TagUsage, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetActivityTags(date)
}

// GetTopWindows returns the most used windows for a date, grouped by window title.
func (a *App) GetTopWindows(date string, limit int) ([]*service.WindowUsage, error) {
	if a.Analytics == nil {
		return nil, nil
	}

	// Parse date to get start/end timestamps
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return nil, err
	}

	start := t.Unix()
	end := t.Add(24 * time.Hour).Unix() - 1

	return a.Analytics.GetTopWindows(start, end, limit)
}

// ============================================================================
// Timeline Methods (exposed to frontend)
// ============================================================================

// GetSessionsForDate returns all sessions for a date.
func (a *App) GetSessionsForDate(date string) ([]*service.SessionSummary, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetSessionsForDate(date)
}

// GetScreenshotsForSession returns paginated screenshots for a session.
func (a *App) GetScreenshotsForSession(sessionID int64, page, perPage int) (*service.ScreenshotPage, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetScreenshotsForSession(sessionID, page, perPage)
}

// GetScreenshotsForHour returns screenshots for a specific hour.
func (a *App) GetScreenshotsForHour(date string, hour int) ([]*storage.Screenshot, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetScreenshotsForHour(date, hour)
}

// GetSessionContext returns all context for a session.
func (a *App) GetSessionContext(sessionID int64) (*service.SessionContext, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetSessionContext(sessionID)
}

// GetRecentSessions returns the most recent sessions.
func (a *App) GetRecentSessions(limit int) ([]*storage.Session, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetRecentSessions(limit)
}

// ============================================================================
// Screenshot Methods (exposed to frontend)
// ============================================================================

// GetScreenshot returns screenshot metadata by ID.
func (a *App) GetScreenshot(id int64) (*storage.Screenshot, error) {
	if a.Screenshots == nil {
		return nil, nil
	}
	return a.Screenshots.GetScreenshot(id)
}

// GetScreenshotInfo returns detailed info about a screenshot.
func (a *App) GetScreenshotInfo(id int64) (*service.ScreenshotInfo, error) {
	if a.Screenshots == nil {
		return nil, nil
	}
	return a.Screenshots.GetScreenshotInfo(id)
}

// GetScreenshotPath returns the filesystem path to a screenshot.
func (a *App) GetScreenshotPath(id int64) (result string, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = ""
			err = nil
		}
	}()
	if a == nil || !a.ready || a.Screenshots == nil {
		return "", nil
	}
	return a.Screenshots.GetScreenshotPath(id)
}

// GetThumbnailPath returns the filesystem path to a thumbnail.
func (a *App) GetThumbnailPath(id int64) (result string, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = ""
			err = nil
		}
	}()
	if a == nil || !a.ready || a.Screenshots == nil {
		return "", nil
	}
	return a.Screenshots.GetThumbnailPath(id)
}

// DeleteScreenshot deletes a screenshot and its files.
func (a *App) DeleteScreenshot(id int64) error {
	if a.Screenshots == nil {
		return nil
	}
	return a.Screenshots.DeleteScreenshot(id)
}

// ============================================================================
// Reports Methods (exposed to frontend)
// ============================================================================

// GenerateReport generates a new report for the given time range.
func (a *App) GenerateReport(timeRange, reportType string, includeScreenshots bool) (*storage.Report, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GenerateReport(timeRange, reportType, includeScreenshots)
}

// GetReport returns a report by ID with full content.
func (a *App) GetReport(id int64) (*storage.Report, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GetReport(id)
}

// ExportReport exports a report in the specified format.
func (a *App) ExportReport(reportID int64, format string) (string, error) {
	if a.Reports == nil {
		return "", nil
	}
	return a.Reports.ExportReport(reportID, format)
}

// GetReportHistory returns past generated reports.
func (a *App) GetReportHistory() ([]*service.ReportMeta, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GetReportHistory()
}

// ParseTimeRange parses natural language time input.
func (a *App) ParseTimeRange(input string) (*service.TimeRange, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.ParseTimeRange(input)
}

// ============================================================================
// Config Methods (exposed to frontend)
// ============================================================================

// GetConfig returns the current configuration.
func (a *App) GetConfig() (*service.Config, error) {
	if a.Config == nil {
		return nil, nil
	}
	return a.Config.GetConfig()
}

// UpdateConfig updates configuration values.
func (a *App) UpdateConfig(updates map[string]interface{}) error {
	if a.Config == nil {
		return nil
	}
	return a.Config.UpdateConfig(updates)
}

// GetStorageStats returns storage statistics.
func (a *App) GetStorageStats() (*service.StorageStats, error) {
	if a.Config == nil {
		return nil, nil
	}
	return a.Config.GetStorageStats()
}

// ============================================================================
// System Methods (exposed to frontend)
// ============================================================================

// GetDataDir returns the data directory path.
func (a *App) GetDataDir() string {
	if a.platform == nil {
		return ""
	}
	return a.platform.DataDir()
}

// GetVersion returns the application version.
func (a *App) GetVersion() string {
	return "2.0.0"
}

// GetSystemInfo returns basic system information.
func (a *App) GetSystemInfo() map[string]string {
	dataDir := ""
	if a.platform != nil {
		dataDir = a.platform.DataDir()
	}
	return map[string]string{
		"dataDir": dataDir,
		"version": "2.0.0",
	}
}

// OpenDataDir opens the data directory in the file manager.
func (a *App) OpenDataDir() error {
	if a.platform == nil {
		return nil
	}
	return a.platform.OpenURL(a.platform.DataDir())
}

// GetCurrentTime returns the current Unix timestamp.
func (a *App) GetCurrentTime() int64 {
	return time.Now().Unix()
}

// ============================================================================
// Git Tracking Methods (exposed to frontend)
// ============================================================================

// RegisterGitRepository adds a git repository for tracking.
func (a *App) RegisterGitRepository(path string) (*storage.GitRepository, error) {
	if a.daemon == nil {
		return nil, nil
	}
	return a.daemon.RegisterGitRepository(path)
}

// UnregisterGitRepository removes a git repository from tracking.
func (a *App) UnregisterGitRepository(repoID int64) error {
	if a.daemon == nil {
		return nil
	}
	return a.daemon.UnregisterGitRepository(repoID)
}

// GetTrackedRepositories returns all tracked git repositories.
func (a *App) GetTrackedRepositories() ([]*storage.GitRepository, error) {
	if a.daemon == nil {
		return nil, nil
	}
	return a.daemon.GetTrackedRepositories()
}

// ============================================================================
// File Tracking Methods (exposed to frontend)
// ============================================================================

// WatchDirectory adds a directory to the file watcher.
func (a *App) WatchDirectory(path string) error {
	if a.daemon == nil {
		return nil
	}
	return a.daemon.WatchDirectory(path)
}

// UnwatchDirectory removes a directory from the file watcher.
func (a *App) UnwatchDirectory(path string) error {
	if a.daemon == nil {
		return nil
	}
	return a.daemon.UnwatchDirectory(path)
}

// GetWatchedDirectories returns the list of watched directories.
func (a *App) GetWatchedDirectories() []string {
	if a.daemon == nil {
		return nil
	}
	return a.daemon.GetWatchedDirectories()
}
