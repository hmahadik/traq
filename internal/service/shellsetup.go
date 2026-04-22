package service

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"traq/internal/tracker/shellplugin"
)

const (
	traqFenceStart = "# >>> traq shell integration >>>"
	traqFenceEnd   = "# <<< traq shell integration <<<"
	markerFilename = "enabled"
)

type SetupState string

const (
	StateNotInstalled      SetupState = "not_installed"
	StateActive            SetupState = "active"
	StateInstalledDisabled SetupState = "installed_disabled"
	StateNeedsAttention    SetupState = "needs_attention"
)

type SetupStatus struct {
	Shell      shellplugin.ShellKind `json:"shell"`
	State      SetupState            `json:"state"`
	RcPath     string                `json:"rcPath"`
	PluginPath string                `json:"pluginPath"`
	Overflowed bool                  `json:"overflowed"`
	Message    string                `json:"message"`
}

type ShellSetupService struct {
	dataDir string
}

func NewShellSetupService(dataDir string) *ShellSetupService {
	return &ShellSetupService{dataDir: dataDir}
}

func (s *ShellSetupService) shellDir() string { return filepath.Join(s.dataDir, "shell") }
func (s *ShellSetupService) markerPath() string {
	return filepath.Join(s.shellDir(), markerFilename)
}
func (s *ShellSetupService) overflowPath() string {
	return filepath.Join(s.shellDir(), "overflowed")
}
func (s *ShellSetupService) pluginPath(kind shellplugin.ShellKind) string {
	return filepath.Join(s.shellDir(), shellplugin.Filename(kind))
}

func (s *ShellSetupService) rcPathFor(kind shellplugin.ShellKind) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	switch kind {
	case shellplugin.Bash:
		return filepath.Join(home, ".bashrc"), nil
	case shellplugin.Zsh:
		return filepath.Join(home, ".zshrc"), nil
	case shellplugin.Fish:
		return filepath.Join(home, ".config", "fish", "config.fish"), nil
	case shellplugin.PowerShell:
		return filepath.Join(home, "Documents", "PowerShell", "Microsoft.PowerShell_profile.ps1"), nil
	}
	return "", errors.New("unsupported shell")
}

func sourceLine(kind shellplugin.ShellKind, pluginPath string) string {
	switch kind {
	case shellplugin.Bash, shellplugin.Zsh:
		return fmt.Sprintf(`[ -f %q ] && . %q`, pluginPath, pluginPath)
	case shellplugin.Fish:
		return fmt.Sprintf(`test -f %q; and source %q`, pluginPath, pluginPath)
	case shellplugin.PowerShell:
		return fmt.Sprintf(`if (Test-Path %q) { . %q }`, pluginPath, pluginPath)
	}
	return ""
}

func (s *ShellSetupService) Install(kind shellplugin.ShellKind) error {
	script, err := shellplugin.Script(kind)
	if err != nil {
		return fmt.Errorf("load plugin script: %w", err)
	}
	if err := os.MkdirAll(s.shellDir(), 0700); err != nil {
		return fmt.Errorf("create shell dir: %w", err)
	}
	pluginPath := s.pluginPath(kind)
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		return fmt.Errorf("write plugin: %w", err)
	}

	rcPath, err := s.rcPathFor(kind)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(rcPath), 0755); err != nil {
		return fmt.Errorf("create rc dir: %w", err)
	}

	block := strings.Join([]string{
		traqFenceStart,
		"# Managed by Traq. Do not edit between these fences.",
		sourceLine(kind, pluginPath),
		traqFenceEnd,
	}, "\n")

	if err := upsertFencedBlock(rcPath, block); err != nil {
		return fmt.Errorf("update rc file: %w", err)
	}
	return nil
}

func (s *ShellSetupService) Uninstall(kind shellplugin.ShellKind) error {
	rcPath, err := s.rcPathFor(kind)
	if err != nil {
		return err
	}
	if err := removeFencedBlock(rcPath); err != nil {
		return fmt.Errorf("update rc file: %w", err)
	}
	if err := os.Remove(s.pluginPath(kind)); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove plugin: %w", err)
	}
	return nil
}

func (s *ShellSetupService) EnableCapture() error {
	if err := os.MkdirAll(s.shellDir(), 0700); err != nil {
		return err
	}
	f, err := os.OpenFile(s.markerPath(), os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	return f.Close()
}

func (s *ShellSetupService) DisableCapture() error {
	if err := os.Remove(s.markerPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

// DismissOverflow removes the overflow sentinel file.
func (s *ShellSetupService) DismissOverflow() error {
	if err := os.Remove(s.overflowPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}

func (s *ShellSetupService) Status(kind shellplugin.ShellKind) (*SetupStatus, error) {
	rcPath, err := s.rcPathFor(kind)
	if err != nil {
		return nil, err
	}
	pluginPath := s.pluginPath(kind)

	rcHasFence := false
	if data, err := os.ReadFile(rcPath); err == nil {
		rcHasFence = bytes.Contains(data, []byte(traqFenceStart))
	}
	pluginExists := fileExists(pluginPath)
	markerExists := fileExists(s.markerPath())
	overflow := fileExists(s.overflowPath())

	status := &SetupStatus{
		Shell: kind, RcPath: rcPath, PluginPath: pluginPath, Overflowed: overflow,
	}
	switch {
	case rcHasFence && pluginExists && markerExists:
		status.State = StateActive
		status.Message = ""
	case rcHasFence && pluginExists && !markerExists:
		status.State = StateInstalledDisabled
		status.Message = "Plugin installed but idle. Enable Shell History to resume."
	case rcHasFence && !pluginExists:
		status.State = StateNeedsAttention
		status.Message = "Plugin file missing. Reinstall."
	case !rcHasFence:
		status.State = StateNotInstalled
		status.Message = "Install the Traq plugin for real-time capture across tmux and multiple terminals."
	}
	if overflow && status.State == StateActive {
		status.State = StateNeedsAttention
		status.Message = "Shell log hit size limit while Traq was idle. Some commands may be missing."
	}
	return status, nil
}

func fileExists(p string) bool {
	_, err := os.Stat(p)
	return err == nil
}

// upsertFencedBlock atomically replaces or appends the fenced block in rcPath.
func upsertFencedBlock(rcPath, block string) error {
	existing, err := os.ReadFile(rcPath)
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	var out bytes.Buffer
	if bytes.Contains(existing, []byte(traqFenceStart)) {
		scanner := bufio.NewScanner(bytes.NewReader(existing))
		scanner.Buffer(make([]byte, 64*1024), 1024*1024)
		inside := false
		for scanner.Scan() {
			line := scanner.Text()
			switch {
			case !inside && strings.TrimSpace(line) == traqFenceStart:
				inside = true
				out.WriteString(block)
				out.WriteByte('\n')
			case inside && strings.TrimSpace(line) == traqFenceEnd:
				inside = false
			case !inside:
				out.WriteString(line)
				out.WriteByte('\n')
			}
		}
	} else {
		out.Write(existing)
		if len(existing) > 0 && !bytes.HasSuffix(existing, []byte("\n")) {
			out.WriteByte('\n')
		}
		out.WriteString(block)
		out.WriteByte('\n')
	}

	return atomicWriteFile(rcPath, out.Bytes(), 0600)
}

func removeFencedBlock(rcPath string) error {
	data, err := os.ReadFile(rcPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if !bytes.Contains(data, []byte(traqFenceStart)) {
		return nil
	}
	var out bytes.Buffer
	scanner := bufio.NewScanner(bytes.NewReader(data))
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	inside := false
	for scanner.Scan() {
		line := scanner.Text()
		switch {
		case !inside && strings.TrimSpace(line) == traqFenceStart:
			inside = true
		case inside && strings.TrimSpace(line) == traqFenceEnd:
			inside = false
		case !inside:
			out.WriteString(line)
			out.WriteByte('\n')
		}
	}
	return atomicWriteFile(rcPath, out.Bytes(), 0600)
}

func atomicWriteFile(path string, data []byte, perm os.FileMode) error {
	dir := filepath.Dir(path)
	tmp, err := os.CreateTemp(dir, filepath.Base(path)+".traq.*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)

	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Chmod(tmpPath, perm); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}
