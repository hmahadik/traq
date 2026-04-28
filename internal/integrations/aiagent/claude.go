package aiagent

import (
	"bytes"
	"context"
	"fmt"
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
	prompt := BuildPrompt(in)
	start := time.Now()
	cmd := g.commandFunc(ctx, "claude", "--bare", "-p", prompt)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("claude invocation failed: %w (stderr: %s)", err, strings.TrimSpace(stderr.String()))
	}
	return &Output{
		Notes:      strings.TrimSpace(stdout.String()),
		Tool:       "claude",
		DurationMS: time.Since(start).Milliseconds(),
	}, nil
}
