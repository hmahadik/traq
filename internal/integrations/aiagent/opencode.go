package aiagent

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// OpenCodeGenerator invokes the `opencode` CLI in `run` (non-interactive) mode.
type OpenCodeGenerator struct {
	commandFunc func(ctx context.Context, name string, args ...string) *exec.Cmd
}

func NewOpenCodeGenerator() *OpenCodeGenerator {
	return &OpenCodeGenerator{commandFunc: exec.CommandContext}
}

func (g *OpenCodeGenerator) Name() string { return "opencode" }

func (g *OpenCodeGenerator) Available() bool {
	_, err := exec.LookPath("opencode")
	return err == nil
}

// ansiRE strips terminal color/control sequences from CLI output.
var ansiRE = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func (g *OpenCodeGenerator) Generate(ctx context.Context, in Input) (*Output, error) {
	prompt := BuildPrompt(in)
	start := time.Now()
	cmd := g.commandFunc(ctx, "opencode", "run", prompt)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("opencode invocation failed: %w (stderr: %s)", err, strings.TrimSpace(stderr.String()))
	}
	cleaned := ansiRE.ReplaceAllString(stdout.String(), "")
	return &Output{
		Notes:      strings.TrimSpace(cleaned),
		Tool:       "opencode",
		DurationMS: time.Since(start).Milliseconds(),
	}, nil
}
