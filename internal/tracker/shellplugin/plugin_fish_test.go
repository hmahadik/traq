//go:build !windows

package shellplugin

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestFishPlugin_WritesLogLine(t *testing.T) {
	if _, err := exec.LookPath("fish"); err != nil {
		t.Skip("fish not installed")
	}

	home := t.TempDir()
	shellDir := filepath.Join(home, ".local", "share", "traq", "shell")
	if err := os.MkdirAll(shellDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(shellDir, "enabled"), []byte{}, 0600); err != nil {
		t.Fatal(err)
	}

	pluginPath := filepath.Join(home, "plugin.fish")
	script, err := Script(Fish)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command("fish", "--no-config", "-c",
		`source $argv[1]; emit fish_preexec "echo hello"; emit fish_postexec "echo hello"`,
		pluginPath)
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"XDG_DATA_HOME="+filepath.Join(home, ".local", "share"),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("fish failed: %v\n%s", err, out)
	}

	logBytes, err := os.ReadFile(filepath.Join(shellDir, "history.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if !strings.Contains(string(logBytes), "\tfish\t") {
		t.Errorf("log missing fish shell marker: %s", logBytes)
	}
}
