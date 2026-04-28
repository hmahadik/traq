package aiagent

import (
	"context"
	"errors"
)

// AutoGenerator picks the first available CLI in priority order: claude, opencode.
type AutoGenerator struct {
	generators []Generator
}

// NewAutoGenerator returns a generator that picks the first available CLI.
// Pass explicit generators to control priority (useful in tests). With no args,
// defaults to ClaudeGenerator then OpenCodeGenerator.
func NewAutoGenerator(gens ...Generator) *AutoGenerator {
	if len(gens) == 0 {
		gens = []Generator{NewClaudeGenerator(), NewOpenCodeGenerator()}
	}
	return &AutoGenerator{generators: gens}
}

func (g *AutoGenerator) Name() string { return "auto" }

func (g *AutoGenerator) Available() bool {
	for _, sub := range g.generators {
		if sub.Available() {
			return true
		}
	}
	return false
}

func (g *AutoGenerator) Generate(ctx context.Context, in Input) (*Output, error) {
	for _, sub := range g.generators {
		if sub.Available() {
			return sub.Generate(ctx, in)
		}
	}
	return nil, errors.New("no AI agent CLI is available on PATH (install claude or opencode)")
}
