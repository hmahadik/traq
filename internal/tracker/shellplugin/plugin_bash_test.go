//go:build !windows

package shellplugin

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestBashPlugin_WritesLogLine(t *testing.T) {
	if _, err := exec.LookPath("bash"); err != nil {
		t.Skip("bash not installed")
	}

	home := t.TempDir()
	shellDir := filepath.Join(home, ".local", "share", "traq", "shell")
	if err := os.MkdirAll(shellDir, 0700); err != nil {
		t.Fatal(err)
	}
	// Marker present → plugin should log
	if err := os.WriteFile(filepath.Join(shellDir, "enabled"), []byte{}, 0600); err != nil {
		t.Fatal(err)
	}

	pluginPath := filepath.Join(home, "plugin.bash")
	script, err := Script(Bash)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(pluginPath, script, 0600); err != nil {
		t.Fatal(err)
	}

	// Run bash interactively-ish: source the plugin, run one command, exit.
	cmd := exec.Command("bash", "--noprofile", "--norc", "-c",
		`set -o history; HISTFILE=/dev/null; source "$1"; echo hello; `+
			`# PROMPT_COMMAND only fires at prompt; invoke hook manually:
			__traq_hook`,
		"--", pluginPath)
	cmd.Env = append(os.Environ(),
		"HOME="+home,
		"XDG_DATA_HOME="+filepath.Join(home, ".local", "share"),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("bash failed: %v\n%s", err, out)
	}

	logBytes, err := os.ReadFile(filepath.Join(shellDir, "history.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if !strings.Contains(string(logBytes), "\tbash\t") {
		t.Errorf("log missing bash shell marker: %s", logBytes)
	}
	if !strings.Contains(string(logBytes), "echo hello") {
		t.Errorf("log missing command: %s", logBytes)
	}
}
