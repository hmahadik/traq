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
	store     *storage.Store
	timeline  *TimelineService
	analytics *AnalyticsService
	projects  *ProjectAssignmentService
}

// NewReportsService creates a new ReportsService.
func NewReportsService(store *storage.Store, timeline *TimelineService, analytics *AnalyticsService, projects *ProjectAssignmentService) *ReportsService {
	return &ReportsService{
		store:     store,
		timeline:  timeline,
		analytics: analytics,
		projects:  projects,
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

// GenerateReportWithFilter generates a report filtered by project ID.
// If projectID is 0, returns all activities (same as GenerateReport).
func (s *ReportsService) GenerateReportWithFilter(timeRange, reportType string, includeScreenshots bool, projectID int64) (*Report, error) {
	// If no project filter, use standard report generation
	if projectID == 0 {
		return s.GenerateReport(timeRange, reportType, includeScreenshots)
	}

	// Parse time range
	tr, err := s.ParseTimeRange(timeRange)
	if err != nil {
		return nil, fmt.Errorf("failed to parse time range: %w", err)
	}

	// Get project info for the report title
	project, _ := s.store.GetProject(projectID)
	projectName := "Unknown Project"
	if project != nil {
		projectName = project.Name
	}

	// Get filtered focus events
	focusEvents, err := s.store.GetFocusEventsByProject(tr.Start, tr.End, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to get project events: %w", err)
	}

	// Build a simple project-focused report
	content := s.buildProjectReport(projectName, tr, focusEvents)

	// Save report
	storageReport := &storage.Report{
		Title:      fmt.Sprintf("Project Report: %s (%s)", projectName, tr.Label),
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
		// The content is already HTML from the new generateSummaryReport
		// Wrap it in a basic HTML document structure
		return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>%s</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }
</style>
</head>
<body>
%s
</body>
</html>`, report.Title, content), nil

	case "markdown":
		// Regenerate markdown from the same time range
		if !report.StartTime.Valid || !report.EndTime.Valid {
			return "", fmt.Errorf("report missing time range data for markdown export")
		}

		startDate := time.Unix(report.StartTime.Int64, 0).Format("2006-01-02")
		endDate := time.Unix(report.EndTime.Int64, 0).Format("2006-01-02")

		tr := &TimeRange{
			Start:     report.StartTime.Int64,
			End:       report.EndTime.Int64,
			StartDate: startDate,
			EndDate:   endDate,
		}

		return s.generateSummaryReportMarkdown(tr)

	default:
		// Default to HTML content
		return content, nil
	}
}

// GetReport returns a report by ID with full content.
func (s *ReportsService) GetReport(id int64) (*Report, error) {
	storageReport, err := s.store.GetReport(id)
	if err != nil {
		return nil, err
	}
	return toServiceReport(storageReport), nil
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

// ParseTimeRange parses natural language time input.
func (s *ReportsService) ParseTimeRange(input string) (*TimeRange, error) {
	now := time.Now()
	input = strings.ToLower(strings.TrimSpace(input))

	var start, end time.Time
	var label string

	switch input {
	case "today":
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
		end = start.AddDate(0, 0, 1)
		label = "Today"

	case "yesterday":
		start = time.Date(now.Year(), now.Month(), now.Day()-1, 0, 0, 0, 0, time.Local)
		end = start.AddDate(0, 0, 1)
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
			end = parsedEnd.AddDate(0, 0, 1) // Include the end date
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
				end = start.AddDate(0, 0, 1)
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
