package platform

import (
	"time"
)

// Platform defines the interface for platform-specific operations.
type Platform interface {
	// Paths
	DataDir() string   // Where to store data.db, screenshots
	ConfigDir() string // Where to store config.yaml
	CacheDir() string  // Where to store model files

	// Window Information
	GetActiveWindow() (*WindowInfo, error)

	// Input Monitoring
	GetLastInputTime() (time.Time, error)

	// Shell
	GetShellHistoryPath() string
	GetShellType() string

	// Browser
	GetBrowserHistoryPaths() map[string]string // browser -> path

	// System
	OpenURL(url string) error
	ShowNotification(title, body string) error
}

// WindowInfo contains information about a window.
type WindowInfo struct {
	Title    string
	AppName  string
	Class    string
	PID      int
	X, Y     int
	Width    int
	Height   int
	Monitor  string
}

// New returns the platform implementation for the current OS.
// This is implemented in platform-specific files.
