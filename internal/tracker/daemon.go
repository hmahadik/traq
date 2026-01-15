package tracker

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/getsentry/sentry-go"
	"traq/internal/platform"
	"traq/internal/storage"
)

// DaemonConfig holds configuration for the tracker daemon.
type DaemonConfig struct {
	Interval           time.Duration
	AFKTimeout         time.Duration
	ResumeWindow       time.Duration
	Quality            int
	DuplicateThreshold int
	DataDir            string
	MonitorMode        string // "active_window", "primary", "specific"
	MonitorIndex       int    // Only used when MonitorMode is "specific"
}

// DefaultDaemonConfig returns a default configuration.
func DefaultDaemonConfig(dataDir string) *DaemonConfig {
	return &DaemonConfig{
		Interval:           30 * time.Second,
		AFKTimeout:         3 * time.Minute,
		ResumeWindow:       5 * time.Minute,
		Quality:            80,
		DuplicateThreshold: 3,
		DataDir:            dataDir,
		MonitorMode:        "active_window",
		MonitorIndex:       0,
	}
}

// Daemon is the main tracking daemon.
type Daemon struct {
	config  *DaemonConfig
	store   *storage.Store
	plat    platform.Platform
	capture *ScreenCapture
	window  *WindowTracker
	afk     *AFKDetector
	session *SessionManager
	shell   *ShellTracker
	git     *GitTracker
	files   *FileTracker
	browser *BrowserTracker

	running         bool
	paused          bool
	stopCh          chan struct{}
	mu              sync.RWMutex
	lastDHash       string
	currentAFKID    int64 // Track ongoing AFK event ID

	// Auto-update support
	onUpdateReady     func() bool    // Returns true if update is pending
	onUpdateApply     func()         // Called to apply update and restart
	afkRestartMinutes int            // AFK duration threshold for auto-restart (default: 10)
}

// NewDaemon creates a new tracking daemon.
func NewDaemon(config *DaemonConfig, store *storage.Store, plat platform.Platform) (*Daemon, error) {
	capture := NewScreenCapture(config.DataDir, config.Quality)
	capture.SetDuplicateThreshold(config.DuplicateThreshold)

	afk := NewAFKDetector(plat, config.AFKTimeout)
	session := NewSessionManager(store, afk)
	window := NewWindowTracker(plat, store)
	shell := NewShellTracker(plat, store, config.DataDir)
	git := NewGitTracker(store, config.DataDir)

	// FileTracker is optional - don't fail if it can't be created
	files, _ := NewFileTracker(store)

	// BrowserTracker for tracking browser history
	browser := NewBrowserTracker(plat, store, config.DataDir)

	d := &Daemon{
		config:            config,
		store:             store,
		plat:              plat,
		capture:           capture,
		window:            window,
		afk:               afk,
		session:           session,
		shell:             shell,
		git:               git,
		files:             files,
		browser:           browser,
		stopCh:            make(chan struct{}),
		afkRestartMinutes: 10, // Default: restart after 10 min AFK with pending update
	}

	// Set up AFK callbacks
	afk.SetCallbacks(d.onAFK, d.onReturn)

	return d, nil
}

// Start starts the daemon.
func (d *Daemon) Start() error {
	d.mu.Lock()
	if d.running {
		d.mu.Unlock()
		return fmt.Errorf("daemon already running")
	}
	d.running = true
	d.stopCh = make(chan struct{})
	d.mu.Unlock()

	// Close any orphaned AFK events from a previous crash
	// We assume user returned at current time if there's an unclosed AFK event
	if err := d.store.CloseOrphanedAFKEvents(time.Now().Unix()); err != nil {
		// Log but don't fail startup
		fmt.Printf("Warning: failed to close orphaned AFK events: %v\n", err)
	}

	// Close any orphaned sessions from crashes or multiple instances
	// Sessions older than 12 hours without an end_time are considered orphaned
	const maxSessionAge = 12 * 60 * 60 // 12 hours in seconds
	if count, err := d.store.CloseOrphanedSessions(time.Now().Unix(), maxSessionAge); err != nil {
		fmt.Printf("Warning: failed to close orphaned sessions: %v\n", err)
	} else if count > 0 {
		fmt.Printf("Closed %d orphaned session(s) from previous run\n", count)
	}

	// Start or resume a session
	session, err := d.session.StartSession()
	if err != nil {
		return fmt.Errorf("failed to start session: %w", err)
	}

	// Start file tracker with current session
	if d.files != nil {
		d.files.SetSessionID(session.ID)
		d.files.Start()
	}

	go d.run()
	return nil
}

// Stop stops the daemon.
func (d *Daemon) Stop() error {
	d.mu.Lock()
	if !d.running {
		d.mu.Unlock()
		return nil
	}
	d.mu.Unlock()

	close(d.stopCh)

	// Stop file tracker (flushes buffered events)
	if d.files != nil {
		d.files.Stop()
	}

	// Flush current window focus
	d.window.FlushCurrentFocus()

	// End current session
	d.session.EndSession()

	d.mu.Lock()
	d.running = false
	d.mu.Unlock()

	return nil
}

// IsRunning returns whether the daemon is running.
func (d *Daemon) IsRunning() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.running
}

// IsPaused returns whether capture is paused.
func (d *Daemon) IsPaused() bool {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.paused
}

// Pause pauses screenshot capture without stopping the daemon.
// The daemon continues running but skips capture operations.
func (d *Daemon) Pause() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.paused = true
}

// Resume resumes screenshot capture after a pause.
func (d *Daemon) Resume() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.paused = false
}

// GetStatus returns the current daemon status.
func (d *Daemon) GetStatus() *DaemonStatus {
	d.mu.RLock()
	defer d.mu.RUnlock()

	return &DaemonStatus{
		Running:         d.running,
		Paused:          d.paused,
		IsAFK:           d.afk.IsAFK(),
		CurrentSession:  d.session.GetCurrentSession(),
		SessionDuration: d.session.GetSessionDuration(),
		IdleDuration:    d.afk.GetIdleDuration(),
	}
}

// DaemonStatus represents the current status of the daemon.
type DaemonStatus struct {
	Running         bool
	Paused          bool
	IsAFK           bool
	CurrentSession  *storage.Session
	SessionDuration time.Duration
	IdleDuration    time.Duration
}

func (d *Daemon) run() {
	// Recover from panics and report to Sentry
	defer func() {
		if r := recover(); r != nil {
			sentry.CurrentHub().Recover(r)
			sentry.Flush(2 * time.Second)
		}
	}()

	ticker := time.NewTicker(d.config.Interval)
	defer ticker.Stop()

	// Initial tick
	d.tick()

	for {
		select {
		case <-ticker.C:
			d.tick()
		case <-d.stopCh:
			return
		}
	}
}

func (d *Daemon) tick() {
	// Check AFK status
	stateChanged := d.afk.Poll()
	if stateChanged {
		// State change callbacks will handle session management
		return
	}

	// Don't capture if AFK
	if d.afk.IsAFK() {
		// Check if we should auto-restart for pending update
		d.checkAutoUpdate()
		return
	}

	// Don't capture if paused
	d.mu.RLock()
	paused := d.paused
	d.mu.RUnlock()
	if paused {
		return
	}

	// Ensure we have an active session
	session, err := d.session.EnsureSession()
	if err != nil {
		// Log error but continue
		return
	}

	// Check window focus
	windowInfo, changed, err := d.window.Poll()
	if err == nil && changed {
		d.window.RecordFocusChange(windowInfo, session.ID)
	}

	// Capture screenshot based on monitor mode configuration
	var result *CaptureResult
	monitorIndex := d.getMonitorIndexForCapture(windowInfo)
	result, err = d.capture.CaptureMonitor(monitorIndex)
	if err != nil {
		// Log error but continue
		return
	}

	// Check for duplicate
	if d.lastDHash != "" {
		similar, _ := d.capture.AreSimilar(d.lastDHash, result.DHash)
		if similar {
			// Skip duplicate screenshot - clean up the saved files
			os.Remove(result.Filepath)
			if result.ThumbnailPath != "" {
				os.Remove(result.ThumbnailPath)
			}
			return
		}
	}
	d.lastDHash = result.DHash

	// Save to database
	sc := &storage.Screenshot{
		Timestamp:     time.Now().Unix(),
		Filepath:      result.Filepath,
		DHash:         result.DHash,
		MonitorName:   sql.NullString{String: result.MonitorName, Valid: true},
		MonitorWidth:  sql.NullInt64{Int64: int64(result.Width), Valid: true},
		MonitorHeight: sql.NullInt64{Int64: int64(result.Height), Valid: true},
		SessionID:     sql.NullInt64{Int64: session.ID, Valid: true},
	}

	// Add window info if available
	if windowInfo != nil {
		sc.WindowTitle = sql.NullString{String: windowInfo.Title, Valid: windowInfo.Title != ""}
		sc.AppName = sql.NullString{String: windowInfo.AppName, Valid: windowInfo.AppName != ""}
		sc.WindowClass = sql.NullString{String: windowInfo.Class, Valid: windowInfo.Class != ""}
		sc.ProcessPID = sql.NullInt64{Int64: int64(windowInfo.PID), Valid: windowInfo.PID > 0}
		sc.WindowX = sql.NullInt64{Int64: int64(windowInfo.X), Valid: true}
		sc.WindowY = sql.NullInt64{Int64: int64(windowInfo.Y), Valid: true}
		sc.WindowWidth = sql.NullInt64{Int64: int64(windowInfo.Width), Valid: true}
		sc.WindowHeight = sql.NullInt64{Int64: int64(windowInfo.Height), Valid: true}
	}

	d.store.SaveScreenshot(sc)

	// Poll shell history for new commands
	d.shell.Poll(session.ID)

	// Poll git repositories for new commits
	d.git.Poll(session.ID)

	// Poll browser history for new visits
	d.browser.Poll(session.ID)
}

// checkAutoUpdate checks if we should auto-restart to apply a pending update.
// This is called during AFK periods to apply updates when user is away.
func (d *Daemon) checkAutoUpdate() {
	d.mu.RLock()
	onReady := d.onUpdateReady
	onApply := d.onUpdateApply
	threshold := d.afkRestartMinutes
	d.mu.RUnlock()

	// Skip if callbacks not set
	if onReady == nil || onApply == nil {
		return
	}

	// Check if update is pending
	if !onReady() {
		return
	}

	// Check if we've been AFK long enough
	idleDuration := d.afk.GetIdleDuration()
	if idleDuration < time.Duration(threshold)*time.Minute {
		return
	}

	// Trigger update and restart
	fmt.Printf("Auto-update: AFK for %v with pending update, restarting...\n", idleDuration)
	onApply()
}

func (d *Daemon) onAFK() {
	// Flush window focus
	d.window.FlushCurrentFocus()

	// End current session
	d.session.HandleAFK()

	// Clear duplicate detection
	d.lastDHash = ""

	// Create AFK event
	session := d.session.GetCurrentSession()
	var sessionID sql.NullInt64
	if session != nil {
		sessionID = sql.NullInt64{Int64: session.ID, Valid: true}
	}

	afkEvent := &storage.AFKEvent{
		StartTime:   time.Now().Unix(),
		SessionID:   sessionID,
		TriggerType: "idle_timeout",
	}
	id, err := d.store.CreateAFKEvent(afkEvent)
	if err == nil {
		d.mu.Lock()
		d.currentAFKID = id
		d.mu.Unlock()
	}
}

func (d *Daemon) onReturn() {
	// Close current AFK event
	d.mu.Lock()
	afkID := d.currentAFKID
	d.currentAFKID = 0
	d.mu.Unlock()

	if afkID > 0 {
		d.store.UpdateAFKEventEnd(afkID, time.Now().Unix())
	}

	// Start new session
	session, err := d.session.HandleReturn()
	if err != nil {
		return
	}

	// Update window tracker with new session ID
	d.window.UpdateSessionID(session.ID)

	// Update file tracker with new session ID
	if d.files != nil {
		d.files.SetSessionID(session.ID)
	}
}

// getMonitorIndexForCapture returns the monitor index to capture based on config.
func (d *Daemon) getMonitorIndexForCapture(windowInfo *platform.WindowInfo) int {
	d.mu.RLock()
	mode := d.config.MonitorMode
	configuredIndex := d.config.MonitorIndex
	d.mu.RUnlock()

	switch mode {
	case "primary":
		return 0
	case "specific":
		// Validate the configured index
		n := GetMonitorCount()
		if configuredIndex >= 0 && configuredIndex < n {
			return configuredIndex
		}
		// Fall back to primary if configured monitor not available
		return 0
	default: // "active_window" or empty (default)
		// Use the window's location to determine monitor
		if windowInfo != nil && (windowInfo.Width > 0 || windowInfo.Height > 0) {
			return GetMonitorForWindow(windowInfo.X, windowInfo.Y, windowInfo.Width, windowInfo.Height)
		}
		// Fall back to primary monitor if no window info
		return 0
	}
}

// UpdateConfig updates the daemon configuration.
func (d *Daemon) UpdateConfig(config *DaemonConfig) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.config = config
	d.capture.quality = config.Quality
	d.capture.SetDuplicateThreshold(config.DuplicateThreshold)
	d.afk.SetTimeout(config.AFKTimeout)
	if config.ResumeWindow > 0 {
		d.session.SetResumeWindow(config.ResumeWindow)
	}
}

// SetUpdateCallbacks sets the callbacks for auto-update support.
// onReady is called to check if an update is pending (returns true if ready to apply).
// onApply is called to apply the update and restart the app.
func (d *Daemon) SetUpdateCallbacks(onReady func() bool, onApply func()) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.onUpdateReady = onReady
	d.onUpdateApply = onApply
}

// SetAFKRestartMinutes sets the AFK duration threshold for auto-restart with pending update.
func (d *Daemon) SetAFKRestartMinutes(minutes int) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.afkRestartMinutes = minutes
}

// SetMonitorMode sets the monitor selection mode.
// mode can be "active_window", "primary", or "specific".
func (d *Daemon) SetMonitorMode(mode string) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.config.MonitorMode = mode
}

// GetMonitorMode returns the current monitor selection mode.
func (d *Daemon) GetMonitorMode() string {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config.MonitorMode
}

// SetMonitorIndex sets the specific monitor index to capture.
// Only used when MonitorMode is "specific".
func (d *Daemon) SetMonitorIndex(index int) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.config.MonitorIndex = index
}

// GetMonitorIndex returns the currently configured monitor index.
func (d *Daemon) GetMonitorIndex() int {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.config.MonitorIndex
}

// GetAvailableMonitors returns info about all connected monitors.
func (d *Daemon) GetAvailableMonitors() []MonitorInfo {
	return GetAvailableMonitors()
}

// SetShellType sets the shell type for tracking.
func (d *Daemon) SetShellType(shellType string) {
	d.shell.SetShellType(shellType)
}

// GetShellType returns the current shell type being tracked.
func (d *Daemon) GetShellType() string {
	return d.shell.GetShellType()
}

// SetShellHistoryPath sets a custom path to the shell history file.
// Pass empty string to use the default platform-detected path.
func (d *Daemon) SetShellHistoryPath(path string) {
	d.shell.SetHistoryPath(path)
}

// GetShellHistoryPath returns the current shell history path being tracked.
func (d *Daemon) GetShellHistoryPath() string {
	return d.shell.GetHistoryPath()
}

// GetShellHistoryPathOverride returns the custom history path if set, or empty if using default.
func (d *Daemon) GetShellHistoryPathOverride() string {
	return d.shell.GetHistoryPathOverride()
}

// SetShellExcludePatterns sets the exclude patterns for shell command filtering.
func (d *Daemon) SetShellExcludePatterns(patterns []string) error {
	return d.shell.SetExcludePatterns(patterns)
}

// GetShellExcludePatterns returns the current user-defined exclude patterns.
func (d *Daemon) GetShellExcludePatterns() []string {
	return d.shell.GetExcludePatterns()
}

// ForceCapture forces an immediate screenshot capture.
func (d *Daemon) ForceCapture() (*CaptureResult, error) {
	windowInfo, _, _ := d.window.Poll()
	monitorIndex := d.getMonitorIndexForCapture(windowInfo)
	return d.capture.CaptureMonitor(monitorIndex)
}

// RegisterGitRepository adds a git repository for tracking.
func (d *Daemon) RegisterGitRepository(path string) (*storage.GitRepository, error) {
	return d.git.RegisterRepository(path)
}

// UnregisterGitRepository removes a git repository from tracking.
func (d *Daemon) UnregisterGitRepository(repoID int64) error {
	return d.git.UnregisterRepository(repoID)
}

// GetTrackedRepositories returns all tracked git repositories.
func (d *Daemon) GetTrackedRepositories() ([]*storage.GitRepository, error) {
	return d.git.GetRepositories()
}

// DiscoverGitRepositories searches for git repositories in the given paths.
func (d *Daemon) DiscoverGitRepositories(searchPaths []string, maxDepth int) ([]*storage.GitRepository, error) {
	return d.git.DiscoverRepositories(searchPaths, maxDepth)
}

// AutoRegisterGitRepo attempts to register the current working directory if it's a git repo.
func (d *Daemon) AutoRegisterGitRepo() {
	cwd, err := os.Getwd()
	if err != nil {
		return
	}
	// Silently try to register - will fail if not a git repo
	d.git.RegisterRepository(cwd)
}

// WatchDirectory adds a directory to the file watcher.
func (d *Daemon) WatchDirectory(path string) error {
	if d.files == nil {
		return fmt.Errorf("file tracker not initialized")
	}
	return d.files.WatchDirectory(path)
}

// UnwatchDirectory removes a directory from the file watcher.
func (d *Daemon) UnwatchDirectory(path string) error {
	if d.files == nil {
		return fmt.Errorf("file tracker not initialized")
	}
	return d.files.UnwatchDirectory(path)
}

// GetWatchedDirectories returns the list of watched directories.
func (d *Daemon) GetWatchedDirectories() []string {
	if d.files == nil {
		return nil
	}
	return d.files.GetWatchedDirectories()
}

// AutoWatchDownloads attempts to watch the user's Downloads folder.
func (d *Daemon) AutoWatchDownloads() {
	if d.files == nil {
		return
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return
	}
	downloadsDir := filepath.Join(homeDir, "Downloads")
	if info, err := os.Stat(downloadsDir); err == nil && info.IsDir() {
		d.files.WatchDirectory(downloadsDir)
	}
}

// SetFileExcludePatterns sets directory patterns to exclude from file tracking.
func (d *Daemon) SetFileExcludePatterns(patterns []string) {
	if d.files == nil {
		return
	}
	// Clear existing patterns and add new ones
	// Note: The FileTracker already has default patterns, we're adding user-defined ones
	for _, pattern := range patterns {
		if pattern != "" {
			d.files.AddExcludePattern(pattern)
		}
	}
}

// SetFileAllowedExtensions sets which file extensions to track.
// If empty, all extensions are tracked (default behavior).
func (d *Daemon) SetFileAllowedExtensions(extensions []string) {
	if d.files == nil {
		return
	}
	d.files.SetAllowedExtensions(extensions)
}

// GetFileAllowedExtensions returns the list of allowed file extensions.
func (d *Daemon) GetFileAllowedExtensions() []string {
	if d.files == nil {
		return nil
	}
	return d.files.GetAllowedExtensions()
}

// GetAvailableBrowsers returns browsers that have history files available.
func (d *Daemon) GetAvailableBrowsers() []string {
	if d.browser == nil {
		return nil
	}
	return d.browser.GetAvailableBrowsers()
}

// SetEnabledBrowsers sets which browsers to track.
func (d *Daemon) SetEnabledBrowsers(browsers []string) {
	if d.browser == nil {
		return
	}
	d.browser.SetEnabledBrowsers(browsers)
}

// SetExcludedDomains sets which domains to exclude from browser tracking.
func (d *Daemon) SetExcludedDomains(domains []string) {
	if d.browser == nil {
		return
	}
	d.browser.SetExcludedDomains(domains)
}

// GetExcludedDomains returns the list of excluded domains.
func (d *Daemon) GetExcludedDomains() []string {
	if d.browser == nil {
		return nil
	}
	return d.browser.GetExcludedDomains()
}

// SetBrowserHistoryLimit sets the limit for how far back to read browser history.
// A value of 0 means no limit (read all available history).
func (d *Daemon) SetBrowserHistoryLimit(days int) {
	if d.browser == nil {
		return
	}
	d.browser.SetHistoryLimitDays(days)
}

// GetBrowserHistoryLimit returns the current browser history limit in days.
func (d *Daemon) GetBrowserHistoryLimit() int {
	if d.browser == nil {
		return 0
	}
	return d.browser.GetHistoryLimitDays()
}
