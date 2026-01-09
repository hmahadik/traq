//go:build linux

package platform

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Linux implements Platform for Linux systems.
type Linux struct{}

// New returns the platform implementation for Linux.
func New() Platform {
	return &Linux{}
}

// DataDir returns the XDG data directory for traq.
func (l *Linux) DataDir() string {
	if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
		return filepath.Join(dir, "traq")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".local", "share", "traq")
}

// ConfigDir returns the XDG config directory for traq.
func (l *Linux) ConfigDir() string {
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		return filepath.Join(dir, "traq")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "traq")
}

// CacheDir returns the XDG cache directory for traq.
func (l *Linux) CacheDir() string {
	if dir := os.Getenv("XDG_CACHE_HOME"); dir != "" {
		return filepath.Join(dir, "traq")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cache", "traq")
}

// GetActiveWindow returns information about the currently focused window.
func (l *Linux) GetActiveWindow() (*WindowInfo, error) {
	// Get active window ID
	windowID, err := l.getActiveWindowID()
	if err != nil {
		return nil, fmt.Errorf("failed to get active window ID: %w", err)
	}

	info := &WindowInfo{}

	// Get window title
	title, err := l.getWindowTitle(windowID)
	if err == nil {
		info.Title = title
	}

	// Get WM_CLASS (app name and class)
	appName, class, err := l.getWindowClass(windowID)
	if err == nil {
		info.AppName = appName
		info.Class = class
	}

	// Get window geometry
	x, y, w, h, err := l.getWindowGeometry(windowID)
	if err == nil {
		info.X = x
		info.Y = y
		info.Width = w
		info.Height = h
	}

	// Get PID
	pid, err := l.getWindowPID(windowID)
	if err == nil {
		info.PID = pid
	}

	return info, nil
}

func (l *Linux) getActiveWindowID() (string, error) {
	cmd := exec.Command("xdotool", "getactivewindow")
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func (l *Linux) getWindowTitle(windowID string) (string, error) {
	cmd := exec.Command("xdotool", "getwindowname", windowID)
	out, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}

func (l *Linux) getWindowClass(windowID string) (appName, class string, err error) {
	cmd := exec.Command("xprop", "-id", windowID, "WM_CLASS")
	out, err := cmd.Output()
	if err != nil {
		return "", "", err
	}

	// Parse: WM_CLASS(STRING) = "instance", "class"
	line := strings.TrimSpace(string(out))
	if !strings.Contains(line, "=") {
		return "", "", fmt.Errorf("invalid WM_CLASS format")
	}

	parts := strings.SplitN(line, "=", 2)
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid WM_CLASS format")
	}

	values := strings.Split(parts[1], ",")
	if len(values) >= 1 {
		appName = strings.Trim(strings.TrimSpace(values[0]), "\"")
	}
	if len(values) >= 2 {
		class = strings.Trim(strings.TrimSpace(values[1]), "\"")
	}

	return appName, class, nil
}

func (l *Linux) getWindowGeometry(windowID string) (x, y, w, h int, err error) {
	cmd := exec.Command("xdotool", "getwindowgeometry", "--shell", windowID)
	out, err := cmd.Output()
	if err != nil {
		return 0, 0, 0, 0, err
	}

	// Parse shell format: X=..., Y=..., WIDTH=..., HEIGHT=...
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "X=") {
			x, _ = strconv.Atoi(strings.TrimPrefix(line, "X="))
		} else if strings.HasPrefix(line, "Y=") {
			y, _ = strconv.Atoi(strings.TrimPrefix(line, "Y="))
		} else if strings.HasPrefix(line, "WIDTH=") {
			w, _ = strconv.Atoi(strings.TrimPrefix(line, "WIDTH="))
		} else if strings.HasPrefix(line, "HEIGHT=") {
			h, _ = strconv.Atoi(strings.TrimPrefix(line, "HEIGHT="))
		}
	}

	return x, y, w, h, nil
}

func (l *Linux) getWindowPID(windowID string) (int, error) {
	cmd := exec.Command("xdotool", "getwindowpid", windowID)
	out, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	return strconv.Atoi(strings.TrimSpace(string(out)))
}

// GetLastInputTime returns the time of the last user input.
func (l *Linux) GetLastInputTime() (time.Time, error) {
	// Use xprintidle to get idle time in milliseconds
	cmd := exec.Command("xprintidle")
	out, err := cmd.Output()
	if err != nil {
		// Fall back to reading X11 screensaver info
		return l.getLastInputTimeXSS()
	}

	idleMs, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
	if err != nil {
		return time.Time{}, err
	}

	return time.Now().Add(-time.Duration(idleMs) * time.Millisecond), nil
}

func (l *Linux) getLastInputTimeXSS() (time.Time, error) {
	// Fallback using xssstate
	cmd := exec.Command("xssstate", "-i")
	out, err := cmd.Output()
	if err != nil {
		// Last resort: assume not idle
		return time.Now(), nil
	}

	idleMs, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
	if err != nil {
		return time.Now(), nil
	}

	return time.Now().Add(-time.Duration(idleMs) * time.Millisecond), nil
}

// GetShellHistoryPath returns the path to the shell history file.
func (l *Linux) GetShellHistoryPath() string {
	home, _ := os.UserHomeDir()
	shell := l.GetShellType()

	switch shell {
	case "zsh":
		if histFile := os.Getenv("HISTFILE"); histFile != "" {
			return histFile
		}
		return filepath.Join(home, ".zsh_history")
	case "fish":
		return filepath.Join(home, ".local", "share", "fish", "fish_history")
	default: // bash
		if histFile := os.Getenv("HISTFILE"); histFile != "" {
			return histFile
		}
		return filepath.Join(home, ".bash_history")
	}
}

// GetShellType returns the current shell type.
func (l *Linux) GetShellType() string {
	shell := os.Getenv("SHELL")
	if strings.Contains(shell, "zsh") {
		return "zsh"
	}
	if strings.Contains(shell, "fish") {
		return "fish"
	}
	return "bash"
}

// GetBrowserHistoryPaths returns paths to browser history databases.
func (l *Linux) GetBrowserHistoryPaths() map[string]string {
	home, _ := os.UserHomeDir()

	paths := map[string]string{}

	// Chrome
	chromePath := filepath.Join(home, ".config", "google-chrome", "Default", "History")
	if _, err := os.Stat(chromePath); err == nil {
		paths["chrome"] = chromePath
	}

	// Chromium
	chromiumPath := filepath.Join(home, ".config", "chromium", "Default", "History")
	if _, err := os.Stat(chromiumPath); err == nil {
		paths["chromium"] = chromiumPath
	}

	// Firefox - find default profile
	firefoxDir := filepath.Join(home, ".mozilla", "firefox")
	if entries, err := os.ReadDir(firefoxDir); err == nil {
		for _, entry := range entries {
			if entry.IsDir() && strings.HasSuffix(entry.Name(), ".default-release") {
				placesPath := filepath.Join(firefoxDir, entry.Name(), "places.sqlite")
				if _, err := os.Stat(placesPath); err == nil {
					paths["firefox"] = placesPath
					break
				}
			}
		}
	}

	// Brave
	bravePath := filepath.Join(home, ".config", "BraveSoftware", "Brave-Browser", "Default", "History")
	if _, err := os.Stat(bravePath); err == nil {
		paths["brave"] = bravePath
	}

	// Microsoft Edge
	edgePath := filepath.Join(home, ".config", "microsoft-edge", "Default", "History")
	if _, err := os.Stat(edgePath); err == nil {
		paths["edge"] = edgePath
	}

	return paths
}

// OpenURL opens a URL in the default browser.
func (l *Linux) OpenURL(url string) error {
	cmd := exec.Command("xdg-open", url)
	return cmd.Start()
}

// ShowNotification displays a desktop notification.
func (l *Linux) ShowNotification(title, body string) error {
	cmd := exec.Command("notify-send", title, body)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("notify-send failed: %w: %s", err, stderr.String())
	}
	return nil
}

// autostartDesktopPath returns the path to the autostart .desktop file.
func (l *Linux) autostartDesktopPath() string {
	autostartDir := filepath.Join(l.ConfigDir(), "..", "..", "autostart")
	if dir := os.Getenv("XDG_CONFIG_HOME"); dir != "" {
		autostartDir = filepath.Join(dir, "autostart")
	} else {
		home, _ := os.UserHomeDir()
		autostartDir = filepath.Join(home, ".config", "autostart")
	}
	return filepath.Join(autostartDir, "traq.desktop")
}

// SetAutoStart enables or disables autostart on login.
func (l *Linux) SetAutoStart(enabled bool) error {
	desktopPath := l.autostartDesktopPath()

	if !enabled {
		// Remove the desktop file if it exists
		if _, err := os.Stat(desktopPath); err == nil {
			return os.Remove(desktopPath)
		}
		return nil
	}

	// Find the executable path
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Ensure the autostart directory exists
	autostartDir := filepath.Dir(desktopPath)
	if err := os.MkdirAll(autostartDir, 0755); err != nil {
		return fmt.Errorf("failed to create autostart directory: %w", err)
	}

	// Create the .desktop file content
	desktopContent := fmt.Sprintf(`[Desktop Entry]
Type=Application
Name=Traq
Comment=Track your work sessions and productivity
Exec=%s
Icon=traq
Terminal=false
Categories=Utility;
X-GNOME-Autostart-enabled=true
`, execPath)

	// Write the .desktop file
	if err := os.WriteFile(desktopPath, []byte(desktopContent), 0644); err != nil {
		return fmt.Errorf("failed to write autostart desktop file: %w", err)
	}

	return nil
}

// IsAutoStartEnabled checks if autostart is currently enabled.
func (l *Linux) IsAutoStartEnabled() (bool, error) {
	desktopPath := l.autostartDesktopPath()
	_, err := os.Stat(desktopPath)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// GetSystemTheme detects if the system is using dark or light theme.
func (l *Linux) GetSystemTheme() string {
	// Try GNOME/GTK color-scheme setting first
	out, err := exec.Command("gsettings", "get", "org.gnome.desktop.interface", "color-scheme").Output()
	if err == nil {
		result := strings.TrimSpace(string(out))
		if strings.Contains(result, "dark") {
			return "dark"
		}
		if strings.Contains(result, "light") {
			return "light"
		}
	}

	// Try gtk-theme setting as fallback
	out, err = exec.Command("gsettings", "get", "org.gnome.desktop.interface", "gtk-theme").Output()
	if err == nil {
		result := strings.ToLower(strings.TrimSpace(string(out)))
		if strings.Contains(result, "dark") {
			return "dark"
		}
	}

	// Default to light
	return "light"
}
