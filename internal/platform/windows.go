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

	// Brave
	bravePath := filepath.Join(localAppData, "BraveSoftware", "Brave-Browser", "User Data", "Default", "History")
	if _, err := os.Stat(bravePath); err == nil {
		paths["brave"] = bravePath
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

// startupShortcutPath returns the path to the startup shortcut.
func (w *Windows) startupShortcutPath() string {
	startupDir := os.Getenv("APPDATA")
	if startupDir == "" {
		home, _ := os.UserHomeDir()
		startupDir = filepath.Join(home, "AppData", "Roaming")
	}
	return filepath.Join(startupDir, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "Traq.lnk")
}

// SetAutoStart enables or disables autostart on login.
// On Windows, this creates/removes a shortcut in the Startup folder.
// Note: Full implementation would use Windows registry or create a proper .lnk file.
func (w *Windows) SetAutoStart(enabled bool) error {
	// TODO: Implement Windows autostart using registry key
	// HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
	// or create .lnk shortcut in Startup folder
	return nil
}

// IsAutoStartEnabled checks if autostart is currently enabled.
func (w *Windows) IsAutoStartEnabled() (bool, error) {
	// TODO: Check Windows registry or Startup folder
	shortcutPath := w.startupShortcutPath()
	_, err := os.Stat(shortcutPath)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// GetSystemTheme detects if the system is using dark or light theme.
func (w *Windows) GetSystemTheme() string {
	// Check registry for AppsUseLightTheme
	// reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" /v AppsUseLightTheme
	out, err := exec.Command("reg", "query",
		`HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize`,
		"/v", "AppsUseLightTheme").Output()
	if err == nil {
		result := string(out)
		// If AppsUseLightTheme is 0, it's dark mode
		if strings.Contains(result, "0x0") {
			return "dark"
		}
	}
	return "light"
}
