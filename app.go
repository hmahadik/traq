package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"traq/internal/inference"
	"traq/internal/integrations/aiagent"
	"traq/internal/integrations/functionfox"
	"traq/internal/lock"
	"traq/internal/platform"
	"traq/internal/service"
	"traq/internal/storage"
	"traq/internal/tracker"
	"traq/internal/tracker/shellplugin"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Version is set at build time via -ldflags "-X main.Version=x.y.z".
// Defaults to "dev" for local builds. The init() guard below prevents
// an empty string if ldflags passes -X main.Version= (no value).
var Version = "dev"

func init() {
	if Version == "" {
		Version = "dev"
	}
}

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
	Projects    *service.ProjectAssignmentService
	Embeddings  *service.EmbeddingService
	Draft       *service.DraftService
	ShellSetup  *service.ShellSetupService
	TmuxSetup   *service.TmuxSetupService
	AI          *service.AIService
	Timesheet   *service.TimesheetService

	// FunctionFox client (Plan B uses stub; Plan C will use real HTTP client)
	ffClient functionfox.Client

	// Inference engine
	inference *inference.Service

	// Backfill service for applying patterns to historical data
	backfillService *service.BackfillService
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

	// Mirror logs to a stable file in the data dir so users can diagnose
	// failures without needing to find the terminal that launched wails dev.
	// File is opened in append mode and capped via lumberjack-style rotation
	// (manual: keep at most ~5MB of recent logs by truncating on startup).
	if err := os.MkdirAll(dataDir, 0o755); err == nil {
		logPath := filepath.Join(dataDir, "traq.log")
		// Truncate-on-startup keeps the file bounded across runs without
		// pulling in a rotation dep. Each run gets a clean log; the user's
		// most recent failure is always at the top.
		if f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644); err == nil {
			log.SetOutput(io.MultiWriter(os.Stderr, f))
			log.Printf("traq starting: log mirrored to %s", logPath)
		}
	}

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
	a.AI = service.NewAIService(a.store)
	a.Config.SetInferenceUpdater(func(cfg *service.Config) {
		if a.inference == nil {
			return
		}
		inferenceConfig := buildInferenceConfig(cfg)
		a.inference.UpdateConfig(inferenceConfig)
	})

	// Initialize daemon with saved config (falling back to defaults for any
	// missing fields). Privacy-sensitive flags like AIStorePromptContent
	// must be read from stored config at startup so the default-off behavior
	// survives app restarts without the user re-opting-out every time.
	daemonConfig := tracker.DefaultDaemonConfig(dataDir)
	if cfg, err := a.Config.GetConfig(); err == nil && cfg != nil {
		if cfg.DataSources != nil && cfg.DataSources.AITracking != nil {
			ai := cfg.DataSources.AITracking
			daemonConfig.AIStorePromptContent = ai.StorePromptContent
			daemonConfig.AITrackingEnabled = ai.Enabled
			daemonConfig.AIClaudeEnabled = ai.ClaudeEnabled
			daemonConfig.AIOpenCodeEnabled = ai.OpenCodeEnabled
		}
	}
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

	// Initialize projects service (for project assignment and learning)
	// Must be before Reports since Reports uses it for pattern matching
	a.Projects = service.NewProjectAssignmentService(a.store)

	// Wire up auto-assignment of new activities to projects
	if a.daemon != nil {
		a.daemon.SetOnActivitySaved(func(eventType string, eventID int64, appName, windowTitle, gitRepo string) {
			// Check if auto-assign is enabled
			val, err := a.store.GetConfig("projects.auto_assign")
			if err != nil || val != "true" {
				return
			}

			ctx := &storage.AssignmentContext{
				AppName:     appName,
				WindowTitle: windowTitle,
				GitRepo:     gitRepo,
			}

			match := a.Projects.SuggestProject(ctx)
			if match != nil && match.Confidence > 0 {
				if err := a.store.SetEventProject(eventType, eventID, match.ProjectID, match.Confidence, "rule"); err != nil {
					log.Printf("Auto-assign failed for %s/%d: %v", eventType, eventID, err)
				}
			}
		})
	}

	// Initialize embedding service (for semantic similarity-based project assignment)
	a.Embeddings = service.NewEmbeddingService(a.store, nil) // ONNX optional, nil for now
	// Load existing labeled vectors in background
	go func() {
		if err := a.Embeddings.LoadVectors(); err != nil {
			log.Printf("Failed to load embedding vectors: %v", err)
		}
	}()

	// Initialize reports service (after timeline, analytics, and projects services)
	a.Reports = service.NewReportsService(a.store, a.Timeline, a.Analytics, a.Projects)

	// Wire up reports service to projects service (for auto-discovery)
	a.Projects.SetReportsService(a.Reports)

	// Initialize timesheet service (after reports service for project detection)
	a.Timesheet = service.NewTimesheetService(a.store, a.Reports)

	// Initialize FunctionFox client (Plan B uses stub)
	a.ffClient = functionfox.NewStubClient()

	// Initialize backfill service (after reports service for detection functions)
	a.backfillService = service.NewBackfillService(a.store, a.Projects, a.Reports)

	// Initialize inference service from config
	config, _ := a.Config.GetConfig()
	inferenceConfig := buildInferenceConfig(config)
	a.inference = inference.NewService(inferenceConfig)

	// Initialize summary service
	a.Summary = service.NewSummaryService(a.store, a.inference)

	// Initialize draft service (for AI draft approval workflow)
	a.Draft = service.NewDraftService(a.store)

	// Wire up auto-summary generation when sessions close. Without this, the
	// summary pipeline only fires on manual user action, so most sessions
	// never get an AI summary or its structured project allocations.
	if a.daemon != nil {
		a.daemon.SetOnSessionEnded(func(sessionID int64) {
			cfg, err := a.Config.GetConfig()
			if err != nil || cfg == nil || cfg.AI == nil {
				return
			}
			mode := cfg.AI.SummaryMode
			if mode == "" || mode == "off" {
				return
			}
			summary, err := a.generateSummaryUsingConfiguredBackend(sessionID, cfg)
			if err != nil {
				log.Printf("auto-summary: session %d failed: %v", sessionID, err)
				return
			}
			if mode == "drafts" && summary != nil {
				if err := a.store.UpdateSummaryDraftStatus(summary.ID, true, "pending"); err != nil {
					log.Printf("auto-summary: mark draft for session %d failed: %v", sessionID, err)
				}
			}
		})
	}

	// Initialize shell setup service (plugin install/uninstall/status)
	a.ShellSetup = service.NewShellSetupService(dataDir)
	a.Config.SetShellSetup(a.ShellSetup)
	a.TmuxSetup = service.NewTmuxSetupService()

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

	// Sync autostart state with system (creates .desktop file on Linux if needed)
	if err := a.Config.SyncAutoStart(); err != nil {
		log.Printf("Failed to sync autostart state: %v", err)
	}

	// Wire up update callbacks to daemon for AFK-triggered auto-restart
	if a.daemon != nil {
		a.daemon.SetUpdateCallbacks(
			a.Update.HasPendingUpdate,
			func() {
				// Release instance lock before restart — os.Exit skips cleanup
				if a.instanceLock != nil {
					a.instanceLock.Release()
				}
				a.Update.ApplyAndRestart()
			},
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

// GetProjectUsage returns project usage for a time range.
func (a *App) GetProjectUsage(start, end int64) ([]*service.ProjectUsage, error) {
	if a.Analytics == nil {
		return nil, nil
	}
	return a.Analytics.GetProjectUsage(start, end)
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
	end := t.Add(24*time.Hour).Unix() - 1

	return a.Analytics.GetTopWindows(start, end, limit)
}

// GetTopWindowsRange returns the most used windows for a timestamp range, grouped by window title.
func (a *App) GetTopWindowsRange(start, end int64, limit int) ([]*service.WindowUsage, error) {
	if a.Analytics == nil {
		return nil, nil
	}
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

	// Get timeline display settings from config
	opts := service.TimelineOptions{}
	if a.Config != nil {
		if config, err := a.Config.GetConfig(); err == nil && config.Timeline != nil {
			opts.MinDurationSeconds = config.Timeline.MinActivityDurationSeconds
			opts.AppGrouping = config.Timeline.AppGrouping
			opts.ContinuityMergeSeconds = config.Timeline.ContinuityMergeSeconds
		}
	}

	return a.Timeline.GetTimelineGridDataWithOptions(date, opts)
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

// GetShellSetupStatus returns the install/enable state for a given shell.
func (a *App) GetShellSetupStatus(shell string) (*service.SetupStatus, error) {
	return a.ShellSetup.Status(shellplugin.ShellKind(shell))
}

// InstallShellPlugin installs the Traq plugin for the given shell.
func (a *App) InstallShellPlugin(shell string) error {
	return a.ShellSetup.Install(shellplugin.ShellKind(shell))
}

// UninstallShellPlugin removes the Traq plugin for the given shell.
func (a *App) UninstallShellPlugin(shell string) error {
	return a.ShellSetup.Uninstall(shellplugin.ShellKind(shell))
}

// DismissShellOverflow clears the overflow sentinel file.
func (a *App) DismissShellOverflow() error {
	return a.ShellSetup.DismissOverflow()
}

// GetTmuxSetupStatus returns whether Traq's tmux integration block is
// present in the user's tmux.conf, and whether tmux is on PATH at all.
func (a *App) GetTmuxSetupStatus() (*service.TmuxSetupStatus, error) {
	return a.TmuxSetup.Status()
}

// InstallTmuxIntegration writes Traq's set-titles config block to the
// user's tmux.conf and live-reloads any running tmux server.
func (a *App) InstallTmuxIntegration() error {
	return a.TmuxSetup.Install()
}

// UninstallTmuxIntegration removes Traq's tmux config block (other tmux
// settings the user has are left untouched).
func (a *App) UninstallTmuxIntegration() error {
	return a.TmuxSetup.Uninstall()
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

// GetSessionContextSummary returns lightweight session context with counts only.
// Use this instead of GetSessionContext when you only need counts for tab badges.
// Note: GetSessionContext is kept as an internal Go method (used by reports.go)
// but is no longer exposed as a Wails binding to prevent frontend misuse.
func (a *App) GetSessionContextSummary(sessionID int64) (*service.SessionContextSummary, error) {
	if a == nil || !a.ready || a.Timeline == nil || sessionID <= 0 {
		return &service.SessionContextSummary{}, nil
	}
	return a.Timeline.GetSessionContextSummary(sessionID)
}

// GetFocusEventsForSession returns focus events for a session with friendly app names.
func (a *App) GetFocusEventsForSession(sessionID int64) ([]*service.FocusEventDisplay, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetFocusEventsForSession(sessionID)
}

// GetShellCommandsForSession returns shell commands for a session.
func (a *App) GetShellCommandsForSession(sessionID int64) ([]*storage.ShellCommand, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetShellCommandsForSession(sessionID)
}

// GetGitCommitsForSession returns git commits for a session.
func (a *App) GetGitCommitsForSession(sessionID int64) ([]*storage.GitCommit, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetGitCommitsForSession(sessionID)
}

// GetFileEventsForSession returns file events for a session.
func (a *App) GetFileEventsForSession(sessionID int64) ([]*storage.FileEvent, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetFileEventsForSession(sessionID)
}

// GetBrowserVisitsForSession returns browser visits for a session.
func (a *App) GetBrowserVisitsForSession(sessionID int64) ([]*storage.BrowserVisit, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetBrowserVisitsForSession(sessionID)
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

// GenerateProjectReport generates a report for a specific project.
// If projectID is 0, generates a report for all activities.
func (a *App) GenerateProjectReport(timeRange, reportType string, includeScreenshots bool, projectID int64) (*service.Report, error) {
	if a.Reports == nil {
		return nil, nil
	}
	return a.Reports.GenerateReportWithFilter(timeRange, reportType, includeScreenshots, projectID)
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

// GenerateEnhancedWeeklyHTML generates a visual-rich HTML report for team presentations.
func (a *App) GenerateEnhancedWeeklyHTML(startDate, endDate string) (string, error) {
	if a.Reports == nil {
		return "", nil
	}
	return a.Reports.GenerateEnhancedWeeklyHTML(startDate, endDate)
}

// ============================================================================
// Summary Methods (exposed to frontend)
// ============================================================================

// GenerateSummary generates an AI summary for a session, dispatching to
// the inference engine or a CLI agent based on ai.summaryBackend config.
func (a *App) GenerateSummary(sessionID int64) (*storage.Summary, error) {
	if a.Summary == nil {
		return nil, fmt.Errorf("summary service not initialized")
	}
	cfg, _ := a.Config.GetConfig()
	return a.generateSummaryUsingConfiguredBackend(sessionID, cfg)
}

// RegenerateSummary deletes any existing summary for the session and
// regenerates via the configured backend.
func (a *App) RegenerateSummary(sessionID int64) (*storage.Summary, error) {
	if a.Summary == nil {
		return nil, fmt.Errorf("summary service not initialized")
	}
	if existing, err := a.store.GetSummaryBySession(sessionID); err == nil && existing != nil {
		_ = a.store.DeleteSummary(existing.ID)
	}
	cfg, _ := a.Config.GetConfig()
	return a.generateSummaryUsingConfiguredBackend(sessionID, cfg)
}

// generateSummaryUsingConfiguredBackend reads ai.summaryBackend and either
// runs the local inference engine (default) or routes through an aiagent
// CLI subprocess. CLI failure when explicitly configured returns the error;
// CLI unavailability under "auto" silently falls back to inference so the
// pipeline keeps working when claude/opencode aren't installed.
func (a *App) generateSummaryUsingConfiguredBackend(sessionID int64, cfg *service.Config) (*storage.Summary, error) {
	if cfg == nil || cfg.AI == nil || cfg.AI.SummaryBackend == "" || cfg.AI.SummaryBackend == "inference" {
		return a.Summary.GenerateSummary(sessionID)
	}
	gen, err := pickSummaryAgent(cfg.AI.SummaryBackend)
	if err != nil {
		// auto mode: fall back to inference rather than failing the user.
		if cfg.AI.SummaryBackend == "auto" {
			log.Printf("summary-backend: %v; falling back to inference", err)
			return a.Summary.GenerateSummary(sessionID)
		}
		return nil, err
	}
	return a.Summary.GenerateSummaryWithAgent(sessionID, gen)
}

// pickSummaryAgent mirrors pickAIGenerator but is scoped to summary
// generation. Kept as a separate function so the timesheet AI-notes path
// (which has its own backend selection) doesn't bind to summary settings.
func pickSummaryAgent(backend string) (aiagent.Generator, error) {
	switch backend {
	case "claude":
		g := aiagent.NewClaudeGenerator()
		if !g.Available() {
			return nil, fmt.Errorf("claude CLI not on PATH")
		}
		return g, nil
	case "opencode":
		g := aiagent.NewOpenCodeGenerator()
		if !g.Available() {
			return nil, fmt.Errorf("opencode CLI not on PATH")
		}
		return g, nil
	case "auto":
		g := aiagent.NewAutoGenerator()
		if !g.Available() {
			return nil, fmt.Errorf("no AI agent CLI on PATH (install claude or opencode)")
		}
		return g, nil
	default:
		return nil, fmt.Errorf("unknown summary backend: %s", backend)
	}
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
// Draft Methods (exposed to frontend)
// ============================================================================

// AcceptSummaryDraft marks a summary draft as accepted.
func (a *App) AcceptSummaryDraft(summaryID int64) error {
	if a.Draft == nil {
		return fmt.Errorf("draft service not initialized")
	}
	return a.Draft.AcceptSummaryDraft(summaryID)
}

// RejectSummaryDraft marks a summary draft as rejected.
func (a *App) RejectSummaryDraft(summaryID int64) error {
	if a.Draft == nil {
		return fmt.Errorf("draft service not initialized")
	}
	return a.Draft.RejectSummaryDraft(summaryID)
}

// AcceptAssignmentDraft marks a project assignment draft as accepted.
func (a *App) AcceptAssignmentDraft(activityID int64) error {
	if a.Draft == nil {
		return fmt.Errorf("draft service not initialized")
	}
	return a.Draft.AcceptAssignmentDraft(activityID)
}

// RejectAssignmentDraft marks a project assignment draft as rejected.
func (a *App) RejectAssignmentDraft(activityID int64) error {
	if a.Draft == nil {
		return fmt.Errorf("draft service not initialized")
	}
	return a.Draft.RejectAssignmentDraft(activityID)
}

// BulkAcceptDrafts accepts multiple drafts at once.
func (a *App) BulkAcceptDrafts(summaryIDs, assignmentIDs []int64) error {
	if a.Draft == nil {
		return fmt.Errorf("draft service not initialized")
	}
	return a.Draft.BulkAcceptDrafts(summaryIDs, assignmentIDs)
}

// BulkAcceptDraftsBySession accepts drafts using session IDs and activity IDs.
// Session IDs are resolved to their corresponding summary IDs internally.
func (a *App) BulkAcceptDraftsBySession(sessionIDs, activityIDs []int64) error {
	if a.Draft == nil {
		return fmt.Errorf("draft service not initialized")
	}
	return a.Draft.BulkAcceptDraftsBySession(sessionIDs, activityIDs)
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

// CheckForUpdate manually triggers an update check and downloads if available.
func (a *App) CheckForUpdate() (*service.UpdateInfo, error) {
	if a.Update == nil {
		return nil, nil
	}
	info, err := a.Update.CheckForUpdate()
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, nil // already up to date
	}
	// Download immediately so the update is staged and ready to install
	if err := a.Update.DownloadUpdate(info); err != nil {
		return info, fmt.Errorf("update found (v%s) but download failed: %w", info.Version, err)
	}
	return info, nil
}

// TriggerUpdate manually applies a pending update and restarts.
func (a *App) TriggerUpdate() error {
	if a.Update == nil {
		return nil
	}
	// Release instance lock before restart — os.Exit(0) in RestartSelf
	// skips all deferred cleanup, so the lock file would persist and
	// block the new instance (especially on Windows with PID reuse).
	if a.instanceLock != nil {
		a.instanceLock.Release()
	}
	return a.Update.ApplyAndRestart()
}

// SetUpdateEnabled enables or disables auto-updates and persists the setting.
func (a *App) SetUpdateEnabled(enabled bool) error {
	if a.Update != nil {
		a.Update.SetEnabled(enabled)
	}
	return a.Config.UpdateConfig(map[string]interface{}{
		"update": map[string]interface{}{"autoUpdate": enabled},
	})
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

// GetOllamaSetupStatus checks if Ollama is installed and ready to use.
func (a *App) GetOllamaSetupStatus() *inference.OllamaSetupStatus {
	return inference.CheckOllamaSetup()
}

// StartOllamaService attempts to start the Ollama service.
func (a *App) StartOllamaService() error {
	return inference.StartOllamaService()
}

// PullOllamaModel pulls an Ollama model. Progress is reported via Wails events.
func (a *App) PullOllamaModel(modelName string) error {
	progressChan := make(chan inference.ModelPullProgress)

	// Send progress updates via Wails runtime events
	go func() {
		for progress := range progressChan {
			wailsRuntime.EventsEmit(a.ctx, "ollama-pull-progress", progress)
		}
	}()

	return inference.PullOllamaModel(modelName, progressChan)
}

// GetOllamaInstallInfo returns installation instructions for Ollama.
func (a *App) GetOllamaInstallInfo() map[string]interface{} {
	return map[string]interface{}{
		"command":        inference.GetOllamaInstallCommand(),
		"url":            inference.GetOllamaInstallURL(),
		"canAutoInstall": inference.CanAutoInstallOllama(),
	}
}

// AutoInstallOllama attempts to automatically install Ollama (Linux only).
func (a *App) AutoInstallOllama() error {
	return inference.AutoInstallOllama()
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
// Project Methods (exposed to frontend)
// ============================================================================

// GetProjects returns all projects, auto-discovering if none exist.
func (a *App) GetProjects() ([]storage.Project, error) {
	if a.Projects == nil {
		return nil, nil
	}

	projects, err := a.Projects.GetProjects()
	if err != nil {
		return nil, err
	}

	// Auto-discover if no projects exist (cold start)
	if len(projects) == 0 {
		_, err := a.Projects.AutoDiscoverProjects()
		if err != nil {
			// Log but don't fail - return empty list
			log.Printf("Auto-discovery failed: %v", err)
			return projects, nil
		}
		// Re-fetch after discovery
		return a.Projects.GetProjects()
	}

	return projects, nil
}

// AutoDiscoverProjects can be called manually to discover new projects.
// It only creates projects that don't already exist (by name).
func (a *App) AutoDiscoverProjects() ([]storage.Project, error) {
	if a.Projects == nil {
		return nil, fmt.Errorf("projects service not initialized")
	}
	return a.Projects.AutoDiscoverProjects()
}

// GetProject returns a single project by ID.
func (a *App) GetProject(projectID int64) (*storage.Project, error) {
	if a.Projects == nil {
		return nil, nil
	}
	return a.Projects.GetProject(projectID)
}

// CreateProject creates a new project.
func (a *App) CreateProject(name, color, description string) (*storage.Project, error) {
	if a.Projects == nil {
		return nil, fmt.Errorf("projects service not initialized")
	}
	return a.Projects.CreateProject(name, color, description)
}

// UpdateProject updates a project.
func (a *App) UpdateProject(projectID int64, name, color, description string) error {
	if a.Projects == nil {
		return fmt.Errorf("projects service not initialized")
	}
	return a.Projects.UpdateProject(projectID, name, color, description)
}

// DeleteProject deletes a project and clears its assignments.
func (a *App) DeleteProject(projectID int64) error {
	if a.Projects == nil {
		return fmt.Errorf("projects service not initialized")
	}
	return a.Projects.DeleteProject(projectID)
}

// GetProjectStats returns aggregate stats for a project.
func (a *App) GetProjectStats(projectID int64) (*storage.ProjectStats, error) {
	if a.Projects == nil {
		return nil, nil
	}
	return a.Projects.GetProjectStats(projectID)
}

// GetProjectActivities returns activities for a project in a time range.
func (a *App) GetProjectActivities(projectID int64, startDate, endDate string) ([]storage.ProjectActivity, error) {
	start, _ := time.ParseInLocation("2006-01-02", startDate, time.Local)
	end, _ := time.ParseInLocation("2006-01-02", endDate, time.Local)
	end = end.Add(24 * time.Hour) // Include full end day

	return a.store.GetProjectActivities(projectID, start.Unix(), end.Unix(), 500)
}

// GetUnassignedActivities returns activities without project assignment in a time range.
func (a *App) GetUnassignedActivities(startDate, endDate string) ([]storage.ProjectActivity, error) {
	start, _ := time.ParseInLocation("2006-01-02", startDate, time.Local)
	end, _ := time.ParseInLocation("2006-01-02", endDate, time.Local)
	end = end.Add(24 * time.Hour) // Include full end day

	return a.store.GetUnassignedActivities(start.Unix(), end.Unix(), 500)
}

// GetProjectPatterns returns learned patterns for a project.
func (a *App) GetProjectPatterns(projectID int64) ([]storage.ProjectPattern, error) {
	if a.Projects == nil {
		return nil, nil
	}
	return a.Projects.GetProjectPatterns(projectID)
}

// DeleteProjectPattern deletes a learned pattern.
func (a *App) DeleteProjectPattern(patternID int64) error {
	if a.Projects == nil {
		return fmt.Errorf("projects service not initialized")
	}
	return a.Projects.DeletePattern(patternID)
}

// CreateProjectRule creates a new user-defined pattern rule.
func (a *App) CreateProjectRule(rule service.ProjectRuleInput) (*storage.ProjectPattern, error) {
	if a.Projects == nil {
		return nil, fmt.Errorf("projects service not initialized")
	}
	return a.Projects.CreateProjectRule(rule)
}

// UpdateProjectRule updates an existing pattern rule.
func (a *App) UpdateProjectRule(id int64, rule service.ProjectRuleInput) error {
	if a.Projects == nil {
		return fmt.Errorf("projects service not initialized")
	}
	return a.Projects.UpdateProjectRule(id, rule)
}

// PreviewRuleMatches shows what events would match a pattern without applying it.
func (a *App) PreviewRuleMatches(rule service.ProjectRuleInput) (*service.RulePreview, error) {
	if a.Projects == nil {
		return nil, fmt.Errorf("projects service not initialized")
	}
	return a.Projects.PreviewRuleMatches(rule)
}

// ApplyRuleToHistory applies a pattern to all matching historical events.
func (a *App) ApplyRuleToHistory(patternID int64) (int, error) {
	if a.Projects == nil {
		return 0, fmt.Errorf("projects service not initialized")
	}
	return a.Projects.ApplyRuleToHistory(patternID)
}

// MigrateHardcodedPatterns migrates legacy hardcoded project detection rules to the database.
// This is idempotent and safe to call multiple times.
func (a *App) MigrateHardcodedPatterns() (int, error) {
	if a.Projects == nil {
		return 0, fmt.Errorf("projects service not initialized")
	}
	return a.Projects.MigrateHardcodedPatterns()
}

// AssignEventToProject manually assigns an event to a project.
func (a *App) AssignEventToProject(eventType string, eventID, projectID int64) error {
	if a.Projects == nil {
		return fmt.Errorf("projects service not initialized")
	}
	return a.Projects.ManualAssign(eventType, eventID, projectID)
}

// BulkAssignment represents a single assignment in a bulk operation
type BulkAssignment struct {
	EventType string `json:"eventType"`
	EventID   int64  `json:"eventId"`
	ProjectID int64  `json:"projectId"`
}

// BulkAssignProject assigns multiple activities to a project
func (a *App) BulkAssignProject(assignments []BulkAssignment) error {
	if a.Projects == nil {
		return fmt.Errorf("projects service not initialized")
	}

	for _, assign := range assignments {
		if err := a.Projects.ManualAssign(assign.EventType, assign.EventID, assign.ProjectID); err != nil {
			return fmt.Errorf("failed to assign %s/%d: %w", assign.EventType, assign.EventID, err)
		}

		// Generate and store embedding for newly assigned activity
		ctx, err := a.Projects.ExtractEventContext(assign.EventType, assign.EventID)
		if err == nil && ctx != nil && a.Embeddings != nil {
			embCtx := &service.EmbeddingContext{
				AppName:     ctx.AppName,
				WindowTitle: ctx.WindowTitle,
				GitRepo:     ctx.GitRepo,
				Domain:      ctx.Domain,
			}
			embedding := a.Embeddings.GenerateEmbedding(embCtx)
			contextText := service.BuildContextText(embCtx)
			contextHash := storage.HashContext(contextText)
			a.store.SaveEmbedding(assign.EventType, assign.EventID, service.FloatsToBytes(embedding), contextText, contextHash)
		}
	}

	// Reload vectors after bulk assignment
	if a.Embeddings != nil {
		go a.Embeddings.LoadVectors()
	}

	return nil
}

// SuggestProject gets a project suggestion for an event context.
func (a *App) SuggestProject(ctx *storage.AssignmentContext) *service.AssignmentResult {
	if a.Projects == nil {
		return nil
	}
	return a.Projects.SuggestProject(ctx)
}

// GetUnassignedEventCount returns the count of events without project assignment.
func (a *App) GetUnassignedEventCount() (int, error) {
	if a.store == nil {
		return 0, nil
	}
	return a.store.GetUnassignedEventCount()
}

// GetAssignmentMetrics returns accuracy metrics for the past week.
func (a *App) GetAssignmentMetrics() (*storage.AssignmentMetrics, error) {
	if a.store == nil {
		return nil, nil
	}
	now := time.Now()
	weekAgo := now.AddDate(0, 0, -7)
	return a.store.GetAssignmentMetrics(weekAgo.Unix(), now.Unix())
}

// ============================================================================
// Entries and Backfill Methods (exposed to frontend)
// ============================================================================

// GetEntriesForDate returns project-assigned activities for the Entries lane
func (a *App) GetEntriesForDate(date string) ([]service.EntryBlock, error) {
	if a.Timeline == nil {
		return nil, nil
	}
	return a.Timeline.GetEntriesForDate(date)
}

// BackfillProjects applies project patterns to historical unassigned activities
func (a *App) BackfillProjects(startDate, endDate string, minConfidence float64) (*service.BackfillResult, error) {
	if a.backfillService == nil {
		return nil, fmt.Errorf("backfill service not initialized")
	}
	return a.backfillService.BackfillProjects(startDate, endDate, minConfidence)
}

// PreviewBackfill shows what would be assigned without committing
func (a *App) PreviewBackfill(startDate, endDate string, minConfidence float64) (*service.BackfillResult, error) {
	if a.backfillService == nil {
		return nil, fmt.Errorf("backfill service not initialized")
	}
	return a.backfillService.PreviewBackfill(startDate, endDate, minConfidence)
}

// IgnoreActivities marks activities as ignored (hidden from view)
func (a *App) IgnoreActivities(eventType string, ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	if eventType == "focus" {
		return a.store.SetFocusEventsStatus(ids, "ignored")
	} else if eventType == "screenshot" {
		return a.store.SetScreenshotsStatus(ids, "ignored")
	}
	return fmt.Errorf("unknown event type: %s", eventType)
}

// UnignoreActivities restores ignored activities to active
func (a *App) UnignoreActivities(eventType string, ids []int64) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	if eventType == "focus" {
		return a.store.SetFocusEventsStatus(ids, "active")
	} else if eventType == "screenshot" {
		return a.store.SetScreenshotsStatus(ids, "active")
	}
	return fmt.Errorf("unknown event type: %s", eventType)
}

// GetReportIncludeUnassigned returns the report config setting
func (a *App) GetReportIncludeUnassigned() (bool, error) {
	if a.store == nil {
		return true, nil // Default to true
	}
	val, err := a.store.GetConfig("reports.include_unassigned")
	if err != nil {
		return true, nil // Default to true
	}
	return val == "true", nil
}

// SetReportIncludeUnassigned updates the report config setting
func (a *App) SetReportIncludeUnassigned(include bool) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	val := "false"
	if include {
		val = "true"
	}
	return a.store.SetConfig("reports.include_unassigned", val)
}

// GetProjectsAutoAssign returns whether new activities should be auto-assigned to projects
func (a *App) GetProjectsAutoAssign() (bool, error) {
	if a.store == nil {
		return false, nil // Default to false
	}
	val, err := a.store.GetConfig("projects.auto_assign")
	if err != nil {
		return false, nil // Default to false
	}
	return val == "true", nil
}

// SetProjectsAutoAssign updates whether new activities should be auto-assigned to projects
func (a *App) SetProjectsAutoAssign(enabled bool) error {
	if a.store == nil {
		return fmt.Errorf("store not initialized")
	}
	val := "false"
	if enabled {
		val = "true"
	}
	return a.store.SetConfig("projects.auto_assign", val)
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

// ListAISessions returns AI coding sessions (Claude Code, opencode) that had
// activity on the given date. Bound to the frontend via Wails.
func (a *App) ListAISessions(date string) ([]service.AISessionDisplay, error) {
	return a.AI.ListAISessions(date)
}

// GetAISession returns detail for one AI session by its native tool ID.
func (a *App) GetAISession(id string) (*service.AISessionDetail, error) {
	return a.AI.GetAISession(id)
}

// GetAIPromptsForDay returns one entry per user-initiated AI event with
// optional prompt-text preview. Preview / content are populated only when
// AITrackingConfig.StorePromptContent is on at ingest time; otherwise both
// fields come back empty and the frontend renders timestamp-only rows.
func (a *App) GetAIPromptsForDay(date string) ([]service.AIPromptDisplay, error) {
	return a.AI.GetAIPromptsForDay(date)
}

// =============================================================================
// Timesheet (Plan B)
// =============================================================================

// GenerateTimesheet builds a structured per-(project, date) timesheet for the
// given date range and resolves FF mappings. Notes are NOT generated unless
// AI notes are enabled in settings (handled by GenerateTimesheetWithAINotes).
func (a *App) GenerateTimesheet(startDate, endDate string) (*service.TimesheetData, error) {
	cfg, err := a.Config.GetConfig()
	if err != nil {
		return nil, fmt.Errorf("get config: %w", err)
	}
	rounding := 0.25
	if cfg.Timesheet != nil && cfg.Timesheet.HoursRounding > 0 {
		rounding = cfg.Timesheet.HoursRounding
	}
	data, err := a.Timesheet.BuildTimesheet(startDate, endDate, rounding)
	if err != nil {
		return nil, err
	}
	if cfg.Timesheet == nil || !cfg.Timesheet.AINotesEnabled {
		log.Printf("[timesheet] notes skipped: aiNotesEnabled=%v",
			cfg.Timesheet != nil && cfg.Timesheet.AINotesEnabled)
		return data, nil
	}
	log.Printf("[timesheet] notes enabled backend=%q entries=%d",
		cfg.Timesheet.AINotesBackend, len(data.Entries))
	backend, err := a.pickNotesBackend(cfg.Timesheet.AINotesBackend)
	if err != nil {
		// Surface the failure as a generated-but-noted-as-failed marker on
		// every non-skipped row, so the user sees something concrete in the
		// preview instead of "huh, no notes." The previous behavior (silent
		// fall-through) made misconfigured backends indistinguishable from
		// the AI-notes-off case.
		log.Printf("[timesheet] notes backend unavailable: %v", err)
		marker := fmt.Sprintf("[notes backend %q unavailable: %v]", cfg.Timesheet.AINotesBackend, err)
		for i := range data.Entries {
			if !data.Entries[i].Skipped {
				data.Entries[i].Notes = marker
			}
		}
		return data, nil
	}
	log.Printf("[timesheet] notes backend selected: %s", backend.Name())
	if err := a.Timesheet.PopulateNotes(a.ctx, data, backend); err != nil {
		log.Printf("[timesheet] PopulateNotes returned err=%v", err)
		return data, fmt.Errorf("populate notes: %w", err)
	}
	// Quick post-condition: did anything actually land?
	populated := 0
	for _, e := range data.Entries {
		if e.Notes != "" && !strings.HasPrefix(e.Notes, "[") {
			populated++
		}
	}
	log.Printf("[timesheet] notes populated %d/%d entries", populated, len(data.Entries))
	return data, nil
}

// pickNotesBackend selects the configured notes backend. "inference" routes
// through the local inference engine (same one summaries can use); the rest
// route through CLI subprocesses. Returns an error when the requested
// backend isn't available — caller decides whether to abort or fall through.
func (a *App) pickNotesBackend(backend string) (service.NotesBackend, error) {
	switch backend {
	case "inference":
		if a.inference == nil {
			return nil, fmt.Errorf("inference service not initialized")
		}
		if status := a.inference.GetSetupStatus(); !status.Ready {
			return nil, fmt.Errorf("inference not ready: %s", status.Issue)
		}
		return service.NewInferenceNotesBackend(a.inference), nil
	case "claude":
		g := aiagent.NewClaudeGenerator()
		if !g.Available() {
			return nil, fmt.Errorf("claude CLI not on PATH")
		}
		return service.NewAgentNotesBackend(g), nil
	case "opencode":
		g := aiagent.NewOpenCodeGenerator()
		if !g.Available() {
			return nil, fmt.Errorf("opencode CLI not on PATH")
		}
		return service.NewAgentNotesBackend(g), nil
	case "auto", "":
		g := aiagent.NewAutoGenerator()
		if !g.Available() {
			return nil, fmt.Errorf("no AI agent CLI on PATH (install claude or opencode)")
		}
		return service.NewAgentNotesBackend(g), nil
	default:
		return nil, fmt.Errorf("unknown AI notes backend: %s", backend)
	}
}

// ListProjectMappings returns all stored Traq project → FunctionFox mappings.
func (a *App) ListProjectMappings() ([]*storage.FunctionFoxProjectMapping, error) {
	return a.store.ListFunctionFoxProjectMappings()
}

// SaveProjectMapping inserts or updates a Traq project → FunctionFox mapping.
// Returns the row ID (insert) or 0 (update — sqlite driver-specific behavior).
func (a *App) SaveProjectMapping(m *storage.FunctionFoxProjectMapping) (int64, error) {
	if m == nil {
		return 0, fmt.Errorf("mapping is nil")
	}
	return a.store.SaveFunctionFoxProjectMapping(m)
}

// DeleteProjectMapping removes the mapping for the given Traq project.
func (a *App) DeleteProjectMapping(traqProject string) error {
	return a.store.DeleteFunctionFoxProjectMapping(traqProject)
}

// ListFFCustomers returns the list of FunctionFox customers (clients) visible
// to the configured account. Plan B uses a stub; Plan C wires the real HTTP client.
func (a *App) ListFFCustomers() ([]functionfox.Customer, error) {
	return a.ffClient.ListCustomers(a.ctx)
}

// ListFFJobs returns the jobs (projects) under a given FF customer.
func (a *App) ListFFJobs(customerID string) ([]functionfox.Job, error) {
	return a.ffClient.ListJobs(a.ctx, customerID)
}

// ListFFTasks returns the tasks (activities) within a given FF job.
func (a *App) ListFFTasks(customerID, jobID string) ([]functionfox.Task, error) {
	return a.ffClient.ListTasks(a.ctx, customerID, jobID)
}

// TestFFConnection verifies the FunctionFox client is reachable. Plan B's stub
// always returns nil. Plan C will perform a real login round-trip.
func (a *App) TestFFConnection() error {
	return a.ffClient.TestConnection(a.ctx)
}
