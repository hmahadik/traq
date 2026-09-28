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
	_, ok := resolveCLI("opencode")
	return ok
}

// ansiRE strips terminal color/control sequences from CLI output.
var ansiRE = regexp.MustCompile(`\x1b\[[0-9;]*[a-zA-Z]`)

func (g *OpenCodeGenerator) Generate(ctx context.Context, in Input) (*Output, error) {
	start := time.Now()
	out, err := g.GenerateRaw(ctx, BuildPrompt(in))
	if err != nil {
		return nil, err
	}
	return &Output{
		Notes:      out,
		Tool:       "opencode",
		DurationMS: time.Since(start).Milliseconds(),
	}, nil
}

// GenerateRaw runs `opencode run <prompt>` and returns trimmed, ANSI-stripped
// stdout. Used by callers that build their own prompt structure.
func (g *OpenCodeGenerator) GenerateRaw(ctx context.Context, prompt string) (string, error) {
	bin, ok := resolveCLI("opencode")
	if !ok {
		bin = "opencode" // let exec report the not-found error
	}
	cmd := g.commandFunc(ctx, bin, "run", prompt)
	cmd.Env = commandEnv(bin)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("opencode invocation failed: %w (stderr: %s)", err, strings.TrimSpace(stderr.String()))
	}
	cleaned := ansiRE.ReplaceAllString(stdout.String(), "")
	return strings.TrimSpace(cleaned), nil
}
