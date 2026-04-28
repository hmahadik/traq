package aiagent

import (
	"context"
	"errors"
	"os/exec"
	"strings"
	"testing"
)

func TestBuildPrompt_IncludesAllSections(t *testing.T) {
	in := Input{
		Project:      "traq",
		Date:         "2026-04-28",
		Hours:        2.5,
		WindowTitles: []string{"VS Code — main.go"},
		AISummaries:  []string{"Refactored reports.go"},
		GitCommits:   []string{"refactor(reports): split"},
	}
	p := BuildPrompt(in)
	for _, want := range []string{"traq", "2026-04-28", "2.50", "Refactored reports.go", "refactor(reports): split"} {
		if !strings.Contains(p, want) {
			t.Errorf("prompt missing %q", want)
		}
	}
}

func TestBuildPrompt_WindowTitlesOnlyWhenNoOtherContext(t *testing.T) {
	inWithOnlyWindows := Input{
		Project:      "x", Date: "2026-04-28", Hours: 1.0,
		WindowTitles: []string{"Some window"},
	}
	inWithSummaries := Input{
		Project:      "x", Date: "2026-04-28", Hours: 1.0,
		WindowTitles: []string{"Some window"},
		AISummaries:  []string{"Did a thing"},
	}
	if !strings.Contains(BuildPrompt(inWithOnlyWindows), "Some window") {
		t.Error("expected window titles when no summaries/commits")
	}
	if strings.Contains(BuildPrompt(inWithSummaries), "Some window") {
		t.Error("did not expect window titles when summaries are present")
	}
}

// fakeCommandContext returns a *exec.Cmd that runs `echo` with a fixed string.
// Used to test the subprocess-wrapping code without depending on actual CLIs.
func fakeCommandContext(output string) func(ctx context.Context, name string, args ...string) *exec.Cmd {
	return func(ctx context.Context, name string, args ...string) *exec.Cmd {
		return exec.CommandContext(ctx, "echo", output)
	}
}

func TestClaudeGenerator_Generate_Success(t *testing.T) {
	g := NewClaudeGenerator()
	g.commandFunc = fakeCommandContext("Worked on Project X for two and a half hours.")
	out, err := g.Generate(context.Background(), Input{Project: "x", Date: "d", Hours: 1})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if out.Tool != "claude" {
		t.Errorf("Tool = %q, want claude", out.Tool)
	}
	if !strings.Contains(out.Notes, "two and a half hours") {
		t.Errorf("Notes = %q, missing expected text", out.Notes)
	}
	if out.DurationMS < 0 {
		t.Errorf("DurationMS negative: %d", out.DurationMS)
	}
}

func TestOpenCodeGenerator_Generate_StripsANSI(t *testing.T) {
	g := NewOpenCodeGenerator()
	// ANSI-colored output the way opencode might decorate things.
	g.commandFunc = fakeCommandContext("\x1b[31mRed text\x1b[0m followed by clean text")
	out, err := g.Generate(context.Background(), Input{Project: "x", Date: "d", Hours: 1})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if strings.Contains(out.Notes, "\x1b[") {
		t.Errorf("ANSI not stripped: %q", out.Notes)
	}
	if !strings.Contains(out.Notes, "Red text") {
		t.Errorf("missing expected text after strip: %q", out.Notes)
	}
}

// fakeGenerator implements Generator for AutoGenerator tests.
type fakeGenerator struct {
	name      string
	available bool
	out       *Output
	err       error
}

func (f *fakeGenerator) Name() string         { return f.name }
func (f *fakeGenerator) Available() bool      { return f.available }
func (f *fakeGenerator) Generate(ctx context.Context, in Input) (*Output, error) {
	return f.out, f.err
}

func TestAutoGenerator_PicksFirstAvailable(t *testing.T) {
	a := &fakeGenerator{name: "a", available: false}
	b := &fakeGenerator{name: "b", available: true, out: &Output{Tool: "b", Notes: "ok"}}
	auto := NewAutoGenerator(a, b)
	if !auto.Available() {
		t.Fatal("Available should be true")
	}
	out, err := auto.Generate(context.Background(), Input{})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if out.Tool != "b" {
		t.Errorf("Tool = %q, want b", out.Tool)
	}
}

func TestAutoGenerator_ErrorsWhenNoneAvailable(t *testing.T) {
	a := &fakeGenerator{name: "a", available: false}
	b := &fakeGenerator{name: "b", available: false}
	auto := NewAutoGenerator(a, b)
	if auto.Available() {
		t.Fatal("Available should be false")
	}
	_, err := auto.Generate(context.Background(), Input{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "no AI agent") {
		t.Errorf("error message = %q", err.Error())
	}
}

// Compile-time interface conformance checks.
var (
	_ Generator = (*ClaudeGenerator)(nil)
	_ Generator = (*OpenCodeGenerator)(nil)
	_ Generator = (*AutoGenerator)(nil)
	_ Generator = (*fakeGenerator)(nil)
	_           = errors.New
)
