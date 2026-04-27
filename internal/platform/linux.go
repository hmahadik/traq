//go:build linux

package platform

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
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
//
// The X11 connection is established lazily on first use and re-established on
// demand if it drops (display restart, xwayland crash, etc.). All access to
// the connection state goes through ensureX11 / resetX11 under x11Mu.
type Linux struct {
	x11Mu    sync.Mutex
	x11Conn  *xgb.Conn
	x11Root  xproto.Window
	x11Atoms x11Atoms
	x11Ready bool
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
	conn, root, atoms, err := l.snapshotX11()
	if err != nil {
		return nil, err
	}

	winID, err := getActiveWindowID(conn, root, atoms)
	if err != nil {
		l.handleXErr(err)
		return nil, fmt.Errorf("get active window: %w", err)
	}
	if winID == 0 {
		return nil, nil
	}

	info := &WindowInfo{}
	info.Title = getWindowTitle(conn, winID, atoms)
	info.AppName, info.Class = getWindowClass(conn, winID, atoms)
	info.PID = getWindowPID(conn, winID, atoms)
	info.X, info.Y, info.Width, info.Height = getWindowGeometry(conn, root, winID)
	return info, nil
}

// snapshotX11 returns a coherent snapshot of the X11 connection, root window,
// and interned atoms under the lock. Callers must use the returned values for
// the rest of the operation — reading l.x11Conn / l.x11Root / l.x11Atoms
// directly after the lock is released is a data race with concurrent
// resetX11 calls (tracker poll + AFK detector run on independent intervals).
//
// If a reset happens while the caller is mid-operation with the snapshot,
// the underlying xgb.Conn will be closed and in-flight Reply() calls return
// io.EOF; handleXErr picks that up as the reconnect trigger for the next
// snapshotX11 call.
func (l *Linux) snapshotX11() (*xgb.Conn, xproto.Window, x11Atoms, error) {
	l.x11Mu.Lock()
	defer l.x11Mu.Unlock()
	if l.x11Ready {
		return l.x11Conn, l.x11Root, l.x11Atoms, nil
	}

	conn, err := xgb.NewConn()
	if err != nil {
		return nil, 0, x11Atoms{}, fmt.Errorf("connect to X11: %w", err)
	}
	if err := screensaver.Init(conn); err != nil {
		conn.Close()
		return nil, 0, x11Atoms{}, fmt.Errorf("init screensaver extension: %w", err)
	}

	atoms, err := internAtoms(conn)
	if err != nil {
		conn.Close()
		return nil, 0, x11Atoms{}, err
	}

	setup := xproto.Setup(conn)
	l.x11Conn = conn
	l.x11Root = setup.DefaultScreen(conn).Root
	l.x11Atoms = atoms
	l.x11Ready = true
	return l.x11Conn, l.x11Root, l.x11Atoms, nil
}

// resetX11 marks the X11 connection as dead so the next ensureX11 call
// re-dials. Call when an operation returns io.EOF (xgb's signal for a
// closed connection — e.g. X server restart, XWayland crash, display logout).
func (l *Linux) resetX11() {
	l.x11Mu.Lock()
	defer l.x11Mu.Unlock()
	if l.x11Conn != nil {
		l.x11Conn.Close()
		l.x11Conn = nil
	}
	l.x11Ready = false
}

// handleXErr resets the connection if err indicates it's dead. xgb signals
// connection death by returning io.EOF from Reply() when its internal
// read goroutine has exited. Protocol errors (bad window, missing property)
// surface as other error types and do not warrant a reconnect.
func (l *Linux) handleXErr(err error) {
	if err == nil {
		return
	}
	if errors.Is(err, io.EOF) {
		l.resetX11()
	}
}

// internAtoms interns the X11 atoms we need. Atom IDs are stable for the
// lifetime of a single connection, so we intern once per ensureX11 call.
func internAtoms(conn *xgb.Conn) (x11Atoms, error) {
	var a x11Atoms
	entries := []struct {
		name string
		out  *xproto.Atom
	}{
		{"_NET_ACTIVE_WINDOW", &a.netActiveWindow},
		{"_NET_WM_NAME", &a.netWmName},
		{"_NET_WM_PID", &a.netWmPid},
		{"WM_NAME", &a.wmName},
		{"WM_CLASS", &a.wmClass},
	}
	for _, e := range entries {
		r, err := xproto.InternAtom(conn, false, uint16(len(e.name)), e.name).Reply()
		if err != nil {
			return x11Atoms{}, fmt.Errorf("intern atom %s: %w", e.name, err)
		}
		*e.out = r.Atom
	}
	return a, nil
}

func getActiveWindowID(conn *xgb.Conn, root xproto.Window, atoms x11Atoms) (xproto.Window, error) {
	reply, err := xproto.GetProperty(conn, false, root,
		atoms.netActiveWindow, xproto.AtomWindow, 0, 1).Reply()
	if err != nil {
		return 0, err
	}
	return parseWindowID(reply.Value), nil
}

// parseWindowID extracts an X window ID from the raw 4-byte property value.
// Returns 0 when the property is unset or truncated.
//
// X11 property values arrive in the byte order negotiated at connection
// setup. xgb always requests little-endian during the handshake, so we
// decode little-endian here regardless of host CPU endianness.
func parseWindowID(b []byte) xproto.Window {
	if len(b) < 4 {
		return 0
	}
	return xproto.Window(binary.LittleEndian.Uint32(b))
}

// getStringProp reads a string-like property using AtomAny so we accept either
// STRING (latin-1) or UTF8_STRING — different apps set _NET_WM_NAME under
// different types and we want to be permissive.
func getStringProp(conn *xgb.Conn, win xproto.Window, atom xproto.Atom) string {
	reply, err := xproto.GetProperty(conn, false, win, atom,
		xproto.GetPropertyTypeAny, 0, 4096).Reply()
	if err != nil || len(reply.Value) == 0 {
		return ""
	}
	return string(bytes.TrimRight(reply.Value, "\x00"))
}

func getWindowTitle(conn *xgb.Conn, win xproto.Window, atoms x11Atoms) string {
	if v := getStringProp(conn, win, atoms.netWmName); v != "" {
		return v
	}
	return getStringProp(conn, win, atoms.wmName)
}

func getWindowClass(conn *xgb.Conn, win xproto.Window, atoms x11Atoms) (appName, class string) {
	reply, err := xproto.GetProperty(conn, false, win,
		atoms.wmClass, xproto.GetPropertyTypeAny, 0, 1024).Reply()
	if err != nil {
		return "", ""
	}
	return parseWmClass(reply.Value)
}

// parseWmClass splits the WM_CLASS property, which is two consecutive
// null-terminated strings in the form "instance\0class\0".
func parseWmClass(b []byte) (appName, class string) {
	if len(b) == 0 {
		return "", ""
	}
	parts := bytes.SplitN(b, []byte{0}, 3)
	if len(parts) >= 1 {
		appName = string(parts[0])
	}
	if len(parts) >= 2 {
		class = string(parts[1])
	}
	return
}

func getWindowPID(conn *xgb.Conn, win xproto.Window, atoms x11Atoms) int {
	reply, err := xproto.GetProperty(conn, false, win,
		atoms.netWmPid, xproto.AtomCardinal, 0, 1).Reply()
	if err != nil {
		return 0
	}
	return parseCardinal(reply.Value)
}

// parseCardinal decodes a 4-byte little-endian X CARDINAL (used by
// _NET_WM_PID and similar numeric properties). See parseWindowID for the
// endianness rationale.
func parseCardinal(b []byte) int {
	if len(b) < 4 {
		return 0
	}
	return int(binary.LittleEndian.Uint32(b))
}

func getWindowGeometry(conn *xgb.Conn, root xproto.Window, win xproto.Window) (x, y, w, h int) {
	geom, err := xproto.GetGeometry(conn, xproto.Drawable(win)).Reply()
	if err != nil {
		return 0, 0, 0, 0
	}
	// GetGeometry returns coordinates relative to the window's parent.
	// Translate to root for absolute screen coordinates (matches xdotool's behavior).
	if trans, terr := xproto.TranslateCoordinates(conn, win, root, 0, 0).Reply(); terr == nil {
		return int(trans.DstX), int(trans.DstY), int(geom.Width), int(geom.Height)
	}
	return int(geom.X), int(geom.Y), int(geom.Width), int(geom.Height)
}

// GetLastInputTime returns the time of the last user input.
func (l *Linux) GetLastInputTime() (time.Time, error) {
	conn, root, _, initErr := l.snapshotX11()

	if initErr == nil {
		info, err := screensaver.QueryInfo(conn, xproto.Drawable(root)).Reply()
		if err == nil {
			return time.Now().Add(-time.Duration(info.MsSinceUserInput) * time.Millisecond), nil
		}
		l.handleXErr(err)
	}

	if out, err := exec.Command("xprintidle").Output(); err == nil {
		if idleMs, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64); err == nil {
			return time.Now().Add(-time.Duration(idleMs) * time.Millisecond), nil
		}
	}

	if initErr != nil {
		return time.Time{}, initErr
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
