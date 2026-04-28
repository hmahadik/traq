package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"time"

	"traq/internal/inference"
	"traq/internal/integrations/aiagent"
	"traq/internal/storage"
)

// SummaryService handles AI summary generation
type SummaryService struct {
	store     *storage.Store
	inference *inference.Service
}

// NewSummaryService creates a new SummaryService
func NewSummaryService(store *storage.Store, inf *inference.Service) *SummaryService {
	return &SummaryService{
		store:     store,
		inference: inf,
	}
}

// GenerateSummary generates a summary for a session using the configured
// inference engine (bundled / Ollama / cloud).
func (s *SummaryService) GenerateSummary(sessionID int64) (*storage.Summary, error) {
	return s.generate(sessionID, nil)
}

// GenerateSummaryWithAgent generates a summary using a CLI-backed aiagent
// instead of the inference engine. The same prompt builder + response parser
// are used, so the resulting Summary record is structurally identical — only
// the transport changes (CLI subprocess vs HTTP to llama-server).
func (s *SummaryService) GenerateSummaryWithAgent(sessionID int64, gen aiagent.Generator) (*storage.Summary, error) {
	if gen == nil {
		return nil, fmt.Errorf("nil generator")
	}
	return s.generate(sessionID, gen)
}

func (s *SummaryService) generate(sessionID int64, gen aiagent.Generator) (*storage.Summary, error) {
	overallStart := time.Now()
	backend := "inference"
	if gen != nil {
		backend = "agent:" + gen.Name()
	}
	log.Printf("[summary] generate session=%d backend=%s: start", sessionID, backend)

	// Get session
	session, err := s.store.GetSession(sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session == nil {
		return nil, fmt.Errorf("session not found: %d", sessionID)
	}
	log.Printf("[summary] generate session=%d: session loaded duration=%vs", sessionID, time.Since(overallStart).Seconds())

	// Build context for the inference
	ctx, err := s.buildSessionContext(session)
	if err != nil {
		return nil, fmt.Errorf("failed to build context: %w", err)
	}
	log.Printf("[summary] generate session=%d: context built focus=%d shell=%d git=%d files=%d browser=%d topApps=%v duration=%vs",
		sessionID, len(ctx.FocusEvents), len(ctx.ShellCommands), len(ctx.GitCommits), len(ctx.FileEvents), len(ctx.BrowserVisits), ctx.TopApps, time.Since(overallStart).Seconds())

	var result *inference.SummaryResult
	if gen != nil {
		// CLI path: build the same prompt the inference engine would build,
		// run it through the agent CLI, parse the output with the shared
		// parser. No setup-status check — agent generators have their own
		// Available() probe and the caller has already gated on that.
		runStart := time.Now()
		prompt := inference.BuildSummaryPrompt(ctx)
		log.Printf("[summary] generate session=%d: calling agent %s prompt-bytes=%d", sessionID, gen.Name(), len(prompt))
		raw, err := gen.GenerateRaw(context.Background(), prompt)
		log.Printf("[summary] generate session=%d: agent returned err=%v bytes=%d duration=%vs", sessionID, err, len(raw), time.Since(runStart).Seconds())
		if err != nil {
			return nil, fmt.Errorf("failed to generate summary via agent %s: %w", gen.Name(), err)
		}
		result = inference.ParseSummaryResponse(raw)
		result.ModelUsed = "agent:" + gen.Name()
		result.InferenceMs = time.Since(runStart).Milliseconds()
	} else {
		// Inference engine path. Setup-status gate matters here because the
		// engine may not be ready (server not running, model missing, etc.).
		statusStart := time.Now()
		status := s.inference.GetSetupStatus()
		log.Printf("[summary] generate session=%d: setup-status ready=%v engine=%s issue=%q checked-in=%vs",
			sessionID, status.Ready, status.Engine, status.Issue, time.Since(statusStart).Seconds())
		if !status.Ready {
			return nil, fmt.Errorf("inference not ready: %s. %s", status.Issue, status.Suggestion)
		}
		inferenceStart := time.Now()
		log.Printf("[summary] generate session=%d: calling inference.GenerateSummary", sessionID)
		result, err = s.inference.GenerateSummary(ctx)
		log.Printf("[summary] generate session=%d: inference returned err=%v duration=%vs", sessionID, err, time.Since(inferenceStart).Seconds())
		if err != nil {
			return nil, fmt.Errorf("failed to generate summary: %w", err)
		}
	}

	// Get screenshot IDs for this session
	screenshots, _ := s.store.GetScreenshotsBySession(sessionID)
	var screenshotIDs []int64
	for _, ss := range screenshots {
		screenshotIDs = append(screenshotIDs, ss.ID)
	}

	// Convert inference.ProjectBreakdown to storage.ProjectBreakdown
	var projects []storage.ProjectBreakdown
	for _, p := range result.Projects {
		projects = append(projects, storage.ProjectBreakdown{
			Name:        p.Name,
			TimeMinutes: p.TimeMinutes,
			Activities:  p.Activities,
			Confidence:  p.Confidence,
		})
	}

	// Serialize context to JSON for storage
	contextJSON := sql.NullString{}
	if ctxBytes, err := json.Marshal(ctx); err == nil {
		contextJSON = sql.NullString{String: string(ctxBytes), Valid: true}
	}

	// Save summary to database
	summary := &storage.Summary{
		SessionID:       sql.NullInt64{Int64: sessionID, Valid: true},
		Summary:         result.Summary,
		Explanation:     sql.NullString{String: result.Explanation, Valid: result.Explanation != ""},
		Confidence:      sql.NullString{String: result.Confidence, Valid: result.Confidence != ""},
		Tags:            result.Tags,
		Projects:        projects,
		ModelUsed:       result.ModelUsed,
		InferenceTimeMs: sql.NullInt64{Int64: result.InferenceMs, Valid: true},
		ScreenshotIDs:   screenshotIDs,
		ContextJSON:     contextJSON,
		CreatedAt:       time.Now().Unix(),
	}

	summaryID, err := s.store.SaveSummary(summary)
	if err != nil {
		return nil, fmt.Errorf("failed to save summary: %w", err)
	}
	summary.ID = summaryID

	// Link summary to session
	if err := s.store.SetSessionSummary(sessionID, summaryID); err != nil {
		// Log but don't fail - summary was saved
		fmt.Printf("Warning: failed to link summary to session: %v\n", err)
	}

	log.Printf("[summary] generate session=%d: done summaryID=%d total=%vs", sessionID, summaryID, time.Since(overallStart).Seconds())
	return summary, nil
}

// RegenerateSummary regenerates a summary for a session (deletes existing)
func (s *SummaryService) RegenerateSummary(sessionID int64) (*storage.Summary, error) {
	// Delete existing summary if any
	existing, err := s.store.GetSummaryBySession(sessionID)
	if err == nil && existing != nil {
		s.store.DeleteSummary(existing.ID)
	}

	// Generate new summary
	return s.GenerateSummary(sessionID)
}

// GetSummary retrieves a summary by ID
func (s *SummaryService) GetSummary(id int64) (*storage.Summary, error) {
	return s.store.GetSummary(id)
}

// GetSummaryBySession retrieves a summary by session ID
func (s *SummaryService) GetSummaryBySession(sessionID int64) (*storage.Summary, error) {
	return s.store.GetSummaryBySession(sessionID)
}

func (s *SummaryService) buildSessionContext(session *storage.Session) (*inference.SessionContext, error) {
	ctx := &inference.SessionContext{
		StartTime:       session.StartTime,
		ScreenshotCount: session.ScreenshotCount,
	}

	if session.EndTime.Valid {
		ctx.EndTime = session.EndTime.Int64
	} else {
		ctx.EndTime = time.Now().Unix()
	}

	if session.DurationSeconds.Valid {
		ctx.DurationSeconds = session.DurationSeconds.Int64
	} else {
		ctx.DurationSeconds = ctx.EndTime - ctx.StartTime
	}

	// Pre-load project names so we can annotate focus events that already
	// have a ProjectID assigned by the auto-assign / rules / AI / manual
	// pipeline. Lets the LLM see "this 30-min block was already attributed
	// to Acme" instead of guessing from the window title.
	projects, _ := s.store.GetProjects()
	projectNameByID := make(map[int64]string, len(projects))
	for _, p := range projects {
		projectNameByID[p.ID] = p.Name
	}

	// Get focus events
	focusEvents, _ := s.store.GetWindowFocusEventsBySession(session.ID)
	appDurations := make(map[string]float64)
	for _, evt := range focusEvents {
		appDurations[evt.AppName] += evt.DurationSeconds
		var projName string
		if evt.ProjectID.Valid {
			projName = projectNameByID[evt.ProjectID.Int64]
		}
		ctx.FocusEvents = append(ctx.FocusEvents, inference.FocusEvent{
			AppName:     evt.AppName,
			WindowTitle: evt.WindowTitle,
			Duration:    evt.DurationSeconds,
			StartTime:   evt.StartTime,
			ProjectName: projName,
		})
	}

	// Get top apps sorted by duration (descending)
	type appDur struct {
		name string
		dur  float64
	}
	var sorted []appDur
	for app, dur := range appDurations {
		sorted = append(sorted, appDur{app, dur})
	}
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].dur > sorted[j].dur
	})
	for i, ad := range sorted {
		if i >= 5 {
			break
		}
		ctx.TopApps = append(ctx.TopApps, ad.name)
	}

	// Get shell commands — including working directory, the strongest
	// project signal for terminal time.
	shellCmds, _ := s.store.GetShellCommandsBySession(session.ID)
	for _, cmd := range shellCmds {
		cwd := ""
		if cmd.WorkingDirectory.Valid {
			cwd = cmd.WorkingDirectory.String
		}
		ctx.ShellCommands = append(ctx.ShellCommands, inference.ShellEvent{
			Timestamp:        cmd.Timestamp,
			Command:          cmd.Command,
			WorkingDirectory: cwd,
		})
	}

	// Get git commits — annotate with repo name (from a small lookup cache)
	// and branch so the LLM can attribute commits without guessing.
	gitCommits, _ := s.store.GetGitCommitsBySession(session.ID)
	repoNameByID := make(map[int64]string)
	for _, commit := range gitCommits {
		repoName, ok := repoNameByID[commit.RepositoryID]
		if !ok {
			if repo, err := s.store.GetGitRepository(commit.RepositoryID); err == nil && repo != nil {
				repoName = repo.Name
			}
			repoNameByID[commit.RepositoryID] = repoName
		}
		branch := ""
		if commit.Branch.Valid {
			branch = commit.Branch.String
		}
		subject := commit.MessageSubject
		if subject == "" {
			subject = commit.Message
		}
		ctx.GitCommits = append(ctx.GitCommits, inference.GitEvent{
			Timestamp: commit.Timestamp,
			Subject:   subject,
			Repo:      repoName,
			Branch:    branch,
		})
	}

	// Get file events
	fileEvents, _ := s.store.GetFileEventsBySession(session.ID)
	for _, evt := range fileEvents {
		ctx.FileEvents = append(ctx.FileEvents, inference.FileEvent{
			Timestamp: evt.Timestamp,
			EventType: evt.EventType,
			FileName:  evt.FileName,
			Directory: evt.Directory,
		})
	}

	// Get browser visits
	browserVisits, _ := s.store.GetBrowserVisitsBySession(session.ID)
	for _, visit := range browserVisits {
		title := ""
		if visit.Title.Valid {
			title = visit.Title.String
		}
		ctx.BrowserVisits = append(ctx.BrowserVisits, inference.BrowserEvent{
			Timestamp: visit.Timestamp,
			Title:     title,
			Domain:    visit.Domain,
			URL:       visit.URL,
		})
	}

	// Pull AI coding events that overlap this work session. These come from
	// claude/opencode session logs and provide rich signal: which directory
	// the AI was pointed at and what the user was actually asking for.
	if aiEvents, err := s.store.GetAIEventsInRange(ctx.StartTime, ctx.EndTime); err == nil {
		for _, e := range aiEvents {
			ctx.AIEvents = append(ctx.AIEvents, inference.AIEvent{
				Timestamp:  e.Timestamp,
				Tool:       e.Tool,
				Kind:       e.Kind,
				ProjectDir: e.ProjectDir,
				Content:    e.Content,
			})
		}
	}

	return ctx, nil
}
