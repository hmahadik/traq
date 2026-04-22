//go:build !windows

package shellplugin

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestZshPlugin_WritesLogLine(t *testing.T) {
	if _, err := exec.LookPath("zsh"); err != nil {
		t.Skip("zsh not installed")
	}

	home := t.TempDir()
	shellDir := filepath.Join(home, ".local", "share", "traq", "shell")
	if err := os.MkdirAll(shellDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(shellDir, "enabled"), []byte{}, 0600); err != nil {
		t.Fatal(err)
	}

	pluginPath := filepath.Join(home, "plugin.zsh")
	script, err := Script(Zsh)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command("zsh", "--no-rcs", "-c",
		`source "$1"; __traq_preexec "echo hello"; __traq_precmd`,
		"--", pluginPath)
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"XDG_DATA_HOME="+filepath.Join(home, ".local", "share"),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("zsh failed: %v\n%s", err, out)
	}

	logBytes, err := os.ReadFile(filepath.Join(shellDir, "history.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if !strings.Contains(string(logBytes), "\tzsh\t") {
		t.Errorf("log missing zsh shell marker: %s", logBytes)
	}
	if !strings.Contains(string(logBytes), "echo hello") {
		t.Errorf("log missing command: %s", logBytes)
	}
}
