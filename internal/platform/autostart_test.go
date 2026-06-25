//go:build linux

package platform

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// When running as an AppImage, os.Executable() points at the ephemeral FUSE
// mount (/tmp/.mount_*). autostartExecPath must prefer $APPIMAGE so the
// autostart entry survives a reboot.
func TestAutostartExecPath_PrefersAppImage(t *testing.T) {
	const appImage = "/home/user/AppImages/traq.appimage"
	t.Setenv("APPIMAGE", appImage)

	got, err := autostartExecPath()
	if err != nil {
		t.Fatalf("autostartExecPath() error = %v", err)
	}
	if got != appImage {
		t.Errorf("autostartExecPath() = %q, want %q", got, appImage)
	}
}

// Without $APPIMAGE (e.g. a plain binary install) it falls back to the real
// executable path and must not return the empty string.
func TestAutostartExecPath_FallsBackToExecutable(t *testing.T) {
	t.Setenv("APPIMAGE", "")

	got, err := autostartExecPath()
	if err != nil {
		t.Fatalf("autostartExecPath() error = %v", err)
	}
	if got == "" {
		t.Fatal("autostartExecPath() returned empty path")
	}
	if strings.HasPrefix(got, "/tmp/.mount_") {
		t.Errorf("fallback returned an ephemeral mount path: %q", got)
	}
}

// SetAutoStart must bake the stable $APPIMAGE path into the .desktop Exec line,
// not the /tmp mount path.
func TestSetAutoStart_WritesStableExecPath(t *testing.T) {
	const appImage = "/home/user/AppImages/traq.appimage"
	configHome := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", configHome)
	t.Setenv("APPIMAGE", appImage)

	l := &Linux{}
	if err := l.SetAutoStart(true); err != nil {
		t.Fatalf("SetAutoStart(true) error = %v", err)
	}

	desktopPath := filepath.Join(configHome, "autostart", "traq.desktop")
	data, err := os.ReadFile(desktopPath)
	if err != nil {
		t.Fatalf("reading autostart desktop file: %v", err)
	}
	content := string(data)

	if !strings.Contains(content, "Exec="+appImage+"\n") {
		t.Errorf("autostart Exec line missing stable path; got:\n%s", content)
	}
	if strings.Contains(content, "/tmp/.mount_") {
		t.Errorf("autostart entry leaked an ephemeral mount path:\n%s", content)
	}

	// And disabling removes the file again.
	if err := l.SetAutoStart(false); err != nil {
		t.Fatalf("SetAutoStart(false) error = %v", err)
	}
	if _, err := os.Stat(desktopPath); !os.IsNotExist(err) {
		t.Errorf("expected desktop file removed, stat err = %v", err)
	}
}
