package aiagent

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

// ClaudeGenerator invokes the `claude` CLI in --bare -p (non-interactive) mode.
type ClaudeGenerator struct {
	// commandFunc is overridable in tests. Defaults to exec.CommandContext.
	commandFunc func(ctx context.Context, name string, args ...string) *exec.Cmd
}

func NewClaudeGenerator() *ClaudeGenerator {
	return &ClaudeGenerator{commandFunc: exec.CommandContext}
}

func (g *ClaudeGenerator) Name() string { return "claude" }

func (g *ClaudeGenerator) Available() bool {
	_, err := exec.LookPath("claude")
	return err == nil
}

func (g *ClaudeGenerator) Generate(ctx context.Context, in Input) (*Output, error) {
	start := time.Now()
	out, err := g.GenerateRaw(ctx, BuildPrompt(in))
	if err != nil {
		return nil, err
	}
	return &Output{
		Notes:      out,
		Tool:       "claude",
		DurationMS: time.Since(start).Milliseconds(),
	}, nil
}

// GenerateRaw runs `claude -p <prompt>` and returns trimmed stdout.
//
// We deliberately do NOT pass --bare: that flag forces Anthropic auth to
// strictly use ANTHROPIC_API_KEY / apiKeyHelper and skips OAuth + keychain,
// which immediately fails for users authenticated via Claude Code's normal
// `claude login` flow (the common case). Plain `-p` honors whichever auth
// the user has configured.
//
// The command runs from a temp directory so CLAUDE.md / hooks / settings
// from the user's working tree don't leak into the prompt context — Traq
// is asking Claude to summarize Traq's own session data, not to read its
// own source code repo.
func (g *ClaudeGenerator) GenerateRaw(ctx context.Context, prompt string) (string, error) {
	cmd := g.commandFunc(ctx, "claude", "-p", prompt)
	cmd.Dir = os.TempDir()
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("claude invocation failed: %w (stderr: %s)", err, strings.TrimSpace(stderr.String()))
	}
	return strings.TrimSpace(stdout.String()), nil
}
