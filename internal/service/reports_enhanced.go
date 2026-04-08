package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"traq/internal/storage"
)

// GenerateEnhancedWeeklyHTML generates a visual-rich HTML report for team presentations.
// Includes screenshots, charts, and comprehensive work breakdown.
func (s *ReportsService) GenerateEnhancedWeeklyHTML(startDate, endDate string) (string, error) {
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

	// Get screenshots for the period
	screenshots, _ := s.store.GetScreenshotsByTimeRange(startUnix, endUnix)

	// Generate enhanced HTML
	return s.formatEnhancedHTML(data, screenshots, startDate, endDate), nil
}

// splitAcusightSubprojects splits the Acusight project into SmartPanel and acusight.io subprojects
func (s *ReportsService) splitAcusightSubprojects(projects []ProjectSummary) []ProjectSummary {
	var result []ProjectSummary

	for _, project := range projects {
		if project.Name != "Acusight" {
			result = append(result, project)
			continue
		}

		// Split accomplishments into SmartPanel and acusight.io
		smartpanelAccs := make(map[string][]string)
		acusightIOAccs := make(map[string][]string)
		smartpanelHours := 0.0
		acusightIOHours := 0.0

		for date, accs := range project.DailyAccomplishments {
			for _, acc := range accs {
				accLower := strings.ToLower(acc)
				// Keywords for SmartPanel work
				if strings.Contains(accLower, "smartpanel") ||
					strings.Contains(accLower, "sl2619") ||
					strings.Contains(accLower, "embedded world") ||
					strings.Contains(accLower, "touchpad") ||
					strings.Contains(accLower, "kiosk") ||
					strings.Contains(accLower, "s7-1200") ||
					strings.Contains(accLower, "tia portal") ||
					strings.Contains(accLower, "oee dashboard") {
					smartpanelAccs[date] = append(smartpanelAccs[date], acc)
				} else if strings.Contains(accLower, "acusight.io") ||
					strings.Contains(accLower, "docs deploy") ||
					strings.Contains(accLower, "mintlify") ||
					strings.Contains(accLower, "cloud ops") ||
					strings.Contains(accLower, "cloud env") ||
					strings.Contains(accLower, "cloud deployment") ||
					strings.Contains(accLower, "brinqai") {
					acusightIOAccs[date] = append(acusightIOAccs[date], acc)
				} else {
					// Default to acusight.io for ambiguous items
					acusightIOAccs[date] = append(acusightIOAccs[date], acc)
				}
			}
		}

		// Estimate hours split (rough approximation based on accomplishment count)
		totalAccs := 0
		smartpanelAccCount := 0
		for _, accs := range smartpanelAccs {
			smartpanelAccCount += len(accs)
			totalAccs += len(accs)
		}
		for _, accs := range acusightIOAccs {
			totalAccs += len(accs)
		}

		if totalAccs > 0 {
			smartpanelHours = project.Hours * float64(smartpanelAccCount) / float64(totalAccs)
			acusightIOHours = project.Hours - smartpanelHours
		}

		// Create subprojects if both have content
		hasSmartpanel := len(smartpanelAccs) > 0 || smartpanelHours > 0.5
		hasAcusightIO := len(acusightIOAccs) > 0 || acusightIOHours > 0.5

		if hasSmartpanel && hasAcusightIO {
			// Add SmartPanel subproject
			result = append(result, ProjectSummary{
				Name:                 "  SmartPanel (Embedded World)",
				Hours:                smartpanelHours,
				Percentage:           project.Percentage * smartpanelHours / project.Hours,
				CommitCount:          project.CommitCount / 2, // Rough split
				DailyAccomplishments: smartpanelAccs,
			})

			// Add acusight.io subproject
			result = append(result, ProjectSummary{
				Name:                 "  acusight.io Platform",
				Hours:                acusightIOHours,
				Percentage:           project.Percentage * acusightIOHours / project.Hours,
				CommitCount:          project.CommitCount / 2, // Rough split
				DailyAccomplishments: acusightIOAccs,
			})
		} else {
			// Not enough to split, keep original
			result = append(result, project)
		}
	}

	return result
}

// categorizeScreenshotsByProject assigns screenshots to projects based on timing and context
func (s *ReportsService) categorizeScreenshotsByProject(projects []ProjectSummary, screenshots []*storage.Screenshot) map[string][]*storage.Screenshot {
	result := make(map[string][]*storage.Screenshot)

	// Build time ranges for each project based on accomplishments
	projectTimeRanges := make(map[string][]string) // project name -> list of dates
	for _, project := range projects {
		var dates []string
		for date := range project.DailyAccomplishments {
			dates = append(dates, date)
		}
		projectTimeRanges[project.Name] = dates
	}

	// Categorize each screenshot
	for _, screenshot := range screenshots {
		screenshotDate := time.Unix(screenshot.Timestamp, 0).Format("2006-01-02")

		// Get app name and window title for context matching
		appName := ""
		if screenshot.AppName.Valid {
			appName = strings.ToLower(screenshot.AppName.String)
		}
		windowTitle := ""
		if screenshot.WindowTitle.Valid {
			windowTitle = strings.ToLower(screenshot.WindowTitle.String)
		}

		// Try to match to a project
		matched := false
		for _, project := range projects {
			projectName := strings.TrimPrefix(project.Name, "  ") // Remove indent

			// Check if screenshot date matches project activity dates
			for _, date := range projectTimeRanges[project.Name] {
				if date == screenshotDate {
					// Additional context matching for better accuracy
					if projectName == "SmartPanel (Embedded World)" {
						if strings.Contains(windowTitle, "smartpanel") ||
							strings.Contains(windowTitle, "sl2619") ||
							strings.Contains(windowTitle, "embedded") ||
							strings.Contains(windowTitle, "oee") ||
							strings.Contains(windowTitle, "grafana") ||
							strings.Contains(windowTitle, "siemens") ||
							strings.Contains(windowTitle, "tia portal") {
							result[projectName] = append(result[projectName], screenshot)
							matched = true
							break
						}
					} else if projectName == "acusight.io Platform" {
						if strings.Contains(windowTitle, "acusight") ||
							strings.Contains(windowTitle, "brinq") ||
							strings.Contains(windowTitle, "mintlify") ||
							strings.Contains(windowTitle, "docs") ||
							strings.Contains(windowTitle, "cloud") ||
							strings.Contains(windowTitle, "aws") ||
							strings.Contains(windowTitle, "vercel") {
							result[projectName] = append(result[projectName], screenshot)
							matched = true
							break
						}
					} else if projectName == "Traq" {
						if strings.Contains(appName, "traq") ||
							strings.Contains(windowTitle, "traq") ||
							strings.Contains(windowTitle, "timeline") ||
							strings.Contains(windowTitle, "wails") {
							result[projectName] = append(result[projectName], screenshot)
							matched = true
							break
						}
					} else if projectName == "iENSO" {
						if strings.Contains(windowTitle, "ienso") ||
							strings.Contains(windowTitle, "evk") ||
							strings.Contains(windowTitle, "sdk") {
							result[projectName] = append(result[projectName], screenshot)
							matched = true
							break
						}
					} else {
						// Generic project - match by date only
						result[projectName] = append(result[projectName], screenshot)
						matched = true
						break
					}
				}
			}
			if matched {
				break
			}
		}

		// If not matched to any project, add to "Other Activities"
		if !matched {
			result["Other Activities"] = append(result["Other Activities"], screenshot)
		}
	}

	return result
}

// formatEnhancedHTML creates a presentation-ready HTML report with charts and screenshots
func (s *ReportsService) formatEnhancedHTML(data *WeeklySummaryData, screenshots []*storage.Screenshot, startDate, endDate string) string {
	var sb strings.Builder

	// HTML header with modern styling and Chart.js
	sb.WriteString(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Weekly Work Report: ` + startDate + ` to ` + endDate + `</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #1a202c;
  padding: 40px 20px;
  line-height: 1.6;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 60px 40px;
  text-align: center;
}

.header h1 {
  font-size: 3rem;
  margin-bottom: 10px;
  font-weight: 800;
}

.header .subtitle {
  font-size: 1.3rem;
  opacity: 0.95;
  font-weight: 300;
}

.content {
  padding: 40px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 30px;
  margin-bottom: 50px;
}

.stat-card {
  background: linear-gradient(135deg, #f6f8fb 0%, #ffffff 100%);
  border-radius: 15px;
  padding: 30px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0,0,0,0.08);
  border: 1px solid #e5e7eb;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.15);
}

.stat-label {
  font-size: 0.9rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-weight: 600;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 5px;
}

.stat-meta {
  font-size: 0.85rem;
  color: #9ca3af;
}

.section {
  margin-bottom: 50px;
}

.section-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 25px;
  color: #1f2937;
  border-bottom: 3px solid #667eea;
  padding-bottom: 10px;
}

.project-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 25px;
  border-left: 5px solid #667eea;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.project-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.project-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
}

.project-hours {
  font-size: 1.2rem;
  color: #667eea;
  font-weight: 600;
}

.accomplishment-list {
  list-style: none;
  padding-left: 20px;
}

.accomplishment-list li {
  padding: 8px 0;
  color: #4b5563;
  position: relative;
}

.accomplishment-list li:before {
  content: "✓";
  position: absolute;
  left: -20px;
  color: #10b981;
  font-weight: bold;
}

.chart-container {
  position: relative;
  height: 400px;
  margin-bottom: 40px;
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.screenshots-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.screenshot-item {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: transform 0.3s ease;
}

.screenshot-item:hover {
  transform: scale(1.05);
}

.screenshot-item img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  display: block;
}

.screenshot-caption {
  padding: 10px;
  background: #f9fafb;
  font-size: 0.85rem;
  color: #6b7280;
}

.commit-list {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
}

.commit-item {
  padding: 12px;
  border-left: 3px solid #10b981;
  margin-bottom: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.commit-message {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 5px;
}

.commit-meta {
  font-size: 0.85rem;
  color: #6b7280;
}

.meetings-list {
  background: #fef3c7;
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
  border-left: 5px solid #f59e0b;
}

.meeting-item {
  padding: 15px;
  background: white;
  border-radius: 8px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.meeting-title {
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 5px;
}

.table-container {
  overflow-x: auto;
  margin-top: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

th {
  background: #667eea;
  color: white;
  padding: 15px;
  text-align: left;
  font-weight: 600;
}

td {
  padding: 12px 15px;
  border-bottom: 1px solid #e5e7eb;
}

tr:hover {
  background: #f9fafb;
}

.footer {
  text-align: center;
  padding: 30px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.9rem;
}

@media print {
  body { background: white; padding: 0; }
  .container { box-shadow: none; }
  .stat-card:hover, .screenshot-item:hover { transform: none; }
}
</style>
</head>
<body>
<div class="container">
`)

	// Header
	startTime, _ := time.Parse("2006-01-02", startDate)
	endTime, _ := time.Parse("2006-01-02", endDate)
	sb.WriteString(fmt.Sprintf(`
<div class="header">
  <h1>📊 Weekly Work Report</h1>
  <p class="subtitle">%s – %s</p>
</div>
`, startTime.Format("Jan 2, 2006"), endTime.Format("Jan 2, 2006")))

	sb.WriteString(`<div class="content">`)

	// Executive Summary Stats
	sb.WriteString(`<div class="stats-grid">`)

	sb.WriteString(fmt.Sprintf(`
<div class="stat-card">
  <div class="stat-label">Active Time</div>
  <div class="stat-value">%.1f</div>
  <div class="stat-meta">hours tracked</div>
</div>`, data.TotalHours))

	sb.WriteString(fmt.Sprintf(`
<div class="stat-card">
  <div class="stat-label">Sessions</div>
  <div class="stat-value">%d</div>
  <div class="stat-meta">work sessions</div>
</div>`, data.SessionCount))

	if data.GitCommitCount > 0 {
		sb.WriteString(fmt.Sprintf(`
<div class="stat-card">
  <div class="stat-label">Commits</div>
  <div class="stat-value">%d</div>
  <div class="stat-meta">+%s -%s lines</div>
</div>`, data.GitCommitCount, formatNumber(data.TotalInsertions), formatNumber(data.TotalDeletions)))
	}

	sb.WriteString(fmt.Sprintf(`
<div class="stat-card">
  <div class="stat-label">Screenshots</div>
  <div class="stat-value">%d</div>
  <div class="stat-meta">captured</div>
</div>`, data.ScreenshotCount))

	sb.WriteString(`</div>`) // End stats grid

	// Split Acusight project into subprojects if needed (do this outside the if block)
	var projects []ProjectSummary
	var screenshotsByProject map[string][]*storage.Screenshot

	if len(data.Projects) > 0 {
		projects = s.splitAcusightSubprojects(data.Projects)
		screenshotsByProject = s.categorizeScreenshotsByProject(projects, screenshots)
	}

	// Projects & Work (moved to top - most important for team presentation)
	if len(data.Projects) > 0 {
		sb.WriteString(`
<div class="section">
  <h2 class="section-title">💼 Projects & Focus Areas</h2>
  <p style="color: #6b7280; margin-bottom: 25px; font-size: 0.95rem;">Detailed breakdown of work by project with accomplishments, commits, and screenshots</p>`)

		for i, project := range projects {
			if project.Hours < 0.5 && project.CommitCount == 0 {
				continue
			}

			// Check if project has meaningful content
			hasAccomplishments := false
			for _, accs := range project.DailyAccomplishments {
				if len(accs) > 0 {
					hasAccomplishments = true
					break
				}
			}
			if !hasAccomplishments && project.CommitCount == 0 && project.Hours < 0.5 {
				continue
			}

			// Add indent for subprojects
			indent := ""
			if strings.HasPrefix(project.Name, "  ") {
				indent = "margin-left: 20px; "
			}

			sb.WriteString(fmt.Sprintf(`
<div class="project-card" style="%s">
  <div class="project-header">
    <div class="project-name">%d. %s</div>
    <div class="project-hours">%.1f hours (%.0f%%)</div>
  </div>`, indent, i+1, esc(strings.TrimPrefix(project.Name, "  ")), project.Hours, project.Percentage))

			if project.CommitCount > 0 {
				sb.WriteString(fmt.Sprintf(`
  <p style="color: #10b981; font-weight: 600; margin-bottom: 15px;">🔨 %d commits</p>`, project.CommitCount))
			}

			// Accomplishments
			if len(project.DailyAccomplishments) > 0 {
				sb.WriteString(`<ul class="accomplishment-list">`)
				var days []string
				for d := range project.DailyAccomplishments {
					if d >= startDate && d <= endDate {
						days = append(days, d)
					}
				}
				sort.Strings(days)

				for _, day := range days {
					accs := project.DailyAccomplishments[day]
					if len(accs) == 0 {
						continue
					}
					cleanedAccs := consolidateAccomplishments(accs)
					for _, acc := range cleanedAccs {
						sb.WriteString(fmt.Sprintf(`<li>%s</li>`, esc(acc)))
					}
				}
				sb.WriteString(`</ul>`)
			}

			// Screenshots for this project
			projectName := strings.TrimPrefix(project.Name, "  ")
			if projectScreenshots, ok := screenshotsByProject[projectName]; ok && len(projectScreenshots) > 0 {
				// Sort chronologically
				sort.Slice(projectScreenshots, func(i, j int) bool {
					return projectScreenshots[i].Timestamp < projectScreenshots[j].Timestamp
				})

				// Limit to 6 screenshots per project for readability
				maxScreenshots := 6
				if len(projectScreenshots) > maxScreenshots {
					// Sample evenly
					interval := len(projectScreenshots) / maxScreenshots
					if interval < 1 {
						interval = 1
					}
					var sampled []*storage.Screenshot
					for idx := 0; idx < len(projectScreenshots) && len(sampled) < maxScreenshots; idx += interval {
						sampled = append(sampled, projectScreenshots[idx])
					}
					projectScreenshots = sampled
				}

				sb.WriteString(fmt.Sprintf(`
  <div style="margin-top: 20px;">
    <h4 style="color: #667eea; font-size: 0.9rem; margin-bottom: 12px;">📸 Screenshots (%d captured)</h4>
    <div class="screenshots-grid">`, len(screenshotsByProject[projectName])))

				for _, screenshot := range projectScreenshots {
					timestamp := time.Unix(screenshot.Timestamp, 0)
					screenshotPath := screenshot.Filepath

					appName := "Unknown"
					if screenshot.AppName.Valid {
						appName = GetFriendlyAppName(screenshot.AppName.String)
					}

					sb.WriteString(fmt.Sprintf(`
      <div class="screenshot-item">
        <img src="file://%s" alt="Screenshot">
        <div class="screenshot-caption">
          <strong>%s</strong><br>
          %s
        </div>
      </div>`, screenshotPath, esc(appName), timestamp.Format("Mon Jan 2, 3:04 PM")))
				}

				sb.WriteString(`</div></div>`) // End screenshots grid and container
			}

			sb.WriteString(`</div>`) // End project card
		}
		sb.WriteString(`</div>`) // End section
	}

	// Daily Activity Chart
	if len(data.DailyStats) > 0 {
		sb.WriteString(`
<div class="section">
  <h2 class="section-title">📈 Daily Activity Breakdown</h2>
  <div class="chart-container">
    <canvas id="dailyChart"></canvas>
  </div>
</div>`)
	}

	// App Usage Chart (moved down - less important than projects)
	if len(data.AppUsage) > 0 {
		sb.WriteString(`
<div class="section">
  <h2 class="section-title">⏱️ Time Distribution by Application</h2>
  <p style="color: #6b7280; margin-bottom: 20px; font-size: 0.9rem;">Tool usage breakdown across all projects</p>
  <div class="chart-container" style="height: 400px;">
    <canvas id="appChart"></canvas>
  </div>
</div>`)
	}

	// Meetings & Communication
	if len(data.Meetings) > 0 || data.TotalSlackMins > 0 || data.TotalZoomMins > 0 {
		sb.WriteString(`
<div class="section">
  <h2 class="section-title">💬 Meetings & Communication</h2>
  <div class="meetings-list">`)

		if data.TotalZoomMins > 0 {
			sb.WriteString(fmt.Sprintf(`
<div style="margin-bottom: 20px;">
  <h3 style="color: #2563eb; margin-bottom: 10px;">📹 Video Calls: ~%d minutes</h3>`, data.TotalZoomMins))
			for _, m := range data.Meetings {
				meetingTime := time.Unix(m.StartTime, 0)
				sb.WriteString(fmt.Sprintf(`
  <div class="meeting-item">
    <div class="meeting-title">%s</div>
    <div class="commit-meta">%s • %.0f minutes</div>
  </div>`, esc(m.Title), meetingTime.Format("Mon Jan 2, 3:04 PM"), m.DurationSeconds/60))
			}
			sb.WriteString(`</div>`)
		}

		if data.TotalSlackMins > 0 {
			sb.WriteString(fmt.Sprintf(`
<div style="margin-bottom: 20px;">
  <h3 style="color: #8b5cf6; margin-bottom: 10px;">💬 Slack: ~%d minutes</h3>`, data.TotalSlackMins))
			for _, ch := range data.SlackChannels {
				huddle := ""
				if ch.IsHuddle {
					huddle = " (huddle)"
				}
				sb.WriteString(fmt.Sprintf(`
  <div class="meeting-item">
    <div class="meeting-title">%s%s</div>
    <div class="commit-meta">%d minutes</div>
  </div>`, esc(ch.Name), huddle, ch.DurationMins))
			}
			sb.WriteString(`</div>`)
		}

		sb.WriteString(`</div></div>`) // End meetings-list and section
	}

	// Git Commits Detail
	if len(data.CommitsByRepo) > 0 {
		sb.WriteString(`
<div class="section">
  <h2 class="section-title">🔨 Git Commits</h2>`)

		for _, repo := range data.CommitsByRepo {
			if repo.CommitCount == 0 {
				continue
			}

			sb.WriteString(fmt.Sprintf(`
<div style="margin-bottom: 30px;">
  <h3 style="color: #667eea; margin-bottom: 15px;">📦 %s (%d commits)</h3>
  <div class="commit-list">`, esc(repo.RepoName), repo.CommitCount))

			for _, commit := range repo.Commits {
				commitTime := time.Unix(commit.Timestamp, 0)
				msg := commit.Message
				if len(msg) > 80 {
					msg = msg[:77] + "..."
				}

				insertions := ""
				deletions := ""
				if commit.Insertions.Valid {
					insertions = fmt.Sprintf("+%s", formatNumber(commit.Insertions.Int64))
				}
				if commit.Deletions.Valid {
					deletions = fmt.Sprintf("-%s", formatNumber(commit.Deletions.Int64))
				}

				sb.WriteString(fmt.Sprintf(`
    <div class="commit-item">
      <div class="commit-message">%s</div>
      <div class="commit-meta">%s • %s %s</div>
    </div>`, esc(msg), commitTime.Format("Mon Jan 2, 3:04 PM"), insertions, deletions))
			}

			sb.WriteString(`</div></div>`)
		}
		sb.WriteString(`</div>`) // End section
	}

	// Screenshot Gallery (now showing only "Other Activities" screenshots)
	var otherScreenshots []*storage.Screenshot
	if screenshotsByProject != nil {
		otherScreenshots = screenshotsByProject["Other Activities"]
	}
	if len(otherScreenshots) > 0 {
		// Sort chronologically
		sort.Slice(otherScreenshots, func(i, j int) bool {
			return otherScreenshots[i].Timestamp < otherScreenshots[j].Timestamp
		})

		// Sample up to 8 screenshots
		sampleSize := 8
		if len(otherScreenshots) > sampleSize {
			interval := len(otherScreenshots) / sampleSize
			if interval < 1 {
				interval = 1
			}
			var sampled []*storage.Screenshot
			for idx := 0; idx < len(otherScreenshots) && len(sampled) < sampleSize; idx += interval {
				sampled = append(sampled, otherScreenshots[idx])
			}
			otherScreenshots = sampled
		}

		sb.WriteString(`
<div class="section">
  <h2 class="section-title">📸 Other Activities</h2>
  <p style="color: #6b7280; margin-bottom: 15px;">Screenshots not associated with specific projects (` + fmt.Sprintf("%d", len(screenshotsByProject["Other Activities"])) + ` total)</p>
  <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 20px;">
    💡 <em>Note: Screenshots are stored locally. Open this file in Firefox for best compatibility, or use Chrome with the --allow-file-access-from-files flag.</em>
  </p>
  <div class="screenshots-grid">`)

		for _, screenshot := range otherScreenshots {
			timestamp := time.Unix(screenshot.Timestamp, 0)
			screenshotPath := screenshot.Filepath

			appName := "Unknown"
			if screenshot.AppName.Valid {
				appName = GetFriendlyAppName(screenshot.AppName.String)
			}

			sb.WriteString(fmt.Sprintf(`
    <div class="screenshot-item">
      <img src="file://%s" alt="Screenshot">
      <div class="screenshot-caption">
        <strong>%s</strong><br>
        %s
      </div>
    </div>`, screenshotPath, esc(appName), timestamp.Format("Mon Jan 2, 3:04 PM")))
		}

		sb.WriteString(`</div></div>`) // End screenshots grid and section
	}

	// Close content div
	sb.WriteString(`</div>`)

	// Footer
	sb.WriteString(fmt.Sprintf(`
<div class="footer">
  Generated by Traq • %s
</div>`, time.Now().Format("January 2, 2006 at 3:04 PM")))

	// JavaScript for Charts
	sb.WriteString(`
<script>
// Daily Activity Chart
const dailyCtx = document.getElementById('dailyChart');
if (dailyCtx) {
  new Chart(dailyCtx, {
    type: 'bar',
    data: {
      labels: [`)

	for i, day := range data.DailyStats {
		if i > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(fmt.Sprintf("'%s'", day.DayName))
	}

	sb.WriteString(`],
      datasets: [{
        label: 'Hours',
        data: [`)

	for i, day := range data.DailyStats {
		if i > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(fmt.Sprintf("%.2f", day.Hours))
	}

	sb.WriteString(`],
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Hours Per Day',
          font: { size: 16, weight: 'bold' }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Hours' }
        }
      }
    }
  });
}

// App Usage Chart
const appCtx = document.getElementById('appChart');
if (appCtx) {
  new Chart(appCtx, {
    type: 'doughnut',
    data: {
      labels: [`)

	for i, app := range data.AppUsage {
		if i >= 8 {
			break // Top 8 apps
		}
		if i > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(fmt.Sprintf("'%s'", app.FriendlyName))
	}

	sb.WriteString(`],
      datasets: [{
        data: [`)

	for i, app := range data.AppUsage {
		if i >= 8 {
			break
		}
		if i > 0 {
			sb.WriteString(", ")
		}
		sb.WriteString(fmt.Sprintf("%.2f", app.DurationSeconds/3600))
	}

	sb.WriteString(`],
        backgroundColor: [
          '#667eea', '#764ba2', '#f093fb', '#4facfe',
          '#43e97b', '#fa709a', '#fee140', '#30cfd0'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
        title: {
          display: true,
          text: 'Time by Application',
          font: { size: 16, weight: 'bold' }
        }
      }
    }
  });
}
</script>`)

	// Close HTML
	sb.WriteString(`
</div>
</body>
</html>`)

	return sb.String()
}
