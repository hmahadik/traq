package aiagent

import (
	"fmt"
	"strings"
)

// BuildPrompt assembles the LLM prompt from an Input bundle. The wording asks
// for a single short paragraph suitable for a creative-agency timesheet
// (FunctionFox notes field). Output should be plain text, no markdown.
func BuildPrompt(in Input) string {
	var b strings.Builder
	b.WriteString("Write a single concise paragraph (max 80 words) summarizing the work done on the project below, suitable for a professional agency timesheet entry. Use plain text only — no markdown, no bullets, no headers. Lead with the substantive accomplishment, not the project name. If the data is too sparse to justify a paragraph, write one short sentence.\n\n")
	fmt.Fprintf(&b, "Project: %s\n", in.Project)
	fmt.Fprintf(&b, "Date: %s\n", in.Date)
	fmt.Fprintf(&b, "Hours tracked: %.2f\n\n", in.Hours)
	if len(in.AISummaries) > 0 {
		b.WriteString("Per-session summaries observed today:\n")
		for _, s := range in.AISummaries {
			fmt.Fprintf(&b, "- %s\n", s)
		}
		b.WriteString("\n")
	}
	if len(in.GitCommits) > 0 {
		b.WriteString("Git commits authored on this project today:\n")
		for _, c := range in.GitCommits {
			fmt.Fprintf(&b, "- %s\n", c)
		}
		b.WriteString("\n")
	}
	if len(in.WindowTitles) > 0 && len(in.AISummaries) == 0 && len(in.GitCommits) == 0 {
		b.WriteString("Windows/files seen today (use as last-resort context only — do not list them):\n")
		for _, w := range in.WindowTitles {
			fmt.Fprintf(&b, "- %s\n", w)
		}
		b.WriteString("\n")
	}
	b.WriteString("Output: just the paragraph. No quotes, no preamble, no sign-off.")
	return b.String()
}
