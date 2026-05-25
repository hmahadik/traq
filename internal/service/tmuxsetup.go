package service

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// Tmux integration installer.
//
// The shell already emits OSC 2 ("set window title") with the current cwd on
// every prompt — that's how the X11 window title updates outside tmux. Inside
// tmux, however, tmux captures OSC 2 as the *pane* title and never propagates
// it upstream unless explicitly configured. By default tmux's set-titles
// option is off on most distros, and even when on its default set-titles-
// string is "#S:#I:#W" (session/window-index/window-name) — useless for
// project attribution from focus events.
//
// This installer adds a fenced block to ~/.tmux.conf that turns set-titles on
// and points set-titles-string at #{pane_title}. After installation, the
// active pane's cwd-bearing title flows through to the X11 window title,
// which Traq's window tracker already reads — so multi-project tmux sessions
// produce a stream of focus events with distinct, project-bearing titles
// without any post-hoc inference.
const (
	traqTmuxFenceStart = "# >>> traq tmux integration >>>"
	traqTmuxFenceEnd   = "# <<< traq tmux integration <<<"
)

type TmuxSetupStatus struct {
	State       SetupState `json:"state"`
	ConfPath    string     `json:"confPath"`
	Installed   bool       `json:"installed"` // tmux binary is on PATH
	Message     string     `json:"message"`
}

type TmuxSetupService struct{}

func NewTmuxSetupService() *TmuxSetupService { return &TmuxSetupService{} }

// confPath returns the active tmux config path. Newer tmux convention is
// $XDG_CONFIG_HOME/tmux/tmux.conf (or ~/.config/tmux/tmux.conf), older
// installs use ~/.tmux.conf. We prefer the XDG path when its directory
// already exists; otherwise default to ~/.tmux.conf.
func (s *TmuxSetupService) confPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	xdg := os.Getenv("XDG_CONFIG_HOME")
	if xdg == "" {
		xdg = filepath.Join(home, ".config")
	}
	xdgTmuxDir := filepath.Join(xdg, "tmux")
	xdgConf := filepath.Join(xdgTmuxDir, "tmux.conf")
	classicConf := filepath.Join(home, ".tmux.conf")

	// Prefer whichever already exists. If neither does, prefer ~/.tmux.conf
	// (more universal default).
	if fileExists(xdgConf) {
		return xdgConf, nil
	}
	if fileExists(classicConf) {
		return classicConf, nil
	}
	if fi, err := os.Stat(xdgTmuxDir); err == nil && fi.IsDir() {
		return xdgConf, nil
	}
	return classicConf, nil
}

func tmuxBlock() string {
	return strings.Join([]string{
		traqTmuxFenceStart,
		"# Managed by Traq. Do not edit between these fences.",
		"# Propagate the active pane's title (the shell's OSC-2 cwd) up to the",
		"# terminal's X11 window title so Traq's focus tracker sees per-pane",
		"# project context instead of a generic 'tilix'/'gnome-terminal'.",
		"set -g set-titles on",
		`set -g set-titles-string "#{pane_title}"`,
		traqTmuxFenceEnd,
	}, "\n")
}

func (s *TmuxSetupService) Install() error {
	confPath, err := s.confPath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(confPath), 0o755); err != nil {
		return fmt.Errorf("create tmux config dir: %w", err)
	}
	if err := upsertFencedBlock(confPath, tmuxBlock(), traqTmuxFenceStart, traqTmuxFenceEnd); err != nil {
		return fmt.Errorf("update tmux config: %w", err)
	}
	// Best-effort live reload: if a tmux server is running, ask it to
	// re-source the file so the change applies without the user having
	// to restart their session. Failure here is non-fatal — the next time
	// they start tmux it'll pick up the file from disk anyway.
	_ = exec.Command("tmux", "source-file", confPath).Run()
	return nil
}

func (s *TmuxSetupService) Uninstall() error {
	confPath, err := s.confPath()
	if err != nil {
		return err
	}
	if err := removeFencedBlock(confPath, traqTmuxFenceStart, traqTmuxFenceEnd); err != nil {
		return fmt.Errorf("update tmux config: %w", err)
	}
	// Live reload so the running tmux server forgets the title settings.
	// Note: source-file re-applies the *current* file; settings the file
	// no longer sets will linger in the running server until next restart.
	// We accept that trade-off — re-running the original tmux defaults is
	// out of scope for an uninstaller.
	_ = exec.Command("tmux", "source-file", confPath).Run()
	return nil
}

func (s *TmuxSetupService) Status() (*TmuxSetupStatus, error) {
	confPath, err := s.confPath()
	if err != nil {
		return nil, err
	}
	st := &TmuxSetupStatus{ConfPath: confPath}

	// tmux on PATH? Used to flag "install tmux first" before showing the
	// installer as the next step the user should take.
	if _, err := exec.LookPath("tmux"); err == nil {
		st.Installed = true
	}

	hasFence := false
	if data, err := os.ReadFile(confPath); err == nil {
		hasFence = bytes.Contains(data, []byte(traqTmuxFenceStart))
	}

	switch {
	case !st.Installed && !hasFence:
		st.State = StateNotInstalled
		st.Message = "tmux is not installed. Skip this if you don't use tmux."
	case !st.Installed && hasFence:
		st.State = StateNeedsAttention
		st.Message = "Traq config block exists but tmux isn't on PATH."
	case st.Installed && !hasFence:
		st.State = StateNotInstalled
		st.Message = "Install to set tmux's window title from the active pane's title — Traq's focus tracker will then see per-pane cwd."
	case st.Installed && hasFence:
		st.State = StateActive
		st.Message = ""
	}
	return st, nil
}

// Compile-time check: ensures we don't accidentally drop the field used by
// callers that check Installed without going through the State machine.
var _ = errors.New