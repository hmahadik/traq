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

// GenerateRaw runs `claude --bare -p <prompt>` and returns trimmed stdout.
// Used by callers that build their own prompt structure (e.g. session
// summary) and don't fit the timesheet-notes Input/Output shape.
func (g *ClaudeGenerator) GenerateRaw(ctx context.Context, prompt string) (string, error) {
	cmd := g.commandFunc(ctx, "claude", "--bare", "-p", prompt)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("claude invocation failed: %w (stderr: %s)", err, strings.TrimSpace(stderr.String()))
	}
	return strings.TrimSpace(stdout.String()), nil
}
