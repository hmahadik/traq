//go:build darwin

package platform

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// Darwin implements Platform for macOS systems.
type Darwin struct{}

// New returns the platform implementation for macOS.
func New() Platform {
	return &Darwin{}
}

// DataDir returns the Application Support directory for traq.
func (d *Darwin) DataDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "Application Support", "Traq")
}

// ConfigDir returns the config directory (same as DataDir on macOS).
func (d *Darwin) ConfigDir() string {
	return d.DataDir()
}

// CacheDir returns the Caches directory for traq.
func (d *Darwin) CacheDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "Caches", "Traq")
}

// GetActiveWindow returns information about the currently focused window.
// Requires Accessibility permission.
func (d *Darwin) GetActiveWindow() (*WindowInfo, error) {
	// Use AppleScript to get window info
	script := `
		tell application "System Events"
			set frontApp to first application process whose frontmost is true
			set appName to name of frontApp
			set windowTitle to ""
			try
				set windowTitle to name of front window of frontApp
			end try
			return appName & "|" & windowTitle
		end tell
	`
	cmd := exec.Command("osascript", "-e", script)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	parts := strings.SplitN(strings.TrimSpace(string(out)), "|", 2)
	info := &WindowInfo{}
	if len(parts) >= 1 {
		info.AppName = parts[0]
	}
	if len(parts) >= 2 {
		info.Title = parts[1]
	}

	return info, nil
}

// GetLastInputTime returns the time of the last user input.
func (d *Darwin) GetLastInputTime() (time.Time, error) {
	// Use ioreg to get HIDIdleTime
	cmd := exec.Command("ioreg", "-c", "IOHIDSystem", "-d", "4")
	out, err := cmd.Output()
	if err != nil {
		return time.Now(), nil
	}

	// Parse HIDIdleTime from output
	for _, line := range strings.Split(string(out), "\n") {
		if strings.Contains(line, "HIDIdleTime") {
			parts := strings.Split(line, "=")
			if len(parts) == 2 {
				// HIDIdleTime is in nanoseconds
				idleNs := strings.TrimSpace(parts[1])
				// Remove any non-numeric characters
				idleNs = strings.Trim(idleNs, " \t\n\r")
				var idle int64
				if _, err := fmt.Sscanf(idleNs, "%d", &idle); err == nil {
					return time.Now().Add(-time.Duration(idle)), nil
				}
			}
		}
	}

	return time.Now(), nil
}

// GetShellHistoryPath returns the path to the shell history file.
func (d *Darwin) GetShellHistoryPath() string {
	home, _ := os.UserHomeDir()
	shell := d.GetShellType()

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
func (d *Darwin) GetShellType() string {
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
func (d *Darwin) GetBrowserHistoryPaths() map[string]string {
	home, _ := os.UserHomeDir()

	paths := map[string]string{}

	// Chrome
	chromePath := filepath.Join(home, "Library", "Application Support", "Google", "Chrome", "Default", "History")
	if _, err := os.Stat(chromePath); err == nil {
		paths["chrome"] = chromePath
	}

	// Safari
	safariPath := filepath.Join(home, "Library", "Safari", "History.db")
	if _, err := os.Stat(safariPath); err == nil {
		paths["safari"] = safariPath
	}

	// Firefox
	firefoxDir := filepath.Join(home, "Library", "Application Support", "Firefox", "Profiles")
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
	bravePath := filepath.Join(home, "Library", "Application Support", "BraveSoftware", "Brave-Browser", "Default", "History")
	if _, err := os.Stat(bravePath); err == nil {
		paths["brave"] = bravePath
	}

	// Microsoft Edge
	edgePath := filepath.Join(home, "Library", "Application Support", "Microsoft Edge", "Default", "History")
	if _, err := os.Stat(edgePath); err == nil {
		paths["edge"] = edgePath
	}

	return paths
}

// OpenURL opens a URL in the default browser.
func (d *Darwin) OpenURL(url string) error {
	cmd := exec.Command("open", url)
	return cmd.Start()
}

// ShowNotification displays a macOS notification.
func (d *Darwin) ShowNotification(title, body string) error {
	script := `display notification "` + body + `" with title "` + title + `"`
	cmd := exec.Command("osascript", "-e", script)
	return cmd.Run()
}

// launchAgentPath returns the path to the LaunchAgent plist file.
func (d *Darwin) launchAgentPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "LaunchAgents", "com.traq.app.plist")
}

// SetAutoStart enables or disables autostart on login via LaunchAgent.
func (d *Darwin) SetAutoStart(enabled bool) error {
	plistPath := d.launchAgentPath()

	if !enabled {
		// Remove the plist file if it exists
		if _, err := os.Stat(plistPath); err == nil {
			// Unload the agent first
			exec.Command("launchctl", "unload", plistPath).Run()
			return os.Remove(plistPath)
		}
		return nil
	}

	// Find the executable path
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	// Ensure the LaunchAgents directory exists
	launchAgentsDir := filepath.Dir(plistPath)
	if err := os.MkdirAll(launchAgentsDir, 0755); err != nil {
		return fmt.Errorf("failed to create LaunchAgents directory: %w", err)
	}

	// Create the plist content
	plistContent := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.traq.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>%s</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>
`, execPath)

	// Write the plist file
	if err := os.WriteFile(plistPath, []byte(plistContent), 0644); err != nil {
		return fmt.Errorf("failed to write LaunchAgent plist: %w", err)
	}

	// Load the agent
	cmd := exec.Command("launchctl", "load", plistPath)
	if err := cmd.Run(); err != nil {
		// Don't fail if launchctl load fails - the agent will load on next login
		// This commonly happens when the agent is already loaded
	}

	return nil
}

// IsAutoStartEnabled checks if autostart is currently enabled.
func (d *Darwin) IsAutoStartEnabled() (bool, error) {
	plistPath := d.launchAgentPath()
	_, err := os.Stat(plistPath)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// GetSystemTheme detects if the system is using dark or light theme.
func (d *Darwin) GetSystemTheme() string {
	// Use AppleScript to check dark mode
	out, err := exec.Command("defaults", "read", "-g", "AppleInterfaceStyle").Output()
	if err == nil {
		result := strings.TrimSpace(string(out))
		if strings.ToLower(result) == "dark" {
			return "dark"
		}
	}
	// If the key doesn't exist or is empty, system is in light mode
	return "light"
}
