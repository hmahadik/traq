package tracker

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
)

// DaemonConfig holds configuration for the tracker daemon.
type DaemonConfig struct {
	Interval           time.Duration
	AFKTimeout         time.Duration
	Quality            int
	DuplicateThreshold int
	DataDir            string
}

// DefaultDaemonConfig returns a default configuration.
func DefaultDaemonConfig(dataDir string) *DaemonConfig {
	return &DaemonConfig{
		Interval:           30 * time.Second,
		AFKTimeout:         3 * time.Minute,
		Quality:            80,
		DuplicateThreshold: 3,
		DataDir:            dataDir,
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

	running   bool
	stopCh    chan struct{}
	mu        sync.RWMutex
	lastDHash string
}

// NewDaemon creates a new tracking daemon.
func NewDaemon(config *DaemonConfig, store *storage.Store, plat platform.Platform) (*Daemon, error) {
	capture := NewScreenCapture(config.DataDir, config.Quality)
	capture.SetDuplicateThreshold(config.DuplicateThreshold)

	afk := NewAFKDetector(plat, config.AFKTimeout)
	session := NewSessionManager(store, afk)
	window := NewWindowTracker(plat, store)

	d := &Daemon{
		config:  config,
		store:   store,
		plat:    plat,
		capture: capture,
		window:  window,
		afk:     afk,
		session: session,
		stopCh:  make(chan struct{}),
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

	// Start or resume a session
	if _, err := d.session.StartSession(); err != nil {
		return fmt.Errorf("failed to start session: %w", err)
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

// GetStatus returns the current daemon status.
func (d *Daemon) GetStatus() *DaemonStatus {
	d.mu.RLock()
	defer d.mu.RUnlock()

	return &DaemonStatus{
		Running:         d.running,
		IsAFK:           d.afk.IsAFK(),
		CurrentSession:  d.session.GetCurrentSession(),
		SessionDuration: d.session.GetSessionDuration(),
		IdleDuration:    d.afk.GetIdleDuration(),
	}
}

// DaemonStatus represents the current status of the daemon.
type DaemonStatus struct {
	Running         bool
	IsAFK           bool
	CurrentSession  *storage.Session
	SessionDuration time.Duration
	IdleDuration    time.Duration
}

func (d *Daemon) run() {
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

	// Capture screenshot
	result, err := d.capture.Capture()
	if err != nil {
		// Log error but continue
		return
	}

	// Check for duplicate
	if d.lastDHash != "" {
		similar, _ := d.capture.AreSimilar(d.lastDHash, result.DHash)
		if similar {
			// Skip duplicate screenshot
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
		sc.WindowX = sql.NullInt64{Int64: int64(windowInfo.X), Valid: true}
		sc.WindowY = sql.NullInt64{Int64: int64(windowInfo.Y), Valid: true}
		sc.WindowWidth = sql.NullInt64{Int64: int64(windowInfo.Width), Valid: true}
		sc.WindowHeight = sql.NullInt64{Int64: int64(windowInfo.Height), Valid: true}
	}

	d.store.SaveScreenshot(sc)
}

func (d *Daemon) onAFK() {
	// Flush window focus
	d.window.FlushCurrentFocus()

	// End current session
	d.session.HandleAFK()

	// Clear duplicate detection
	d.lastDHash = ""
}

func (d *Daemon) onReturn() {
	// Start new session
	session, err := d.session.HandleReturn()
	if err != nil {
		return
	}

	// Update window tracker with new session ID
	d.window.UpdateSessionID(session.ID)
}

// UpdateConfig updates the daemon configuration.
func (d *Daemon) UpdateConfig(config *DaemonConfig) {
	d.mu.Lock()
	defer d.mu.Unlock()

	d.config = config
	d.capture.quality = config.Quality
	d.capture.SetDuplicateThreshold(config.DuplicateThreshold)
	d.afk.SetTimeout(config.AFKTimeout)
}

// ForceCapture forces an immediate screenshot capture.
func (d *Daemon) ForceCapture() (*CaptureResult, error) {
	return d.capture.Capture()
}
