package aiagent

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// withFakeEnv points resolveCLI at a temp home directory and makes the PATH
// lookup fail, simulating a GUI launch whose PATH lacks ~/.local/bin.
func withFakeEnv(t *testing.T) string {
	t.Helper()
	if runtime.GOOS == "windows" {
		t.Skip("fallback directories are Unix-specific")
	}
	home := t.TempDir()
	origHome, origLook := userHomeDir, lookPath
	userHomeDir = func() (string, error) { return home, nil }
	lookPath = func(file string) (string, error) {
		if strings.ContainsRune(file, filepath.Separator) {
			return exec.LookPath(file) // absolute candidate: check the real file
		}
		return "", exec.ErrNotFound // bare name: simulate a minimal PATH
	}
	t.Cleanup(func() { userHomeDir, lookPath = origHome, origLook })
	return home
}

func writeExecutable(t *testing.T, path string, mode os.FileMode) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("#!/bin/sh\n"), mode); err != nil {
		t.Fatal(err)
	}
}

func TestResolveCLI_PrefersPATH(t *testing.T) {
	withFakeEnv(t)
	lookPath = func(file string) (string, error) { return "/usr/bin/" + file, nil }
	got, ok := resolveCLI("claude")
	if !ok || got != "/usr/bin/claude" {
		t.Fatalf("resolveCLI = %q, %v; want /usr/bin/claude, true", got, ok)
	}
}

func TestResolveCLI_FallsBackToLocalBin(t *testing.T) {
	home := withFakeEnv(t)
	want := filepath.Join(home, ".local", "bin", "claude")
	writeExecutable(t, want, 0o755)
	got, ok := resolveCLI("claude")
	if !ok || got != want {
		t.Fatalf("resolveCLI = %q, %v; want %q, true", got, ok, want)
	}
}

func TestResolveCLI_FindsOpenCodeInstallDir(t *testing.T) {
	home := withFakeEnv(t)
	want := filepath.Join(home, ".opencode", "bin", "opencode")
	writeExecutable(t, want, 0o755)
	got, ok := resolveCLI("opencode")
	if !ok || got != want {
		t.Fatalf("resolveCLI = %q, %v; want %q, true", got, ok, want)
	}
}

func TestResolveCLI_PicksNewestNvmNode(t *testing.T) {
	home := withFakeEnv(t)
	writeExecutable(t, filepath.Join(home, ".nvm", "versions", "node", "v9.11.2", "bin", "claude"), 0o755)
	want := filepath.Join(home, ".nvm", "versions", "node", "v20.19.2", "bin", "claude")
	writeExecutable(t, want, 0o755)
	got, ok := resolveCLI("claude")
	if !ok || got != want {
		t.Fatalf("resolveCLI = %q, %v; want %q, true", got, ok, want)
	}
}

func TestResolveCLI_IgnoresNonExecutable(t *testing.T) {
	home := withFakeEnv(t)
	writeExecutable(t, filepath.Join(home, ".local", "bin", "claude"), 0o644)
	if got, ok := resolveCLI("claude"); ok {
		t.Fatalf("resolveCLI = %q, true; want not found", got)
	}
}

func TestResolveCLI_NotFound(t *testing.T) {
	withFakeEnv(t)
	if got, ok := resolveCLI("claude"); ok {
		t.Fatalf("resolveCLI = %q, true; want not found", got)
	}
}

func TestResolveCLI_NoHomeDir(t *testing.T) {
	withFakeEnv(t)
	userHomeDir = func() (string, error) { return "", errors.New("no home") }
	if _, ok := resolveCLI("claude"); ok {
		t.Fatal("expected not found when home dir is unknown")
	}
}

func TestClaudeGenerator_UsesResolvedPathAndExtendsPATH(t *testing.T) {
	home := withFakeEnv(t)
	bin := filepath.Join(home, ".local", "bin", "claude")
	writeExecutable(t, bin, 0o755)

	g := NewClaudeGenerator()
	if !g.Available() {
		t.Fatal("Available should be true when claude is in ~/.local/bin")
	}
	var gotName string
	var gotCmd *exec.Cmd
	g.commandFunc = func(ctx context.Context, name string, args ...string) *exec.Cmd {
		gotName = name
		gotCmd = exec.CommandContext(ctx, "echo", "ok")
		return gotCmd
	}
	if _, err := g.GenerateRaw(context.Background(), "hi"); err != nil {
		t.Fatalf("GenerateRaw: %v", err)
	}
	if gotName != bin {
		t.Errorf("command name = %q, want %q", gotName, bin)
	}
	if path := envValue(gotCmd.Env, "PATH"); !strings.HasPrefix(path, filepath.Dir(bin)+string(os.PathListSeparator)) {
		t.Errorf("child PATH = %q, want it to start with %q", path, filepath.Dir(bin))
	}
}

func envValue(env []string, key string) string {
	for _, kv := range env {
		if strings.HasPrefix(kv, key+"=") {
			return strings.TrimPrefix(kv, key+"=")
		}
	}
	return ""
}
