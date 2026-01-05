//go:build windows

package platform

import (
	"os"
	"path/filepath"
	"time"
)

// Windows implements Platform for Windows systems.
type Windows struct{}

// New returns the platform implementation for Windows.
func New() Platform {
	return &Windows{}
}

// DataDir returns the AppData directory for traq.
func (w *Windows) DataDir() string {
	if dir := os.Getenv("APPDATA"); dir != "" {
		return filepath.Join(dir, "Traq")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "AppData", "Roaming", "Traq")
}

// ConfigDir returns the config directory (same as DataDir on Windows).
func (w *Windows) ConfigDir() string {
	return w.DataDir()
}

// CacheDir returns the LocalAppData directory for traq cache.
func (w *Windows) CacheDir() string {
	if dir := os.Getenv("LOCALAPPDATA"); dir != "" {
		return filepath.Join(dir, "Traq", "Cache")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "AppData", "Local", "Traq", "Cache")
}

// GetActiveWindow returns information about the currently focused window.
// TODO: Implement using Win32 API (GetForegroundWindow, GetWindowText, etc.)
func (w *Windows) GetActiveWindow() (*WindowInfo, error) {
	// Placeholder - requires Win32 API calls
	return &WindowInfo{
		Title:   "Unknown",
		AppName: "Unknown",
	}, nil
}

// GetLastInputTime returns the time of the last user input.
// TODO: Implement using GetLastInputInfo Win32 API
func (w *Windows) GetLastInputTime() (time.Time, error) {
	// Placeholder - requires Win32 API
	return time.Now(), nil
}

// GetShellHistoryPath returns the path to PowerShell history.
func (w *Windows) GetShellHistoryPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "AppData", "Roaming", "Microsoft", "Windows", "PowerShell", "PSReadLine", "ConsoleHost_history.txt")
}

// GetShellType returns the shell type.
func (w *Windows) GetShellType() string {
	return "powershell"
}

// GetBrowserHistoryPaths returns paths to browser history databases.
func (w *Windows) GetBrowserHistoryPaths() map[string]string {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		home, _ := os.UserHomeDir()
		localAppData = filepath.Join(home, "AppData", "Local")
	}

	paths := map[string]string{}

	// Chrome
	chromePath := filepath.Join(localAppData, "Google", "Chrome", "User Data", "Default", "History")
	if _, err := os.Stat(chromePath); err == nil {
		paths["chrome"] = chromePath
	}

	// Edge
	edgePath := filepath.Join(localAppData, "Microsoft", "Edge", "User Data", "Default", "History")
	if _, err := os.Stat(edgePath); err == nil {
		paths["edge"] = edgePath
	}

	// Firefox
	appData := os.Getenv("APPDATA")
	if appData != "" {
		firefoxDir := filepath.Join(appData, "Mozilla", "Firefox", "Profiles")
		if entries, err := os.ReadDir(firefoxDir); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					placesPath := filepath.Join(firefoxDir, entry.Name(), "places.sqlite")
					if _, err := os.Stat(placesPath); err == nil {
						paths["firefox"] = placesPath
						break
					}
				}
			}
		}
	}

	return paths
}

// OpenURL opens a URL in the default browser.
func (w *Windows) OpenURL(url string) error {
	// TODO: Use ShellExecute or start command
	return nil
}

// ShowNotification displays a toast notification.
func (w *Windows) ShowNotification(title, body string) error {
	// TODO: Use Windows toast notifications
	return nil
}
