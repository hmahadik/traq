//go:build linux

package platform

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jezek/xgb"
	"github.com/jezek/xgb/screensaver"
	"github.com/jezek/xgb/xproto"
)

// Linux implements Platform for Linux systems.
type Linux struct {
	x11Conn      *xgb.Conn
	x11Root      xproto.Window
	x11InitOnce  sync.Once
	x11InitErr   error
	x11Atoms     x11Atoms
	x11AtomsOnce sync.Once
	x11AtomsErr  error
}

// x11Atoms caches interned atom IDs needed for window inspection.
// Atoms are stable for the connection lifetime, so a one-time intern is enough.
type x11Atoms struct {
	netActiveWindow xproto.Atom
	netWmName       xproto.Atom
	netWmPid        xproto.Atom
	wmName          xproto.Atom
	wmClass         xproto.Atom
}

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
// Returns (nil, nil) when no window currently has focus (e.g. user is on an
// empty desktop) — callers should treat that as "no change to record".
func (l *Linux) GetActiveWindow() (*WindowInfo, error) {
	l.initX11()
	if l.x11InitErr != nil {
		return nil, l.x11InitErr
	}
	if err := l.initAtoms(); err != nil {
		return nil, err
	}

	winID, err := l.getActiveWindowID()
	if err != nil {
		return nil, fmt.Errorf("get active window: %w", err)
	}
	if winID == 0 {
		return nil, nil
	}

	info := &WindowInfo{}
	info.Title = l.getWindowTitle(winID)
	info.AppName, info.Class = l.getWindowClass(winID)
	info.PID = l.getWindowPID(winID)
	info.X, info.Y, info.Width, info.Height = l.getWindowGeometry(winID)
	return info, nil
}

// initAtoms interns the X11 atoms we need. Atom IDs are stable per connection,
// so this only needs to run once.
func (l *Linux) initAtoms() error {
	l.x11AtomsOnce.Do(func() {
		entries := []struct {
			name string
			out  *xproto.Atom
		}{
			{"_NET_ACTIVE_WINDOW", &l.x11Atoms.netActiveWindow},
			{"_NET_WM_NAME", &l.x11Atoms.netWmName},
			{"_NET_WM_PID", &l.x11Atoms.netWmPid},
			{"WM_NAME", &l.x11Atoms.wmName},
			{"WM_CLASS", &l.x11Atoms.wmClass},
		}
		for _, e := range entries {
			r, err := xproto.InternAtom(l.x11Conn, false, uint16(len(e.name)), e.name).Reply()
			if err != nil {
				l.x11AtomsErr = fmt.Errorf("intern atom %s: %w", e.name, err)
				return
			}
			*e.out = r.Atom
		}
	})
	return l.x11AtomsErr
}

func (l *Linux) getActiveWindowID() (xproto.Window, error) {
	reply, err := xproto.GetProperty(l.x11Conn, false, l.x11Root,
		l.x11Atoms.netActiveWindow, xproto.AtomWindow, 0, 1).Reply()
	if err != nil {
		return 0, err
	}
	if len(reply.Value) < 4 {
		return 0, nil
	}
	return xproto.Window(binary.LittleEndian.Uint32(reply.Value)), nil
}

// getStringProp reads a string-like property using AtomAny so we accept either
// STRING (latin-1) or UTF8_STRING — different apps set _NET_WM_NAME under
// different types and we want to be permissive.
func (l *Linux) getStringProp(win xproto.Window, atom xproto.Atom) string {
	reply, err := xproto.GetProperty(l.x11Conn, false, win, atom,
		xproto.GetPropertyTypeAny, 0, 4096).Reply()
	if err != nil || len(reply.Value) == 0 {
		return ""
	}
	return string(bytes.TrimRight(reply.Value, "\x00"))
}

func (l *Linux) getWindowTitle(win xproto.Window) string {
	if v := l.getStringProp(win, l.x11Atoms.netWmName); v != "" {
		return v
	}
	return l.getStringProp(win, l.x11Atoms.wmName)
}

func (l *Linux) getWindowClass(win xproto.Window) (appName, class string) {
	reply, err := xproto.GetProperty(l.x11Conn, false, win,
		l.x11Atoms.wmClass, xproto.GetPropertyTypeAny, 0, 1024).Reply()
	if err != nil || len(reply.Value) == 0 {
		return "", ""
	}
	// WM_CLASS is two consecutive null-terminated strings: instance\0class\0
	parts := bytes.SplitN(reply.Value, []byte{0}, 3)
	if len(parts) >= 1 {
		appName = string(parts[0])
	}
	if len(parts) >= 2 {
		class = string(parts[1])
	}
	return
}

func (l *Linux) getWindowPID(win xproto.Window) int {
	reply, err := xproto.GetProperty(l.x11Conn, false, win,
		l.x11Atoms.netWmPid, xproto.AtomCardinal, 0, 1).Reply()
	if err != nil || len(reply.Value) < 4 {
		return 0
	}
	return int(binary.LittleEndian.Uint32(reply.Value))
}

func (l *Linux) getWindowGeometry(win xproto.Window) (x, y, w, h int) {
	geom, err := xproto.GetGeometry(l.x11Conn, xproto.Drawable(win)).Reply()
	if err != nil {
		return 0, 0, 0, 0
	}
	// GetGeometry returns coordinates relative to the window's parent.
	// Translate to root for absolute screen coordinates (matches xdotool's behavior).
	if trans, terr := xproto.TranslateCoordinates(l.x11Conn, win, l.x11Root, 0, 0).Reply(); terr == nil {
		return int(trans.DstX), int(trans.DstY), int(geom.Width), int(geom.Height)
	}
	return int(geom.X), int(geom.Y), int(geom.Width), int(geom.Height)
}

func (l *Linux) initX11() {
	l.x11InitOnce.Do(func() {
		conn, err := xgb.NewConn()
		if err != nil {
			l.x11InitErr = fmt.Errorf("failed to connect to X11: %w", err)
			return
		}

		if err := screensaver.Init(conn); err != nil {
			conn.Close()
			l.x11InitErr = fmt.Errorf("failed to init screensaver extension: %w", err)
			return
		}

		setup := xproto.Setup(conn)
		l.x11Root = setup.DefaultScreen(conn).Root
		l.x11Conn = conn
	})
}

// GetLastInputTime returns the time of the last user input.
func (l *Linux) GetLastInputTime() (time.Time, error) {
	l.initX11()

	if l.x11Conn != nil {
		info, err := screensaver.QueryInfo(l.x11Conn, xproto.Drawable(l.x11Root)).Reply()
		if err == nil {
			return time.Now().Add(-time.Duration(info.MsSinceUserInput) * time.Millisecond), nil
		}
	}

	if out, err := exec.Command("xprintidle").Output(); err == nil {
		if idleMs, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64); err == nil {
			return time.Now().Add(-time.Duration(idleMs) * time.Millisecond), nil
		}
	}

	if l.x11InitErr != nil {
		return time.Time{}, l.x11InitErr
	}
	return time.Time{}, fmt.Errorf("unable to detect idle time: X11 screensaver extension unavailable and xprintidle not installed")
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
