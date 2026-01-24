package service

import (
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"traq/internal/storage"
)

// ProjectAssignmentService handles manual project assignments and AI learning.
type ProjectAssignmentService struct {
	store        *storage.Store
	patternCache *PatternCache
	reports      *ReportsService // Set after creation to avoid circular dependency
}

// PatternCache holds in-memory pattern rules for fast matching.
type PatternCache struct {
	patterns map[int64][]storage.ProjectPattern // project_id -> patterns
	mu       sync.RWMutex
	lastLoad time.Time
	ttl      time.Duration
}

// AssignmentResult represents a project suggestion result.
type AssignmentResult struct {
	ProjectID   int64   `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Color       string  `json:"color"`
	Confidence  float64 `json:"confidence"`
	Source      string  `json:"source"` // 'rule', 'ai', 'user'
	Reason      string  `json:"reason"` // Human-readable explanation
}

// ProjectRuleInput is the input for creating/updating a project rule.
type ProjectRuleInput struct {
	ProjectID    int64   `json:"projectId"`
	PatternType  string  `json:"patternType"`  // app_name, window_title, git_repo, domain
	PatternValue string  `json:"patternValue"`
	MatchType    string  `json:"matchType"` // exact, contains, prefix, suffix, regex
	Weight       float64 `json:"weight,omitempty"`
}

// RulePreview shows what events would match a pattern.
type RulePreview struct {
	MatchCount    int      `json:"matchCount"`
	SampleMatches []string `json:"sampleMatches"` // up to 5 window titles
}

// NewProjectAssignmentService creates a new project assignment service.
func NewProjectAssignmentService(store *storage.Store) *ProjectAssignmentService {
	svc := &ProjectAssignmentService{
		store: store,
		patternCache: &PatternCache{
			patterns: make(map[int64][]storage.ProjectPattern),
			ttl:      5 * time.Minute,
		},
	}
	// Load patterns initially
	svc.refreshPatternCache()
	return svc
}

// SetReportsService sets the reports service reference (called after both services are created).
func (s *ProjectAssignmentService) SetReportsService(reports *ReportsService) {
	s.reports = reports
}

// ============================================================================
// Auto-Discovery
// ============================================================================

// projectColors is a palette of distinct colors for auto-discovered projects.
var projectColors = []string{
	"#6366f1", // Indigo
	"#8b5cf6", // Violet
	"#ec4899", // Pink
	"#f43f5e", // Rose
	"#f97316", // Orange
	"#eab308", // Yellow
	"#22c55e", // Green
	"#14b8a6", // Teal
	"#06b6d4", // Cyan
	"#3b82f6", // Blue
}

// AutoDiscoverProjects discovers projects from historical data and creates them.
// It only creates projects that don't already exist (by name).
func (s *ProjectAssignmentService) AutoDiscoverProjects() ([]storage.Project, error) {
	if s.reports == nil {
		log.Printf("AutoDiscoverProjects: reports service not set, skipping")
		return nil, nil
	}

	// 1. Get existing projects for deduplication
	existingProjects, err := s.store.GetProjects()
	if err != nil {
		return nil, err
	}
	existingNames := make(map[string]bool)
	for _, p := range existingProjects {
		existingNames[strings.ToLower(p.Name)] = true
	}

	// 2. Query historical data (last 90 days)
	now := time.Now()
	startTime := now.AddDate(0, 0, -90).Unix()
	endTime := now.Unix()

	// Track discovered projects with their detection sources
	type discoveredProject struct {
		name       string
		gitRepos   []string // repo paths that triggered detection
		windowApps []string // app names that triggered detection
	}
	discovered := make(map[string]*discoveredProject) // lowercase name -> info

	// 3a. Detect from git commits
	commits, err := s.store.GetGitCommitsByTimeRange(startTime, endTime)
	if err != nil {
		log.Printf("AutoDiscoverProjects: failed to get git commits: %v", err)
	} else {
		repoPathCache := make(map[int64]string)
		for _, commit := range commits {
			// Get repo path
			repoPath, ok := repoPathCache[commit.RepositoryID]
			if !ok {
				repo, err := s.store.GetGitRepository(commit.RepositoryID)
				if err == nil && repo != nil {
					repoPath = repo.Path
				}
				repoPathCache[commit.RepositoryID] = repoPath
			}

			if repoPath == "" {
				continue
			}

			projectName := s.reports.DetectProjectFromGitRepo(repoPath)
			if projectName == "" || projectName == "Other" {
				continue
			}

			key := strings.ToLower(projectName)
			if _, exists := discovered[key]; !exists {
				discovered[key] = &discoveredProject{name: projectName}
			}
			// Track the repo that triggered this
			dp := discovered[key]
			found := false
			for _, r := range dp.gitRepos {
				if r == repoPath {
					found = true
					break
				}
			}
			if !found {
				dp.gitRepos = append(dp.gitRepos, repoPath)
			}
		}
	}

	// 3b. Detect from window focus events
	focusEvents, err := s.store.GetFocusEventsByTimeRange(startTime, endTime)
	if err != nil {
		log.Printf("AutoDiscoverProjects: failed to get focus events: %v", err)
	} else {
		for _, evt := range focusEvents {
			projectName := s.reports.DetectProjectFromWindowTitle(evt.WindowTitle, evt.AppName)
			if projectName == "" {
				continue
			}

			key := strings.ToLower(projectName)
			if _, exists := discovered[key]; !exists {
				discovered[key] = &discoveredProject{name: projectName}
			}
			// Track the app that triggered this
			dp := discovered[key]
			found := false
			for _, a := range dp.windowApps {
				if a == evt.AppName {
					found = true
					break
				}
			}
			if !found && evt.AppName != "" {
				dp.windowApps = append(dp.windowApps, evt.AppName)
			}
		}
	}

	// 3c. Detect from browser visits
	visits, err := s.store.GetBrowserVisitsByTimeRange(startTime, endTime)
	if err != nil {
		log.Printf("AutoDiscoverProjects: failed to get browser visits: %v", err)
	} else {
		for _, visit := range visits {
			if !visit.Title.Valid {
				continue
			}
			projectName := s.reports.DetectProjectFromBrowserTitle(visit.Title.String)
			if projectName == "" {
				continue
			}

			key := strings.ToLower(projectName)
			if _, exists := discovered[key]; !exists {
				discovered[key] = &discoveredProject{name: projectName}
			}
		}
	}

	// 4. Create projects that don't already exist
	var created []storage.Project
	colorIndex := len(existingProjects) % len(projectColors)

	for key, dp := range discovered {
		// Skip if project with this name already exists
		if existingNames[key] {
			continue
		}

		// Create the project
		color := projectColors[colorIndex]
		colorIndex = (colorIndex + 1) % len(projectColors)

		project, err := s.store.CreateProject(dp.name, color, "Auto-discovered from activity data")
		if err != nil {
			log.Printf("AutoDiscoverProjects: failed to create project %s: %v", dp.name, err)
			continue
		}

		// Create patterns based on what triggered detection
		for _, repoPath := range dp.gitRepos {
			repoName := extractRepoName(repoPath)
			if repoName != "" {
				s.store.UpsertPattern(project.ID, "git_repo", repoName, "contains", 1.0)
			}
		}

		// Note: window title patterns are harder to auto-generate reliably
		// The hardcoded detection will still work, and users can add patterns manually

		created = append(created, *project)
		existingNames[key] = true // Prevent duplicates within this run
	}

	// 5. Refresh pattern cache
	if len(created) > 0 {
		s.refreshPatternCache()
		log.Printf("AutoDiscoverProjects: created %d new projects", len(created))
	}

	return created, nil
}

// ============================================================================
// Project CRUD (delegation to storage)
// ============================================================================

// CreateProject creates a new project.
func (s *ProjectAssignmentService) CreateProject(name, color, description string) (*storage.Project, error) {
	if color == "" {
		color = "#6366f1" // Default indigo
	}
	project, err := s.store.CreateProject(name, color, description)
	if err != nil {
		return nil, err
	}
	return project, nil
}

// GetProjects returns all projects.
func (s *ProjectAssignmentService) GetProjects() ([]storage.Project, error) {
	return s.store.GetProjects()
}

// GetProject returns a single project by ID.
func (s *ProjectAssignmentService) GetProject(id int64) (*storage.Project, error) {
	return s.store.GetProject(id)
}

// UpdateProject updates a project.
func (s *ProjectAssignmentService) UpdateProject(id int64, name, color, description string) error {
	return s.store.UpdateProject(id, name, color, description)
}

// DeleteProject deletes a project and clears its assignments.
func (s *ProjectAssignmentService) DeleteProject(id int64) error {
	err := s.store.DeleteProject(id)
	if err == nil {
		s.refreshPatternCache()
	}
	return err
}

// GetProjectStats returns aggregate stats for a project.
func (s *ProjectAssignmentService) GetProjectStats(projectID int64) (*storage.ProjectStats, error) {
	return s.store.GetProjectStats(projectID)
}

// GetProjectPatterns returns learned patterns for a project.
func (s *ProjectAssignmentService) GetProjectPatterns(projectID int64) ([]storage.ProjectPattern, error) {
	return s.store.GetProjectPatterns(projectID)
}

// DeletePattern deletes a learned pattern.
func (s *ProjectAssignmentService) DeletePattern(patternID int64) error {
	err := s.store.DeletePattern(patternID)
	if err == nil {
		s.refreshPatternCache()
	}
	return err
}

// ============================================================================
// Project Rules CRUD (User-configurable rules)
// ============================================================================

// CreateProjectRule creates a new pattern rule for a project.
func (s *ProjectAssignmentService) CreateProjectRule(input ProjectRuleInput) (*storage.ProjectPattern, error) {
	// Validate inputs
	if input.ProjectID == 0 {
		return nil, errInvalidInput("projectId is required")
	}
	if input.PatternType == "" {
		return nil, errInvalidInput("patternType is required")
	}
	if input.PatternValue == "" {
		return nil, errInvalidInput("patternValue is required")
	}
	if input.MatchType == "" {
		input.MatchType = "contains" // default
	}
	if input.Weight == 0 {
		input.Weight = 1.0 // default
	}

	// Validate pattern type
	validTypes := map[string]bool{"app_name": true, "window_title": true, "git_repo": true, "domain": true, "path": true}
	if !validTypes[input.PatternType] {
		return nil, errInvalidInput("invalid patternType: " + input.PatternType)
	}

	// Validate match type
	validMatchTypes := map[string]bool{"exact": true, "contains": true, "prefix": true, "suffix": true, "regex": true}
	if !validMatchTypes[input.MatchType] {
		return nil, errInvalidInput("invalid matchType: " + input.MatchType)
	}

	// Validate regex if that's the match type
	if input.MatchType == "regex" {
		if _, err := regexp.Compile(input.PatternValue); err != nil {
			return nil, errInvalidInput("invalid regex pattern: " + err.Error())
		}
	}

	// Create the pattern
	id, err := s.store.CreatePattern(input.ProjectID, input.PatternType, input.PatternValue, input.MatchType, input.Weight)
	if err != nil {
		return nil, err
	}

	// Refresh cache
	s.refreshPatternCache()

	// Return the created pattern
	return s.store.GetPattern(id)
}

// UpdateProjectRule updates an existing pattern rule.
func (s *ProjectAssignmentService) UpdateProjectRule(id int64, input ProjectRuleInput) error {
	// Get existing pattern to verify it exists
	existing, err := s.store.GetPattern(id)
	if err != nil {
		return err
	}
	if existing == nil {
		return errInvalidInput("pattern not found")
	}

	// Use existing values for any unset fields
	if input.PatternType == "" {
		input.PatternType = existing.PatternType
	}
	if input.PatternValue == "" {
		input.PatternValue = existing.PatternValue
	}
	if input.MatchType == "" {
		input.MatchType = existing.MatchType
	}
	if input.Weight == 0 {
		input.Weight = existing.Weight
	}

	// Validate regex if that's the match type
	if input.MatchType == "regex" {
		if _, err := regexp.Compile(input.PatternValue); err != nil {
			return errInvalidInput("invalid regex pattern: " + err.Error())
		}
	}

	// Update the pattern
	if err := s.store.UpdatePattern(id, input.PatternType, input.PatternValue, input.MatchType, input.Weight); err != nil {
		return err
	}

	// Refresh cache
	s.refreshPatternCache()
	return nil
}

// PreviewRuleMatches shows what events would match a pattern without applying it.
func (s *ProjectAssignmentService) PreviewRuleMatches(input ProjectRuleInput) (*RulePreview, error) {
	// Validate inputs
	if input.PatternType == "" {
		return nil, errInvalidInput("patternType is required")
	}
	if input.PatternValue == "" {
		return nil, errInvalidInput("patternValue is required")
	}
	if input.MatchType == "" {
		input.MatchType = "contains"
	}

	// Validate regex if that's the match type
	if input.MatchType == "regex" {
		if _, err := regexp.Compile(input.PatternValue); err != nil {
			return nil, errInvalidInput("invalid regex pattern: " + err.Error())
		}
	}

	// Get count
	count, err := s.store.CountMatchingEvents(input.PatternType, input.PatternValue, input.MatchType)
	if err != nil {
		return nil, err
	}

	// Get samples
	samples, err := s.store.GetSampleMatchingEvents(input.PatternType, input.PatternValue, input.MatchType, 5)
	if err != nil {
		return nil, err
	}

	return &RulePreview{
		MatchCount:    count,
		SampleMatches: samples,
	}, nil
}

// ApplyRuleToHistory applies a pattern to all matching historical events.
func (s *ProjectAssignmentService) ApplyRuleToHistory(patternID int64) (int, error) {
	// Get the pattern
	pattern, err := s.store.GetPattern(patternID)
	if err != nil {
		return 0, err
	}
	if pattern == nil {
		return 0, errInvalidInput("pattern not found")
	}

	// Apply to events
	count, err := s.store.ApplyPatternToEvents(pattern.ProjectID, pattern.PatternType, pattern.PatternValue, pattern.MatchType)
	if err != nil {
		return 0, err
	}

	log.Printf("Applied pattern %d to %d events", patternID, count)
	return count, nil
}

// errInvalidInput creates a formatted error for invalid input.
func errInvalidInput(msg string) error {
	return &InvalidInputError{Message: msg}
}

// InvalidInputError represents a validation error.
type InvalidInputError struct {
	Message string
}

func (e *InvalidInputError) Error() string {
	return e.Message
}

// ============================================================================
// Legacy Pattern Migration (One-time migration of hardcoded rules to DB)
// ============================================================================

// MigrateHardcodedPatterns creates database patterns from the legacy hardcoded rules.
// This is idempotent - it won't create duplicates if called multiple times.
// Returns number of patterns created.
func (s *ProjectAssignmentService) MigrateHardcodedPatterns() (int, error) {
	// Define legacy patterns grouped by project
	type legacyPattern struct {
		projectName  string
		projectColor string
		patternType  string
		patternValue string
	}

	legacyPatterns := []legacyPattern{
		// Traq project
		{projectName: "Traq", projectColor: "#6366f1", patternType: "window_title", patternValue: "traq"},
		{projectName: "Traq", projectColor: "#6366f1", patternType: "window_title", patternValue: "activity-tracker"},
		{projectName: "Traq", projectColor: "#6366f1", patternType: "window_title", patternValue: "activity tracker"},
		{projectName: "Traq", projectColor: "#6366f1", patternType: "git_repo", patternValue: "traq"},
		{projectName: "Traq", projectColor: "#6366f1", patternType: "git_repo", patternValue: "activity-tracker"},

		// Synaptics/42T project
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "synaptics"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "sl261"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "sl2619"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "torq"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "tflite"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "mobilenet"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "window_title", patternValue: "yolo"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "git_repo", patternValue: "synaptics"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "git_repo", patternValue: "42t"},
		{projectName: "Synaptics/42T", projectColor: "#f97316", patternType: "git_repo", patternValue: "sl261"},

		// Claude Code project
		{projectName: "Claude Code", projectColor: "#8b5cf6", patternType: "window_title", patternValue: "autonomous-coding"},
		{projectName: "Claude Code", projectColor: "#8b5cf6", patternType: "window_title", patternValue: "claude-quickstarts"},
		{projectName: "Claude Code", projectColor: "#8b5cf6", patternType: "git_repo", patternValue: "claude-quickstarts"},
		{projectName: "Claude Code", projectColor: "#8b5cf6", patternType: "git_repo", patternValue: "autonomous-coding"},

		// Arcturus Admin project
		{projectName: "Arcturus Admin", projectColor: "#ec4899", patternType: "window_title", patternValue: "arcturus"},
		{projectName: "Arcturus Admin", projectColor: "#ec4899", patternType: "window_title", patternValue: "eng-mv"},
		{projectName: "Arcturus Admin", projectColor: "#ec4899", patternType: "window_title", patternValue: "brinq-boyz"},

		// AI/ML Research project
		{projectName: "AI/ML Research", projectColor: "#14b8a6", patternType: "window_title", patternValue: "functiongemma"},
		{projectName: "AI/ML Research", projectColor: "#14b8a6", patternType: "window_title", patternValue: "fine-tuning"},
		{projectName: "AI/ML Research", projectColor: "#14b8a6", patternType: "window_title", patternValue: "gemma"},

		// Acusight project
		{projectName: "Acusight", projectColor: "#22c55e", patternType: "git_repo", patternValue: "acusight"},

		// Portainer project
		{projectName: "Portainer", projectColor: "#06b6d4", patternType: "git_repo", patternValue: "portainer"},

		// Fleet project
		{projectName: "Fleet", projectColor: "#3b82f6", patternType: "git_repo", patternValue: "fleet"},
	}

	// Get existing projects
	existingProjects, err := s.store.GetProjects()
	if err != nil {
		return 0, err
	}
	projectByName := make(map[string]*storage.Project)
	for i := range existingProjects {
		projectByName[strings.ToLower(existingProjects[i].Name)] = &existingProjects[i]
	}

	// Get existing patterns to avoid duplicates
	allPatterns, err := s.store.GetAllPatterns()
	if err != nil {
		return 0, err
	}
	existingPatternKeys := make(map[string]bool)
	for _, p := range allPatterns {
		key := fmt.Sprintf("%d:%s:%s:contains", p.ProjectID, p.PatternType, strings.ToLower(p.PatternValue))
		existingPatternKeys[key] = true
	}

	created := 0

	for _, lp := range legacyPatterns {
		// Get or create project
		project := projectByName[strings.ToLower(lp.projectName)]
		if project == nil {
			// Create the project
			newProject, err := s.store.CreateProject(lp.projectName, lp.projectColor, "Migrated from hardcoded patterns")
			if err != nil {
				log.Printf("MigrateHardcodedPatterns: failed to create project %s: %v", lp.projectName, err)
				continue
			}
			project = newProject
			projectByName[strings.ToLower(lp.projectName)] = project
		}

		// Check if pattern already exists
		key := fmt.Sprintf("%d:%s:%s:contains", project.ID, lp.patternType, strings.ToLower(lp.patternValue))
		if existingPatternKeys[key] {
			continue // Skip duplicate
		}

		// Create the pattern
		_, err := s.store.CreatePattern(project.ID, lp.patternType, lp.patternValue, "contains", 1.0)
		if err != nil {
			log.Printf("MigrateHardcodedPatterns: failed to create pattern %s/%s: %v", lp.projectName, lp.patternValue, err)
			continue
		}
		existingPatternKeys[key] = true
		created++
	}

	// Refresh pattern cache
	if created > 0 {
		s.refreshPatternCache()
		log.Printf("MigrateHardcodedPatterns: created %d patterns", created)
	}

	return created, nil
}

// ============================================================================
// Manual Assignment
// ============================================================================

// ManualAssign assigns an event to a project and learns patterns.
func (s *ProjectAssignmentService) ManualAssign(eventType string, eventID, projectID int64) error {
	// 1. Update the event with user assignment
	if err := s.store.SetEventProject(eventType, eventID, projectID, 1.0, "user"); err != nil {
		return err
	}

	// Don't learn patterns if unassigning (projectID == 0)
	if projectID == 0 {
		return nil
	}

	// 2. Extract context from the event
	ctx, err := s.ExtractEventContext(eventType, eventID)
	if err != nil {
		log.Printf("Failed to extract event context: %v", err)
		return nil // Non-fatal, assignment succeeded
	}

	// 3. Learn patterns from this assignment
	if err := s.learnFromAssignment(projectID, ctx); err != nil {
		log.Printf("Failed to learn from assignment: %v", err)
	}

	// 4. Store as few-shot example
	ctxJSON, _ := json.Marshal(ctx)
	if err := s.store.AddAssignmentExample(projectID, eventType, eventID, string(ctxJSON)); err != nil {
		log.Printf("Failed to store assignment example: %v", err)
	}

	return nil
}

// ExtractEventContext gets context from an event for pattern learning.
// Exported for use by embedding service.
func (s *ProjectAssignmentService) ExtractEventContext(eventType string, eventID int64) (*storage.AssignmentContext, error) {
	ctx := &storage.AssignmentContext{}

	switch eventType {
	case "screenshot":
		screenshot, err := s.store.GetScreenshot(eventID)
		if err != nil {
			return nil, err
		}
		if screenshot.AppName.Valid {
			ctx.AppName = screenshot.AppName.String
		}
		if screenshot.WindowTitle.Valid {
			ctx.WindowTitle = screenshot.WindowTitle.String
		}
		// Extract URL from window title if browser
		if isBrowser(ctx.AppName) {
			ctx.URL = extractURLFromTitle(ctx.WindowTitle)
			ctx.Domain = extractDomain(ctx.URL)
		}

	case "focus", "activity":
		// "activity" is the frontend name for focus events
		var windowTitle, appName string
		err := s.store.DB().QueryRow(`
			SELECT window_title, app_name FROM window_focus_events WHERE id = ?
		`, eventID).Scan(&windowTitle, &appName)
		if err != nil {
			return nil, err
		}
		ctx.AppName = appName
		ctx.WindowTitle = windowTitle
		if isBrowser(appName) {
			ctx.URL = extractURLFromTitle(windowTitle)
			ctx.Domain = extractDomain(ctx.URL)
		}

	case "git":
		// Query git commit with repo info
		var repoURL string
		var branch string
		err := s.store.DB().QueryRow(`
			SELECT COALESCE(r.remote_url, ''), COALESCE(c.branch, '')
			FROM git_commits c
			LEFT JOIN git_repositories r ON c.repository_id = r.id
			WHERE c.id = ?
		`, eventID).Scan(&repoURL, &branch)
		if err != nil {
			return nil, err
		}
		ctx.GitRepo = repoURL
		ctx.BranchName = branch
	}

	return ctx, nil
}

// ============================================================================
// Pattern Learning
// ============================================================================

// learnFromAssignment extracts patterns from a user's manual assignment.
func (s *ProjectAssignmentService) learnFromAssignment(projectID int64, ctx *storage.AssignmentContext) error {
	// 1. App name is almost always a good signal
	if ctx.AppName != "" && !isGenericApp(ctx.AppName) {
		s.store.UpsertPattern(projectID, "app_name", strings.ToLower(ctx.AppName), "exact", 0.5)
	}

	// 2. Git repo is a strong signal
	if ctx.GitRepo != "" {
		repoName := extractRepoName(ctx.GitRepo)
		if repoName != "" {
			s.store.UpsertPattern(projectID, "git_repo", repoName, "contains", 1.0)
		}
	}

	// 3. Extract keywords from window title
	if ctx.WindowTitle != "" {
		keywords := extractKeywords(ctx.WindowTitle)
		for _, kw := range keywords {
			s.store.UpsertPattern(projectID, "window_title", kw, "contains", 0.3)
		}
	}

	// 4. Domain extraction from URLs
	if ctx.Domain != "" && !isGenericDomain(ctx.Domain) {
		s.store.UpsertPattern(projectID, "domain", ctx.Domain, "contains", 0.7)
	}

	// Refresh pattern cache
	s.refreshPatternCache()

	return nil
}

// ============================================================================
// Pattern Matching
// ============================================================================

// SuggestProject gets a project suggestion for an event context.
func (s *ProjectAssignmentService) SuggestProject(ctx *storage.AssignmentContext) *AssignmentResult {
	return s.matchPatterns(ctx)
}

// matchPatterns uses cached patterns to suggest a project.
func (s *ProjectAssignmentService) matchPatterns(ctx *storage.AssignmentContext) *AssignmentResult {
	s.patternCache.mu.RLock()
	defer s.patternCache.mu.RUnlock()

	// Check if cache needs refresh
	if time.Since(s.patternCache.lastLoad) > s.patternCache.ttl {
		go s.refreshPatternCache()
	}

	scores := make(map[int64]float64)
	reasons := make(map[int64]string)

	for projectID, patterns := range s.patternCache.patterns {
		for _, p := range patterns {
			var matched bool
			var field string

			switch p.PatternType {
			case "app_name":
				matched = s.matchField(ctx.AppName, p.PatternValue, p.MatchType)
				field = "app"
			case "window_title":
				matched = s.matchField(ctx.WindowTitle, p.PatternValue, p.MatchType)
				field = "window"
			case "git_repo":
				matched = s.matchField(ctx.GitRepo, p.PatternValue, p.MatchType)
				field = "repo"
			case "domain":
				matched = s.matchField(ctx.Domain, p.PatternValue, p.MatchType)
				if !matched {
					matched = s.matchField(ctx.URL, p.PatternValue, p.MatchType)
				}
				field = "url"
			}

			if matched {
				scores[projectID] += p.Weight
				reasons[projectID] = "Matched " + field + ": " + p.PatternValue
			}
		}
	}

	// Find best match
	var bestProject int64
	var bestScore float64
	for pid, score := range scores {
		if score > bestScore {
			bestScore = score
			bestProject = pid
		}
	}

	if bestScore == 0 {
		return nil
	}

	// Normalize confidence (0-1), 3 matching rules = 100%
	confidence := bestScore / 3.0
	if confidence > 1.0 {
		confidence = 1.0
	}

	// Get project details
	project, _ := s.store.GetProject(bestProject)
	if project == nil {
		return nil
	}

	return &AssignmentResult{
		ProjectID:   bestProject,
		ProjectName: project.Name,
		Color:       project.Color,
		Confidence:  confidence,
		Source:      "rule",
		Reason:      reasons[bestProject],
	}
}

// matchField checks if a value matches a pattern.
func (s *ProjectAssignmentService) matchField(value, pattern, matchType string) bool {
	if value == "" || pattern == "" {
		return false
	}
	value = strings.ToLower(value)
	pattern = strings.ToLower(pattern)

	switch matchType {
	case "exact":
		return value == pattern
	case "contains":
		return strings.Contains(value, pattern)
	case "prefix":
		return strings.HasPrefix(value, pattern)
	case "suffix":
		return strings.HasSuffix(value, pattern)
	case "regex":
		matched, _ := regexp.MatchString(pattern, value)
		return matched
	}
	return false
}

// refreshPatternCache reloads patterns from the database.
func (s *ProjectAssignmentService) refreshPatternCache() {
	s.patternCache.mu.Lock()
	defer s.patternCache.mu.Unlock()

	if time.Since(s.patternCache.lastLoad) < time.Second {
		return // Already refreshed recently
	}

	patterns, err := s.store.GetAllPatterns()
	if err != nil {
		// Only log if this isn't a "no such table" error (which happens on first run before migration repair)
		if !strings.Contains(err.Error(), "no such table") {
			log.Printf("Failed to load patterns: %v", err)
		}
		// Initialize empty cache - patterns will be loaded on next successful refresh
		s.patternCache.patterns = make(map[int64][]storage.ProjectPattern)
		s.patternCache.lastLoad = time.Now()
		return
	}

	// Group by project
	grouped := make(map[int64][]storage.ProjectPattern)
	for _, p := range patterns {
		grouped[p.ProjectID] = append(grouped[p.ProjectID], p)
	}

	s.patternCache.patterns = grouped
	s.patternCache.lastLoad = time.Now()
}

// ============================================================================
// Helper Functions
// ============================================================================

// isBrowser checks if an app name is a browser.
func isBrowser(appName string) bool {
	lower := strings.ToLower(appName)
	browsers := []string{"chrome", "firefox", "safari", "brave", "edge", "chromium", "opera", "vivaldi"}
	for _, b := range browsers {
		if strings.Contains(lower, b) {
			return true
		}
	}
	return false
}

// isGenericApp checks if an app is too generic for pattern learning.
func isGenericApp(appName string) bool {
	lower := strings.ToLower(appName)
	generics := []string{"gnome-shell", "plasmashell", "explorer", "finder", "desktop"}
	for _, g := range generics {
		if strings.Contains(lower, g) {
			return true
		}
	}
	return false
}

// isGenericDomain checks if a domain is too generic for pattern learning.
func isGenericDomain(domain string) bool {
	generics := []string{
		"google.com", "github.com", "stackoverflow.com", "youtube.com",
		"twitter.com", "facebook.com", "linkedin.com", "reddit.com",
		"amazon.com", "wikipedia.org",
	}
	lower := strings.ToLower(domain)
	for _, g := range generics {
		if lower == g || strings.HasSuffix(lower, "."+g) {
			return true
		}
	}
	return false
}

// extractRepoName gets the repo name from a git URL.
func extractRepoName(repoURL string) string {
	if repoURL == "" {
		return ""
	}
	// Handle various git URL formats
	// https://github.com/user/repo.git -> repo
	// git@github.com:user/repo.git -> repo
	// /path/to/repo -> repo
	repoURL = strings.TrimSuffix(repoURL, ".git")
	parts := strings.Split(repoURL, "/")
	if len(parts) > 0 {
		name := parts[len(parts)-1]
		// Handle git@github.com:user/repo format
		if colonIdx := strings.LastIndex(name, ":"); colonIdx >= 0 {
			name = name[colonIdx+1:]
		}
		return strings.ToLower(name)
	}
	return ""
}

// extractURLFromTitle tries to extract a URL from a browser window title.
func extractURLFromTitle(title string) string {
	// Browser titles often have format "Page Title - Browser Name" or "Page Title | Site Name"
	// Look for common URL patterns in the title
	urlRegex := regexp.MustCompile(`https?://[^\s]+`)
	if match := urlRegex.FindString(title); match != "" {
		return match
	}
	return ""
}

// extractDomain gets the domain from a URL.
func extractDomain(url string) string {
	if url == "" {
		return ""
	}
	// Remove protocol
	url = strings.TrimPrefix(url, "https://")
	url = strings.TrimPrefix(url, "http://")
	// Get host
	if idx := strings.Index(url, "/"); idx > 0 {
		url = url[:idx]
	}
	// Remove port
	if idx := strings.Index(url, ":"); idx > 0 {
		url = url[:idx]
	}
	return strings.ToLower(url)
}

// extractKeywords pulls meaningful terms from window titles.
func extractKeywords(title string) []string {
	// Skip common noise words
	noise := map[string]bool{
		"the": true, "and": true, "for": true, "with": true, "from": true,
		"new": true, "tab": true, "untitled": true, "file": true, "edit": true,
		"view": true, "help": true, "window": true, "document": true,
		"google": true, "chrome": true, "firefox": true, "safari": true,
	}

	// Split and filter
	words := strings.Fields(strings.ToLower(title))
	keywords := []string{}

	for _, w := range words {
		w = strings.Trim(w, "[]()-:.,|/\\\"'")
		// Skip short words, numbers, and noise
		if len(w) < 4 || noise[w] {
			continue
		}
		// Skip if it looks like a URL part
		if strings.Contains(w, ".com") || strings.Contains(w, ".org") ||
			strings.Contains(w, "http") || strings.Contains(w, "www") {
			continue
		}
		keywords = append(keywords, w)
	}

	// Return top 3 most distinctive
	if len(keywords) > 3 {
		keywords = keywords[:3]
	}
	return keywords
}
