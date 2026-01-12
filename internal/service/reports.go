package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jung-kurt/gofpdf"
	"traq/internal/storage"
)

// ReportsService provides report generation.
type ReportsService struct {
	store     *storage.Store
	timeline  *TimelineService
	analytics *AnalyticsService
}

// NewReportsService creates a new ReportsService.
func NewReportsService(store *storage.Store, timeline *TimelineService, analytics *AnalyticsService) *ReportsService {
	return &ReportsService{
		store:     store,
		timeline:  timeline,
		analytics: analytics,
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

// Report is the service-layer report type with plain strings (not sql.Null types).
type Report struct {
	ID         int64  `json:"id"`
	Title      string `json:"title"`
	TimeRange  string `json:"timeRange"`
	ReportType string `json:"reportType"`
	Format     string `json:"format"`
	Content    string `json:"content"`
	Filepath   string `json:"filepath"`
	StartTime  int64  `json:"startTime"`
	EndTime    int64  `json:"endTime"`
	CreatedAt  int64  `json:"createdAt"`
}

// toServiceReport converts a storage report to a service report.
func toServiceReport(r *storage.Report) *Report {
	if r == nil {
		return nil
	}
	return &Report{
		ID:         r.ID,
		Title:      r.Title,
		TimeRange:  r.TimeRange,
		ReportType: r.ReportType,
		Format:     r.Format,
		Content:    r.Content.String,
		Filepath:   r.Filepath.String,
		StartTime:  r.StartTime.Int64,
		EndTime:    r.EndTime.Int64,
		CreatedAt:  r.CreatedAt,
	}
}

// GenerateReport generates a new report for the given time range.
func (s *ReportsService) GenerateReport(timeRange, reportType string, includeScreenshots bool) (*Report, error) {
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
	storageReport := &storage.Report{
		Title:      fmt.Sprintf("%s Report: %s", strings.Title(reportType), tr.Label),
		TimeRange:  timeRange,
		ReportType: reportType,
		Format:     "html",
		Content:    storage.NullString(content),
		StartTime:  storage.NullInt64(tr.Start),
		EndTime:    storage.NullInt64(tr.End),
	}

	id, err := s.store.SaveReport(storageReport)
	if err != nil {
		return nil, err
	}
	storageReport.ID = id

	return toServiceReport(storageReport), nil
}

// generateSummaryReport creates a visual HTML summary report.
func (s *ReportsService) generateSummaryReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	// Get app usage for time breakdown
	appUsage, _ := s.analytics.GetAppUsage(tr.Start, tr.End)

	// Calculate category breakdown
	var productiveMinutes, neutralMinutes, distractingMinutes int64
	for _, app := range appUsage {
		minutes := int64(app.DurationSeconds / 60)
		category := s.analytics.CategorizeApp(app.AppName)
		switch category {
		case CategoryProductive:
			productiveMinutes += minutes
		case CategoryDistracting:
			distractingMinutes += minutes
		default:
			neutralMinutes += minutes
		}
	}
	totalMinutes := productiveMinutes + neutralMinutes + distractingMinutes

	// Calculate productivity score (0-100)
	var productivityScore int
	var productivityLabel string
	var scoreColor string
	if totalMinutes > 0 {
		productivityScore = int((float64(productiveMinutes) / float64(totalMinutes)) * 100)
	}
	switch {
	case productivityScore >= 80:
		productivityLabel = "Excellent"
		scoreColor = "#22c55e"
	case productivityScore >= 60:
		productivityLabel = "Good"
		scoreColor = "#84cc16"
	case productivityScore >= 40:
		productivityLabel = "Fair"
		scoreColor = "#eab308"
	case productivityScore >= 20:
		productivityLabel = "Needs Improvement"
		scoreColor = "#f97316"
	default:
		productivityLabel = "Low"
		scoreColor = "#ef4444"
	}

	// Get top app for headline
	topApp := "various apps"
	if len(appUsage) > 0 {
		topApp = GetFriendlyAppName(appUsage[0].AppName)
	}

	// Get sessions and commits for context
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)
	gitCommits, _ := s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)

	// Get hourly activity
	hourlyData := s.getHourlyActivity(tr.Start, tr.End)

	// Build headline
	headline := s.buildHeadline(totalMinutes, topApp, len(gitCommits), productivityLabel)

	// === START BUILDING HTML REPORT ===
	sb.WriteString(`<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; color: #e2e8f0;">`)

	// Header
	sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 24px;">
		<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 8px 0; color: #f1f5f9;">Activity Summary: %s</h1>
		<p style="color: #94a3b8; margin: 0; font-size: 0.9rem;">%s</p>
	</div>`, tr.Label, headline))

	// Stats Grid
	sb.WriteString(`<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px;">`)

	// Productivity Score Card
	sb.WriteString(fmt.Sprintf(`
		<div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4)); border-radius: 12px; padding: 16px; border: 1px solid rgba(148, 163, 184, 0.1);">
			<div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Productivity</div>
			<div style="font-size: 2rem; font-weight: 700; color: %s; line-height: 1;">%d%%</div>
			<div style="font-size: 0.8rem; color: %s; margin-top: 4px;">%s</div>
			<div style="margin-top: 8px; height: 4px; background: rgba(148, 163, 184, 0.2); border-radius: 2px; overflow: hidden;">
				<div style="height: 100%%; width: %d%%; background: %s; border-radius: 2px;"></div>
			</div>
		</div>`, scoreColor, productivityScore, scoreColor, productivityLabel, productivityScore, scoreColor))

	// Total Time Card
	sb.WriteString(fmt.Sprintf(`
		<div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4)); border-radius: 12px; padding: 16px; border: 1px solid rgba(148, 163, 184, 0.1);">
			<div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Active Time</div>
			<div style="font-size: 2rem; font-weight: 700; color: #f1f5f9; line-height: 1;">%s</div>
			<div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">%d sessions</div>
		</div>`, formatMinutes(totalMinutes), len(sessions)))

	// Productive Time Card
	sb.WriteString(fmt.Sprintf(`
		<div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4)); border-radius: 12px; padding: 16px; border: 1px solid rgba(148, 163, 184, 0.1);">
			<div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Productive</div>
			<div style="font-size: 2rem; font-weight: 700; color: #22c55e; line-height: 1;">%s</div>
			<div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">focused work</div>
		</div>`, formatMinutes(productiveMinutes)))

	// Distracted Time Card
	sb.WriteString(fmt.Sprintf(`
		<div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4)); border-radius: 12px; padding: 16px; border: 1px solid rgba(148, 163, 184, 0.1);">
			<div style="font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">Distracted</div>
			<div style="font-size: 2rem; font-weight: 700; color: %s; line-height: 1;">%s</div>
			<div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">off-task</div>
		</div>`, func() string {
		if distractingMinutes > 30 {
			return "#ef4444"
		}
		return "#64748b"
	}(), formatMinutes(distractingMinutes)))

	sb.WriteString(`</div>`) // End stats grid

	// Time Breakdown Bar
	if totalMinutes > 0 {
		productivePct := float64(productiveMinutes) / float64(totalMinutes) * 100
		neutralPct := float64(neutralMinutes) / float64(totalMinutes) * 100
		distractingPct := float64(distractingMinutes) / float64(totalMinutes) * 100

		sb.WriteString(fmt.Sprintf(`
		<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Time Distribution</div>
			<div style="display: flex; height: 24px; border-radius: 6px; overflow: hidden; background: rgba(30, 41, 59, 0.5);">
				<div style="width: %.1f%%; background: #22c55e; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: white;" title="Productive: %s">%s</div>
				<div style="width: %.1f%%; background: #64748b; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: white;" title="Neutral: %s">%s</div>
				<div style="width: %.1f%%; background: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 600; color: white;" title="Distracting: %s">%s</div>
			</div>
			<div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 0.75rem; color: #94a3b8;">
				<span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #22c55e; margin-right: 4px;"></span>Productive</span>
				<span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #64748b; margin-right: 4px;"></span>Neutral</span>
				<span><span style="display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #ef4444; margin-right: 4px;"></span>Distracting</span>
			</div>
		</div>`,
			productivePct, formatMinutes(productiveMinutes), formatMinutes(productiveMinutes),
			neutralPct, formatMinutes(neutralMinutes), formatMinutes(neutralMinutes),
			distractingPct, formatMinutes(distractingMinutes), formatMinutes(distractingMinutes)))
	}

	// Hourly Activity
	if len(hourlyData) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Activity by Hour</div>
			<div style="display: flex; gap: 2px; align-items: flex-end; height: 60px; padding: 4px; background: rgba(30, 41, 59, 0.3); border-radius: 8px;">`)

		maxActivity := int64(1)
		for _, h := range hourlyData {
			if h.Minutes > maxActivity {
				maxActivity = h.Minutes
			}
		}

		for _, h := range hourlyData {
			height := 0
			if maxActivity > 0 {
				height = int(float64(h.Minutes) / float64(maxActivity) * 100)
			}
			color := "#334155"
			if h.Minutes > 0 {
				color = "#3b82f6"
			}
			sb.WriteString(fmt.Sprintf(`<div style="flex: 1; height: %d%%; min-height: 4px; background: %s; border-radius: 2px;" title="%d:00 - %dm"></div>`, height, color, h.Hour, h.Minutes))
		}

		sb.WriteString(`</div>
			<div style="display: flex; justify-content: space-between; font-size: 0.65rem; color: #64748b; margin-top: 4px;">
				<span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
			</div>
		</div>`)
	}

	// Top Applications
	if len(appUsage) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Top Applications</div>`)

		maxDuration := appUsage[0].DurationSeconds
		count := 0
		for _, app := range appUsage {
			if count >= 6 {
				break
			}
			appName := GetFriendlyAppName(app.AppName)
			category := s.analytics.CategorizeApp(app.AppName)
			barWidth := int(app.DurationSeconds / maxDuration * 100)
			barColor := "#64748b"
			if category == CategoryProductive {
				barColor = "#22c55e"
			} else if category == CategoryDistracting {
				barColor = "#ef4444"
			}

			sb.WriteString(fmt.Sprintf(`
			<div style="display: flex; align-items: center; margin-bottom: 8px;">
				<div style="width: 100px; font-size: 0.8rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">%s</div>
				<div style="flex: 1; height: 20px; background: rgba(30, 41, 59, 0.5); border-radius: 4px; margin: 0 12px; overflow: hidden;">
					<div style="height: 100%%; width: %d%%; background: %s; border-radius: 4px;"></div>
				</div>
				<div style="width: 50px; text-align: right; font-size: 0.8rem; color: #94a3b8;">%s</div>
			</div>`, appName, barWidth, barColor, formatMinutes(int64(app.DurationSeconds/60))))
			count++
		}
		sb.WriteString(`</div>`)
	}

	// Key Accomplishments
	accomplishments := s.extractAccomplishments(sessions)
	if len(accomplishments) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Key Accomplishments</div>`)
		for _, acc := range accomplishments {
			sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				<div style="color: #22c55e; font-size: 0.9rem;">✓</div>
				<div style="font-size: 0.85rem; color: #cbd5e1;">%s</div>
			</div>`, acc))
		}
		sb.WriteString(`</div>`)
	}

	// Git Commits
	if len(gitCommits) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Commits</div>`)
		seen := make(map[string]bool)
		for _, commit := range gitCommits {
			if !seen[commit.Message] {
				seen[commit.Message] = true
				sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: baseline;">
					<code style="font-size: 0.75rem; color: #f97316; background: rgba(249, 115, 22, 0.1); padding: 2px 6px; border-radius: 4px;">%s</code>
					<span style="font-size: 0.85rem; color: #cbd5e1;">%s</span>
				</div>`, commit.ShortHash, commit.Message))
			}
		}
		sb.WriteString(`</div>`)
	}

	// Insights
	insights := s.generateInsights(appUsage, productiveMinutes, distractingMinutes, len(gitCommits))
	if len(insights) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 3px solid #3b82f6;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #3b82f6; margin-bottom: 8px;">💡 Insights</div>`)
		for _, insight := range insights {
			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 4px;">• %s</div>`, insight))
		}
		sb.WriteString(`</div>`)
	}

	sb.WriteString(`</div>`) // End main container

	return sb.String(), nil
}

// HourlyActivityData represents activity for a single hour.
type HourlyActivityData struct {
	Hour    int
	Minutes int64
}

// getHourlyActivity returns activity breakdown by hour.
func (s *ReportsService) getHourlyActivity(start, end int64) []HourlyActivityData {
	startTime := time.Unix(start, 0)
	endTime := time.Unix(end, 0)

	// Only generate hourly data for single-day reports
	if startTime.Day() != endTime.Day() || startTime.Month() != endTime.Month() {
		return nil
	}

	hourly := make([]HourlyActivityData, 24)
	for i := 0; i < 24; i++ {
		hourly[i] = HourlyActivityData{Hour: i, Minutes: 0}
	}

	// Get screenshots by time range and count by hour
	screenshots, _ := s.store.GetScreenshotsByTimeRange(start, end)
	for _, ss := range screenshots {
		hour := time.Unix(ss.Timestamp, 0).Hour()
		if hour >= 0 && hour < 24 {
			hourly[hour].Minutes++ // Each screenshot ≈ 0.5 min, but count as 1 for simplicity
		}
	}

	return hourly
}

// buildHeadline creates a natural language headline for the report.
func (s *ReportsService) buildHeadline(totalMinutes int64, topApp string, commitCount int, productivityLabel string) string {
	if totalMinutes == 0 {
		return "No activity recorded for this period"
	}

	var parts []string

	// Time description
	if totalMinutes >= 60 {
		hours := totalMinutes / 60
		if hours == 1 {
			parts = append(parts, "1 hour")
		} else {
			parts = append(parts, fmt.Sprintf("%d hours", hours))
		}
	} else {
		parts = append(parts, fmt.Sprintf("%d minutes", totalMinutes))
	}

	// Top app
	parts = append(parts, fmt.Sprintf("mostly in %s", topApp))

	// Commits
	if commitCount > 0 {
		if commitCount == 1 {
			parts = append(parts, "with 1 commit")
		} else {
			parts = append(parts, fmt.Sprintf("with %d commits", commitCount))
		}
	}

	headline := strings.Join(parts, ", ")
	return fmt.Sprintf("%s productivity day: %s", productivityLabel, headline)
}

// extractAccomplishments pulls key accomplishments from session summaries.
func (s *ReportsService) extractAccomplishments(sessions []*storage.Session) []string {
	var accomplishments []string
	seen := make(map[string]bool)

	for _, sess := range sessions {
		if sess.SummaryID.Valid {
			sum, err := s.store.GetSummary(sess.SummaryID.Int64)
			if err == nil && sum != nil && sum.Summary != "" {
				// Clean up the summary - remove generic phrases
				summary := sum.Summary
				if !seen[summary] && !isGenericSummary(summary) {
					seen[summary] = true
					accomplishments = append(accomplishments, summary)
				}
			}
		}
	}

	// Limit to top 5
	if len(accomplishments) > 5 {
		accomplishments = accomplishments[:5]
	}

	return accomplishments
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

// generateInsights creates actionable insights from the data.
func (s *ReportsService) generateInsights(appUsage []*AppUsage, productiveMin, distractingMin int64, commitCount int) []string {
	var insights []string

	// Distraction insight
	if distractingMin > 30 && productiveMin > 0 {
		ratio := float64(distractingMin) / float64(productiveMin)
		if ratio > 0.5 {
			insights = append(insights, fmt.Sprintf("Spent %s on distracting apps - consider blocking during focus time", formatMinutes(distractingMin)))
		}
	}

	// Top app dominance
	if len(appUsage) >= 2 {
		topDuration := appUsage[0].DurationSeconds
		secondDuration := appUsage[1].DurationSeconds
		if secondDuration > 0 && topDuration/secondDuration > 3 {
			insights = append(insights, fmt.Sprintf("%s dominated your time at %.0f%% of total", GetFriendlyAppName(appUsage[0].AppName), appUsage[0].Percentage))
		}
	}

	// Commit productivity
	if commitCount > 5 {
		insights = append(insights, fmt.Sprintf("Productive coding session with %d commits", commitCount))
	} else if commitCount == 0 && productiveMin > 60 {
		insights = append(insights, "Significant productive time but no commits - consider breaking work into smaller commits")
	}

	// Browser usage
	for _, app := range appUsage {
		if strings.Contains(strings.ToLower(app.AppName), "chrome") ||
			strings.Contains(strings.ToLower(app.AppName), "firefox") ||
			strings.Contains(strings.ToLower(app.AppName), "safari") {
			if app.DurationSeconds > 3600 {
				insights = append(insights, fmt.Sprintf("Spent %s in browser - review if this was productive research", formatMinutes(int64(app.DurationSeconds/60))))
			}
			break
		}
	}

	return insights
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

// TimelineEvent represents a unified event for chronological display.
type TimelineEvent struct {
	Timestamp int64
	Type      string // "git", "shell", "file", "browser"
	Summary   string
}

// generateDetailedReport creates a detailed HTML report with all data.
func (s *ReportsService) generateDetailedReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	// === START BUILDING HTML REPORT ===
	sb.WriteString(`<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; color: #e2e8f0;">`)

	// Header
	sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 24px;">
		<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 8px 0; color: #f1f5f9;">Detailed Activity Report: %s</h1>
		<p style="color: #94a3b8; margin: 0; font-size: 0.9rem;">Generated: %s</p>
	</div>`, tr.Label, time.Now().Format("2006-01-02 15:04")))

	// Collect all timeline events
	var timelineEvents []TimelineEvent

	// Get git commits
	gitCommits, _ := s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)
	for _, commit := range gitCommits {
		timelineEvents = append(timelineEvents, TimelineEvent{
			Timestamp: commit.Timestamp,
			Type:      "git",
			Summary:   fmt.Sprintf(`<span style="font-weight: 600; color: #f97316;">[Git]</span> <code style="font-size: 0.85em; background: rgba(249, 115, 22, 0.1); padding: 2px 6px; border-radius: 4px; color: #f97316;">%s</code> %s`, commit.ShortHash, commit.Message),
		})
	}

	// Get shell commands
	shellCommands, _ := s.store.GetShellCommandsByTimeRange(tr.Start, tr.End)
	for _, cmd := range shellCommands {
		cmdText := cmd.Command
		if len(cmdText) > 80 {
			cmdText = cmdText[:77] + "..."
		}
		timelineEvents = append(timelineEvents, TimelineEvent{
			Timestamp: cmd.Timestamp,
			Type:      "shell",
			Summary:   fmt.Sprintf(`<span style="font-weight: 600; color: #3b82f6;">[Shell]</span> <code style="font-size: 0.85em; background: rgba(59, 130, 246, 0.1); padding: 2px 6px; border-radius: 4px; color: #60a5fa;">%s</code>`, cmdText),
		})
	}

	// Get file events
	fileEvents, _ := s.store.GetFileEventsByTimeRange(tr.Start, tr.End)
	for _, fileEvt := range fileEvents {
		fileName := fileEvt.FileName
		if fileEvt.FileExtension.Valid && fileEvt.FileExtension.String != "" {
			fileName += fileEvt.FileExtension.String
		}
		timelineEvents = append(timelineEvents, TimelineEvent{
			Timestamp: fileEvt.Timestamp,
			Type:      "file",
			Summary:   fmt.Sprintf(`<span style="font-weight: 600; color: #22c55e;">[File]</span> %s: <code style="font-size: 0.85em; background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px; color: #4ade80;">%s</code>`, fileEvt.EventType, fileName),
		})
	}

	// Sort by timestamp
	for i := 0; i < len(timelineEvents)-1; i++ {
		for j := i + 1; j < len(timelineEvents); j++ {
			if timelineEvents[i].Timestamp > timelineEvents[j].Timestamp {
				timelineEvents[i], timelineEvents[j] = timelineEvents[j], timelineEvents[i]
			}
		}
	}

	// Event Timeline Section
	sb.WriteString(`<div style="margin-bottom: 32px;">
		<div style="font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid rgba(148, 163, 184, 0.2);">📅 Event Timeline</div>
		<p style="color: #94a3b8; margin-bottom: 16px; font-size: 0.85rem;">All events in chronological order</p>`)

	if len(timelineEvents) > 0 {
		sb.WriteString(`<div style="background: rgba(30, 41, 59, 0.3); border-radius: 8px; padding: 16px;">`)
		for _, evt := range timelineEvents {
			evtTime := time.Unix(evt.Timestamp, 0)
			sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 12px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
				<div style="font-family: monospace; color: #94a3b8; font-size: 0.85rem; min-width: 70px;">%s</div>
				<div style="font-size: 0.9rem; color: #cbd5e1; flex: 1;">%s</div>
			</div>`, evtTime.Format("15:04:05"), evt.Summary))
		}
		sb.WriteString(`</div>`)
	} else {
		sb.WriteString(`<p style="color: #64748b; font-style: italic; font-size: 0.9rem;">No events recorded for this period</p>`)
	}
	sb.WriteString(`</div>`)

	// Sessions Section
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)

	if len(sessions) > 0 {
		sb.WriteString(`<div style="margin-bottom: 32px;">
			<div style="font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid rgba(148, 163, 184, 0.2);">🎯 Sessions</div>`)

		for _, sess := range sessions {
			ctx, _ := s.timeline.GetSessionContext(sess.ID)
			if ctx == nil {
				continue
			}

			startTime := time.Unix(sess.StartTime, 0)
			sb.WriteString(fmt.Sprintf(`<div style="background: rgba(30, 41, 59, 0.4); border-radius: 8px; padding: 16px; margin-bottom: 16px; border-left: 3px solid #3b82f6;">
				<div style="font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Session: %s</div>`, startTime.Format("2006-01-02 15:04")))

			if sess.DurationSeconds.Valid {
				minutes := sess.DurationSeconds.Int64 / 60
				sb.WriteString(fmt.Sprintf(`<div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 12px;">Duration: %dh %dm</div>`, minutes/60, minutes%60))
			}

			// Summary
			if ctx.Summary != nil {
				sb.WriteString(`<div style="margin-bottom: 16px; padding: 12px; background: rgba(59, 130, 246, 0.1); border-radius: 6px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #3b82f6; margin-bottom: 6px;">Summary</div>`)
				sb.WriteString(fmt.Sprintf(`<p style="color: #cbd5e1; font-size: 0.9rem; margin: 0;">%s</p>`, ctx.Summary.Summary))
				if ctx.Summary.Explanation.Valid && ctx.Summary.Explanation.String != "" {
					sb.WriteString(fmt.Sprintf(`<p style="color: #94a3b8; font-size: 0.85rem; margin-top: 8px; margin-bottom: 0;"><strong>Explanation:</strong> %s</p>`, ctx.Summary.Explanation.String))
				}
				if len(ctx.Summary.Tags) > 0 {
					sb.WriteString(`<div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap;">`)
					for _, tag := range ctx.Summary.Tags {
						sb.WriteString(fmt.Sprintf(`<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">%s</span>`, tag))
					}
					sb.WriteString(`</div>`)
				}
				sb.WriteString(`</div>`)
			}

			// Application Focus
			if len(ctx.FocusEvents) > 0 {
				sb.WriteString(`<div style="margin-bottom: 16px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Application Focus</div>
					<div style="background: rgba(30, 41, 59, 0.5); border-radius: 6px; overflow: hidden;">
						<table style="width: 100%; border-collapse: collapse;">
							<thead>
								<tr style="background: rgba(148, 163, 184, 0.1);">
									<th style="text-align: left; padding: 8px 12px; font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Application</th>
									<th style="text-align: right; padding: 8px 12px; font-size: 0.8rem; color: #94a3b8; font-weight: 600;">Duration</th>
								</tr>
							</thead>
							<tbody>`)

				appDurations := make(map[string]float64)
				for _, evt := range ctx.FocusEvents {
					appDurations[evt.AppName] += evt.DurationSeconds
				}
				for app, dur := range appDurations {
					minutes := int(dur / 60)
					sb.WriteString(fmt.Sprintf(`<tr style="border-bottom: 1px solid rgba(148, 163, 184, 0.05);">
						<td style="padding: 8px 12px; font-size: 0.85rem; color: #e2e8f0;">%s</td>
						<td style="padding: 8px 12px; font-size: 0.85rem; color: #94a3b8; text-align: right;">%dm</td>
					</tr>`, GetFriendlyAppName(app), minutes))
				}

				sb.WriteString(`</tbody></table></div></div>`)
			}

			// Shell Commands
			if len(ctx.ShellCommands) > 0 {
				sb.WriteString(`<div style="margin-bottom: 16px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Shell Commands</div>
					<div style="background: rgba(0, 0, 0, 0.3); border-radius: 6px; padding: 12px; font-family: monospace; font-size: 0.8rem; color: #94a3b8; overflow-x: auto;">`)
				for _, cmd := range ctx.ShellCommands {
					sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 4px;">%s</div>`, cmd.Command))
				}
				sb.WriteString(`</div></div>`)
			}

			// Git Commits
			if len(ctx.GitCommits) > 0 {
				sb.WriteString(`<div style="margin-bottom: 16px;">
					<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 8px;">Git Commits</div>`)
				for _, commit := range ctx.GitCommits {
					sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: baseline;">
						<code style="font-size: 0.75rem; color: #f97316; background: rgba(249, 115, 22, 0.15); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">%s</code>
						<span style="font-size: 0.85rem; color: #cbd5e1;">%s</span>
					</div>`, commit.ShortHash, commit.Message))
				}
				sb.WriteString(`</div>`)
			}

			sb.WriteString(`</div>`) // End session card
		}

		sb.WriteString(`</div>`) // End sessions section
	}

	sb.WriteString(`</div>`) // End main container

	return sb.String(), nil
}

// generateStandupReport creates an HTML standup-style report following the standard 3-question format.
func (s *ReportsService) generateStandupReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	var sb strings.Builder

	// Get app usage and calculate total time
	appUsage, _ := s.analytics.GetAppUsage(tr.Start, tr.End)
	var totalMinutes int64
	for _, app := range appUsage {
		totalMinutes += int64(app.DurationSeconds / 60)
	}

	// Get sessions and commits
	sessions, _ := s.store.GetSessionsByTimeRange(tr.Start, tr.End)
	commits, _ := s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)

	// === START HTML ===
	sb.WriteString(`<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; color: #e2e8f0;">`)

	// Header with summary
	sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 20px;">
		<h1 style="font-size: 1.5rem; font-weight: 700; margin: 0 0 8px 0; color: #f1f5f9;">Standup Report: %s</h1>
		<p style="color: #94a3b8; margin: 0; font-size: 0.9rem;">%s tracked across %d sessions</p>
	</div>`, tr.Label, formatMinutes(totalMinutes), len(sessions)))

	// === WHAT I ACCOMPLISHED ===
	sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(34, 197, 94, 0.1); border-radius: 8px; border-left: 3px solid #22c55e;">
		<div style="font-size: 0.85rem; font-weight: 600; color: #22c55e; margin-bottom: 12px;">✓ What I accomplished</div>`)

	accomplishments := s.extractAccomplishments(sessions)
	if len(accomplishments) > 0 {
		for _, acc := range accomplishments {
			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; padding-left: 8px;">• %s</div>`, acc))
		}
	} else if len(commits) > 0 {
		sb.WriteString(`<div style="font-size: 0.75rem; color: #64748b; margin-bottom: 6px;">Based on commits:</div>`)
		seen := make(map[string]bool)
		count := 0
		for _, commit := range commits {
			if !seen[commit.Message] && count < 5 {
				seen[commit.Message] = true
				sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 6px; padding-left: 8px;">• %s</div>`, commit.Message))
				count++
			}
		}
	} else {
		sb.WriteString(`<div style="font-size: 0.85rem; color: #64748b; font-style: italic;">No specific accomplishments recorded</div>`)
	}
	sb.WriteString(`</div>`)

	// === COMMITS ===
	if len(commits) > 0 {
		sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(249, 115, 22, 0.1); border-radius: 8px; border-left: 3px solid #f97316;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f97316; margin-bottom: 12px;">📝 Commits</div>`)
		seen := make(map[string]bool)
		for _, commit := range commits {
			if !seen[commit.Message] {
				seen[commit.Message] = true
				sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: baseline;">
					<code style="font-size: 0.7rem; color: #f97316; background: rgba(249, 115, 22, 0.15); padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">%s</code>
					<span style="font-size: 0.85rem; color: #cbd5e1;">%s</span>
				</div>`, commit.ShortHash, commit.Message))
			}
		}
		sb.WriteString(`</div>`)
	}

	// === WHAT'S NEXT ===
	sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(59, 130, 246, 0.1); border-radius: 8px; border-left: 3px solid #3b82f6;">
		<div style="font-size: 0.85rem; font-weight: 600; color: #3b82f6; margin-bottom: 12px;">🎯 What's next</div>`)

	if len(commits) > 0 {
		lastCommit := commits[len(commits)-1]
		if strings.Contains(strings.ToLower(lastCommit.Message), "wip") ||
			strings.Contains(strings.ToLower(lastCommit.Message), "in progress") {
			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.85rem; color: #cbd5e1; padding-left: 8px;">• Continue work on: %s</div>`, lastCommit.Message))
		} else {
			sb.WriteString(`<div style="font-size: 0.85rem; color: #64748b; font-style: italic; padding-left: 8px;">Add your planned tasks here</div>`)
		}
	} else {
		sb.WriteString(`<div style="font-size: 0.85rem; color: #64748b; font-style: italic; padding-left: 8px;">Add your planned tasks here</div>`)
	}
	sb.WriteString(`</div>`)

	// === BLOCKERS ===
	sb.WriteString(`<div style="margin-bottom: 20px; padding: 16px; background: rgba(100, 116, 139, 0.1); border-radius: 8px; border-left: 3px solid #64748b;">
		<div style="font-size: 0.85rem; font-weight: 600; color: #94a3b8; margin-bottom: 12px;">🚧 Blockers</div>
		<div style="font-size: 0.85rem; color: #64748b; padding-left: 8px;">• None identified</div>
	</div>`)

	// === TIME SUMMARY ===
	if len(appUsage) > 0 {
		sb.WriteString(`<div style="margin-bottom: 20px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">⏱️ Time Summary</div>`)

		maxDuration := appUsage[0].DurationSeconds
		count := 0
		for _, app := range appUsage {
			if count >= 5 {
				break
			}
			appName := GetFriendlyAppName(app.AppName)
			category := s.analytics.CategorizeApp(app.AppName)
			barWidth := int(app.DurationSeconds / maxDuration * 100)
			barColor := "#64748b"
			if category == CategoryProductive {
				barColor = "#22c55e"
			} else if category == CategoryDistracting {
				barColor = "#ef4444"
			}

			sb.WriteString(fmt.Sprintf(`
			<div style="display: flex; align-items: center; margin-bottom: 6px;">
				<div style="width: 80px; font-size: 0.8rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">%s</div>
				<div style="flex: 1; height: 16px; background: rgba(30, 41, 59, 0.5); border-radius: 4px; margin: 0 12px; overflow: hidden;">
					<div style="height: 100%%; width: %d%%; background: %s; border-radius: 4px;"></div>
				</div>
				<div style="width: 45px; text-align: right; font-size: 0.8rem; color: #94a3b8;">%s</div>
			</div>`, appName, barWidth, barColor, formatMinutes(int64(app.DurationSeconds/60))))
			count++
		}
		sb.WriteString(`</div>`)
	}

	sb.WriteString(`</div>`) // End main container

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
		// Use proper JSON encoding to handle special characters
		jsonData := map[string]interface{}{
			"title":     report.Title,
			"content":   content,
			"timeRange": report.TimeRange,
			"type":      report.ReportType,
			"createdAt": report.CreatedAt,
		}
		jsonBytes, err := json.Marshal(jsonData)
		if err != nil {
			return "", fmt.Errorf("failed to marshal JSON: %w", err)
		}
		return string(jsonBytes), nil
	case "pdf":
		return s.markdownToPDF(report.Title, content)
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

// markdownToPDF converts markdown to PDF.
func (s *ReportsService) markdownToPDF(title, md string) (string, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.AddPage()

	// Set up fonts
	pdf.SetFont("Arial", "B", 16)

	// Add title
	pdf.CellFormat(0, 10, title, "", 1, "C", false, 0, "")
	pdf.Ln(5)

	// Process markdown line by line
	pdf.SetFont("Arial", "", 11)
	lines := strings.Split(md, "\n")

	for i := 0; i < len(lines); i++ {
		line := lines[i]

		// Skip empty lines
		if strings.TrimSpace(line) == "" {
			pdf.Ln(3)
			continue
		}

		// Handle headers
		if strings.HasPrefix(line, "# ") {
			pdf.SetFont("Arial", "B", 16)
			pdf.MultiCell(0, 10, strings.TrimPrefix(line, "# "), "", "", false)
			pdf.SetFont("Arial", "", 11)
			pdf.Ln(2)
			continue
		} else if strings.HasPrefix(line, "## ") {
			pdf.SetFont("Arial", "B", 14)
			pdf.MultiCell(0, 8, strings.TrimPrefix(line, "## "), "", "", false)
			pdf.SetFont("Arial", "", 11)
			pdf.Ln(2)
			continue
		} else if strings.HasPrefix(line, "### ") {
			pdf.SetFont("Arial", "B", 12)
			pdf.MultiCell(0, 7, strings.TrimPrefix(line, "### "), "", "", false)
			pdf.SetFont("Arial", "", 11)
			pdf.Ln(2)
			continue
		}

		// Handle bullet points
		if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			text := strings.TrimPrefix(strings.TrimPrefix(line, "- "), "* ")
			// Remove markdown formatting for simplicity
			text = regexp.MustCompile(`\*\*(.+?)\*\*`).ReplaceAllString(text, "$1")
			text = regexp.MustCompile(`\*(.+?)\*`).ReplaceAllString(text, "$1")
			text = regexp.MustCompile("`(.+?)`").ReplaceAllString(text, "$1")

			pdf.SetX(15) // Indent
			pdf.MultiCell(0, 6, "• "+text, "", "", false)
			continue
		}

		// Regular text
		// Remove markdown formatting
		text := line
		text = regexp.MustCompile(`\*\*(.+?)\*\*`).ReplaceAllString(text, "$1")
		text = regexp.MustCompile(`\*(.+?)\*`).ReplaceAllString(text, "$1")
		text = regexp.MustCompile("`(.+?)`").ReplaceAllString(text, "$1")

		if strings.TrimSpace(text) != "" {
			pdf.MultiCell(0, 6, text, "", "", false)
		}
	}

	// Output to buffer
	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return "", fmt.Errorf("failed to generate PDF: %w", err)
	}

	return buf.String(), nil
}

// GetReport returns a report by ID with full content.
func (s *ReportsService) GetReport(id int64) (*Report, error) {
	storageReport, err := s.store.GetReport(id)
	if err != nil {
		return nil, err
	}
	return toServiceReport(storageReport), nil
}

// DailySummary represents a daily summary report for the list view.
type DailySummary struct {
	ID          int64  `json:"id"`
	Date        string `json:"date"`        // YYYY-MM-DD
	Summary     string `json:"summary"`     // Preview text (first ~200 chars)
	TotalTime   int64  `json:"totalTime"`   // Total active time in seconds
	SessionsCount int  `json:"sessionsCount"`
	CreatedAt   int64  `json:"createdAt"`
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

// GetDailySummaries returns auto-generated daily summary reports.
// Returns summaries for days with activity, most recent first.
func (s *ReportsService) GetDailySummaries(limit int) ([]*DailySummary, error) {
	if limit <= 0 {
		limit = 30 // Default to last 30 days
	}

	// Get all summary-type reports that cover full days
	reports, err := s.store.GetAllReports()
	if err != nil {
		return nil, err
	}

	var summaries []*DailySummary
	for _, r := range reports {
		// Filter to only summary reports for single days
		if r.ReportType != "summary" {
			continue
		}

		// Check if this is a single-day report
		if !r.StartTime.Valid || !r.EndTime.Valid {
			continue
		}

		startTime := time.Unix(r.StartTime.Int64, 0)
		endTime := time.Unix(r.EndTime.Int64, 0)

		// Check if start and end are on the same day
		if startTime.Format("2006-01-02") != endTime.Format("2006-01-02") {
			continue
		}

		// Get sessions for this day to calculate total time
		sessions, _ := s.store.GetSessionsByTimeRange(r.StartTime.Int64, r.EndTime.Int64)
		var totalTime int64
		for _, sess := range sessions {
			if sess.DurationSeconds.Valid {
				totalTime += sess.DurationSeconds.Int64
			}
		}

		// Extract preview text (first paragraph or ~200 chars)
		preview := extractPreview(r.Content.String)

		summaries = append(summaries, &DailySummary{
			ID:            r.ID,
			Date:          startTime.Format("2006-01-02"),
			Summary:       preview,
			TotalTime:     totalTime,
			SessionsCount: len(sessions),
			CreatedAt:     r.CreatedAt,
		})

		if len(summaries) >= limit {
			break
		}
	}

	return summaries, nil
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

// parseFlexibleDate parses a date string in various common formats
// Input is expected to be lowercase (already lowercased by caller)
func parseFlexibleDate(input string) (time.Time, bool) {
	input = strings.TrimSpace(input)

	// Map of lowercase month abbreviations/names to Go format month
	monthMap := map[string]time.Month{
		"jan": time.January, "january": time.January,
		"feb": time.February, "february": time.February,
		"mar": time.March, "march": time.March,
		"apr": time.April, "april": time.April,
		"may": time.May,
		"jun": time.June, "june": time.June,
		"jul": time.July, "july": time.July,
		"aug": time.August, "august": time.August,
		"sep": time.September, "september": time.September,
		"oct": time.October, "october": time.October,
		"nov": time.November, "november": time.November,
		"dec": time.December, "december": time.December,
	}

	// Try "month day, year" format (e.g., "jan 5, 2026")
	monthDayYearRe := regexp.MustCompile(`^([a-z]+)\s+(\d{1,2}),?\s*(\d{4})$`)
	if matches := monthDayYearRe.FindStringSubmatch(input); len(matches) == 4 {
		month, ok := monthMap[matches[1]]
		if ok {
			day, _ := strconv.Atoi(matches[2])
			year, _ := strconv.Atoi(matches[3])
			return time.Date(year, month, day, 0, 0, 0, 0, time.Local), true
		}
	}

	// Try "day month year" format (e.g., "5 jan 2026")
	dayMonthYearRe := regexp.MustCompile(`^(\d{1,2})\s+([a-z]+)\s+(\d{4})$`)
	if matches := dayMonthYearRe.FindStringSubmatch(input); len(matches) == 4 {
		month, ok := monthMap[matches[2]]
		if ok {
			day, _ := strconv.Atoi(matches[1])
			year, _ := strconv.Atoi(matches[3])
			return time.Date(year, month, day, 0, 0, 0, 0, time.Local), true
		}
	}

	// Try standard formats
	formats := []string{
		"2006-01-02", // 2026-01-05
		"01/02/2006", // 01/05/2026
		"1/2/2006",   // 1/5/2026
	}

	for _, format := range formats {
		if parsed, err := time.ParseInLocation(format, input, time.Local); err == nil {
			return parsed, true
		}
	}

	return time.Time{}, false
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
		} else if parsedStart, parsedEnd, rangeLabel, ok := parseDateRange(input); ok {
			// Try parsing as date range (e.g., "jan 5, 2026 - jan 12, 2026")
			start = parsedStart
			end = parsedEnd.Add(24 * time.Hour) // Include the end date
			label = rangeLabel
		} else {
			// Try parsing as date
			parsed, err := time.ParseInLocation("2006-01-02", input, time.Local)
			if err != nil {
				// Try month name
				parsed, err = time.ParseInLocation("January 2006", input, time.Local)
				if err != nil {
					parsed, err = time.ParseInLocation("January", input, time.Local)
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

// DeleteReport deletes a report by ID.
func (s *ReportsService) DeleteReport(reportID int64) error {
	return s.store.DeleteReport(reportID)
}
