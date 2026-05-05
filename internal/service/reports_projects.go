// Project detection and grouping for the reports service.

package service

import (
	"sort"
	"strings"
	"time"

	"traq/internal/storage"
)

// extractVSCodeProject parses VS Code window title to extract project name.
// Format: "file - Project (Workspace) - Visual Studio Code"
func (s *ReportsService) extractVSCodeProject(title string) string {
	if !strings.Contains(strings.ToLower(title), "visual studio code") {
		return ""
	}

	// Split by " - " and look for project name
	parts := strings.Split(title, " - ")
	if len(parts) >= 3 {
		// Project is usually the second part
		project := parts[1]
		// Remove (Workspace) suffix if present
		project = strings.TrimSuffix(project, " (Workspace)")
		return project
	}
	return ""
}

// detectProjectFromLearnedPatterns attempts to match using learned project patterns.
// Returns project name if matched, empty string otherwise.
// Uses confidence > 0 threshold to match auto-assign behavior (app.go).
func (s *ReportsService) detectProjectFromLearnedPatterns(ctx *storage.AssignmentContext) string {
	if s.projects == nil {
		return ""
	}

	result := s.projects.matchPatterns(ctx)
	if result != nil && result.Confidence > 0 {
		// Get project name from storage
		project, err := s.store.GetProject(result.ProjectID)
		if err == nil && project != nil {
			return project.Name
		}
	}
	return ""
}

// DetectProjectFromWindowTitle extracts project name from learned patterns.
// Hardcoded detection rules have been migrated to database patterns.
// Call MigrateHardcodedPatterns() on first run to populate the patterns.
func (s *ReportsService) DetectProjectFromWindowTitle(windowTitle, appName string) string {
	// Use learned patterns from database
	if projectName := s.detectProjectFromLearnedPatterns(&storage.AssignmentContext{
		AppName:     appName,
		WindowTitle: windowTitle,
	}); projectName != "" {
		return projectName
	}

	// VS Code pattern: extract project name from workspace title
	// "file - ProjectName (Workspace) - Visual Studio Code"
	lower := strings.ToLower(windowTitle)
	appLower := strings.ToLower(appName)
	if strings.Contains(appLower, "code") || strings.Contains(lower, "visual studio code") {
		parts := strings.Split(windowTitle, " - ")
		if len(parts) >= 3 {
			project := parts[1]
			project = strings.TrimSuffix(project, " (Workspace)")
			if project != "" && !strings.Contains(strings.ToLower(project), "untitled") {
				return project
			}
		}
	}

	return ""
}

// DetectProjectFromGitRepo extracts project name from learned patterns.
// Hardcoded detection rules have been migrated to database patterns.
// Call MigrateHardcodedPatterns() on first run to populate the patterns.
func (s *ReportsService) DetectProjectFromGitRepo(repoPath string) string {
	// Use learned patterns from database
	if projectName := s.detectProjectFromLearnedPatterns(&storage.AssignmentContext{
		GitRepo: repoPath,
	}); projectName != "" {
		return projectName
	}

	// Fall back: extract repo name from path
	parts := strings.Split(repoPath, "/")
	for i := len(parts) - 1; i >= 0; i-- {
		if parts[i] != "" && parts[i] != ".git" {
			return parts[i]
		}
	}

	return "Other"
}

// DetectProjectFromBrowserTitle detects project from browser page title.
// Hardcoded detection rules have been migrated to database patterns.
// Call MigrateHardcodedPatterns() on first run to populate the patterns.
func (s *ReportsService) DetectProjectFromBrowserTitle(title string) string {
	// Use learned patterns from database
	return s.detectProjectFromLearnedPatterns(&storage.AssignmentContext{
		WindowTitle: title,
	})
}

// groupActivitiesByProject groups all activities by detected project.
func (s *ReportsService) groupActivitiesByProject(ctx *EnhancedReportContext) []*ProjectGroup {
	projectMap := make(map[string]*ProjectGroup)
	repoPathCache := make(map[int64]string) // Cache repo paths by ID

	// Helper to get or create a project group
	getProject := func(name string) *ProjectGroup {
		if name == "" {
			name = "Other"
		}
		if existing, ok := projectMap[name]; ok {
			return existing
		}
		projectMap[name] = &ProjectGroup{
			Name:           name,
			Apps:           []string{},
			Activities:     []string{},
			Commits:        []*storage.GitCommit{},
			DailyBreakdown: make(map[string]*ReportDailyStats),
		}
		return projectMap[name]
	}

	// Group git commits
	for _, commit := range ctx.GitCommits {
		// Get repo path from cache or lookup
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
		project.Commits = append(project.Commits, commit)
		project.CommitCount++

		// Add to daily breakdown
		day := time.Unix(commit.Timestamp, 0).Format("2006-01-02")
		if _, ok := project.DailyBreakdown[day]; !ok {
			project.DailyBreakdown[day] = &ReportDailyStats{
				Date:            day,
				DayOfWeek:       time.Unix(commit.Timestamp, 0).Format("Mon"),
				Accomplishments: []string{},
			}
		}
		project.DailyBreakdown[day].CommitCount++

		// Extract accomplishments from commit messages
		if !isBoringCommit(commit.Message) {
			project.DailyBreakdown[day].Accomplishments = append(
				project.DailyBreakdown[day].Accomplishments,
				commit.Message,
			)
		}
	}

	// Group focus events by project
	for _, app := range ctx.AppUsage {
		for _, window := range app.Windows {
			projectName := s.DetectProjectFromWindowTitle(window.WindowTitle, app.AppName)
			if projectName != "" {
				project := getProject(projectName)
				project.DurationSeconds += window.DurationSeconds

				// Track apps used
				if !containsString(project.Apps, app.FriendlyName) {
					project.Apps = append(project.Apps, app.FriendlyName)
				}
			}
		}
	}

	// Add unassigned time to "Other" project
	var assignedDuration float64
	for _, project := range projectMap {
		assignedDuration += project.DurationSeconds
	}
	var totalDuration float64
	for _, app := range ctx.AppUsage {
		totalDuration += app.DurationSeconds
	}
	if totalDuration > assignedDuration {
		otherProject := getProject("Other")
		otherProject.DurationSeconds += (totalDuration - assignedDuration)
	}

	// Calculate percentages and sort
	var result []*ProjectGroup
	for _, project := range projectMap {
		if totalDuration > 0 {
			project.Percentage = (project.DurationSeconds / totalDuration) * 100
		}
		project.DurationMinutes = int64(project.DurationSeconds / 60)
		result = append(result, project)
	}

	// Sort by duration descending
	sort.Slice(result, func(i, j int) bool {
		return result[i].DurationSeconds > result[j].DurationSeconds
	})

	return result
}

// inferPrimaryFocus determines the main work theme from accomplishments.
func (s *ReportsService) inferPrimaryFocus(accomplishments []string) string {
	// Count keywords
	keywords := map[string]int{
		"feat":     0,
		"fix":      0,
		"refactor": 0,
		"docs":     0,
		"test":     0,
		"style":    0,
		"perf":     0,
		"chore":    0,
	}

	for _, acc := range accomplishments {
		lower := strings.ToLower(acc)
		for kw := range keywords {
			if strings.Contains(lower, kw) {
				keywords[kw]++
			}
		}
	}

	// Find dominant keyword
	maxCount := 0
	dominant := ""
	for kw, count := range keywords {
		if count > maxCount {
			maxCount = count
			dominant = kw
		}
	}

	switch dominant {
	case "feat":
		return "Feature development"
	case "fix":
		return "Bug fixes"
	case "refactor":
		return "Refactoring"
	case "docs":
		return "Documentation"
	case "test":
		return "Testing"
	case "perf":
		return "Performance optimization"
	default:
		return "Development"
	}
}

// getProjectDescription returns a static description for known projects
func getProjectDescription(projectName string) string {
	descriptions := map[string]string{
		"Traq":           "Full-stack development of a privacy-first desktop activity tracker.",
		"Synaptics/42T":  "Embedded demo development for Synaptics SL261x/SL2619 chips.",
		"AI/ML Research": "AI/ML experimentation and model fine-tuning research.",
		"Arcturus Admin": "Administrative tasks and communication for Arcturus project.",
		"Claude Code":    "Development of Claude Code CLI integration and tooling.",
	}
	if desc, ok := descriptions[projectName]; ok {
		return desc
	}
	return ""
}

// consolidateAccomplishments cleans up and consolidates a list of accomplishments
func consolidateAccomplishments(accs []string) []string {
	var result []string
	seen := make(map[string]bool)

	for _, acc := range accs {
		// Clean the message
		cleaned := cleanCommitMessage(acc)

		// Skip duplicates and very similar items
		lowerCleaned := strings.ToLower(cleaned)
		if seen[lowerCleaned] {
			continue
		}

		// Skip doc-only updates unless important
		if strings.HasPrefix(lowerCleaned, "update progress") ||
			strings.HasPrefix(lowerCleaned, "mark test") ||
			strings.HasPrefix(lowerCleaned, "docs:") {
			continue
		}

		// Skip session-specific messages
		if strings.Contains(lowerCleaned, "session") && strings.Contains(lowerCleaned, "complete") {
			continue
		}

		seen[lowerCleaned] = true
		result = append(result, cleaned)
	}

	// Limit to max 8 items per day to keep report readable
	if len(result) > 8 {
		result = result[:8]
	}

	return result
}
