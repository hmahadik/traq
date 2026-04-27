// Pure helper functions for the reports service.

package service

import (
	"fmt"
	"html"
	"math"
	"strings"
	"time"
)

// esc escapes a string for safe embedding in HTML output.
func esc(s string) string {
	return html.EscapeString(s)
}

// formatHoursMinutes converts a float64 hours value to "X hours Y minutes" format.
// Examples: 3.1 -> "3 hours 6 minutes", 1.0 -> "1 hour", 0.5 -> "30 minutes"
func formatHoursMinutes(hours float64) string {
	totalMinutes := int(math.Round(hours * 60))
	h := totalMinutes / 60
	m := totalMinutes % 60

	if h == 0 {
		if m == 1 {
			return "1 minute"
		}
		return fmt.Sprintf("%d minutes", m)
	}
	if m == 0 {
		if h == 1 {
			return "1 hour"
		}
		return fmt.Sprintf("%d hours", h)
	}

	hourWord := "hours"
	if h == 1 {
		hourWord = "hour"
	}
	minuteWord := "minutes"
	if m == 1 {
		minuteWord = "minute"
	}
	return fmt.Sprintf("%d %s %d %s", h, hourWord, m, minuteWord)
}

// formatHoursMinutesShort converts a float64 hours value to "Xh Ym" format.
// Examples: 3.1 -> "3h 6m", 1.0 -> "1h", 0.5 -> "30m"
func formatHoursMinutesShort(hours float64) string {
	totalMinutes := int(math.Round(hours * 60))
	h := totalMinutes / 60
	m := totalMinutes % 60

	if h == 0 {
		return fmt.Sprintf("%dm", m)
	}
	if m == 0 {
		return fmt.Sprintf("%dh", h)
	}
	return fmt.Sprintf("%dh %dm", h, m)
}

// isBoringCommit returns true if the commit message is generic/uninteresting.
func isBoringCommit(message string) bool {
	boring := []string{
		"wip", "work in progress", "merge branch", "merge pull request",
		"update", "fix typo", "typo", "minor", "cleanup",
	}
	lower := strings.ToLower(message)
	for _, b := range boring {
		if lower == b || strings.HasPrefix(lower, b+" ") {
			return true
		}
	}
	// Also filter out very short messages and docs-only commits
	if len(message) < 10 {
		return true
	}
	if strings.HasPrefix(lower, "docs:") && !strings.Contains(lower, "readme") {
		return true
	}
	return false
}

// isGarbageActivity detects AI-generated activities that are clearly random browsing, not work.
// These usually come from Wikipedia, news sites, or general interest browsing.
func isGarbageActivity(activity string) bool {
	lower := strings.ToLower(activity)

	// Pattern 1: "Researched/Investigated [Topic]" where topic is clearly not work
	garbagePatterns := []string{
		"crude oil", "oil exports", "world war", "civil war", "revolution",
		"investigated spain", "investigated france", "investigated germany",
		"investigated china", "investigated russia", "investigated japan",
		"researched venezuela", "researched ukraine", "researched israel",
		"history of ", "biography of ", "population of ",
		"geography of ", "economy of ", "climate of ",
		"researched the history", "investigated the history",
		"browsed news", "read news", "checked news",
		"watched video", "youtube video", "streaming",
		"social media", "twitter", "reddit", "facebook",
		"sports scores", "game results", "match results",
		"weather forecast", "stock prices", "cryptocurrency",
	}

	for _, pattern := range garbagePatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}

	// Pattern 2: Very generic activities
	genericActivities := []string{
		"browsed the web", "general browsing", "web browsing",
		"various activities", "miscellaneous tasks", "general research",
		"read articles", "viewed pages", "checked websites",
	}

	for _, generic := range genericActivities {
		if strings.Contains(lower, generic) || lower == generic {
			return true
		}
	}

	// Pattern 3: Activities that are just project name regurgitation (no actual work described)
	// e.g., "Smart Panel Demo - SL2619", "Event Drops Demo", "Traq codebase"
	projectNamePatterns := []string{
		"smart panel demo", "event drops demo", "sl2619", "sl261",
		"traq codebase", "synaptics demo", "42t demo",
	}
	for _, pattern := range projectNamePatterns {
		// If the activity is basically just the project name (with minor additions)
		if lower == pattern || strings.HasPrefix(lower, pattern+" -") || strings.HasSuffix(lower, " "+pattern) {
			return true
		}
	}

	// Pattern 4: Activities that are just "[Something] Demo" with no verb/action
	if strings.HasSuffix(lower, " demo") && !strings.Contains(lower, "implement") &&
		!strings.Contains(lower, "creat") && !strings.Contains(lower, "build") &&
		!strings.Contains(lower, "fix") && !strings.Contains(lower, "add") &&
		!strings.Contains(lower, "work") && !strings.Contains(lower, "develop") {
		return true
	}

	return false
}

// cleanCommitMessage cleans up a commit message for display
func cleanCommitMessage(msg string) string {
	// Remove conventional commit prefixes like "feat:", "fix:", "chore:", etc.
	prefixes := []string{
		"feat:", "fix:", "chore:", "docs:", "test:", "refactor:", "style:", "perf:", "ci:",
		"feat(", "fix(", "chore(", "docs(", "test(", "refactor(", "style(", "perf(", "ci(",
	}
	lower := strings.ToLower(msg)
	for _, prefix := range prefixes {
		if strings.HasPrefix(lower, prefix) {
			// Find the end of the scope if present
			if strings.HasPrefix(prefix, strings.Split(prefix, "(")[0]+"(") {
				// Has scope like "feat(scope):"
				if idx := strings.Index(msg, "):"); idx > 0 {
					msg = strings.TrimSpace(msg[idx+2:])
				} else if idx := strings.Index(msg, ")"); idx > 0 {
					msg = strings.TrimSpace(msg[idx+1:])
					if strings.HasPrefix(msg, ":") {
						msg = strings.TrimSpace(msg[1:])
					}
				}
			} else {
				// Simple prefix like "feat:"
				msg = strings.TrimSpace(msg[len(prefix):])
			}
			break
		}
	}

	// Capitalize first letter
	if len(msg) > 0 {
		msg = strings.ToUpper(string(msg[0])) + msg[1:]
	}

	return msg
}

// containsString checks if a string slice contains a value.
func containsString(slice []string, val string) bool {
	for _, s := range slice {
		if s == val {
			return true
		}
	}
	return false
}

// isGenericSummary returns true if the summary is too generic to be useful.
func isGenericSummary(summary string) bool {
	genericPhrases := []string{
		"no significant activity",
		"idle period",
		"minimal activity",
	}
	lower := strings.ToLower(summary)
	for _, phrase := range genericPhrases {
		if strings.Contains(lower, phrase) {
			return true
		}
	}
	return false
}

// formatMinutes formats minutes as "Xh Ym" or "Xm".
func formatMinutes(minutes int64) string {
	if minutes >= 60 {
		hours := minutes / 60
		mins := minutes % 60
		if mins > 0 {
			return fmt.Sprintf("%dh %dm", hours, mins)
		}
		return fmt.Sprintf("%dh", hours)
	}
	return fmt.Sprintf("%dm", minutes)
}

// extractPreview extracts a preview from markdown content.
func extractPreview(content string) string {
	if content == "" {
		return "No summary available"
	}

	// Remove markdown headers
	lines := strings.Split(content, "\n")
	var textLines []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Skip headers, empty lines, and horizontal rules
		if strings.HasPrefix(line, "#") || line == "" || strings.HasPrefix(line, "---") {
			continue
		}
		// Skip bullet points and numbered lists for preview
		if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			continue
		}
		if len(line) > 0 {
			textLines = append(textLines, line)
		}
		// Stop after we have some content
		if len(textLines) >= 2 {
			break
		}
	}

	preview := strings.Join(textLines, " ")

	// Limit to ~200 chars
	if len(preview) > 200 {
		preview = preview[:197] + "..."
	}

	if preview == "" {
		return "Daily activity summary"
	}

	return preview
}

// parseDateRange attempts to parse a date range string like "jan 5, 2026 - jan 12, 2026"
// Returns start date, end date, label, and success bool
func parseDateRange(input string) (time.Time, time.Time, string, bool) {
	// Split on common separators
	parts := strings.Split(input, " - ")
	if len(parts) != 2 {
		parts = strings.Split(input, " to ")
	}
	if len(parts) != 2 {
		return time.Time{}, time.Time{}, "", false
	}

	startStr := strings.TrimSpace(parts[0])
	endStr := strings.TrimSpace(parts[1])

	startDate, startOk := parseFlexibleDate(startStr)
	endDate, endOk := parseFlexibleDate(endStr)

	if !startOk || !endOk {
		return time.Time{}, time.Time{}, "", false
	}

	// Normalize to start of day
	startDate = time.Date(startDate.Year(), startDate.Month(), startDate.Day(), 0, 0, 0, 0, time.Local)
	endDate = time.Date(endDate.Year(), endDate.Month(), endDate.Day(), 0, 0, 0, 0, time.Local)

	// Generate label
	label := fmt.Sprintf("%s - %s", startDate.Format("Jan 2, 2006"), endDate.Format("Jan 2, 2006"))

	return startDate, endDate, label, true
}
