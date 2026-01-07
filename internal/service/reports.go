package service

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"traq/internal/storage"
)

// ReportsService provides report generation.
type ReportsService struct {
	store    *storage.Store
	timeline *TimelineService
}

// NewReportsService creates a new ReportsService.
func NewReportsService(store *storage.Store, timeline *TimelineService) *ReportsService {
	return &ReportsService{
		store:    store,
		timeline: timeline,
	}
}

// TimeRange represents a parsed time range.
type TimeRange struct {
	Start     int64  `json:"start"`
	End       int64  `json:"end"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
	Label     string `json:"label"`
}

// ReportMeta contains metadata about a generated report.
type ReportMeta struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	TimeRange  string `json:"timeRange"`
	ReportType string `json:"reportType"`
	Format     string `json:"format"`
	CreatedAt  int64  `json:"createdAt"`
}

// GenerateReport generates a new report for the given time range.
func (s *ReportsService) GenerateReport(timeRange, reportType string, includeScreenshots bool) (*storage.Report, error) {
	// Parse time range
	tr, err := s.ParseTimeRange(timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to parse time range: %w", err)
	}

	// Build report content
	var content string
	switch reportType {
	case "standup":
		content, err = s.generateStandupReport(tr, includeScreenshots)
	case "detailed":
		content, err = s.generateDetailedReport(tr, includeScreenshots)
	default: // "summary"
		content, err = s.generateSummaryReport(tr, includeScreenshots)
	}

	if err != nil {
		return nil, err
	}

	// Save report
	report := &storage.Report{
		Title:      fmt.Sprintf("%s Report: %s", strings.Title(reportType), tr.Label),
		TimeRange:  timeRange,
		ReportType: reportType,
		Format:     "markdown",
		Content:    storage.NullString(content),
		StartTime:  storage.NullInt64(tr.Start),
		EndTime:    storage.NullInt64(tr.End),
	}

	id, err := s.store.SaveReport(report)
	if err != nil {
		return nil, err
	}
	report.ID = id

	return report, nil
}

// generateSummaryReport creates a brief summary report.
func (s *ReportsService) generateSummaryReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Activity Summary: %s\n\n", tr.Label))

	// Get sessions
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)

	// Calculate totals
	var totalScreenshots int64
	var totalMinutes int64
	for _, sess := range sessions {
		if sess.ScreenshotCount > 0 {
			totalScreenshots += int64(sess.ScreenshotCount)
		}
		if sess.DurationSeconds.Valid {
			totalMinutes += sess.DurationSeconds.Int64 / 60
		}
	}

	sb.WriteString("## Overview\n\n")
	sb.WriteString(fmt.Sprintf("- **Total Sessions:** %d\n", len(sessions)))
	sb.WriteString(fmt.Sprintf("- **Total Screenshots:** %d\n", totalScreenshots))
	sb.WriteString(fmt.Sprintf("- **Active Time:** %dh %dm\n", totalMinutes/60, totalMinutes%60))

	// Get data source counts
	shellCount, _ := s.store.CountShellCommandsByTimeRange(tr.Start, tr.End)
	gitCount, _ := s.store.CountGitCommitsByTimeRange(tr.Start, tr.End)
	fileCount, _ := s.store.CountFileEventsByTimeRange(tr.Start, tr.End)
	browserCount, _ := s.store.CountBrowserVisitsByTimeRange(tr.Start, tr.End)

	sb.WriteString(fmt.Sprintf("- **Shell Commands:** %d\n", shellCount))
	sb.WriteString(fmt.Sprintf("- **Git Commits:** %d\n", gitCount))
	sb.WriteString(fmt.Sprintf("- **File Events:** %d\n", fileCount))
	sb.WriteString(fmt.Sprintf("- **Browser Visits:** %d\n", browserCount))

	// Get existing summaries
	sb.WriteString("\n## Session Summaries\n\n")
	for _, sess := range sessions {
		if sess.SummaryID.Valid {
			sum, err := s.store.GetSummary(sess.SummaryID.Int64)
			if err == nil && sum != nil {
				startTime := time.Unix(sess.StartTime, 0)
				sb.WriteString(fmt.Sprintf("### %s\n\n", startTime.Format("3:04 PM")))
				sb.WriteString(sum.Summary + "\n\n")
			}
		}
	}

	// Include representative screenshots if requested
	if includeScreenshots {
		sb.WriteString("\n## Key Screenshots\n\n")
		// Get representative screenshots for the time range
		screenshots, err := s.store.GetScreenshotsByTimeRange(tr.Start, tr.End)
		if err == nil && len(screenshots) > 0 {
			// Select up to 5 representative screenshots evenly distributed
			step := len(screenshots) / 5
			if step < 1 {
				step = 1
			}
			count := 0
			for i := 0; i < len(screenshots) && count < 5; i += step {
				ss := screenshots[i]
				timestamp := time.Unix(ss.Timestamp, 0).Format("3:04 PM")
				sb.WriteString(fmt.Sprintf("- **%s** - %s\n", timestamp, ss.AppName.String))
				sb.WriteString(fmt.Sprintf("  ![Screenshot](%s)\n\n", ss.Filepath))
				count++
			}
		} else {
			sb.WriteString("*No screenshots available for this period*\n\n")
		}
	}

	return sb.String(), nil
}

// generateDetailedReport creates a detailed report with all data.
func (s *ReportsService) generateDetailedReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Detailed Activity Report: %s\n\n", tr.Label))
	sb.WriteString(fmt.Sprintf("*Generated: %s*\n\n", time.Now().Format("2006-01-02 15:04")))

	// Get all sessions with context
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)

	for _, sess := range sessions {
		ctx, _ := s.timeline.GetSessionContext(sess.ID)
		if ctx == nil {
			continue
		}

		startTime := time.Unix(sess.StartTime, 0)
		sb.WriteString(fmt.Sprintf("## Session: %s\n\n", startTime.Format("2006-01-02 15:04")))

		if sess.DurationSeconds.Valid {
			minutes := sess.DurationSeconds.Int64 / 60
			sb.WriteString(fmt.Sprintf("**Duration:** %dh %dm\n\n", minutes/60, minutes%60))
		}

		// Summary
		if ctx.Summary != nil {
			sb.WriteString("### Summary\n\n")
			sb.WriteString(ctx.Summary.Summary + "\n\n")
			if ctx.Summary.Explanation.Valid {
				sb.WriteString("**Explanation:** " + ctx.Summary.Explanation.String + "\n\n")
			}
			if len(ctx.Summary.Tags) > 0 {
				sb.WriteString("**Tags:** " + strings.Join(ctx.Summary.Tags, ", ") + "\n\n")
			}
		}

		// Focus events
		if len(ctx.FocusEvents) > 0 {
			sb.WriteString("### Application Focus\n\n")
			sb.WriteString("| Application | Duration |\n")
			sb.WriteString("|-------------|----------|\n")
			appDurations := make(map[string]float64)
			for _, evt := range ctx.FocusEvents {
				appDurations[evt.AppName] += evt.DurationSeconds
			}
			for app, dur := range appDurations {
				minutes := int(dur / 60)
				sb.WriteString(fmt.Sprintf("| %s | %dm |\n", app, minutes))
			}
			sb.WriteString("\n")
		}

		// Shell commands
		if len(ctx.ShellCommands) > 0 {
			sb.WriteString("### Shell Commands\n\n")
			sb.WriteString("```\n")
			for _, cmd := range ctx.ShellCommands {
				sb.WriteString(cmd.Command + "\n")
			}
			sb.WriteString("```\n\n")
		}

		// Git commits
		if len(ctx.GitCommits) > 0 {
			sb.WriteString("### Git Commits\n\n")
			for _, commit := range ctx.GitCommits {
				sb.WriteString(fmt.Sprintf("- `%s` %s\n", commit.ShortHash, commit.Message))
			}
			sb.WriteString("\n")
		}

		sb.WriteString("---\n\n")
	}

	return sb.String(), nil
}

// generateStandupReport creates a standup-style report.
func (s *ReportsService) generateStandupReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Standup Report: %s\n\n", tr.Label))

	// What I worked on
	sb.WriteString("## What I worked on\n\n")

	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)
	for _, sess := range sessions {
		if sess.SummaryID.Valid {
			sum, err := s.store.GetSummary(sess.SummaryID.Int64)
			if err == nil && sum != nil {
				sb.WriteString("- " + sum.Summary + "\n")
			}
		}
	}

	// Git commits
	commits, _ := s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)
	if len(commits) > 0 {
		sb.WriteString("\n## Commits\n\n")
		for _, commit := range commits {
			sb.WriteString(fmt.Sprintf("- %s\n", commit.Message))
		}
	}

	// Time breakdown
	sb.WriteString("\n## Time Breakdown\n\n")
	focusEvents, _ := s.store.GetWindowFocusEventsByTimeRange(tr.Start, tr.End)
	appDurations := make(map[string]float64)
	for _, evt := range focusEvents {
		appDurations[evt.AppName] += evt.DurationSeconds
	}
	for app, dur := range appDurations {
		hours := int(dur / 3600)
		minutes := int((dur - float64(hours*3600)) / 60)
		if hours > 0 {
			sb.WriteString(fmt.Sprintf("- **%s:** %dh %dm\n", app, hours, minutes))
		} else {
			sb.WriteString(fmt.Sprintf("- **%s:** %dm\n", app, minutes))
		}
	}

	return sb.String(), nil
}

// ExportReport exports a report in the specified format.
func (s *ReportsService) ExportReport(reportID int64, format string) (string, error) {
	report, err := s.store.GetReport(reportID)
	if err != nil {
		return "", err
	}

	content := ""
	if report.Content.Valid {
		content = report.Content.String
	}

	switch format {
	case "html":
		return s.markdownToHTML(content), nil
	case "json":
		return fmt.Sprintf(`{"title":"%s","content":"%s"}`, report.Title, content), nil
	default: // markdown
		return content, nil
	}
}

// markdownToHTML converts markdown to HTML (basic conversion).
func (s *ReportsService) markdownToHTML(md string) string {
	// Very basic markdown to HTML conversion
	html := md

	// Headers
	html = regexp.MustCompile(`(?m)^### (.+)$`).ReplaceAllString(html, "<h3>$1</h3>")
	html = regexp.MustCompile(`(?m)^## (.+)$`).ReplaceAllString(html, "<h2>$1</h2>")
	html = regexp.MustCompile(`(?m)^# (.+)$`).ReplaceAllString(html, "<h1>$1</h1>")

	// Bold
	html = regexp.MustCompile(`\*\*(.+?)\*\*`).ReplaceAllString(html, "<strong>$1</strong>")

	// Italic
	html = regexp.MustCompile(`\*(.+?)\*`).ReplaceAllString(html, "<em>$1</em>")

	// Code blocks
	html = regexp.MustCompile("(?s)```(.+?)```").ReplaceAllString(html, "<pre><code>$1</code></pre>")

	// Inline code
	html = regexp.MustCompile("`(.+?)`").ReplaceAllString(html, "<code>$1</code>")

	// Line breaks
	html = strings.ReplaceAll(html, "\n\n", "</p><p>")

	return "<html><body><p>" + html + "</p></body></html>"
}

// GetReport returns a report by ID with full content.
func (s *ReportsService) GetReport(id int64) (*storage.Report, error) {
	return s.store.GetReport(id)
}

// GetReportHistory returns past generated reports.
func (s *ReportsService) GetReportHistory() ([]*ReportMeta, error) {
	reports, err := s.store.GetAllReports()
	if err != nil {
		return nil, err
	}

	var metas []*ReportMeta
	for _, r := range reports {
		metas = append(metas, &ReportMeta{
			ID:         r.ID,
			Title:      r.Title,
			TimeRange:  r.TimeRange,
			ReportType: r.ReportType,
			Format:     r.Format,
			CreatedAt:  r.CreatedAt,
		})
	}

	return metas, nil
}

// ParseTimeRange parses natural language time input.
func (s *ReportsService) ParseTimeRange(input string) (*TimeRange, error) {
	now := time.Now()
	input = strings.ToLower(strings.TrimSpace(input))

	var start, end time.Time
	var label string

	switch input {
	case "today":
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
		end = start.Add(24 * time.Hour)
		label = "Today"

	case "yesterday":
		start = time.Date(now.Year(), now.Month(), now.Day()-1, 0, 0, 0, 0, time.Local)
		end = start.Add(24 * time.Hour)
		label = "Yesterday"

	case "this week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start = time.Date(now.Year(), now.Month(), now.Day()-weekday+1, 0, 0, 0, 0, time.Local)
		end = start.AddDate(0, 0, 7)
		label = "This Week"

	case "last week":
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		start = time.Date(now.Year(), now.Month(), now.Day()-weekday-6, 0, 0, 0, 0, time.Local)
		end = start.AddDate(0, 0, 7)
		label = "Last Week"

	case "this month":
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
		end = start.AddDate(0, 1, 0)
		label = "This Month"

	case "last month":
		start = time.Date(now.Year(), now.Month()-1, 1, 0, 0, 0, 0, time.Local)
		end = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.Local)
		label = "Last Month"

	default:
		// Try "past N days" or "last N days"
		pastDaysRe := regexp.MustCompile(`(?:past|last)\s+(\d+)\s+days?`)
		if matches := pastDaysRe.FindStringSubmatch(input); len(matches) == 2 {
			days, _ := strconv.Atoi(matches[1])
			start = time.Date(now.Year(), now.Month(), now.Day()-days+1, 0, 0, 0, 0, time.Local)
			end = time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, time.Local)
			label = fmt.Sprintf("Past %d Days", days)
		} else {
			// Try parsing as date
			parsed, err := time.Parse("2006-01-02", input)
			if err != nil {
				// Try month name
				parsed, err = time.Parse("January 2006", input)
				if err != nil {
					parsed, err = time.Parse("January", input)
					if err != nil {
						return nil, fmt.Errorf("could not parse time range: %s", input)
					}
					parsed = time.Date(now.Year(), parsed.Month(), 1, 0, 0, 0, 0, time.Local)
				}
				start = parsed
				end = start.AddDate(0, 1, 0)
				label = start.Format("January 2006")
			} else {
				start = parsed
				end = start.Add(24 * time.Hour)
				label = start.Format("January 2, 2006")
			}
		}
	}

	return &TimeRange{
		Start:     start.Unix(),
		End:       end.Unix() - 1,
		StartDate: start.Format("2006-01-02"),
		EndDate:   end.Add(-time.Second).Format("2006-01-02"),
		Label:     label,
	}, nil
}
