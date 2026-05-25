package service

import (
	"context"
	"fmt"
	"strings"

	"traq/internal/inference"
	"traq/internal/integrations/aiagent"
)

// NotesBackend abstracts "given a notes input bundle, return a single
// paragraph of plain text" so the timesheet pipeline can route through
// either an external CLI agent or the local inference engine without the
// caller knowing which.
//
// The contract is intentionally narrow: take a fully-built Input, return
// a string. Caching, error formatting, and retry are the timesheet layer's
// concern, not the backend's.
type NotesBackend interface {
	Name() string
	Generate(ctx context.Context, in aiagent.Input) (string, error)
}

// agentNotesBackend adapts an aiagent.Generator (claude / opencode CLI)
// to the NotesBackend interface. The generator already knows how to build
// the prompt and parse its own output; we just unwrap the Notes field.
type agentNotesBackend struct {
	gen aiagent.Generator
}

func NewAgentNotesBackend(gen aiagent.Generator) NotesBackend {
	return &agentNotesBackend{gen: gen}
}

func (b *agentNotesBackend) Name() string { return "agent:" + b.gen.Name() }

func (b *agentNotesBackend) Generate(ctx context.Context, in aiagent.Input) (string, error) {
	out, err := b.gen.Generate(ctx, in)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(out.Notes), nil
}

// inferenceNotesBackend adapts the local inference.Service to the
// NotesBackend interface. Reuses aiagent.BuildPrompt so the prompt
// contract is identical to the CLI path — only the transport differs.
type inferenceNotesBackend struct {
	svc *inference.Service
}

func NewInferenceNotesBackend(svc *inference.Service) NotesBackend {
	return &inferenceNotesBackend{svc: svc}
}

func (b *inferenceNotesBackend) Name() string { return "inference" }

func (b *inferenceNotesBackend) Generate(ctx context.Context, in aiagent.Input) (string, error) {
	if b.svc == nil {
		return "", fmt.Errorf("inference service is nil")
	}
	prompt := aiagent.BuildPrompt(in)
	raw, err := b.svc.CompletePrompt(prompt)
	if err != nil {
		return "", err
	}
	// CompletePrompt returns whatever the model produced — for chat-template
	// backends that's already the assistant's reply. Trim incidental
	// whitespace; anything else (e.g. accidental JSON) is the user's
	// problem and surfaces in the preview.
	return strings.TrimSpace(raw), nil
}
