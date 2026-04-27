// Summary report generation for the reports service.

package service

import (
	"fmt"
	"strings"
	"time"

	"traq/internal/storage"
)

// buildProjectReport creates an HTML report for a specific project's activities.
func (s *ReportsService) buildProjectReport(projectName string, tr *TimeRange, events []*storage.WindowFocusEvent) string {
	var sb strings.Builder

	// Calculate totals
	var totalMinutes float64
	appUsage := make(map[string]float64)
	for _, e := range events {
		mins := e.DurationSeconds / 60.0
		totalMinutes += mins
		appUsage[e.AppName] += mins
	}

	// Header
	sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 24px;">
		<h1 style="font-size: 1.5rem; font-weight: 700; color: #f1f5f9; margin-bottom: 8px;">📊 %s</h1>
		<p style="color: #94a3b8; font-size: 0.9rem;">%s to %s</p>
	</div>`, projectName, tr.StartDate, tr.EndDate))

	// Summary stats
	sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 16px; margin-bottom: 24px;">
		<div style="background: rgba(99, 102, 241, 0.1); padding: 16px; border-radius: 8px; flex: 1;">
			<div style="font-size: 2rem; font-weight: 700; color: #6366f1;">%s</div>
			<div style="color: #94a3b8; font-size: 0.85rem;">Total Time</div>
		</div>
		<div style="background: rgba(34, 197, 94, 0.1); padding: 16px; border-radius: 8px; flex: 1;">
			<div style="font-size: 2rem; font-weight: 700; color: #22c55e;">%d</div>
			<div style="color: #94a3b8; font-size: 0.85rem;">Activities</div>
		</div>
		<div style="background: rgba(249, 115, 22, 0.1); padding: 16px; border-radius: 8px; flex: 1;">
			<div style="font-size: 2rem; font-weight: 700; color: #f97316;">%d</div>
			<div style="color: #94a3b8; font-size: 0.85rem;">Apps Used</div>
		</div>
	</div>`, formatMinutes(int64(totalMinutes)), len(events), len(appUsage)))

	// App breakdown
	if len(appUsage) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<h2 style="font-size: 1.1rem; font-weight: 600; color: #e2e8f0; margin-bottom: 12px;">📱 App Usage</h2>
			<div style="background: rgba(30, 41, 59, 0.5); border-radius: 8px; padding: 16px;">`)

		// Sort apps by usage
		type appTime struct {
			name    string
			minutes float64
		}
		apps := make([]appTime, 0, len(appUsage))
		for name, mins := range appUsage {
			apps = append(apps, appTime{name, mins})
		}
		// Sort by minutes descending
		for i := 0; i < len(apps); i++ {
			for j := i + 1; j < len(apps); j++ {
				if apps[j].minutes > apps[i].minutes {
					apps[i], apps[j] = apps[j], apps[i]
				}
			}
		}

		for _, app := range apps {
			pct := 0.0
			if totalMinutes > 0 {
				pct = (app.minutes / totalMinutes) * 100
			}
			sb.WriteString(fmt.Sprintf(`<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(51, 65, 85, 0.5);">
				<span style="color: #e2e8f0;">%s</span>
				<span style="color: #94a3b8;">%s (%.0f%%)</span>
			</div>`, esc(app.name), formatMinutes(int64(app.minutes)), pct))
		}

		sb.WriteString(`</div></div>`)
	}

	return sb.String()
}

// generateSummaryReport creates a visual HTML summary report using the unified weekly summary data.
func (s *ReportsService) generateSummaryReport(tr *TimeRange, includeScreenshots bool) (string, error) {
	// Use the same data building as the CLI weekly summary
	data, err := s.buildWeeklySummaryData(tr.Start, tr.End, tr.StartDate, tr.EndDate)
	if err != nil {
		return "", fmt.Errorf("failed to build summary data: %w", err)
	}

	// Format as HTML for display in the UI
	return s.formatWeeklySummaryHTML(data), nil
}

// generateSummaryReportMarkdown generates a markdown version of the summary report.
// This is used for markdown export.
func (s *ReportsService) generateSummaryReportMarkdown(tr *TimeRange) (string, error) {
	data, err := s.buildWeeklySummaryData(tr.Start, tr.End, tr.StartDate, tr.EndDate)
	if err != nil {
		return "", fmt.Errorf("failed to build summary data: %w", err)
	}
	return s.formatWeeklySummaryMarkdown(data), nil
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
