// Context building for reports — assembles EnhancedReportContext from storage.

package service

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"traq/internal/storage"
)

// buildEnhancedReportContext fetches all data needed for reports and aggregates it.
func (s *ReportsService) buildEnhancedReportContext(tr *TimeRange) (*EnhancedReportContext, error) {
	ctx := &EnhancedReportContext{
		TimeRange:    tr,
		SummariesMap: make(map[int64]*storage.Summary),
	}

	// Get sessions
	sessions, err := s.store.GetSessionsByTimeRange(tr.Start, tr.End)
	if err != nil {
		return nil, fmt.Errorf("failed to get sessions: %w", err)
	}
	ctx.Sessions = sessions
	ctx.SessionCount = len(sessions)

	// Batch load summaries for sessions
	if len(sessions) > 0 {
		sessionIDs := make([]int64, len(sessions))
		for i, sess := range sessions {
			sessionIDs[i] = sess.ID
		}
		ctx.SummariesMap, _ = s.store.GetSummariesForSessions(sessionIDs)
	}

	// Get focus events and aggregate with window breakdown
	focusEvents, err := s.store.GetWindowFocusEventsByTimeRange(tr.Start, tr.End)
	if err != nil {
		return nil, fmt.Errorf("failed to get focus events: %w", err)
	}
	ctx.AppUsage = s.aggregateAppUsageWithWindows(focusEvents)

	// Detect meetings from focus events
	ctx.Meetings = s.detectMeetings(focusEvents)

	// Get browser history and aggregate by domain
	browserVisits, err := s.store.GetBrowserVisitsByTimeRange(tr.Start, tr.End)
	if err != nil {
		return nil, fmt.Errorf("failed to get browser history: %w", err)
	}
	ctx.DomainGroups = s.aggregateBrowserByDomain(browserVisits, focusEvents)

	// Get git commits
	ctx.GitCommits, _ = s.store.GetGitCommitsByTimeRange(tr.Start, tr.End)

	// Get shell commands
	ctx.ShellCommands, _ = s.store.GetShellCommandsByTimeRange(tr.Start, tr.End)

	// Get file events
	ctx.FileEvents, _ = s.store.GetFileEventsByTimeRange(tr.Start, tr.End)

	// Calculate productivity metrics
	var totalSeconds float64
	for _, app := range ctx.AppUsage {
		totalSeconds += app.DurationSeconds
		category := s.analytics.CategorizeApp(app.AppName)
		minutes := int64(app.DurationSeconds / 60)
		switch category {
		case CategoryProductive:
			ctx.ProductiveMinutes += minutes
		case CategoryDistracting:
			ctx.DistractingMinutes += minutes
		default:
			ctx.NeutralMinutes += minutes
		}
	}
	ctx.TotalMinutes = ctx.ProductiveMinutes + ctx.NeutralMinutes + ctx.DistractingMinutes

	// Calculate productivity score (0-100)
	if ctx.TotalMinutes > 0 {
		ctx.ProductivityScore = int((float64(ctx.ProductiveMinutes) / float64(ctx.TotalMinutes)) * 100)
	}

	return ctx, nil
}

// aggregateAppUsageWithWindows groups focus events by app, then by window title.
// Uses friendly name as key to deduplicate app variants (e.g., "traq" and "traq-dev-linux-amd64").
func (s *ReportsService) aggregateAppUsageWithWindows(events []*storage.WindowFocusEvent) []*AppDetailedUsage {
	// First pass: aggregate by FRIENDLY name to deduplicate app variants
	appMap := make(map[string]*AppDetailedUsage)
	windowMap := make(map[string]map[string]*WindowBreakdown) // friendlyName -> window -> breakdown

	var totalDuration float64
	for _, evt := range events {
		totalDuration += evt.DurationSeconds

		// Use friendly name as key to deduplicate related app variants
		friendlyName := GetFriendlyAppName(evt.AppName)

		// Get or create app entry using friendly name as key
		if _, ok := appMap[friendlyName]; !ok {
			appMap[friendlyName] = &AppDetailedUsage{
				AppName:      evt.AppName,
				FriendlyName: friendlyName,
				Category:     string(s.analytics.CategorizeApp(evt.AppName)),
				Windows:      []WindowBreakdown{},
			}
			windowMap[friendlyName] = make(map[string]*WindowBreakdown)
		}
		appMap[friendlyName].DurationSeconds += evt.DurationSeconds

		// Get or create window entry
		if _, ok := windowMap[friendlyName][evt.WindowTitle]; !ok {
			isMeeting, platform := s.detectMeetingFromTitle(evt.WindowTitle)
			windowMap[friendlyName][evt.WindowTitle] = &WindowBreakdown{
				WindowTitle:     evt.WindowTitle,
				IsMeeting:       isMeeting,
				MeetingPlatform: platform,
				ProjectPath:     s.extractVSCodeProject(evt.WindowTitle),
			}
			if isMeeting {
				appMap[friendlyName].MeetingCount++
			}
		}
		windowMap[friendlyName][evt.WindowTitle].DurationSeconds += evt.DurationSeconds
	}

	// Second pass: calculate percentages and sort
	var result []*AppDetailedUsage
	for appName, app := range appMap {
		if totalDuration > 0 {
			app.Percentage = (app.DurationSeconds / totalDuration) * 100
		}

		// Convert window map to slice and calculate percentages
		for _, wb := range windowMap[appName] {
			if app.DurationSeconds > 0 {
				wb.Percentage = (wb.DurationSeconds / app.DurationSeconds) * 100
			}
			app.Windows = append(app.Windows, *wb)
		}

		// Sort windows by duration descending
		sort.Slice(app.Windows, func(i, j int) bool {
			return app.Windows[i].DurationSeconds > app.Windows[j].DurationSeconds
		})

		result = append(result, app)
	}

	// Sort apps by duration descending
	sort.Slice(result, func(i, j int) bool {
		return result[i].DurationSeconds > result[j].DurationSeconds
	})

	return result
}

// aggregateBrowserByDomain groups browser visits by domain.
// Browser visits are URL context only - duration tracking comes from window focus events.
func (s *ReportsService) aggregateBrowserByDomain(visits []*storage.BrowserVisit, focusEvents []*storage.WindowFocusEvent) []DomainGroup {
	domainMap := make(map[string]*DomainGroup)

	for _, visit := range visits {
		if existing, ok := domainMap[visit.Domain]; ok {
			existing.VisitCount++
			// Keep first 3 sample titles
			if len(existing.SampleTitles) < 3 && visit.Title.Valid && visit.Title.String != "" {
				// Check if title is already in samples
				found := false
				for _, t := range existing.SampleTitles {
					if t == visit.Title.String {
						found = true
						break
					}
				}
				if !found {
					existing.SampleTitles = append(existing.SampleTitles, visit.Title.String)
				}
			}
		} else {
			dg := &DomainGroup{
				Domain:          visit.Domain,
				VisitCount:      1,
				TopicLabel:      s.inferDomainTopic(visit.Domain),
				SampleTitles:    []string{},
				DurationSeconds: 0, // Duration tracked by focus events, not browser visits
			}
			if visit.Title.Valid && visit.Title.String != "" {
				dg.SampleTitles = append(dg.SampleTitles, visit.Title.String)
			}
			domainMap[visit.Domain] = dg
		}
	}

	// Convert to slice and sort by visit count (since duration is always 0)
	var result []DomainGroup
	for _, dg := range domainMap {
		result = append(result, *dg)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].VisitCount > result[j].VisitCount
	})

	return result
}

// inferDomainTopic applies heuristic rules to categorize domains.
func (s *ReportsService) inferDomainTopic(domain string) string {
	lower := strings.ToLower(domain)

	// Development
	if lower == "github.com" || lower == "gitlab.com" || lower == "bitbucket.org" ||
		lower == "stackoverflow.com" || lower == "stackexchange.com" ||
		strings.HasSuffix(lower, ".dev") {
		return "Development"
	}

	// Documentation
	if strings.HasPrefix(lower, "docs.") || lower == "notion.so" || lower == "confluence.atlassian.com" ||
		strings.Contains(lower, "readthedocs") || strings.Contains(lower, "documentation") {
		return "Documentation"
	}

	// Communication
	if lower == "slack.com" || lower == "mail.google.com" || lower == "outlook.com" ||
		lower == "discord.com" || lower == "teams.microsoft.com" {
		return "Communication"
	}

	// Social / Entertainment
	if lower == "youtube.com" || lower == "reddit.com" || lower == "twitter.com" ||
		lower == "x.com" || lower == "facebook.com" || lower == "instagram.com" ||
		lower == "tiktok.com" || lower == "twitch.tv" {
		return "Social"
	}

	// News
	if strings.Contains(lower, "news") || lower == "hackernews.com" || lower == "news.ycombinator.com" ||
		lower == "techcrunch.com" || lower == "arstechnica.com" {
		return "News"
	}

	// Shopping
	if lower == "amazon.com" || lower == "ebay.com" || strings.Contains(lower, "shop") {
		return "Shopping"
	}

	return "Other"
}

// groupCommitsByRepo groups git commits by repository.
func (s *ReportsService) groupCommitsByRepo(commits []*storage.GitCommit) []*CommitsByRepo {
	repoMap := make(map[int64]*CommitsByRepo)
	repoPathCache := make(map[int64]string) // Cache repo paths by ID

	for _, commit := range commits {
		repoID := commit.RepositoryID

		// Get repo path from cache or lookup
		repoPath, ok := repoPathCache[repoID]
		if !ok {
			repo, err := s.store.GetGitRepository(repoID)
			if err == nil && repo != nil {
				repoPath = repo.Path
			} else {
				repoPath = "unknown"
			}
			repoPathCache[repoID] = repoPath
		}

		// Extract repo name from path
		repoName := s.DetectProjectFromGitRepo(repoPath)

		if existing, ok := repoMap[repoID]; ok {
			existing.Commits = append(existing.Commits, commit)
			existing.CommitCount++
		} else {
			repoMap[repoID] = &CommitsByRepo{
				RepoName:    repoName,
				RepoPath:    repoPath,
				CommitCount: 1,
				Commits:     []*storage.GitCommit{commit},
			}
		}
	}

	// Convert to slice and sort by commit count descending
	var result []*CommitsByRepo
	for _, repo := range repoMap {
		result = append(result, repo)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].CommitCount > result[j].CommitCount
	})

	return result
}

// getDailyBreakdown creates a day-by-day breakdown for multi-day reports.
func (s *ReportsService) getDailyBreakdown(ctx *EnhancedReportContext) []*ReportDailyStats {
	dailyMap := make(map[string]*ReportDailyStats)

	// Get all days in range
	startTime := time.Unix(ctx.TimeRange.Start, 0)
	endTime := time.Unix(ctx.TimeRange.End, 0)

	// Initialize all days
	for d := startTime; d.Before(endTime) || d.Equal(endTime); d = d.AddDate(0, 0, 1) {
		dayStr := d.Format("2006-01-02")
		dailyMap[dayStr] = &ReportDailyStats{
			Date:            dayStr,
			DayOfWeek:       d.Format("Mon"),
			Accomplishments: []string{},
		}
	}

	// Count sessions per day
	for _, sess := range ctx.Sessions {
		dayStr := time.Unix(sess.StartTime, 0).Format("2006-01-02")
		if stats, ok := dailyMap[dayStr]; ok {
			stats.SessionCount++
			if sess.DurationSeconds.Valid {
				stats.DurationMinutes += sess.DurationSeconds.Int64 / 60
			}
		}
	}

	// Count commits and extract accomplishments per day
	for _, commit := range ctx.GitCommits {
		day := time.Unix(commit.Timestamp, 0).Format("2006-01-02")
		if stats, ok := dailyMap[day]; ok {
			stats.CommitCount++
			if !isBoringCommit(commit.Message) && len(stats.Accomplishments) < 5 {
				stats.Accomplishments = append(stats.Accomplishments, commit.Message)
			}
		}
	}

	// Determine primary focus per day from commits
	for _, stats := range dailyMap {
		if len(stats.Accomplishments) > 0 {
			// Infer primary focus from commit messages
			stats.PrimaryFocus = s.inferPrimaryFocus(stats.Accomplishments)
		}
	}

	// Convert to sorted slice
	var result []*ReportDailyStats
	for _, stats := range dailyMap {
		result = append(result, stats)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Date < result[j].Date
	})

	return result
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
