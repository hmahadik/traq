package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"traq/internal/tracker/shellplugin"
)

func newShellSetupTest(t *testing.T) (*ShellSetupService, string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, ".local", "share"))
	dataDir := filepath.Join(home, ".local", "share", "traq")
	svc := NewShellSetupService(dataDir)
	return svc, home
}

func TestInstall_CreatesPluginAndFencesRcFile(t *testing.T) {
	svc, home := newShellSetupTest(t)

	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("Install: %v", err)
	}

	pluginPath := filepath.Join(home, ".local", "share", "traq", "shell", "plugin.bash")
	if _, err := os.Stat(pluginPath); err != nil {
		t.Errorf("plugin file missing: %v", err)
	}

	rc, err := os.ReadFile(filepath.Join(home, ".bashrc"))
	if err != nil {
		t.Fatalf("read .bashrc: %v", err)
	}
	s := string(rc)
	if !strings.Contains(s, traqFenceStart) || !strings.Contains(s, traqFenceEnd) {
		t.Errorf(".bashrc missing fence: %q", s)
	}
	if !strings.Contains(s, "plugin.bash") {
		t.Errorf(".bashrc missing plugin ref: %q", s)
	}
}

func TestInstall_Idempotent(t *testing.T) {
	svc, home := newShellSetupTest(t)
	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("first install: %v", err)
	}
	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("second install: %v", err)
	}
	rc, _ := os.ReadFile(filepath.Join(home, ".bashrc"))
	count := strings.Count(string(rc), traqFenceStart)
	if count != 1 {
		t.Errorf("fence start appears %d times, want 1: %s", count, rc)
	}
}

func TestUninstall_RestoresRcFile(t *testing.T) {
	svc, home := newShellSetupTest(t)
	rcPath := filepath.Join(home, ".bashrc")
	original := "# user content above\nexport PATH=$PATH:/foo\n"
	if err := os.WriteFile(rcPath, []byte(original), 0600); err != nil {
		t.Fatal(err)
	}

	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatalf("Install: %v", err)
	}
	if err := svc.Uninstall(shellplugin.Bash); err != nil {
		t.Fatalf("Uninstall: %v", err)
	}

	got, _ := os.ReadFile(rcPath)
	if string(got) != original {
		t.Errorf("rc file not restored\nwant: %q\ngot:  %q", original, got)
	}
	pluginPath := filepath.Join(home, ".local", "share", "traq", "shell", "plugin.bash")
	if _, err := os.Stat(pluginPath); !os.IsNotExist(err) {
		t.Errorf("plugin file not deleted")
	}
}

func TestStatus_Transitions(t *testing.T) {
	svc, _ := newShellSetupTest(t)

	st, err := svc.Status(shellplugin.Bash)
	if err != nil {
		t.Fatal(err)
	}
	if st.State != StateNotInstalled {
		t.Errorf("expected NotInstalled, got %s", st.State)
	}

	if err := svc.Install(shellplugin.Bash); err != nil {
		t.Fatal(err)
	}
	// Install enables capture automatically; state should be Active without
	// a separate EnableCapture call.
	st, _ = svc.Status(shellplugin.Bash)
	if st.State != StateActive {
		t.Errorf("expected Active after Install, got %s", st.State)
	}

	svc.DisableCapture()
	st, _ = svc.Status(shellplugin.Bash)
	if st.State != StateInstalledDisabled {
		t.Errorf("expected InstalledDisabled, got %s", st.State)
	}
}

func TestMarkerTiesToConfigToggle(t *testing.T) {
	svc, home := newShellSetupTest(t)
	if err := svc.EnableCapture(); err != nil {
		t.Fatal(err)
	}
	marker := filepath.Join(home, ".local", "share", "traq", "shell", "enabled")
	if _, err := os.Stat(marker); err != nil {
		t.Errorf("marker missing after EnableCapture: %v", err)
	}
	if err := svc.DisableCapture(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(marker); !os.IsNotExist(err) {
		t.Errorf("marker still present after DisableCapture")
	}
}
