// Package aiagent invokes a coding-agent CLI (Claude Code or OpenCode) to
// generate FunctionFox-style daily summaries from Traq activity data.
//
// The package is OPT-IN: only used when the user enables AI notes in settings.
// Callers that don't want to send activity data out of process should not
// construct a Generator at all.
package aiagent

import "context"

// Input is the activity bundle the generator turns into a one-paragraph
// timesheet entry. Hours, project name and date are always populated; the
// remaining fields are best-effort context (any may be empty).
type Input struct {
	Project      string   // canonical Traq project name (e.g., "traq")
	Date         string   // YYYY-MM-DD
	Hours        float64  // total focus time on this project on this date
	WindowTitles []string // dedup'd top window titles observed
	AISummaries  []string // existing per-session AI summaries that overlap this project on this date
	GitCommits   []string // commit messages on this project on this date
}

// Output is the agent's response. Notes is the timesheet-ready text.
type Output struct {
	Notes      string
	Tool       string // "claude" | "opencode"
	DurationMS int64  // wall clock time of the call
}

// Generator turns an Input bundle into a polished timesheet entry.
type Generator interface {
	Available() bool
	Name() string // "claude" | "opencode" | "auto"
	Generate(ctx context.Context, in Input) (*Output, error)
}
