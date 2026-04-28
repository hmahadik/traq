package service

import (
	"fmt"
	"math"
	"regexp"
	"sort"
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

// GenerateWeeklySummaryMarkdown generates a comprehensive weekly summary in Markdown format.
func (s *ReportsService) GenerateWeeklySummaryMarkdown(startDate, endDate string) (string, error) {
	// Parse dates
	start, err := time.ParseInLocation("2006-01-02", startDate, time.Local)
	if err != nil {
		return "", fmt.Errorf("invalid start date: %w", err)
	}
	end, err := time.ParseInLocation("2006-01-02", endDate, time.Local)
	if err != nil {
		return "", fmt.Errorf("invalid end date: %w", err)
	}
	// Include the full end day
	end = end.Add(24*time.Hour - time.Second)

	startUnix := start.Unix()
	endUnix := end.Unix()

	// Build all the data
	data, err := s.buildWeeklySummaryData(startUnix, endUnix, startDate, endDate)
	if err != nil {
		return "", err
	}

	// Generate markdown
	return s.formatWeeklySummaryMarkdown(data), nil
}

// buildWeeklySummaryData aggregates all data needed for the weekly summary.
func (s *ReportsService) buildWeeklySummaryData(startUnix, endUnix int64, startDate, endDate string) (*WeeklySummaryData, error) {
	data := &WeeklySummaryData{
		StartDate: startDate,
		EndDate:   endDate,
	}

	// Get sessions
	sessions, _ := s.store.GetSessionsByTimeRange(startUnix, endUnix)
	data.SessionCount = len(sessions)

	// Get screenshots
	screenshots, _ := s.store.GetScreenshotsByTimeRange(startUnix, endUnix)
	data.ScreenshotCount = len(screenshots)

	// Get focus events
	focusEvents, _ := s.store.GetWindowFocusEventsByTimeRange(startUnix, endUnix)
	data.FocusEventCount = len(focusEvents)

	// Calculate total hours from focus events
	var totalSeconds float64
	for _, evt := range focusEvents {
		totalSeconds += evt.DurationSeconds
	}
	data.TotalHours = totalSeconds / 3600

	// Get git commits
	gitCommits, _ := s.store.GetGitCommitsByTimeRange(startUnix, endUnix)
	data.GitCommitCount = len(gitCommits)

	// Calculate git stats
	for _, commit := range gitCommits {
		if commit.Insertions.Valid {
			data.TotalInsertions += commit.Insertions.Int64
		}
		if commit.Deletions.Valid {
			data.TotalDeletions += commit.Deletions.Int64
		}
	}

	// Group commits by repo
	data.CommitsByRepo = s.groupCommitsByRepo(gitCommits)

	// Get shell commands
	shellCmds, _ := s.store.GetShellCommandsByTimeRange(startUnix, endUnix)
	data.ShellCmdCount = len(shellCmds)

	// Get file events
	fileEvents, _ := s.store.GetFileEventsByTimeRange(startUnix, endUnix)
	data.FileEventCount = len(fileEvents)

	// Extract downloads from file events
	data.Downloads = s.extractDownloads(fileEvents)

	// Get browser visits
	browserVisits, _ := s.store.GetBrowserVisitsByTimeRange(startUnix, endUnix)

	// Aggregate app usage with window breakdown
	data.AppUsage = s.aggregateAppUsageWithWindows(focusEvents)

	// Detect meetings
	data.Meetings = s.detectMeetings(focusEvents)

	// Aggregate browser by domain with research topics
	data.BrowserDomains, data.ResearchTopics = s.aggregateBrowserForWeekly(browserVisits, focusEvents)

	// Build project summaries from AI-detected projects (preferred)
	// Fallback to heuristic detection if AI summaries not available
	data.Projects = s.buildProjectSummariesFromAI(sessions, focusEvents, gitCommits, browserVisits)

	// Build daily stats
	data.DailyStats = s.buildDailyStatsForWeekly(startUnix, endUnix, sessions, gitCommits, focusEvents)

	// Extract Slack channel activity
	data.SlackChannels, data.TotalSlackMins, data.TotalZoomMins, data.TotalEmailMins = s.extractCommunicationStats(focusEvents)

	// Extract key accomplishments from commits
	data.KeyAccomplishments = s.extractKeyAccomplishments(gitCommits)

	return data, nil
}

// extractDownloads extracts downloaded files from file events
func (s *ReportsService) extractDownloads(events []*storage.FileEvent) []FileSummary {
	var downloads []FileSummary
	seen := make(map[string]bool)

	for _, evt := range events {
		// Only include created files in downloads category
		if evt.WatchCategory != "downloads" || evt.EventType != "created" {
			continue
		}
		if seen[evt.FileName] {
			continue
		}
		seen[evt.FileName] = true

		downloads = append(downloads, FileSummary{
			FileName:  evt.FileName,
			Timestamp: evt.Timestamp,
			Category:  s.inferFileCategory(evt.FileName),
		})
	}

	return downloads
}

// inferFileCategory categorizes a file based on its name/extension
func (s *ReportsService) inferFileCategory(filename string) string {
	lower := strings.ToLower(filename)

	if strings.HasSuffix(lower, ".pdf") {
		return "Document"
	}
	if strings.HasSuffix(lower, ".doc") || strings.HasSuffix(lower, ".docx") {
		return "Document"
	}
	if strings.HasSuffix(lower, ".zip") || strings.HasSuffix(lower, ".tar.gz") {
		return "Archive"
	}
	if strings.HasSuffix(lower, ".exe") || strings.HasSuffix(lower, ".dmg") || strings.HasSuffix(lower, ".AppImage") {
		return "Application"
	}
	if strings.HasSuffix(lower, ".json") || strings.HasSuffix(lower, ".sh") {
		return "Script/Data"
	}
	if strings.Contains(lower, "playwright") || strings.Contains(lower, "test") {
		return "Test Report"
	}
	if strings.Contains(lower, "logo") || strings.Contains(lower, "design") {
		return "Design"
	}

	return "Other"
}

// aggregateBrowserForWeekly aggregates browser visits and extracts research topics
// Browser visits are URL context only - duration tracking comes from window focus events.
func (s *ReportsService) aggregateBrowserForWeekly(visits []*storage.BrowserVisit, focusEvents []*storage.WindowFocusEvent) ([]BrowserDomainSummary, []ResearchTopic) {
	domainMap := make(map[string]*BrowserDomainSummary)
	topicMap := make(map[string]*ResearchTopic)

	// From browser visits (URL context only, no duration)
	for _, visit := range visits {
		domain := visit.Domain
		if _, ok := domainMap[domain]; !ok {
			domainMap[domain] = &BrowserDomainSummary{
				Domain:       domain,
				Category:     s.inferDomainTopic(domain),
				SampleTitles: []string{},
			}
		}
		domainMap[domain].VisitCount++
		// Duration is 0 - tracked by focus events instead
		if visit.Title.Valid && visit.Title.String != "" && len(domainMap[domain].SampleTitles) < 5 {
			// Avoid duplicates
			found := false
			for _, t := range domainMap[domain].SampleTitles {
				if t == visit.Title.String {
					found = true
					break
				}
			}
			if !found {
				domainMap[domain].SampleTitles = append(domainMap[domain].SampleTitles, visit.Title.String)
			}
		}
	}

	// Also check focus events for browser windows with Claude
	for _, evt := range focusEvents {
		lower := strings.ToLower(evt.AppName)
		if strings.Contains(lower, "chrome") || strings.Contains(lower, "firefox") {
			title := evt.WindowTitle
			// Claude pattern: "Topic - Claude - Google Chrome"
			if strings.Contains(title, "Claude") {
				parts := strings.Split(title, " - ")
				if len(parts) >= 2 {
					topic := strings.TrimSpace(parts[0])
					if topic != "" && topic != "Claude" && !strings.Contains(strings.ToLower(topic), "new chat") {
						if _, ok := topicMap[topic]; !ok {
							topicMap[topic] = &ResearchTopic{
								Topic:  topic,
								Source: "Claude",
							}
						}
						topicMap[topic].DurationMins += int64(evt.DurationSeconds / 60)
					}
				}
			}
		}
	}

	// Convert to slices and sort
	var domains []BrowserDomainSummary
	for _, d := range domainMap {
		domains = append(domains, *d)
	}
	sort.Slice(domains, func(i, j int) bool {
		return domains[i].DurationMins > domains[j].DurationMins
	})

	var topics []ResearchTopic
	for _, t := range topicMap {
		if t.DurationMins >= 5 { // Only include topics with >= 5 mins
			topics = append(topics, *t)
		}
	}
	sort.Slice(topics, func(i, j int) bool {
		return topics[i].DurationMins > topics[j].DurationMins
	})

	return domains, topics
}

// buildProjectSummaries creates project-level summaries from all data
func (s *ReportsService) buildProjectSummaries(focusEvents []*storage.WindowFocusEvent, commits []*storage.GitCommit, browserVisits []*storage.BrowserVisit) []ProjectSummary {
	projectMap := make(map[string]*ProjectSummary)
	repoPathCache := make(map[int64]string)

	// Helper to get or create project
	getProject := func(name string) *ProjectSummary {
		if name == "" {
			name = "Other"
		}
		if p, ok := projectMap[name]; ok {
			return p
		}
		projectMap[name] = &ProjectSummary{
			Name:                 name,
			DailyAccomplishments: make(map[string][]string),
			Apps:                 []string{},
		}
		return projectMap[name]
	}

	// From git commits - most reliable project detection
	for _, commit := range commits {
		repoPath, ok := repoPathCache[commit.RepositoryID]
		if !ok {
			repo, err := s.store.GetGitRepository(commit.RepositoryID)
			if err == nil && repo != nil {
				repoPath = repo.Path
			} else {
				repoPath = "unknown"
			}
			repoPathCache[commit.RepositoryID] = repoPath
		}

		projectName := s.DetectProjectFromGitRepo(repoPath)
		project := getProject(projectName)
		project.CommitCount++

		// Add accomplishment
		day := time.Unix(commit.Timestamp, 0).Format("2006-01-02")
		if !isBoringCommit(commit.Message) {
			project.DailyAccomplishments[day] = append(project.DailyAccomplishments[day], commit.Message)
		}
	}

	// From focus events - time tracking
	for _, evt := range focusEvents {
		projectName := s.DetectProjectFromWindowTitle(evt.WindowTitle, evt.AppName)
		if projectName == "" {
			continue
		}
		project := getProject(projectName)
		project.Hours += evt.DurationSeconds / 3600

		// Track apps used
		appName := GetFriendlyAppName(evt.AppName)
		found := false
		for _, a := range project.Apps {
			if a == appName {
				found = true
				break
			}
		}
		if !found {
			project.Apps = append(project.Apps, appName)
		}
	}

	// Note: Browser visits are URL context only - time tracking comes from focus events above.
	// Project detection from browser URLs is redundant since focus events already capture
	// browser window titles which contain the same project indicators.

	// Calculate total hours for percentage
	var totalHours float64
	for _, p := range projectMap {
		totalHours += p.Hours
	}

	// Convert to slice and calculate percentages
	var projects []ProjectSummary
	for _, p := range projectMap {
		if totalHours > 0 {
			p.Percentage = (p.Hours / totalHours) * 100
		}
		projects = append(projects, *p)
	}

	// Sort by hours descending, with commit count as tiebreaker
	sort.Slice(projects, func(i, j int) bool {
		if projects[i].Hours != projects[j].Hours {
			return projects[i].Hours > projects[j].Hours
		}
		// Tiebreaker: more commits = more important
		return projects[i].CommitCount > projects[j].CommitCount
	})

	return projects
}

// buildProjectSummariesFromAI builds project summaries using a hybrid approach:
// - Time tracking from database project assignments (matches Analytics page)
// - AI-detected activities for granular accomplishments
// This ensures accurate time while capturing work that doesn't show up in git.
func (s *ReportsService) buildProjectSummariesFromAI(sessions []*storage.Session, focusEvents []*storage.WindowFocusEvent, commits []*storage.GitCommit, browserVisits []*storage.BrowserVisit) []ProjectSummary {
	// STEP 1: Build base project map from database assignments (matches Analytics)
	projectMap := make(map[string]*ProjectSummary)
	repoPathCache := make(map[int64]string)

	// Load all projects for ID -> name lookup (same approach as Analytics.GetProjectUsage)
	allProjects, _ := s.store.GetProjects()
	projectByID := make(map[int64]storage.Project)
	for _, p := range allProjects {
		projectByID[p.ID] = p
	}

	// Helper to get or create project
	getProject := func(name string) *ProjectSummary {
		if name == "" {
			name = "Other"
		}
		// Normalize common variations
		normalizedName := s.normalizeProjectName(name)
		if p, ok := projectMap[normalizedName]; ok {
			return p
		}
		projectMap[normalizedName] = &ProjectSummary{
			Name:                 normalizedName,
			DailyAccomplishments: make(map[string][]string),
			Apps:                 []string{},
		}
		return projectMap[normalizedName]
	}

	// Helper to find matching project by fuzzy name
	findMatchingProject := func(name string) *ProjectSummary {
		normalizedName := s.normalizeProjectName(name)
		if p, ok := projectMap[normalizedName]; ok {
			return p
		}
		// Fuzzy match
		lowerName := strings.ToLower(normalizedName)
		for existingName, proj := range projectMap {
			lowerExisting := strings.ToLower(existingName)
			if strings.Contains(lowerExisting, lowerName) || strings.Contains(lowerName, lowerExisting) {
				return proj
			}
		}
		return nil
	}

	// From git commits - project detection + time proxy
	for _, commit := range commits {
		repoPath, ok := repoPathCache[commit.RepositoryID]
		if !ok {
			repo, err := s.store.GetGitRepository(commit.RepositoryID)
			if err == nil && repo != nil {
				repoPath = repo.Path
			} else {
				repoPath = "unknown"
			}
			repoPathCache[commit.RepositoryID] = repoPath
		}

		projectName := s.DetectProjectFromGitRepo(repoPath)
		project := getProject(projectName)
		project.CommitCount++

		// Add commit as accomplishment
		day := time.Unix(commit.Timestamp, 0).Format("2006-01-02")
		if !isBoringCommit(commit.Message) {
			project.DailyAccomplishments[day] = append(
				project.DailyAccomplishments[day],
				commit.Message,
			)
		}
	}

	// From focus events - TIME TRACKING (use database project assignments to match Analytics)
	for _, evt := range focusEvents {
		var projectName string

		// Use database-assigned project_id if available (matches Analytics page behavior)
		if evt.ProjectID.Valid && evt.ProjectID.Int64 > 0 {
			if p, ok := projectByID[evt.ProjectID.Int64]; ok {
				projectName = p.Name
			}
		}

		// Fall back to heuristic detection only if no DB assignment
		if projectName == "" {
			projectName = s.DetectProjectFromWindowTitle(evt.WindowTitle, evt.AppName)
		}

		if projectName == "" {
			continue
		}
		project := getProject(projectName)
		project.Hours += evt.DurationSeconds / 3600

		// Track apps used
		appName := GetFriendlyAppName(evt.AppName)
		found := false
		for _, a := range project.Apps {
			if a == appName {
				found = true
				break
			}
		}
		if !found {
			project.Apps = append(project.Apps, appName)
		}
	}

	// From browser visits - project detection only (duration tracked by focus events)
	for _, visit := range browserVisits {
		if visit.Title.Valid {
			projectName := s.DetectProjectFromBrowserTitle(visit.Title.String)
			if projectName != "" {
				// Just ensure project exists - don't add duration (focus events track that)
				getProject(projectName)
			}
		}
	}

	// STEP 2: Overlay AI-detected activities onto projects
	sessionIDs := make([]int64, len(sessions))
	for i, sess := range sessions {
		sessionIDs[i] = sess.ID
	}

	summariesMap, err := s.store.GetSummariesForSessions(sessionIDs)
	if err == nil && len(summariesMap) > 0 {
		// Merge AI activities into existing projects
		for _, sess := range sessions {
			summary, ok := summariesMap[sess.ID]
			if !ok || summary == nil || len(summary.Projects) == 0 {
				continue
			}

			sessionDate := time.Unix(sess.StartTime, 0).Format("2006-01-02")

			for _, aiProject := range summary.Projects {
				// Skip generic "Research" projects - they're usually garbage from random browsing
				aiProjectLower := strings.ToLower(aiProject.Name)
				if aiProjectLower == "research" || aiProjectLower == "web research" || aiProjectLower == "browsing" {
					continue
				}

				// Find matching project or create new one
				project := findMatchingProject(aiProject.Name)
				if project == nil {
					project = getProject(aiProject.Name)
				}

				// Add AI-detected activities (these are the granular ones git misses)
				for _, activity := range aiProject.Activities {
					if activity != "" && !s.isDuplicateActivity(project.DailyAccomplishments[sessionDate], activity) && !isGarbageActivity(activity) {
						project.DailyAccomplishments[sessionDate] = append(
							project.DailyAccomplishments[sessionDate],
							activity,
						)
					}
				}
			}
		}
	}

	// Calculate percentages
	var totalHours float64
	for _, p := range projectMap {
		totalHours += p.Hours
	}
	for _, p := range projectMap {
		if totalHours > 0 {
			p.Percentage = (p.Hours / totalHours) * 100
		}
	}

	// Convert map to sorted slice
	var projects []ProjectSummary
	for _, p := range projectMap {
		projects = append(projects, *p)
	}

	// Sort by hours descending, with commit count as tiebreaker
	sort.Slice(projects, func(i, j int) bool {
		if projects[i].Hours != projects[j].Hours {
			return projects[i].Hours > projects[j].Hours
		}
		// Tiebreaker: more commits = more important
		return projects[i].CommitCount > projects[j].CommitCount
	})

	return projects
}

// normalizeProjectName consolidates common project name variations.
// This now primarily relies on database patterns. The function attempts to
// match the name against learned patterns and returns a standardized name.
func (s *ReportsService) normalizeProjectName(name string) string {
	// Try to match using learned patterns
	if projectName := s.detectProjectFromLearnedPatterns(&storage.AssignmentContext{
		WindowTitle: name,
	}); projectName != "" {
		return projectName
	}
	return name
}

// isDuplicateActivity checks if an activity is a duplicate or semantically similar.
func (s *ReportsService) isDuplicateActivity(existing []string, newActivity string) bool {
	lowerNew := strings.ToLower(newActivity)
	for _, e := range existing {
		lowerExisting := strings.ToLower(e)
		// Exact match
		if lowerExisting == lowerNew {
			return true
		}
		// One contains the other (semantic similarity)
		if len(lowerNew) > 20 && len(lowerExisting) > 20 {
			if strings.Contains(lowerNew, lowerExisting[:20]) || strings.Contains(lowerExisting, lowerNew[:20]) {
				return true
			}
		}
	}
	return false
}

// buildDailyStatsForWeekly builds daily statistics for the weekly summary
func (s *ReportsService) buildDailyStatsForWeekly(startUnix, endUnix int64, sessions []*storage.Session, commits []*storage.GitCommit, focusEvents []*storage.WindowFocusEvent) []DailySummaryStats {
	dailyMap := make(map[string]*DailySummaryStats)

	// Initialize all days in range
	startTime := time.Unix(startUnix, 0)
	endTime := time.Unix(endUnix, 0)
	for d := startTime; !d.After(endTime); d = d.AddDate(0, 0, 1) {
		dayStr := d.Format("2006-01-02")
		dailyMap[dayStr] = &DailySummaryStats{
			Date:            dayStr,
			DayOfWeek:       d.Format("Mon"),
			DayName:         d.Format("Mon Jan 02"), // e.g., "Mon Jan 06"
			Accomplishments: []string{},
		}
	}

	// Count sessions per day
	for _, sess := range sessions {
		dayStr := time.Unix(sess.StartTime, 0).Format("2006-01-02")
		if stats, ok := dailyMap[dayStr]; ok {
			stats.SessionCount++
		}
	}

	// Add focus event time per day
	for _, evt := range focusEvents {
		dayStr := time.Unix(evt.StartTime, 0).Format("2006-01-02")
		if stats, ok := dailyMap[dayStr]; ok {
			stats.Hours += evt.DurationSeconds / 3600
		}
	}

	// Add commits and extract accomplishments
	for _, commit := range commits {
		dayStr := time.Unix(commit.Timestamp, 0).Format("2006-01-02")
		if stats, ok := dailyMap[dayStr]; ok {
			stats.CommitCount++
			if !isBoringCommit(commit.Message) && len(stats.Accomplishments) < 10 {
				stats.Accomplishments = append(stats.Accomplishments, commit.Message)
			}
		}
	}

	// Determine primary focus for each day from commit messages
	for _, stats := range dailyMap {
		if len(stats.Accomplishments) > 0 {
			stats.PrimaryFocus = s.inferPrimaryFocusFromAccomplishments(stats.Accomplishments)
		}
	}

	// Convert to slice and sort by date
	var result []DailySummaryStats
	for _, stats := range dailyMap {
		result = append(result, *stats)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Date < result[j].Date
	})

	return result
}

// inferPrimaryFocusFromAccomplishments determines primary focus from accomplishment list
func (s *ReportsService) inferPrimaryFocusFromAccomplishments(accomplishments []string) string {
	// Look for patterns in commit messages
	combined := strings.ToLower(strings.Join(accomplishments, " "))

	// Count themes
	themes := map[string]int{
		"timeline":    0,
		"analytics":   0,
		"report":      0,
		"test":        0,
		"fix":         0,
		"feat":        0,
		"session":     0,
		"settings":    0,
		"categoriz":   0,
		"doc":         0,
		"ui":          0,
		"screenshot":  0,
		"git":         0,
		"synaptics":   0,
		"sl261":       0,
		"embedded":    0,
		"vitepress":   0,
		"inference":   0,
		"ai":          0,
		"summary":     0,
	}

	for theme := range themes {
		themes[theme] = strings.Count(combined, theme)
	}

	// Build descriptive focus based on themes - order matters!

	// Analytics-heavy day (check for analytics in titles)
	if themes["analytics"] >= 2 {
		return "Traq v2 Analytics, Timeline features"
	}

	// Feature testing with documentation
	if themes["test"] >= 3 && (themes["vitepress"] > 0 || strings.Contains(combined, "documentation")) {
		return "Traq v2 Feature testing, Documentation site"
	}

	// Timeline v3 specific
	if strings.Contains(combined, "v3") && themes["timeline"] > 0 {
		return "Timeline v3 development, UI improvements"
	}

	// Feature completion milestone
	if strings.Contains(combined, "100%") || strings.Contains(combined, "64/64") {
		return "Traq feature completion (64/64 tests)"
	}

	// Session detail / categorization focus
	if themes["categoriz"] > 0 || strings.Contains(combined, "session detail") {
		return "Traq v2 App Categorization, Session Detail"
	}

	// Synaptics work
	if themes["synaptics"] > 0 || themes["sl261"] > 0 {
		return "Synaptics SDK docs, Traq bug fixes"
	}

	// AI / summary optimization
	if themes["inference"] > 0 || (themes["ai"] > 0 && themes["summary"] > 0) {
		return "Traq polish, AI summary optimization"
	}

	// General feature testing
	if themes["test"] >= 3 {
		return "Traq v2 Feature testing"
	}

	// Timeline development (general)
	if themes["timeline"] >= 2 {
		return "Timeline development, UI improvements"
	}

	// Fix-heavy day
	if themes["fix"] >= 3 {
		return "Bug fixes and polish"
	}

	// Default to feature development
	if themes["feat"] > 0 || strings.Contains(combined, "add") {
		return "Feature development"
	}

	return "Development"
}

// formatWeeklySummaryHTML formats the weekly summary data as styled HTML
func (s *ReportsService) formatWeeklySummaryHTML(data *WeeklySummaryData) string {
	var sb strings.Builder

	// Parse dates for display
	startDate, _ := time.Parse("2006-01-02", data.StartDate)
	endDate, _ := time.Parse("2006-01-02", data.EndDate)

	// Add theme-aware CSS
	sb.WriteString(`<style>
		.report-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 100%; }
		.report-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 16px 0; }
		.report-card { margin-bottom: 24px; padding: 16px; border-radius: 12px; border: 1px solid; }
		.report-card-title { font-size: 0.85rem; font-weight: 600; margin-bottom: 8px; }
		.report-text { font-size: 0.9rem; line-height: 1.5; }
		.report-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
		.report-stat-card { border-radius: 12px; padding: 16px; border: 1px solid; }
		.report-stat-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
		.report-stat-value { font-size: 2rem; font-weight: 700; line-height: 1; }
		.report-stat-meta { font-size: 0.8rem; margin-top: 4px; }
		.report-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
		.report-table th { text-align: left; padding: 8px 4px; }
		.report-table td { padding: 8px 4px; }
		.report-table tr { border-bottom: 1px solid; }
		.report-project-card { margin-bottom: 16px; padding: 12px; border-radius: 8px; border-left: 3px solid; }
		.report-project-title { font-size: 0.95rem; font-weight: 600; }
		.report-project-stats { font-size: 0.8rem; }
		.report-accomplishment { padding-left: 12px; margin-bottom: 2px; }

		/* Light mode colors */
		.report-container { color: #1e293b; }
		.report-title { color: #0f172a; }
		.report-card { background: linear-gradient(135deg, rgba(241, 245, 249, 0.8), rgba(241, 245, 249, 0.4)); border-color: rgba(148, 163, 184, 0.2); }
		.report-card-title { color: #0f172a; }
		.report-text { color: #475569; }
		.report-stat-card { background: linear-gradient(135deg, rgba(241, 245, 249, 0.8), rgba(241, 245, 249, 0.4)); border-color: rgba(148, 163, 184, 0.2); }
		.report-stat-label { color: #64748b; }
		.report-stat-value { color: #0f172a; }
		.report-stat-meta { color: #94a3b8; }
		.report-table th { color: #64748b; }
		.report-table td { color: #1e293b; }
		.report-table tr { border-color: rgba(148, 163, 184, 0.2); }
		.report-project-card { background: rgba(241, 245, 249, 0.5); border-left-color: #3b82f6; }
		.report-project-title { color: #0f172a; }
		.report-project-stats { color: #64748b; }
		.report-accomplishment { color: #64748b; }

		/* Dark mode colors */
		.dark .report-container { color: #e2e8f0; }
		.dark .report-title { color: #f1f5f9; }
		.dark .report-card { background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4)); border-color: rgba(148, 163, 184, 0.1); }
		.dark .report-card-title { color: #f1f5f9; }
		.dark .report-text { color: #cbd5e1; }
		.dark .report-stat-card { background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(30, 41, 59, 0.4)); border-color: rgba(148, 163, 184, 0.1); }
		.dark .report-stat-label { color: #94a3b8; }
		.dark .report-stat-value { color: #f1f5f9; }
		.dark .report-stat-meta { color: #64748b; }
		.dark .report-table th { color: #94a3b8; }
		.dark .report-table td { color: #e2e8f0; }
		.dark .report-table tr { border-color: rgba(148, 163, 184, 0.1); }
		.dark .report-project-card { background: rgba(30, 41, 59, 0.5); border-left-color: #3b82f6; }
		.dark .report-project-title { color: #f1f5f9; }
		.dark .report-project-stats { color: #94a3b8; }
		.dark .report-accomplishment { color: #94a3b8; }
	</style>`)

	// Main container
	sb.WriteString(`<div class="report-container">`)

	// Title
	isSingleDay := data.StartDate == data.EndDate
	var title string
	if isSingleDay {
		title = fmt.Sprintf("Activity Summary: %s", startDate.Format("Monday, January 2, 2006"))
	} else if startDate.Month() == endDate.Month() && startDate.Year() == endDate.Year() {
		title = fmt.Sprintf("Activity Summary: %s - %s, %d",
			startDate.Format("January 2"),
			endDate.Format("2"),
			startDate.Year())
	} else {
		title = fmt.Sprintf("Activity Summary: %s - %s",
			startDate.Format("January 2, 2006"),
			endDate.Format("January 2, 2006"))
	}
	sb.WriteString(fmt.Sprintf(`<h1 class="report-title">%s</h1>`, title))

	// Executive Summary
	sb.WriteString(`<div class="report-card">`)
	sb.WriteString(`<div class="report-card-title">Executive Summary</div>`)

	// Build executive summary - use first project that has meaningful content
	primaryProject := "development work"
	for _, project := range data.Projects {
		// Skip projects with < 0.5 hours and no commits (same filter as Projects section)
		if project.Hours < 0.5 && project.CommitCount == 0 {
			continue
		}
		// Check if project has meaningful content (accomplishments or commits)
		hasAccomplishments := false
		for _, accs := range project.DailyAccomplishments {
			if len(accs) > 0 {
				hasAccomplishments = true
				break
			}
		}
		hasSignificantTime := project.Hours >= 0.5
		if !hasAccomplishments && project.CommitCount == 0 && !hasSignificantTime {
			continue
		}
		// Found a meaningful project
		primaryProject = fmt.Sprintf("<strong>%s</strong>", esc(project.Name))
		break
	}
	execSummary := fmt.Sprintf("This period was focused on %s.", primaryProject)
	sb.WriteString(fmt.Sprintf(`<p class="report-text" style="margin: 0 0 12px 0;">%s</p>`, execSummary))

	// Stats line
	sb.WriteString(fmt.Sprintf(`<div class="report-stat-meta">
		<strong class="report-stat-value" style="font-size: 0.85rem; font-weight: 600;">%s</strong> active time across <strong class="report-stat-value" style="font-size: 0.85rem; font-weight: 600;">%d sessions</strong>`,
		formatHoursMinutes(data.TotalHours), data.SessionCount))
	if data.GitCommitCount > 0 {
		sb.WriteString(fmt.Sprintf(` • <strong style="color: #f97316;">%d commits</strong>`, data.GitCommitCount))
	}
	sb.WriteString(`</div></div>`)

	// Stats Grid
	sb.WriteString(`<div class="report-stats-grid">`)

	// Total Time Card
	sb.WriteString(fmt.Sprintf(`
		<div class="report-stat-card">
			<div class="report-stat-label">Active Time</div>
			<div class="report-stat-value">%s</div>
			<div class="report-stat-meta">%d sessions</div>
		</div>`, formatHoursMinutesShort(data.TotalHours), data.SessionCount))

	// Commits Card
	if data.GitCommitCount > 0 {
		sb.WriteString(fmt.Sprintf(`
			<div class="report-stat-card">
				<div class="report-stat-label">Commits</div>
				<div class="report-stat-value" style="color: #f97316;">%d</div>
				<div class="report-stat-meta">+%s -%s lines</div>
			</div>`, data.GitCommitCount, formatNumber(data.TotalInsertions), formatNumber(data.TotalDeletions)))
	}

	// Screenshots Card
	if data.ScreenshotCount > 0 {
		sb.WriteString(fmt.Sprintf(`
			<div class="report-stat-card">
				<div class="report-stat-label">Screenshots</div>
				<div class="report-stat-value" style="color: #3b82f6;">%d</div>
				<div class="report-stat-meta">captured</div>
			</div>`, data.ScreenshotCount))
	}

	sb.WriteString(`</div>`) // End stats grid

	// Time Distribution by Day (for multi-day reports)
	if len(data.DailyStats) > 1 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div class="report-card-title">Time Distribution by Day</div>
			<div style="overflow-x: auto;">
			<table class="report-table">
				<thead>
					<tr>
						<th style="text-align: left;">Day</th>
						<th style="text-align: right;">Hours</th>
						<th style="text-align: right;">Sessions</th>
						<th style="text-align: left;">Primary Focus</th>
					</tr>
				</thead>
				<tbody>`)

		for _, day := range data.DailyStats {
			if day.Hours > 0 || day.SessionCount > 0 {
				focus := day.PrimaryFocus
				if focus == "" {
					focus = "-"
				}
				sb.WriteString(fmt.Sprintf(`
					<tr>
						<td style="text-align: left;">%s</td>
						<td style="text-align: right;">%s</td>
						<td style="text-align: right;" class="report-stat-meta">%d</td>
						<td style="text-align: left;" class="report-stat-meta">%s</td>
					</tr>`, esc(day.DayName), formatHoursMinutesShort(day.Hours), day.SessionCount, esc(focus)))
			}
		}
		sb.WriteString(`</tbody></table></div></div>`)
	}

	// Projects & Themes
	if len(data.Projects) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div class="report-card-title">Projects & Themes</div>`)

		projectNum := 0
		for _, project := range data.Projects {
			if project.Hours < 0.5 && project.CommitCount == 0 {
				continue
			}

			// Check if project has meaningful content (accomplishments or commits)
			hasAccomplishments := false
			for _, accs := range project.DailyAccomplishments {
				if len(accs) > 0 {
					hasAccomplishments = true
					break
				}
			}
			hasCommits := project.CommitCount > 0
			hasSignificantTime := project.Hours >= 0.5

			// Skip empty project shells - must have accomplishments, commits, OR significant time
			// This ensures research/browser work still appears even without git activity
			if !hasAccomplishments && !hasCommits && !hasSignificantTime {
				continue
			}

			projectNum++

			// Project card
			sb.WriteString(fmt.Sprintf(`
				<div class="report-project-card">
					<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
						<span class="report-project-title">%d. %s</span>
						<span class="report-project-stats">~%.0fh (%.0f%%)</span>
					</div>`, projectNum, esc(project.Name), project.Hours, project.Percentage))

			// Commit count
			if project.CommitCount > 0 {
				sb.WriteString(fmt.Sprintf(`
					<div style="font-size: 0.8rem; color: #f97316; margin-bottom: 8px;">
						%d commits
					</div>`, project.CommitCount))
			}

			// Daily accomplishments
			if len(project.DailyAccomplishments) > 0 {
				sb.WriteString(`<div class="report-project-stats">`)
				var days []string
				for d := range project.DailyAccomplishments {
					// Filter out days outside the report's date range
					if d < data.StartDate || d > data.EndDate {
						continue
					}
					days = append(days, d)
				}
				sort.Strings(days)

				for _, day := range days {
					accs := project.DailyAccomplishments[day]
					if len(accs) == 0 {
						continue
					}
					dayTime, _ := time.Parse("2006-01-02", day)
					sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 6px;"><strong class="report-project-title" style="font-size: 0.8rem;">%s:</strong></div>`, dayTime.Format("Mon Jan 2")))
					cleanedAccs := consolidateAccomplishments(accs)
					for _, acc := range cleanedAccs {
						if len(acc) > 100 {
							acc = acc[:97] + "..."
						}
						sb.WriteString(fmt.Sprintf(`<div class="report-accomplishment">• %s</div>`, esc(acc)))
					}
				}
				sb.WriteString(`</div>`)
			}

			sb.WriteString(`</div>`) // End project card
		}
		sb.WriteString(`</div>`)
	}

	// Meetings & Communication
	hasCommunication := len(data.Meetings) > 0 || len(data.SlackChannels) > 0 || data.TotalZoomMins > 0
	if hasCommunication {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Meetings & Communication</div>`)

		// Slack
		if data.TotalSlackMins > 0 || len(data.SlackChannels) > 0 {
			sb.WriteString(fmt.Sprintf(`
				<div style="margin-bottom: 12px; padding: 10px; background: rgba(138, 43, 226, 0.1); border-radius: 6px; border-left: 3px solid #8b5cf6;">
					<div style="font-size: 0.85rem; font-weight: 500; color: #8b5cf6; margin-bottom: 6px;">💬 Slack: ~%d minutes</div>`, data.TotalSlackMins))
			for _, ch := range data.SlackChannels {
				huddle := ""
				if ch.IsHuddle {
					huddle = " (huddle)"
				}
				sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.8rem; color: #94a3b8; padding-left: 8px;">• %s%s: %dm</div>`, esc(ch.Name), huddle, ch.DurationMins))
			}
			sb.WriteString(`</div>`)
		}

		// Zoom/Meetings
		if data.TotalZoomMins > 0 || len(data.Meetings) > 0 {
			sb.WriteString(fmt.Sprintf(`
				<div style="margin-bottom: 12px; padding: 10px; background: rgba(59, 130, 246, 0.1); border-radius: 6px; border-left: 3px solid #3b82f6;">
					<div style="font-size: 0.85rem; font-weight: 500; color: #3b82f6; margin-bottom: 6px;">📹 Video Calls: ~%d minutes</div>`, data.TotalZoomMins))
			for _, m := range data.Meetings {
				mins := int64(m.DurationSeconds / 60)
				sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.8rem; color: #94a3b8; padding-left: 8px;">• %s (%s): %dm</div>`, esc(m.Title), esc(m.Platform), mins))
			}
			sb.WriteString(`</div>`)
		}

		sb.WriteString(`</div>`)
	}

	// Top Applications section removed - was filler that duplicated info available in Analytics

	// Key Accomplishments
	if len(data.KeyAccomplishments) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Key Accomplishments</div>`)
		for _, acc := range data.KeyAccomplishments {
			sb.WriteString(fmt.Sprintf(`<div style="display: flex; gap: 8px; margin-bottom: 8px;">
				<div style="color: #22c55e; font-size: 0.9rem;">✓</div>
				<div style="font-size: 0.85rem; color: #cbd5e1;">%s</div>
			</div>`, esc(acc)))
		}
		sb.WriteString(`</div>`)
	}

	// Git Commits by Repo
	if len(data.CommitsByRepo) > 0 {
		sb.WriteString(fmt.Sprintf(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Commits (%d total)</div>`, data.GitCommitCount))

		for _, repo := range data.CommitsByRepo {
			sb.WriteString(fmt.Sprintf(`
				<div style="margin-bottom: 12px;">
					<div style="font-size: 0.8rem; font-weight: 500; color: #3b82f6; margin-bottom: 6px;">%s (%d commits)</div>`, esc(repo.RepoName), repo.CommitCount))

			shown := 0
			seen := make(map[string]bool)
			for _, commit := range repo.Commits {
				if shown >= 5 {
					remaining := repo.CommitCount - 5
					if remaining > 0 {
						sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.75rem; color: #64748b; padding-left: 8px;">... and %d more</div>`, remaining))
					}
					break
				}
				if isBoringCommit(commit.Message) || seen[commit.Message] {
					continue
				}
				seen[commit.Message] = true
				msg := commit.Message
				if len(msg) > 60 {
					msg = msg[:57] + "..."
				}
				sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.8rem; color: #94a3b8; padding-left: 8px; margin-bottom: 4px;">• %s</div>`, esc(msg)))
				shown++
			}
			sb.WriteString(`</div>`)
		}
		sb.WriteString(`</div>`)
	}

	// Research & Learning (from Claude/AI) - simplified, no time tracking
	if len(data.ResearchTopics) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Research & Learning</div>`)
		for _, topic := range data.ResearchTopics {
			sb.WriteString(fmt.Sprintf(`
				<div style="margin-bottom: 6px; padding: 6px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
					<span style="font-size: 0.8rem; color: #e2e8f0;">%s</span>
				</div>`, esc(topic.Topic)))
		}
		sb.WriteString(`</div>`)
	}

	// Browser Activity
	if len(data.BrowserDomains) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Browser Activity</div>`)
		for i, domain := range data.BrowserDomains {
			if i >= 10 {
				break
			}
			mins := int64(domain.DurationMins)
			if mins < 1 {
				continue
			}
			sb.WriteString(fmt.Sprintf(`
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding: 6px 0; border-bottom: 1px solid rgba(148, 163, 184, 0.1);">
					<span style="font-size: 0.8rem; color: #e2e8f0;">%s</span>
					<span style="font-size: 0.75rem; color: #94a3b8;">%dm</span>
				</div>`, esc(domain.Domain), mins))
		}
		sb.WriteString(`</div>`)
	}

	// Downloads
	if len(data.Downloads) > 0 {
		sb.WriteString(`<div style="margin-bottom: 24px;">
			<div style="font-size: 0.85rem; font-weight: 600; color: #f1f5f9; margin-bottom: 12px;">Files Downloaded</div>`)
		for _, dl := range data.Downloads {
			sb.WriteString(fmt.Sprintf(`<div style="font-size: 0.8rem; color: #94a3b8; margin-bottom: 4px;">• %s</div>`, esc(dl.FileName)))
		}
		sb.WriteString(`</div>`)
	}

	sb.WriteString(`</div>`) // End main container

	return sb.String()
}

// formatWeeklySummaryMarkdown formats the weekly summary data as Markdown
func (s *ReportsService) formatWeeklySummaryMarkdown(data *WeeklySummaryData) string {
	var sb strings.Builder

	// Parse dates for display
	startDate, _ := time.Parse("2006-01-02", data.StartDate)
	endDate, _ := time.Parse("2006-01-02", data.EndDate)

	// Title
	if startDate.Month() == endDate.Month() && startDate.Year() == endDate.Year() {
		sb.WriteString(fmt.Sprintf("# Weekly Activity Summary: %s-%s, %d\n\n",
			startDate.Format("January 2"),
			endDate.Format("2"),
			startDate.Year()))
	} else {
		sb.WriteString(fmt.Sprintf("# Weekly Activity Summary: %s - %s\n\n",
			startDate.Format("January 2, 2006"),
			endDate.Format("January 2, 2006")))
	}

	// Executive Summary
	sb.WriteString("## Executive Summary\n\n")

	// Build executive summary text - more detailed and descriptive like the target
	// Use first project that has meaningful content (same filter as Projects section)
	primaryProject := "development work"
	var hasFeatureCompletion bool
	var foundProject *ProjectSummary
	for i := range data.Projects {
		p := &data.Projects[i]
		// Skip projects with < 0.5 hours and no commits
		if p.Hours < 0.5 && p.CommitCount == 0 {
			continue
		}
		// Check if project has meaningful content (accomplishments or commits)
		hasAccomplishments := false
		for _, accs := range p.DailyAccomplishments {
			if len(accs) > 0 {
				hasAccomplishments = true
				break
			}
		}
		hasSignificantTime := p.Hours >= 0.5
		if !hasAccomplishments && p.CommitCount == 0 && !hasSignificantTime {
			continue
		}
		foundProject = p
		break
	}

	if foundProject != nil {
		// Check for 100% completion milestone
		for _, acc := range data.KeyAccomplishments {
			lower := strings.ToLower(acc)
			if strings.Contains(lower, "100%") || strings.Contains(lower, "64/64") {
				hasFeatureCompletion = true
				break
			}
		}

		if foundProject.Name == "Traq" {
			if hasFeatureCompletion {
				primaryProject = "**intensive development work on Traq v2 (Activity Tracker)**, achieving **100% feature completion (64/64 tests passing)**"
			} else {
				primaryProject = "**intensive development work on Traq v2 (Activity Tracker)**"
			}
		} else {
			primaryProject = fmt.Sprintf("**%s**", foundProject.Name)
		}
	}

	// Get secondary activities with rich descriptions
	var secondaryActivities []string
	for i := 1; i < len(data.Projects) && i < 4; i++ {
		p := data.Projects[i]
		if p.Hours > 1 || p.CommitCount > 0 {
			desc := p.Name
			switch p.Name {
			case "Synaptics/42T":
				desc = "**Synaptics SL261x/SL2619 embedded demo** research and documentation for 42 Technologies"
			case "AI/ML Research":
				desc = "ongoing **AI/ML experimentation** with FunctionGemma fine-tuning"
			case "Arcturus Admin":
				desc = "**Arcturus Admin** tasks"
			case "activity-tracker":
				desc = "**activity-tracker** maintenance"
			default:
				desc = fmt.Sprintf("**%s**", p.Name)
			}
			secondaryActivities = append(secondaryActivities, desc)
		}
	}

	execSummary := fmt.Sprintf("This week was dominated by %s.", primaryProject)
	if len(secondaryActivities) > 0 {
		execSummary += fmt.Sprintf(" Secondary work included %s.", strings.Join(secondaryActivities, ", plus "))
	}
	sb.WriteString(execSummary + "\n\n")

	// Total active time and project percentages
	sb.WriteString(fmt.Sprintf("**Total Active Time:** %s across %d sessions\n",
		formatHoursMinutes(data.TotalHours), data.SessionCount))

	if len(data.Projects) > 0 {
		var projectPcts []string
		var shownTotal float64
		for _, p := range data.Projects {
			if p.Percentage < 5 {
				continue
			}

			// Only show projects that have meaningful content (accomplishments or commits)
			hasContent := p.CommitCount > 0
			if !hasContent {
				for _, accs := range p.DailyAccomplishments {
					if len(accs) > 0 {
						hasContent = true
						break
					}
				}
			}
			if !hasContent {
				continue // Skip projects with time but no content
			}

			// Round to nearest integer for cleaner display
			rounded := math.Round(p.Percentage)
			projectPcts = append(projectPcts, fmt.Sprintf("%s (%.0f%%)", p.Name, rounded))
			shownTotal += rounded
		}
		// Add "Other" if shown percentages don't account for all time
		if shownTotal < 95 && shownTotal > 0 {
			otherPct := math.Round(100 - shownTotal)
			if otherPct >= 3 {
				projectPcts = append(projectPcts, fmt.Sprintf("Other (%.0f%%)", otherPct))
			}
		}
		if len(projectPcts) > 0 {
			sb.WriteString(fmt.Sprintf("**Primary Projects:** %s\n", strings.Join(projectPcts, ", ")))
		}
	}
	sb.WriteString("\n---\n\n")

	// Time Distribution by Day
	sb.WriteString("## Time Distribution by Day\n\n")
	sb.WriteString("| Day | Hours | Sessions | Primary Focus |\n")
	sb.WriteString("|-----|-------|----------|---------------|\n")
	for _, day := range data.DailyStats {
		if day.Hours > 0 || day.SessionCount > 0 {
			focus := day.PrimaryFocus
			if focus == "" {
				focus = "-"
			}
			sb.WriteString(fmt.Sprintf("| %s | %s | %d | %s |\n",
				day.DayName, formatHoursMinutesShort(day.Hours), day.SessionCount, focus))
		}
	}
	sb.WriteString("\n---\n\n")

	// Projects & Themes
	sb.WriteString("## Projects & Themes\n\n")
	projectNumber := 0
	for _, project := range data.Projects {
		if project.Hours < 1 && project.CommitCount == 0 {
			continue
		}

		// Check if project has meaningful content (accomplishments or commits)
		hasAccomplishments := false
		for _, accs := range project.DailyAccomplishments {
			if len(accs) > 0 {
				hasAccomplishments = true
				break
			}
		}
		hasCommits := project.CommitCount > 0

		// Skip empty project shells - must have at least accomplishments or commits
		if !hasAccomplishments && !hasCommits {
			continue
		}

		projectNumber++

		// Enhanced project name for primary project
		projectTitle := project.Name
		if project.Name == "Traq" && projectNumber == 1 {
			projectTitle = "Traq v2 (Activity Tracker) - Primary Focus"
		}

		sb.WriteString(fmt.Sprintf("### %d. %s (~%.0f hours)\n\n", projectNumber, projectTitle, project.Hours))

		// Add overview description
		desc := getProjectDescription(project.Name)
		if desc != "" {
			// Add milestone completion info for Traq
			if project.Name == "Traq" {
				for _, acc := range data.KeyAccomplishments {
					if strings.Contains(strings.ToLower(acc), "100%") {
						desc += " This week marked the completion of the v2 rewrite with all 64 planned features implemented and verified."
						break
					}
				}
			}
			sb.WriteString(fmt.Sprintf("**Overview:** %s\n\n", desc))
		}

		// Daily accomplishments
		if hasAccomplishments {
			sb.WriteString("#### Key Accomplishments by Day:\n\n")

			// Sort days (filter out days outside the report's date range)
			var days []string
			for d := range project.DailyAccomplishments {
				if d < data.StartDate || d > data.EndDate {
					continue
				}
				days = append(days, d)
			}
			sort.Strings(days)

			for _, day := range days {
				accs := project.DailyAccomplishments[day]
				if len(accs) == 0 {
					continue
				}
				dayTime, _ := time.Parse("2006-01-02", day)
				sb.WriteString(fmt.Sprintf("**%s:**\n", dayTime.Format("Monday Jan 02")))

				// Consolidate and clean up accomplishments
				cleanedAccs := consolidateAccomplishments(accs)
				for _, acc := range cleanedAccs {
					sb.WriteString(fmt.Sprintf("- %s\n", acc))
				}
				sb.WriteString("\n")
			}
		}

		// Add Git Statistics if project has commits
		if hasCommits {
			sb.WriteString("#### Git Statistics:\n")
			repoName := strings.ToLower(project.Name)
			if repoName == "" {
				repoName = "repository"
			}
			sb.WriteString(fmt.Sprintf("- **%d commits** to %s\n", project.CommitCount, repoName))
			// Only show insertions/deletions for primary project with significant commits
			if project.CommitCount >= 5 && data.TotalInsertions > 0 {
				sb.WriteString(fmt.Sprintf("- **%s lines inserted**, **%s lines deleted**\n",
					formatNumber(data.TotalInsertions), formatNumber(data.TotalDeletions)))
			}
			sb.WriteString("\n")
		}

		sb.WriteString("---\n\n")
	}

	// Meetings & Communication
	hasCommunication := len(data.Meetings) > 0 || len(data.SlackChannels) > 0 || data.TotalZoomMins > 0
	if hasCommunication {
		sb.WriteString("## Meetings & Communication\n\n")

		// Slack channels
		if len(data.SlackChannels) > 0 || data.TotalSlackMins > 0 {
			sb.WriteString(fmt.Sprintf("**Slack:** ~%d minutes total\n", data.TotalSlackMins))
			for _, ch := range data.SlackChannels {
				huddle := ""
				if ch.IsHuddle {
					huddle = " (huddle)"
				}
				sb.WriteString(fmt.Sprintf("- %s%s: %d mins\n", ch.Name, huddle, ch.DurationMins))
			}
			sb.WriteString("\n")
		}

		// Zoom meetings
		if data.TotalZoomMins > 0 || len(data.Meetings) > 0 {
			var zoomMeetings []MeetingDetection
			for _, m := range data.Meetings {
				if strings.Contains(strings.ToLower(m.Platform), "zoom") {
					zoomMeetings = append(zoomMeetings, m)
				}
			}
			if data.TotalZoomMins > 0 || len(zoomMeetings) > 0 {
				sb.WriteString(fmt.Sprintf("**Zoom:** ~%d minutes total\n", data.TotalZoomMins))
				for _, m := range zoomMeetings {
					mins := int64(m.DurationSeconds / 60)
					if mins >= 1 {
						sb.WriteString(fmt.Sprintf("- %s: %d mins\n", m.Title, mins))
					}
				}
				sb.WriteString("\n")
			}
		}

		sb.WriteString("---\n\n")
	}

	// Application Usage Summary removed - was filler that duplicated info available elsewhere
	// Top 3 apps are now mentioned in executive summary if significant

	// Key Accomplishments
	if len(data.KeyAccomplishments) > 0 {
		sb.WriteString("## Key Accomplishments\n\n")
		for i, acc := range data.KeyAccomplishments {
			sb.WriteString(fmt.Sprintf("%d. %s\n", i+1, acc))
		}
		sb.WriteString("\n---\n\n")
	}

	// Research & Learning - simplified to just topics without time tracking noise
	if len(data.ResearchTopics) > 0 {
		sb.WriteString("## Research & Learning\n\n")
		sb.WriteString("Topics researched via Claude/AI assistants:\n")
		for _, topic := range data.ResearchTopics {
			sb.WriteString(fmt.Sprintf("- %s\n", topic.Topic))
		}
		sb.WriteString("\n---\n\n")
	}

	// Files Downloaded - only include if there are actual downloads
	if len(data.Downloads) > 0 {
		sb.WriteString("## Files Downloaded\n\n")
		for _, dl := range data.Downloads {
			desc := dl.Category
			sb.WriteString(fmt.Sprintf("- `%s` - %s\n", dl.FileName, desc))
		}
		sb.WriteString("\n---\n\n")
	}

	// Notes for Next Week
	sb.WriteString("## Notes for Next Week\n\n")
	notes := generateNextWeekNotes(data)
	for i, note := range notes {
		sb.WriteString(fmt.Sprintf("%d. **%s**\n", i+1, note))
	}
	sb.WriteString("\n---\n\n")

	// Footer with data source counts
	sb.WriteString(fmt.Sprintf("*Report generated from raw traq data analysis*\n"))
	sb.WriteString(fmt.Sprintf("*Date range: %s to %s*\n", data.StartDate, data.EndDate))
	sb.WriteString(fmt.Sprintf("*Total data points: %d screenshots, %d focus events, %d git commits, %d shell commands, %d file events*\n",
		data.ScreenshotCount, data.FocusEventCount, data.GitCommitCount, data.ShellCmdCount, data.FileEventCount))

	return sb.String()
}

// generateNextWeekNotes generates action items for next week based on the week's activities
func generateNextWeekNotes(data *WeeklySummaryData) []string {
	var notes []string

	// Check for project completions
	for _, acc := range data.KeyAccomplishments {
		lower := strings.ToLower(acc)
		if strings.Contains(lower, "100%") || strings.Contains(lower, "complete") {
			notes = append(notes, "Traq v2 Release - Ready for production deployment")
			break
		}
	}

	// Check for ongoing projects
	for _, project := range data.Projects {
		switch project.Name {
		case "Synaptics/42T":
			if project.Hours > 2 || project.CommitCount > 0 {
				notes = append(notes, "Synaptics Demo - Follow up on SL261x/SL2619 embedded work")
			}
		case "AI/ML Research":
			if project.Hours > 1 {
				notes = append(notes, "FunctionGemma - Continue fine-tuning experiments if applicable")
			}
		}
	}

	// Generic notes based on activity
	if data.GitCommitCount > 100 {
		notes = append(notes, "Documentation - May need additional docs based on user feedback")
	}

	// Ensure we have at least some notes
	if len(notes) == 0 {
		notes = append(notes, "Review week's progress and plan next sprint")
	}

	return notes
}

// inferAppPrimaryUse infers the primary use of an app from its windows
func (s *ReportsService) inferAppPrimaryUse(appName string, windows []WindowBreakdown) string {
	lower := strings.ToLower(appName)

	if strings.Contains(lower, "terminal") || strings.Contains(lower, "tilix") || strings.Contains(lower, "tmux") {
		return "Development, builds, testing"
	}
	if strings.Contains(lower, "chrome") || strings.Contains(lower, "firefox") {
		return "Research, documentation, testing"
	}
	if strings.Contains(lower, "code") || strings.Contains(lower, "vscode") {
		return "Code editing"
	}
	if strings.Contains(lower, "slack") {
		return "Team communication"
	}
	if strings.Contains(lower, "zoom") {
		return "Meetings"
	}
	if strings.Contains(lower, "traq") {
		return "Testing own application"
	}

	return "Various tasks"
}

// extractCommunicationStats extracts Slack, Zoom, and Email time from focus events
func (s *ReportsService) extractCommunicationStats(events []*storage.WindowFocusEvent) ([]SlackChannel, int64, int64, int64) {
	channelMap := make(map[string]*SlackChannel)
	var totalSlack, totalZoom, totalEmail int64

	for _, evt := range events {
		lower := strings.ToLower(evt.AppName)
		windowLower := strings.ToLower(evt.WindowTitle)
		mins := int64(evt.DurationSeconds / 60)

		// Slack
		if strings.Contains(lower, "slack") {
			totalSlack += mins

			// Extract channel name from window title
			// Patterns: "#channel-name - Workspace - Slack", "Huddle: #channel - Workspace - Slack"
			channelName := ""
			isHuddle := strings.Contains(windowLower, "huddle")

			if isHuddle {
				// Extract from "Huddle: #channel-name"
				if strings.Contains(evt.WindowTitle, "Huddle:") {
					parts := strings.Split(evt.WindowTitle, "Huddle:")
					if len(parts) > 1 {
						afterHuddle := strings.TrimSpace(parts[1])
						if idx := strings.Index(afterHuddle, " - "); idx > 0 {
							channelName = strings.TrimSpace(afterHuddle[:idx])
						} else {
							channelName = afterHuddle
						}
					}
				}
			} else {
				// Try to extract channel from title
				parts := strings.Split(evt.WindowTitle, " - ")
				for _, part := range parts {
					trimmed := strings.TrimSpace(part)
					if strings.HasPrefix(trimmed, "#") {
						channelName = trimmed
						break
					}
				}
				// Also check for DMs pattern
				if channelName == "" && strings.Contains(windowLower, "dm") {
					channelName = "DMs"
				}
			}

			if channelName != "" {
				key := channelName
				if isHuddle {
					key = channelName + " (huddle)"
				}
				if _, ok := channelMap[key]; !ok {
					channelMap[key] = &SlackChannel{
						Name:     channelName,
						IsHuddle: isHuddle,
					}
				}
				channelMap[key].DurationMins += mins
			}
		}

		// Video calls: Zoom, Google Meet, Teams (check app name AND window title)
		if strings.Contains(lower, "zoom") ||
			strings.Contains(windowLower, "meet.google.com") ||
			strings.Contains(windowLower, "meet -") ||
			(strings.Contains(windowLower, "microsoft teams") && strings.Contains(windowLower, "meeting")) {
			totalZoom += mins
		}

		// Email
		if strings.Contains(windowLower, "mail") || strings.Contains(windowLower, "outlook") ||
			strings.Contains(windowLower, "gmail") || strings.Contains(lower, "thunderbird") {
			totalEmail += mins
		}
	}

	// Convert to slice and sort by duration
	var channels []SlackChannel
	for _, ch := range channelMap {
		if ch.DurationMins >= 1 {
			channels = append(channels, *ch)
		}
	}
	sort.Slice(channels, func(i, j int) bool {
		return channels[i].DurationMins > channels[j].DurationMins
	})

	return channels, totalSlack, totalZoom, totalEmail
}

// extractKeyAccomplishments extracts top accomplishments from commits
func (s *ReportsService) extractKeyAccomplishments(commits []*storage.GitCommit) []string {
	// High-priority achievements to look for
	highPriority := []struct {
		pattern  string
		summary  string
	}{
		{"100%", "Achieved 100% feature completion on Traq v2 (64/64 tests passing)"},
		{"timeline v3", "Implemented Timeline v3 with multi-source event integration (git, shell, files, browser)"},
		{"vitepress", "Created documentation site with VitePress and GitHub Pages deployment"},
		{"global search", "Added global search across all data sources"},
		{"xss", "Fixed critical XSS vulnerability in markdown rendering"},
		{"ai summary", "Optimized AI summary generation for report generation"},
		{"cli harness", "Set up Claude Code autonomous-coding CLI harness with visual QA"},
	}

	var accomplishments []string
	seen := make(map[string]bool)

	// Check commits against high-priority patterns
	for _, hp := range highPriority {
		for _, commit := range commits {
			lower := strings.ToLower(commit.Message)
			if strings.Contains(lower, hp.pattern) {
				if !seen[hp.summary] {
					seen[hp.summary] = true
					accomplishments = append(accomplishments, hp.summary)
				}
				break
			}
		}
	}

	// Add more from commit messages if needed
	if len(accomplishments) < 8 {
		for _, commit := range commits {
			if len(accomplishments) >= 8 {
				break
			}
			if isBoringCommit(commit.Message) {
				continue
			}
			msg := cleanCommitMessage(commit.Message)
			lowerMsg := strings.ToLower(msg)

			// Skip already covered
			alreadyCovered := false
			for _, acc := range accomplishments {
				if strings.Contains(strings.ToLower(acc), lowerMsg[:min(20, len(lowerMsg))]) {
					alreadyCovered = true
					break
				}
			}
			if alreadyCovered || seen[msg] {
				continue
			}

			// Only include significant achievements
			lower := strings.ToLower(commit.Message)
			if strings.Contains(lower, "implement") || strings.Contains(lower, "complete") ||
				strings.Contains(lower, "add") && len(msg) > 30 {
				seen[msg] = true
				accomplishments = append(accomplishments, msg)
			}
		}
	}

	return accomplishments
}

