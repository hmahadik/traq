package tracker

import (
	"os"
	"path/filepath"
	"testing"
)

func TestShellTracker_PollReadsPluginLogWhenPresent(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer store.Close()
	defer os.RemoveAll(tmpDir)

	pluginDir := filepath.Join(tmpDir, "shell")
	if err := os.MkdirAll(pluginDir, 0700); err != nil {
		t.Fatal(err)
	}
	logPath := filepath.Join(pluginDir, "history.log")
	content := "1\t1745000000\t0\t10\t/tmp\tmain:1\thost\tbash\tls -la\n"
	if err := os.WriteFile(logPath, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	plat := &mockPlatformShell{shellType: "bash", historyPath: "/nonexistent/history_file"}
	tracker := NewShellTracker(plat, store, tmpDir)

	saved, err := tracker.Poll(0)
	if err != nil {
		t.Fatalf("Poll: %v", err)
	}
	if len(saved) != 1 {
		t.Fatalf("expected 1 command, got %d", len(saved))
	}
	if saved[0].Command != "ls -la" {
		t.Errorf("Command: got %q", saved[0].Command)
	}
	if !saved[0].TmuxContext.Valid || saved[0].TmuxContext.String != "main:1" {
		t.Errorf("TmuxContext: got %+v", saved[0].TmuxContext)
	}
	info, _ := os.Stat(logPath)
	if info.Size() != 0 {
		t.Errorf("log not truncated")
	}
}

func TestShellTracker_PollFallsBackToNativeHistory(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer store.Close()
	defer os.RemoveAll(tmpDir)

	histFile := filepath.Join(tmpDir, ".bash_history")
	content := "#1745000000\nvim foo.go\n"
	if err := os.WriteFile(histFile, []byte(content), 0600); err != nil {
		t.Fatal(err)
	}

	plat := &mockPlatformShell{shellType: "bash", historyPath: histFile}
	tracker := NewShellTracker(plat, store, tmpDir)

	saved, err := tracker.Poll(0)
	if err != nil {
		t.Fatalf("Poll: %v", err)
	}
	if len(saved) != 1 || saved[0].Command != "vim foo.go" {
		t.Fatalf("unexpected saved: %+v", saved)
	}
	if saved[0].TmuxContext.Valid {
		t.Errorf("native history should not populate tmux_context")
	}
}
