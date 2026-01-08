package service

import (
	"database/sql"
	"fmt"
	"time"

	"traq/internal/inference"
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

// SetInferenceService sets the inference service (for late initialization)
func (s *SummaryService) SetInferenceService(inf *inference.Service) {
	s.inference = inf
}

// GenerateSummary generates a summary for a session
func (s *SummaryService) GenerateSummary(sessionID int64) (*storage.Summary, error) {
	// Get session
	session, err := s.store.GetSession(sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	if session == nil {
		return nil, fmt.Errorf("session not found: %d", sessionID)
	}

	// Build context for the inference
	ctx, err := s.buildSessionContext(session)
	if err != nil {
		return nil, fmt.Errorf("failed to build context: %w", err)
	}

	// Generate summary
	result, err := s.inference.GenerateSummary(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to generate summary: %w", err)
	}

	// Get screenshot IDs for this session
	screenshots, _ := s.store.GetScreenshotsBySession(sessionID)
	var screenshotIDs []int64
	for _, ss := range screenshots {
		screenshotIDs = append(screenshotIDs, ss.ID)
	}

	// Save summary to database
	summary := &storage.Summary{
		SessionID:       sql.NullInt64{Int64: sessionID, Valid: true},
		Summary:         result.Summary,
		Explanation:     sql.NullString{String: result.Explanation, Valid: result.Explanation != ""},
		Confidence:      sql.NullString{String: result.Confidence, Valid: result.Confidence != ""},
		Tags:            result.Tags,
		ModelUsed:       result.ModelUsed,
		InferenceTimeMs: sql.NullInt64{Int64: result.InferenceMs, Valid: true},
		ScreenshotIDs:   screenshotIDs,
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

	// Get focus events
	focusEvents, _ := s.store.GetWindowFocusEventsBySession(session.ID)
	appDurations := make(map[string]float64)
	for _, evt := range focusEvents {
		appDurations[evt.AppName] += evt.DurationSeconds
		ctx.FocusEvents = append(ctx.FocusEvents, inference.FocusEvent{
			AppName:     evt.AppName,
			WindowTitle: evt.WindowTitle,
			Duration:    evt.DurationSeconds,
		})
	}

	// Get top apps
	for app := range appDurations {
		ctx.TopApps = append(ctx.TopApps, app)
		if len(ctx.TopApps) >= 5 {
			break
		}
	}

	// Get shell commands
	shellCmds, _ := s.store.GetShellCommandsBySession(session.ID)
	for _, cmd := range shellCmds {
		ctx.ShellCommands = append(ctx.ShellCommands, cmd.Command)
	}

	// Get git commits
	gitCommits, _ := s.store.GetGitCommitsBySession(session.ID)
	for _, commit := range gitCommits {
		ctx.GitCommits = append(ctx.GitCommits, commit.MessageSubject)
	}

	// Get file events
	fileEvents, _ := s.store.GetFileEventsBySession(session.ID)
	for _, evt := range fileEvents {
		ctx.FileEvents = append(ctx.FileEvents, fmt.Sprintf("%s: %s", evt.EventType, evt.FileName))
	}

	// Get browser visits
	browserVisits, _ := s.store.GetBrowserVisitsBySession(session.ID)
	for _, visit := range browserVisits {
		title := visit.Domain
		if visit.Title.Valid && visit.Title.String != "" {
			title = visit.Title.String
		}
		ctx.BrowserVisits = append(ctx.BrowserVisits, title)
	}

	return ctx, nil
}
