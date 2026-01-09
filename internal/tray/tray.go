package tray

import (
	"context"
	_ "embed"
	"sync"

	"fyne.io/systray"
)

//go:embed icon.png
var iconData []byte

// Tray manages the system tray icon and menu.
type Tray struct {
	mu sync.Mutex

	// Callbacks
	onShowWindow  func()
	onQuit        func()
	onPause       func()
	onResume      func()
	onForce       func()

	// State
	isPaused    bool
	isCapturing bool

	// Menu items (for updating state)
	mPauseResume *systray.MenuItem
	mCapturing   *systray.MenuItem

	// Context for shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

// Config holds the configuration for the tray.
type Config struct {
	OnShowWindow func()
	OnQuit       func()
	OnPause      func()
	OnResume     func()
	OnForce      func()
}

// New creates a new Tray instance.
func New(cfg Config) *Tray {
	ctx, cancel := context.WithCancel(context.Background())
	return &Tray{
		onShowWindow: cfg.OnShowWindow,
		onQuit:       cfg.OnQuit,
		onPause:      cfg.OnPause,
		onResume:     cfg.OnResume,
		onForce:      cfg.OnForce,
		isCapturing:  true,
		ctx:          ctx,
		cancel:       cancel,
	}
}

// Run starts the system tray. This blocks, so call it in a goroutine.
// Note: systray.Run must be called from the main thread on some platforms.
func (t *Tray) Run() {
	systray.Run(t.onReady, t.onExit)
}

// RunWithExternalLoop starts the system tray for use with external event loops (like Wails).
// Returns start and end functions that must be called appropriately.
func (t *Tray) RunWithExternalLoop() (start, end func()) {
	return systray.RunWithExternalLoop(t.onReady, t.onExit)
}

// Quit exits the system tray.
func (t *Tray) Quit() {
	t.cancel()
	systray.Quit()
}

// SetPaused updates the pause/resume menu item state.
func (t *Tray) SetPaused(paused bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.isPaused = paused
	if t.mPauseResume != nil {
		if paused {
			t.mPauseResume.SetTitle("Resume Capture")
			t.mPauseResume.SetTooltip("Resume screenshot capture")
		} else {
			t.mPauseResume.SetTitle("Pause Capture")
			t.mPauseResume.SetTooltip("Pause screenshot capture")
		}
	}
}

// SetCapturing updates the capturing status indicator.
func (t *Tray) SetCapturing(capturing bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.isCapturing = capturing
	if t.mCapturing != nil {
		if capturing {
			t.mCapturing.SetTitle("● Capturing")
		} else {
			t.mCapturing.SetTitle("○ Paused")
		}
	}
}

func (t *Tray) onReady() {
	systray.SetIcon(iconData)
	systray.SetTitle("Traq")
	systray.SetTooltip("Traq - Activity Tracker")

	// Status indicator (disabled, just for display)
	t.mCapturing = systray.AddMenuItem("● Capturing", "Current capture status")
	t.mCapturing.Disable()

	systray.AddSeparator()

	// Show Window
	mShow := systray.AddMenuItem("Show Window", "Open the Traq window")

	// Force Capture
	mForce := systray.AddMenuItem("Capture Now", "Take a screenshot immediately")

	// Pause/Resume
	t.mPauseResume = systray.AddMenuItem("Pause Capture", "Pause screenshot capture")

	systray.AddSeparator()

	// Quit
	mQuit := systray.AddMenuItem("Quit", "Exit Traq completely")

	// Handle menu clicks
	go func() {
		for {
			select {
			case <-t.ctx.Done():
				return
			case <-mShow.ClickedCh:
				if t.onShowWindow != nil {
					t.onShowWindow()
				}
			case <-mForce.ClickedCh:
				if t.onForce != nil {
					t.onForce()
				}
			case <-t.mPauseResume.ClickedCh:
				t.mu.Lock()
				paused := t.isPaused
				t.mu.Unlock()
				if paused {
					if t.onResume != nil {
						t.onResume()
					}
				} else {
					if t.onPause != nil {
						t.onPause()
					}
				}
			case <-mQuit.ClickedCh:
				if t.onQuit != nil {
					t.onQuit()
				}
				systray.Quit()
				return
			}
		}
	}()
}

func (t *Tray) onExit() {
	// Cleanup if needed
}
