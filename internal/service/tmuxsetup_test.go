package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTmuxSetupTest(t *testing.T) (*TmuxSetupService, string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	// Force the classic ~/.tmux.conf path by unsetting XDG_CONFIG_HOME and
	// not pre-creating ~/.config/tmux. confPath() prefers existing files,
	// so this gives us a deterministic target.
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, ".config"))
	return NewTmuxSetupService(), home
}

func TestTmuxInstall_WritesFencedBlockToTmuxConf(t *testing.T) {
	svc, home := newTmuxSetupTest(t)

	if err := svc.Install(); err != nil {
		t.Fatalf("Install: %v", err)
	}

	confPath := filepath.Join(home, ".tmux.conf")
	data, err := os.ReadFile(confPath)
	if err != nil {
		t.Fatalf("read tmux.conf: %v", err)
	}
	s := string(data)
	if !strings.Contains(s, traqTmuxFenceStart) || !strings.Contains(s, traqTmuxFenceEnd) {
		t.Errorf("tmux.conf missing fence: %q", s)
	}
	if !strings.Contains(s, "set-titles on") {
		t.Errorf("tmux.conf missing set-titles directive: %q", s)
	}
	if !strings.Contains(s, "#{pane_title}") {
		t.Errorf("tmux.conf missing pane_title binding: %q", s)
	}
}

func TestTmuxInstall_PreservesExistingConfig(t *testing.T) {
	svc, home := newTmuxSetupTest(t)
	confPath := filepath.Join(home, ".tmux.conf")
	preexisting := "set -g mouse on\nset -g status-position top\n"
	if err := os.WriteFile(confPath, []byte(preexisting), 0o644); err != nil {
		t.Fatalf("seed tmux.conf: %v", err)
	}

	if err := svc.Install(); err != nil {
		t.Fatalf("Install: %v", err)
	}
	data, _ := os.ReadFile(confPath)
	s := string(data)
	if !strings.Contains(s, "set -g mouse on") || !strings.Contains(s, "set -g status-position top") {
		t.Errorf("install clobbered existing config: %q", s)
	}
	if !strings.Contains(s, traqTmuxFenceStart) {
		t.Errorf("install didn't add fence")
	}
}

func TestTmuxInstall_Idempotent(t *testing.T) {
	svc, home := newTmuxSetupTest(t)

	if err := svc.Install(); err != nil {
		t.Fatalf("first Install: %v", err)
	}
	if err := svc.Install(); err != nil {
		t.Fatalf("second Install: %v", err)
	}

	data, _ := os.ReadFile(filepath.Join(home, ".tmux.conf"))
	count := strings.Count(string(data), traqTmuxFenceStart)
	if count != 1 {
		t.Errorf("fence appears %d times after two installs, want 1", count)
	}
}

func TestTmuxUninstall_RemovesOnlyOurBlock(t *testing.T) {
	svc, home := newTmuxSetupTest(t)
	confPath := filepath.Join(home, ".tmux.conf")
	preexisting := "set -g mouse on\n"
	if err := os.WriteFile(confPath, []byte(preexisting), 0o644); err != nil {
		t.Fatalf("seed: %v", err)
	}

	if err := svc.Install(); err != nil {
		t.Fatalf("Install: %v", err)
	}
	if err := svc.Uninstall(); err != nil {
		t.Fatalf("Uninstall: %v", err)
	}
	data, _ := os.ReadFile(confPath)
	s := string(data)
	if strings.Contains(s, traqTmuxFenceStart) {
		t.Errorf("uninstall left fence in place: %q", s)
	}
	if !strings.Contains(s, "set -g mouse on") {
		t.Errorf("uninstall removed unrelated config: %q", s)
	}
}

func TestTmuxStatus_ReportsActiveAfterInstall(t *testing.T) {
	svc, _ := newTmuxSetupTest(t)

	if err := svc.Install(); err != nil {
		t.Fatalf("Install: %v", err)
	}

	st, err := svc.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	// Test environment may or may not have tmux on PATH. State depends:
	// - tmux installed → StateActive after Install
	// - tmux missing   → StateNeedsAttention (fence present without binary)
	if st.State != StateActive && st.State != StateNeedsAttention {
		t.Errorf("State = %q, want active or needs_attention", st.State)
	}
}

func TestTmuxStatus_ReportsNotInstalledOnVirginConfig(t *testing.T) {
	svc, _ := newTmuxSetupTest(t)
	st, err := svc.Status()
	if err != nil {
		t.Fatalf("Status: %v", err)
	}
	if st.State != StateNotInstalled {
		t.Errorf("State = %q, want not_installed", st.State)
	}
}
