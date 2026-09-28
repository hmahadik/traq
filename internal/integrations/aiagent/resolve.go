package aiagent

import (
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// Overridable in tests.
var (
	lookPath    = exec.LookPath
	userHomeDir = os.UserHomeDir
)

// resolveCLI returns the absolute path of the named CLI. It checks PATH
// first, then well-known per-user install locations.
//
// The fallback matters because Traq is usually launched by the desktop
// session (autostart / .desktop entry / AppImage), not from a shell. Such
// processes inherit the session's minimal PATH, which typically lacks
// ~/.local/bin (the Claude Code native installer's target) and
// ~/.opencode/bin — those are only added by interactive shell rc files.
//
// Resolution is not cached so a CLI installed while Traq is running is
// picked up without a restart.
func resolveCLI(name string) (string, bool) {
	if p, err := lookPath(name); err == nil {
		return p, true
	}
	home, err := userHomeDir()
	if err != nil || home == "" {
		return "", false
	}
	for _, dir := range fallbackDirs(home) {
		if p, err := lookPath(filepath.Join(dir, name)); err == nil {
			return p, true
		}
	}
	return "", false
}

// fallbackDirs lists directories where claude/opencode are commonly
// installed, in priority order.
func fallbackDirs(home string) []string {
	dirs := []string{
		filepath.Join(home, ".local", "bin"),      // Claude Code native installer
		filepath.Join(home, ".claude", "local"),   // Claude Code legacy local install
		filepath.Join(home, ".opencode", "bin"),   // OpenCode installer
		filepath.Join(home, ".npm-global", "bin"), // npm prefix=~/.npm-global
		filepath.Join(home, ".bun", "bin"),
		filepath.Join(home, "bin"),
		"/usr/local/bin",
		"/opt/homebrew/bin", // macOS GUI apps don't see Homebrew's PATH
	}
	return append(dirs, nvmBinDirs(home)...)
}

// nvmBinDirs returns ~/.nvm/versions/node/*/bin, newest Node version first.
func nvmBinDirs(home string) []string {
	matches, _ := filepath.Glob(filepath.Join(home, ".nvm", "versions", "node", "v*", "bin"))
	sort.Slice(matches, func(i, j int) bool {
		return versionLess(nodeVersion(matches[j]), nodeVersion(matches[i]))
	})
	return matches
}

// nodeVersion extracts [major, minor, patch] from .../node/vX.Y.Z/bin.
func nodeVersion(binDir string) []int {
	v := strings.TrimPrefix(filepath.Base(filepath.Dir(binDir)), "v")
	var parts []int
	for _, s := range strings.Split(v, ".") {
		n, _ := strconv.Atoi(s)
		parts = append(parts, n)
	}
	return parts
}

func versionLess(a, b []int) bool {
	for i := 0; i < len(a) && i < len(b); i++ {
		if a[i] != b[i] {
			return a[i] < b[i]
		}
	}
	return len(a) < len(b)
}

// commandEnv returns the current environment with the CLI's own directory
// prepended to PATH. npm-installed CLIs are `#!/usr/bin/env node` scripts,
// and under nvm the node binary lives next to them — so without this the
// resolved script would still fail to start from a GUI-launched Traq.
func commandEnv(bin string) []string {
	dir := filepath.Dir(bin)
	env := os.Environ()
	for i, kv := range env {
		if strings.HasPrefix(kv, "PATH=") {
			env[i] = "PATH=" + dir + string(os.PathListSeparator) + strings.TrimPrefix(kv, "PATH=")
			return env
		}
	}
	return append(env, "PATH="+dir)
}
