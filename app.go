package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"traq/internal/inference"
	"traq/internal/lock"
	"traq/internal/platform"
	"traq/internal/service"
	"traq/internal/storage"
	"traq/internal/tracker"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version is set at build time via -ldflags "-X main.Version=x.y.z"
var Version = "dev"

// App struct holds the application state and services
type App struct {
	ctx   context.Context
	ready bool // Set to true after startup completes

	// Core components
	platform     platform.Platform
	store        *storage.Store
	daemon       *tracker.Daemon
	instanceLock *lock.InstanceLock

	// Services (exposed to frontend via Wails bindings)
	Analytics   *service.AnalyticsService
	Timeline    *service.TimelineService
	Reports     *service.ReportsService
	Config      *service.ConfigService
	Screenshots *service.ScreenshotService
	Summary     *service.SummaryService
	Issues      *service.IssueService
	Update      *service.UpdateService

	// Inference engine
	inference *inference.Service
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

	// Acquire instance lock to prevent multiple instances
	a.instanceLock = lock.New(dataDir)
	if err := a.instanceLock.Acquire(); err != nil {
		log.Printf("Instance lock error: %v", err)
		// Show error dialog and quit
		wailsRuntime.MessageDialog(ctx, wailsRuntime.MessageDialogOptions{
			Type:    wailsRuntime.ErrorDialog,
			Title:   "Traq Already Running",
			Message: "Another instance of Traq is already running.\n\nPlease close the existing instance before starting a new one.",
		})
		wailsRuntime.Quit(ctx)
		return
	}

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

	// Initialize reports service (after timeline and analytics services)
	a.Reports = service.NewReportsService(a.store, a.Timeline, a.Analytics)

	// Initialize inference service from config
	config, _ := a.Config.GetConfig()
	inferenceConfig := buildInferenceConfig(config)
	a.inference = inference.NewService(inferenceConfig)

	// Initialize summary service
	a.Summary = service.NewSummaryService(a.store, a.inference)

	// Initialize issues service (for crash/manual reporting)
	a.Issues = service.NewIssueService(a.store, Version)

	// Initialize update service for auto-updates
	a.Update = service.NewUpdateService(Version, dataDir)

	// Configure update service from settings
	if config != nil && config.Update != nil {
		a.Update.SetEnabled(config.Update.AutoUpdate)
		a.Update.SetCheckInterval(config.Update.CheckIntervalHours)
		if a.daemon != nil {
			a.daemon.SetAFKRestartMinutes(config.Update.AFKRestartMinutes)
		}
	}

	// Wire up update callbacks to daemon for AFK-triggered auto-restart
	if a.daemon != nil {
		a.daemon.SetUpdateCallbacks(
			a.Update.HasPendingUpdate,
			func() { a.Update.ApplyAndRestart() },
		)
	}

	// Start update service (background update checker)
	a.Update.Start()

	// Start screenshot server for dev mode (Vite proxies to this)
	go startScreenshotServer(dataDir)

	// Mark as ready
	a.ready = true
}

// startScreenshotServer starts an HTTP server on port 34116 to serve screenshots.
// This is used in dev mode where Vite proxies /screenshots/* requests here.
// In production, the Wails asset handler serves screenshots directly.
func startScreenshotServer(dataDir string) {
	screenshotsDir := filepath.Join(dataDir, "screenshots")

	mux := http.NewServeMux()
	mux.HandleFunc("/screenshots/", func(w http.ResponseWriter, r *http.Request) {
		// Extract relative path
		relPath := strings.TrimPrefix(r.URL.Path, "/screenshots/")
		if relPath == "" {
			http.NotFound(w, r)
			return
		}

		// Build full path
		fullPath := filepath.Join(screenshotsDir, relPath)

		// Security: ensure we don't escape the screenshots directory
		if !strings.HasPrefix(fullPath, screenshotsDir) {
			http.Error(w, "Invalid path", http.StatusForbidden)
			return
		}

		// Check if file exists
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			http.NotFound(w, r)
			return
		}

		// Serve the file
		http.ServeFile(w, r, fullPath)
	})

	// Start server on port 34116 (don't fail if port is in use)
	log.Printf("Starting screenshot server on :34116")
	if err := http.ListenAndServe(":34116", mux); err != nil {
		log.Printf("Screenshot server error (may be expected if already running): %v", err)
	}
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	// Stop update service
	if a.Update != nil {
		a.Update.Stop()
	}

	// Stop daemon gracefully
	if a.daemon != nil {
		if err := a.daemon.Stop(); err != nil {
			log.Printf("Error stopping daemon: %v", err)
		}
	}

	// Shutdown inference (stops bundled server if running)
	if a.inference != nil {
		a.inference.Shutdown()
	}

	// Close storage
	if a.store != nil {
		if err := a.store.Close(); err != nil {
			log.Printf("Error closing storage: %v", err)
		}
	}

	// Release instance lock
	if a.instanceLock != nil {
		a.instanceLock.Release()
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
func (a *App) GetDaemonStatus() (result *service.DaemonStatus, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Config == nil {
		// Return a default "not running" status instead of nil
		// to avoid JSON parse errors in Wails (nil can't be serialized)
		return &service.DaemonStatus{
			Running: false,
			Paused:  false,
			IsAFK:   false,
		}, nil
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

// PauseCapture pauses screenshot capture without stopping the daemon.
func (a *App) PauseCapture() {
	if a.Config == nil {
		return
	}
	a.Config.PauseDaemon()
}

// ResumeCapture resumes screenshot capture after a pause.
func (a *App) ResumeCapture() {
	if a.Config == nil {
		return
	}
	a.Config.ResumeDaemon()
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

// GetAvailableMonitors returns information about all connected monitors.
func (a *App) GetAvailableMonitors() []tracker.MonitorInfo {
	return tracker.GetAvailableMonitors()
}

// ============================================================================
// Analytics Methods (exposed to frontend)
// ============================================================================

// GetDailyStats returns statistics for a specific date.
func (a *App) GetDailyStats(date string) (result *service.DailyStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetDailyStats(date)
}

// GetDailyStatsWithComparison returns statistics for a specific date with comparison to previous day.
func (a *App) GetDailyStatsWithComparison(date string) (result *service.DailyStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetDailyStatsWithComparison(date, true)
}

// GetWeeklyStats returns statistics for a week.
func (a *App) GetWeeklyStats(startDate string) (result *service.WeeklyStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetWeeklyStats(startDate)
}

// GetMonthlyStats returns statistics for a month.
func (a *App) GetMonthlyStats(year, month int) (result *service.MonthlyStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetMonthlyStats(year, month)
}

// GetYearlyStats returns statistics for a year.
func (a *App) GetYearlyStats(year int) (result *service.YearlyStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetYearlyStats(year)
}

// GetCustomRangeStats returns statistics for a custom date range with auto-bucketing.
func (a *App) GetCustomRangeStats(startDate, endDate string) (result *service.CustomRangeStats, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetCustomRangeStats(startDate, endDate)
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
func (a *App) GetCalendarHeatmap(year, month int) (result *service.CalendarData, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Analytics == nil {
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

// GetHourlyActivityHeatmap returns activity heatmap data grouped by day-of-week and hour.
func (a *App) GetHourlyActivityHeatmap() ([]*service.HeatmapData, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetHourlyActivityHeatmap()
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
	t, err := time.ParseInLocation("2006-01-02", date, time.Local)
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
func (a *App) GetSessionsForDate(date string) (result []*service.SessionSummary, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetSessionsForDate(date)
}

// GetTimelineGridData returns all data for the v3 timeline grid view.
func (a *App) GetTimelineGridData(date string) (result *service.TimelineGridData, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetTimelineGridData(date)
}

// GetWeekTimelineData returns aggregated data for week view.
func (a *App) GetWeekTimelineData(startDate string) (result *service.WeekTimelineData, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetWeekTimelineData(startDate)
}

// GetScreenshotsForSession returns paginated screenshots for a session.
func (a *App) GetScreenshotsForSession(sessionID int64, page, perPage int) (*service.ScreenshotPage, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetScreenshotsForSession(sessionID, page, perPage)
}

// GetScreenshotsForHour returns screenshots for a specific hour.
func (a *App) GetScreenshotsForHour(date string, hour int) ([]*service.ScreenshotDisplay, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetScreenshotsForHour(date, hour)
}

// SearchAllDataSources searches across all event types (git, shell, files, browser, screenshots).
func (a *App) SearchAllDataSources(query string, maxResults int) ([]*service.SearchResult, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.SearchAllDataSources(query, maxResults)
}

// GetScreenshotsForDate returns all screenshots for a specific date.
func (a *App) GetScreenshotsForDate(date string) ([]*service.ScreenshotDisplay, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetScreenshotsForDate(date)
}

// GetSessionContext returns all context for a session.
func (a *App) GetSessionContext(sessionID int64) (*service.SessionContext, error) {
	// Return empty context for not-ready state or invalid session ID
	if a == nil || !a.ready || a.Timeline == nil || sessionID <= 0 {
		return &service.SessionContext{}, nil
	}
	return a.Timeline.GetSessionContext(sessionID)
}

// GetRecentSessions returns the most recent sessions.
func (a *App) GetRecentSessions(limit int) (result []*storage.Session, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetRecentSessions(limit)
}

// DeleteSession deletes a session and all its related data.
func (a *App) DeleteSession(sessionID int64) error {
	if a.store == nil {
		return fmt.Errorf("database not initialized")
	}
	return a.store.DeleteSession(sessionID)
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
// Focus Event Methods (exposed to frontend)
// ============================================================================

// GetFocusEventByID retrieves a single focus event by ID.
func (a *App) GetFocusEventByID(id int64) (*storage.WindowFocusEvent, error) {
	if a.store == nil {
		return nil, fmt.Errorf("store not initialized")
	}
	return a.store.GetFocusEventByID(id)
}

// UpdateFocusEvent updates editable fields of a window focus event.
func (a *App) UpdateFocusEvent(id int64, windowTitle, appName string, startTime, endTime int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.UpdateFocusEvent(id, windowTitle, appName, startTime, endTime)
}

// DeleteFocusEvent removes a single focus event.
func (a *App) DeleteFocusEvent(id int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteFocusEvent(id)
}

// DeleteFocusEvents removes multiple focus events (bulk delete).
func (a *App) DeleteFocusEvents(ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteFocusEvents(ids)
}

// DeleteBrowserVisits removes multiple browser visits (bulk delete).
func (a *App) DeleteBrowserVisits(ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteBrowserVisits(ids)
}

// DeleteGitCommits removes multiple git commits (bulk delete).
func (a *App) DeleteGitCommits(ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteGitCommits(ids)
}

// DeleteShellCommands removes multiple shell commands (bulk delete).
func (a *App) DeleteShellCommands(ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteShellCommands(ids)
}

// DeleteFileEvents removes multiple file events (bulk delete).
func (a *App) DeleteFileEvents(ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteFileEvents(ids)
}

// DeleteAFKEvents removes multiple AFK events (bulk delete).
func (a *App) DeleteAFKEvents(ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteAFKEvents(ids)
}

// ============================================================================
// Reports Methods (exposed to frontend)
// ============================================================================

// GenerateReport generates a new report for the given time range.
func (a *App) GenerateReport(timeRange, reportType string, includeScreenshots bool) (*service.Report, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GenerateReport(timeRange, reportType, includeScreenshots)
}

// GetReport returns a report by ID with full content.
func (a *App) GetReport(id int64) (*service.Report, error) {
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

// DeleteReport deletes a report by ID.
func (a *App) DeleteReport(reportID int64) error {
	if a.Reports == nil {
		return nil
	}
	return a.Reports.DeleteReport(reportID)
}

// GetReportHistory returns past generated reports.
func (a *App) GetReportHistory() ([]*service.ReportMeta, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GetReportHistory()
}

// GetDailySummaries returns auto-generated daily summary reports.
func (a *App) GetDailySummaries(limit int) ([]*service.DailySummary, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GetDailySummaries(limit)
}

// ParseTimeRange parses natural language time input.
func (a *App) ParseTimeRange(input string) (*service.TimeRange, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.ParseTimeRange(input)
}

// GenerateWeeklySummaryMarkdown generates a comprehensive weekly summary in Markdown format.
func (a *App) GenerateWeeklySummaryMarkdown(startDate, endDate string) (string, error) {
	if a.Reports == nil {
		return "", nil
	}
	return a.Reports.GenerateWeeklySummaryMarkdown(startDate, endDate)
}

// ============================================================================
// Summary Methods (exposed to frontend)
// ============================================================================

// GenerateSummary generates an AI summary for a session.
func (a *App) GenerateSummary(sessionID int64) (*storage.Summary, error) {
	if a.Summary == nil {
		return nil, fmt.Errorf("summary service not initialized")
	}
	return a.Summary.GenerateSummary(sessionID)
}

// RegenerateSummary regenerates an AI summary for a session.
func (a *App) RegenerateSummary(sessionID int64) (*storage.Summary, error) {
	if a.Summary == nil {
		return nil, fmt.Errorf("summary service not initialized")
	}
	return a.Summary.RegenerateSummary(sessionID)
}

// DeleteSummary deletes an AI summary.
func (a *App) DeleteSummary(summaryID int64) error {
	if !a.ready {
		return errors.New("app not ready")
	}
	return a.store.DeleteSummary(summaryID)
}

// GetSummary retrieves a summary by ID.
func (a *App) GetSummary(summaryID int64) (*storage.Summary, error) {
	if a.Summary == nil {
		return nil, nil
	}
	return a.Summary.GetSummary(summaryID)
}

// GetSummaryBySession retrieves a summary by session ID.
func (a *App) GetSummaryBySession(sessionID int64) (*storage.Summary, error) {
	if a.Summary == nil {
		return nil, nil
	}
	return a.Summary.GetSummaryBySession(sessionID)
}

// ============================================================================
// Config Methods (exposed to frontend)
// ============================================================================

// GetConfig returns the current configuration.
func (a *App) GetConfig() (result *service.Config, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Config == nil {
		// Return minimal default config to avoid JSON parse errors
		// (nil can't be serialized by Wails)
		return &service.Config{
			UI: &service.UIConfig{
				Theme: "system",
			},
		}, nil
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

// OptimizeDatabase runs VACUUM and ANALYZE to reclaim space and optimize the database.
// Returns the size reduction in bytes (positive if space was reclaimed).
func (a *App) OptimizeDatabase() (int64, error) {
	if a.Config == nil {
		return 0, fmt.Errorf("config service not initialized")
	}
	return a.Config.OptimizeDatabase()
}

// GetCategorizationRules retrieves all app categorization rules.
func (a *App) GetCategorizationRules() ([]storage.CategorizationRule, error) {
	if a.store == nil {
		return nil, fmt.Errorf("store not initialized")
	}
	return a.store.GetCategorizationRules()
}

// SetAppTimelineCategory creates or updates a timeline v3 categorization rule for an app.
func (a *App) SetAppTimelineCategory(appName, category string) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.SetAppTimelineCategory(appName, category)
}

// DeleteTimelineCategoryRule deletes a timeline v3 categorization rule for an app.
func (a *App) DeleteTimelineCategoryRule(appName string) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	return a.store.DeleteTimelineCategoryRule(appName)
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
	return Version
}

// GetSystemInfo returns basic system information.
func (a *App) GetSystemInfo() map[string]string {
	dataDir := ""
	if a.platform != nil {
		dataDir = a.platform.DataDir()
	}
	return map[string]string{
		"dataDir": dataDir,
		"version": Version,
	}
}

// GetSystemTheme returns the current OS theme ("dark" or "light").
func (a *App) GetSystemTheme() string {
	if a.platform == nil {
		return "light"
	}
	return a.platform.GetSystemTheme()
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
// Update Methods (exposed to frontend)
// ============================================================================

// GetUpdateStatus returns the current auto-update status.
func (a *App) GetUpdateStatus() *service.UpdateStatus {
	if a.Update == nil {
		return &service.UpdateStatus{
			CurrentVersion: Version,
			Enabled:        false,
		}
	}
	return a.Update.GetStatus()
}

// CheckForUpdate manually triggers an update check.
func (a *App) CheckForUpdate() (*service.UpdateInfo, error) {
	if a.Update == nil {
		return nil, nil
	}
	return a.Update.CheckForUpdate()
}

// TriggerUpdate manually applies a pending update and restarts.
func (a *App) TriggerUpdate() error {
	if a.Update == nil {
		return nil
	}
	return a.Update.ApplyAndRestart()
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

// DiscoverGitRepositories searches for git repositories in the given paths up to maxDepth.
// Returns a list of newly discovered repositories.
func (a *App) DiscoverGitRepositories(searchPaths []string, maxDepth int) ([]*storage.GitRepository, error) {
	if a.daemon == nil {
		return nil, nil
	}
	return a.daemon.DiscoverGitRepositories(searchPaths, maxDepth)
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

// SetFileAllowedExtensions sets which file extensions to track.
// If empty, all extensions are tracked (default behavior).
func (a *App) SetFileAllowedExtensions(extensions []string) {
	if a.daemon == nil {
		return
	}
	a.daemon.SetFileAllowedExtensions(extensions)
}

// GetFileAllowedExtensions returns the list of allowed file extensions.
func (a *App) GetFileAllowedExtensions() []string {
	if a.daemon == nil {
		return nil
	}
	return a.daemon.GetFileAllowedExtensions()
}

// ============================================================================
// App Categorization Methods
// ============================================================================

// AppWithCategory represents an app with its categorization status.
type AppWithCategory struct {
	AppName  string `json:"appName"`
	Category string `json:"category"` // "productive", "neutral", "distracting", or empty if not categorized
}

// GetAllApps returns all detected apps from focus events with their current categorization.
func (a *App) GetAllApps() ([]*AppWithCategory, error) {
	// Get all distinct app names from focus events
	appNames, err := a.store.GetDistinctAppNames()
	if err != nil {
		return nil, err
	}

	// Get all existing categories
	categories, err := a.store.GetAllAppCategories()
	if err != nil {
		return nil, err
	}

	// Create a map of app name -> category for quick lookup
	categoryMap := make(map[string]string)
	for _, cat := range categories {
		categoryMap[cat.AppName] = cat.Category
	}

	// Build result with categorization status
	var result []*AppWithCategory
	for _, appName := range appNames {
		category := categoryMap[appName]
		result = append(result, &AppWithCategory{
			AppName:  appName,
			Category: category, // Empty string if not categorized
		})
	}

	return result, nil
}

// GetAppCategories returns all app categorizations.
func (a *App) GetAppCategories() ([]*storage.AppCategoryRecord, error) {
	return a.store.GetAllAppCategories()
}

// SaveAppCategory sets or updates the category for an app.
func (a *App) SaveAppCategory(appName, category string) error {
	return a.store.SetAppCategory(appName, category)
}

// DeleteAppCategory removes the category for an app.
func (a *App) DeleteAppCategory(appName string) error {
	return a.store.DeleteAppCategory(appName)
}

// ============================================================================
// Inference Methods (exposed to frontend)
// ============================================================================

// GetInferenceStatus returns the current status of the AI inference service.
func (a *App) GetInferenceStatus() *inference.InferenceStatus {
	if a.inference == nil {
		return &inference.InferenceStatus{
			Engine:    "none",
			Available: false,
		}
	}
	return a.inference.GetStatus()
}

// GetInferenceSetupStatus returns detailed setup status with actionable feedback.
func (a *App) GetInferenceSetupStatus() *inference.SetupStatus {
	if a.inference == nil {
		return &inference.SetupStatus{
			Ready:      false,
			Engine:     "none",
			Issue:      "Inference not configured",
			Suggestion: "Configure AI inference in Settings",
		}
	}
	return a.inference.GetSetupStatus()
}

// GetBundledStatus returns detailed status of the bundled AI engine.
func (a *App) GetBundledStatus() *inference.BundledStatus {
	if a.inference == nil {
		return &inference.BundledStatus{
			Available: false,
		}
	}
	return a.inference.GetBundledStatus()
}

// GetAvailableModels returns the list of available AI models for the bundled engine.
func (a *App) GetAvailableModels() []*inference.ModelInfo {
	models := inference.GetAvailableModels()
	result := make([]*inference.ModelInfo, len(models))
	for i := range models {
		result[i] = &models[i]
	}
	return result
}

// DownloadModel downloads an AI model file. Progress is reported via Wails events.
func (a *App) DownloadModel(modelID string) error {
	// Send progress updates via Wails runtime events
	progress := func(downloaded, total int64) {
		if total > 0 {
			pct := int(float64(downloaded) / float64(total) * 100)
			// Emit event to frontend
			wailsRuntime.EventsEmit(a.ctx, "model:download:progress", map[string]interface{}{
				"modelId":    modelID,
				"downloaded": downloaded,
				"total":      total,
				"percent":    pct,
			})
		}
	}

	// Start download in goroutine so it doesn't block
	go func() {
		err := inference.DownloadModel(modelID, progress)
		if err != nil {
			wailsRuntime.EventsEmit(a.ctx, "model:download:error", map[string]interface{}{
				"modelId": modelID,
				"error":   err.Error(),
			})
		} else {
			wailsRuntime.EventsEmit(a.ctx, "model:download:complete", map[string]interface{}{
				"modelId": modelID,
			})
		}
	}()

	return nil
}

// DeleteModel deletes a downloaded AI model file.
func (a *App) DeleteModel(modelID string) error {
	return inference.DeleteModel(modelID)
}

// GetServerStatus returns the installation status of the llama-server binary.
func (a *App) GetServerStatus() *inference.ServerDownloadStatus {
	return inference.GetServerStatus()
}

// DownloadServer downloads the llama-server binary. Progress is reported via Wails events.
func (a *App) DownloadServer() error {
	// Send progress updates via Wails runtime events
	progress := func(downloaded, total int64) {
		if total > 0 {
			pct := int(float64(downloaded) / float64(total) * 100)
			// Emit event to frontend
			wailsRuntime.EventsEmit(a.ctx, "server:download:progress", map[string]interface{}{
				"downloaded": downloaded,
				"total":      total,
				"percent":    pct,
			})
		}
	}

	// Start download in goroutine so it doesn't block
	go func() {
		err := inference.DownloadServer(progress)
		if err != nil {
			wailsRuntime.EventsEmit(a.ctx, "server:download:error", map[string]interface{}{
				"error": err.Error(),
			})
		} else {
			wailsRuntime.EventsEmit(a.ctx, "server:download:complete", map[string]interface{}{})
		}
	}()

	return nil
}

// ============================================================================
// Tag Management Methods (exposed to frontend)
// ============================================================================

// GetAllTags returns all unique tags with their occurrence counts.
func (a *App) GetAllTags() ([]*storage.TagUsageInfo, error) {
	if a.store == nil {
		return nil, nil
	}
	return a.store.GetAllTags()
}

// RenameTag renames a tag across all summaries.
func (a *App) RenameTag(oldName, newName string) (int, error) {
	if a.store == nil {
		return 0, nil
	}
	return a.store.RenameTag(oldName, newName)
}

// MergeTags merges sourceTag into targetTag across all summaries.
func (a *App) MergeTags(sourceTag, targetTag string) (int, error) {
	if a.store == nil {
		return 0, nil
	}
	return a.store.MergeTags(sourceTag, targetTag)
}

// DeleteTag removes a tag from all summaries.
func (a *App) DeleteTag(tagName string) (int, error) {
	if a.store == nil {
		return 0, nil
	}
	return a.store.DeleteTag(tagName)
}

// AddTagToSession adds a tag to a session's summary.
func (a *App) AddTagToSession(sessionID int64, tagName string) error {
	if a.store == nil {
		return nil
	}
	return a.store.AddTagToSession(sessionID, tagName)
}

// RemoveTagFromSession removes a tag from a session's summary.
func (a *App) RemoveTagFromSession(sessionID int64, tagName string) error {
	if a.store == nil {
		return nil
	}
	return a.store.RemoveTagFromSession(sessionID, tagName)
}

// SetTagsForSession replaces all tags for a session.
func (a *App) SetTagsForSession(sessionID int64, tags []string) error {
	if a.store == nil {
		return nil
	}
	return a.store.SetTagsForSession(sessionID, tags)
}

// ============================================================================
// Hierarchical Summary Methods (exposed to frontend)
// ============================================================================

// GetHierarchicalSummary retrieves a summary by period type and date.
func (a *App) GetHierarchicalSummary(periodType, periodDate string) (*storage.HierarchicalSummary, error) {
	if a.store == nil {
		return nil, nil
	}
	return a.store.GetHierarchicalSummary(periodType, periodDate)
}

// ListHierarchicalSummaries retrieves summaries of a given period type.
func (a *App) ListHierarchicalSummaries(periodType string, limit int) ([]*storage.HierarchicalSummary, error) {
	if a.store == nil {
		return nil, nil
	}
	return a.store.ListHierarchicalSummaries(periodType, limit)
}

// GetLatestHierarchicalSummaries returns the most recent summary for each period type.
func (a *App) GetLatestHierarchicalSummaries() (map[string]*storage.HierarchicalSummary, error) {
	if a.store == nil {
		return nil, nil
	}
	return a.store.GetLatestHierarchicalSummaries()
}

// UpdateHierarchicalSummary updates an existing summary (marks as user-edited).
func (a *App) UpdateHierarchicalSummary(id int64, summary string) error {
	if a.store == nil {
		return nil
	}
	hs, err := a.store.GetHierarchicalSummaryByID(id)
	if err != nil {
		return err
	}
	if hs == nil {
		return nil
	}
	hs.Summary = summary
	hs.UserEdited = true
	return a.store.UpdateHierarchicalSummary(hs)
}

// DeleteHierarchicalSummary deletes a summary.
func (a *App) DeleteHierarchicalSummary(id int64) error {
	if a.store == nil {
		return nil
	}
	return a.store.DeleteHierarchicalSummary(id)
}

// ============================================================================
// Issue Reporting Methods (exposed to frontend)
// ============================================================================

// ReportIssue creates a new issue report (crash or manual).
func (a *App) ReportIssue(reportType, errorMessage, stackTrace, userDescription, pageRoute string) (result *service.IssueReport, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Issues == nil {
		return nil, nil
	}
	return a.Issues.CreateIssueReport(service.CreateIssueRequest{
		ReportType:      reportType,
		ErrorMessage:    errorMessage,
		StackTrace:      stackTrace,
		UserDescription: userDescription,
		PageRoute:       pageRoute,
	})
}

// GetIssueReports returns recent issue reports.
func (a *App) GetIssueReports(limit int) (result []*service.IssueReport, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Issues == nil {
		return nil, nil
	}
	return a.Issues.GetIssueReports(limit)
}

// GetIssueReport returns a single issue report by ID.
func (a *App) GetIssueReport(id int64) (result *service.IssueReport, err error) {
	defer func() {
		if r := recover(); r != nil {
			result = nil
			err = fmt.Errorf("internal error: %v", r)
		}
	}()
	if a == nil || !a.ready || a.Issues == nil {
		return nil, nil
	}
	return a.Issues.GetIssueReport(id)
}

// DeleteIssueReport deletes an issue report.
func (a *App) DeleteIssueReport(id int64) error {
	if a == nil || !a.ready || a.Issues == nil {
		return nil
	}
	return a.Issues.DeleteIssueReport(id)
}

// TestIssueWebhook sends a test notification to the configured webhook.
func (a *App) TestIssueWebhook() error {
	if a == nil || !a.ready || a.Issues == nil {
		return fmt.Errorf("issues service not initialized")
	}
	return a.Issues.TestWebhook()
}

// ============================================================================
// Helper functions
// ============================================================================

// buildInferenceConfig converts app config to inference config.
func buildInferenceConfig(config *service.Config) *inference.Config {
	if config == nil || config.Inference == nil {
		// Return default Ollama config
		return &inference.Config{
			Engine: inference.EngineOllama,
			Ollama: &inference.OllamaConfig{
				Host:  "http://localhost:11434",
				Model: "gemma3:12b-it-qat",
			},
		}
	}

	ic := &inference.Config{}

	switch config.Inference.Engine {
	case "bundled":
		ic.Engine = inference.EngineBundled
		if config.Inference.Bundled != nil {
			serverPath, defaultModelPath := inference.GetDefaultPaths()
			modelPath := defaultModelPath

			// Use the configured model if specified
			if config.Inference.Bundled.Model != "" {
				if configuredPath, err := inference.GetModelPath(config.Inference.Bundled.Model); err == nil {
					modelPath = configuredPath
				}
			}

			ic.Bundled = &inference.BundledConfig{
				ModelPath:  modelPath,
				ServerPath: serverPath,
			}
		}
	case "cloud":
		ic.Engine = inference.EngineCloud
		if config.Inference.Cloud != nil {
			ic.Cloud = &inference.CloudConfig{
				Provider: config.Inference.Cloud.Provider,
				APIKey:   config.Inference.Cloud.APIKey,
				Model:    config.Inference.Cloud.Model,
				Endpoint: config.Inference.Cloud.Endpoint,
			}
		}
	default: // "ollama" or unset
		ic.Engine = inference.EngineOllama
		if config.Inference.Ollama != nil {
			ic.Ollama = &inference.OllamaConfig{
				Host:  config.Inference.Ollama.Host,
				Model: config.Inference.Ollama.Model,
			}
		}
		// Ensure defaults
		if ic.Ollama == nil || ic.Ollama.Host == "" {
			ic.Ollama = &inference.OllamaConfig{
				Host:  "http://localhost:11434",
				Model: "gemma3:12b-it-qat",
			}
		}
	}

	return ic
}
