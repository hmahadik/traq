package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	"traq/internal/integrations/aiagent"
	"traq/internal/storage"
)

// UnattributedProject is the synthetic project name used for time that
// could not be attributed to any Traq project. These rows surface in the
// preview so the user sees the gap, but they are never pushable.
const UnattributedProject = "(Unattributed)"

// TimesheetEntry is one row in the structured timesheet preview: a single
// project's tracked time on a single date.
type TimesheetEntry struct {
	Date          string  `json:"date"`          // "YYYY-MM-DD" in user's local timezone
	TraqProject   string  `json:"traqProject"`   // canonical project name from event.ProjectID, fallback DetectProjectFromWindowTitle, or UnattributedProject
	Hours         float64 `json:"hours"`         // rounded per user's setting
	Notes         string  `json:"notes"`         // initially empty; populated by PopulateNotes
	FFClientID    string  `json:"ffClientId"`    // populated by mapping resolution; empty if unmapped
	FFClientName  string  `json:"ffClientName"`
	FFJobID       string  `json:"ffJobId"`
	FFJobName     string  `json:"ffJobName"`
	FFTaskID      string  `json:"ffTaskId"`
	FFTaskName    string  `json:"ffTaskName"`
	Skipped       bool    `json:"skipped"`       // user toggled off in preview
	SkipReason    string  `json:"skipReason"`    // "" or "unmapped" or "user-skipped" or "unattributed"
	FFTimesheetID string  `json:"ffTimesheetId"` // populated by Plan C after a successful push; empty in Plan B
}

// TimesheetData is the full preview for a date range.
type TimesheetData struct {
	Start            string            `json:"start"`            // "YYYY-MM-DD"
	End              string            `json:"end"`              // "YYYY-MM-DD"
	Entries          []TimesheetEntry  `json:"entries"`          // sorted by Date ASC, then TraqProject ASC
	UnmappedProjects []string          `json:"unmappedProjects"` // distinct project names that have no FF mapping; populated by Task 5
	HoursRounding    float64           `json:"hoursRounding"`    // 0.1 / 0.25 / 0.5 / 1.0
	GeneratedAt      int64             `json:"generatedAt"`      // unix seconds
}

// TimesheetService builds TimesheetData for a date range by aggregating
// window-focus events into per-(project, date) buckets.
type TimesheetService struct {
	store   *storage.Store
	reports *ReportsService

	// notesCache is keyed by SHA-256 of an aiagent.Input bundle (deterministic
	// JSON encoding). Generator output is cached in-process so re-rendering
	// the same preview doesn't re-spend tokens. The cache is intentionally
	// unbounded — preview re-runs in a single session number in the dozens.
	notesCache map[string]string
	cacheMu    sync.Mutex
}

// NewTimesheetService constructs a TimesheetService. The reports service is
// used for its exported project-detection methods.
func NewTimesheetService(store *storage.Store, reports *ReportsService) *TimesheetService {
	return &TimesheetService{
		store:      store,
		reports:    reports,
		notesCache: map[string]string{},
	}
}

// BuildTimesheet builds the structured timesheet for [startDate, endDate]
// inclusive, both formatted "YYYY-MM-DD" in the user's local timezone.
// hoursRounding is the multiple to round each per-(project,date) total to
// (typically 0.25; clamps to a safe range if zero or negative).
//
// This task's scope is bucketing only — entries come back with empty Notes
// and empty FF* fields. Task 5 fills mapping IDs; Task 6 fills Notes.
func (s *TimesheetService) BuildTimesheet(startDate, endDate string, hoursRounding float64) (*TimesheetData, error) {
	if hoursRounding <= 0 {
		hoursRounding = 0.25
	}

	loc := time.Local
	start, err := time.ParseInLocation("2006-01-02", startDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid startDate %q: %w", startDate, err)
	}
	end, err := time.ParseInLocation("2006-01-02", endDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid endDate %q: %w", endDate, err)
	}
	if end.Before(start) {
		return nil, fmt.Errorf("endDate %q is before startDate %q", endDate, startDate)
	}
	// Inclusive of the entire end day.
	endExclusive := end.Add(24 * time.Hour)

	events, err := s.store.GetFocusEventsByTimeRange(start.Unix(), endExclusive.Unix())
	if err != nil {
		return nil, fmt.Errorf("fetch focus events: %w", err)
	}

	// Pre-load all projects into an id→name map so we can attribute events
	// by their stored ProjectID without a per-event DB call. Auto-assignment
	// (rules / AI / manual) writes ProjectID onto the event, which is the
	// authoritative source of truth for "this activity belongs to project X".
	projects, err := s.store.GetProjects()
	if err != nil {
		return nil, fmt.Errorf("fetch projects: %w", err)
	}
	projectNameByID := make(map[int64]string, len(projects))
	for _, p := range projects {
		projectNameByID[p.ID] = p.Name
	}

	// Bucket: key = "YYYY-MM-DD|project" → seconds.
	type bucketKey struct {
		date    string
		project string
	}
	buckets := map[bucketKey]float64{}

	for _, e := range events {
		proj := s.attributeEvent(e, projectNameByID)
		// Use the event's start time in user's local timezone for the date bucket.
		// Events spanning midnight count entirely toward the start day. This matches
		// the existing reports convention.
		d := time.Unix(e.StartTime, 0).In(loc).Format("2006-01-02")
		buckets[bucketKey{d, proj}] += e.DurationSeconds
	}

	// Convert buckets → entries with rounded hours.
	entries := make([]TimesheetEntry, 0, len(buckets))
	for k, sec := range buckets {
		hours := sec / 3600.0
		rounded := roundToMultiple(hours, hoursRounding)
		if rounded <= 0 {
			continue // sub-rounding-precision entries dropped
		}
		entries = append(entries, TimesheetEntry{
			Date:        k.date,
			TraqProject: k.project,
			Hours:       rounded,
		})
	}

	// Sort by Date ASC, then TraqProject ASC for stable preview rendering.
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Date != entries[j].Date {
			return entries[i].Date < entries[j].Date
		}
		return entries[i].TraqProject < entries[j].TraqProject
	})

	data := TimesheetData{
		Start:         startDate,
		End:           endDate,
		Entries:       entries,
		HoursRounding: hoursRounding,
		GeneratedAt:   time.Now().Unix(),
	}
	if err := s.resolveMappings(&data); err != nil {
		return nil, err
	}
	return &data, nil
}

// attributeEvent returns the project name to bucket a focus event under.
// Order of preference:
//  1. event.ProjectID — the authoritative assignment from auto-assign / rules / AI / manual.
//  2. DetectProjectFromWindowTitle — string-pattern fallback for unassigned events.
//  3. UnattributedProject — surfaces the gap in the preview rather than dropping silently.
func (s *TimesheetService) attributeEvent(e *storage.WindowFocusEvent, projectNameByID map[int64]string) string {
	if e.ProjectID.Valid {
		if name, ok := projectNameByID[e.ProjectID.Int64]; ok && name != "" {
			return name
		}
	}
	if name := s.reports.DetectProjectFromWindowTitle(e.WindowTitle, e.AppName); name != "" {
		return name
	}
	return UnattributedProject
}

// resolveMappings populates FF* fields on each entry from the stored mappings,
// marks unmapped entries as Skipped="unmapped" and disabled-mapping entries as
// Skipped="user-skipped", and populates data.UnmappedProjects (deduped, sorted).
// The synthetic UnattributedProject bucket is always skipped with reason
// "unattributed" and never appears in UnmappedProjects.
func (s *TimesheetService) resolveMappings(data *TimesheetData) error {
	mappings, err := s.store.ListFunctionFoxProjectMappings()
	if err != nil {
		return fmt.Errorf("list project mappings: %w", err)
	}
	byProject := make(map[string]*storage.FunctionFoxProjectMapping, len(mappings))
	for _, m := range mappings {
		byProject[m.TraqProject] = m
	}

	unmappedSet := map[string]struct{}{}
	for i := range data.Entries {
		e := &data.Entries[i]
		if e.TraqProject == UnattributedProject {
			e.Skipped = true
			e.SkipReason = "unattributed"
			continue
		}
		m, ok := byProject[e.TraqProject]
		if !ok {
			e.Skipped = true
			e.SkipReason = "unmapped"
			unmappedSet[e.TraqProject] = struct{}{}
			continue
		}
		// Populate FF fields whether enabled or not — UI shows them in both cases.
		e.FFClientID = m.FFClientID
		e.FFClientName = m.FFClientName
		e.FFJobID = m.FFJobID
		e.FFJobName = m.FFJobName
		e.FFTaskID = m.FFTaskID
		e.FFTaskName = m.FFTaskName
		if !m.Enabled {
			e.Skipped = true
			e.SkipReason = "user-skipped"
		}
	}

	data.UnmappedProjects = make([]string, 0, len(unmappedSet))
	for name := range unmappedSet {
		data.UnmappedProjects = append(data.UnmappedProjects, name)
	}
	sort.Strings(data.UnmappedProjects)
	return nil
}

// roundToMultiple rounds x to the nearest multiple of m. Both must be positive.
func roundToMultiple(x, m float64) float64 {
	if m <= 0 {
		return x
	}
	return math.Round(x/m) * m
}

// PopulateNotes invokes the given AI generator for each non-skipped entry
// and writes the result to entry.Notes. If gen is nil, this is a no-op.
//
// Each entry's input bundle is hashed; cache hits skip the generator call.
// Generator failures on a single entry are logged into entry.Notes as a
// best-effort marker but do not abort the whole pass — other entries can
// still succeed.
func (s *TimesheetService) PopulateNotes(ctx context.Context, data *TimesheetData, gen aiagent.Generator) error {
	if gen == nil {
		return nil
	}
	for i := range data.Entries {
		e := &data.Entries[i]
		if e.Skipped {
			continue
		}
		in, err := s.buildAgentInput(e)
		if err != nil {
			return fmt.Errorf("build input for %s/%s: %w", e.Date, e.TraqProject, err)
		}
		key, err := hashInput(in)
		if err != nil {
			return fmt.Errorf("hash input: %w", err)
		}
		s.cacheMu.Lock()
		cached, ok := s.notesCache[key]
		s.cacheMu.Unlock()
		if ok {
			e.Notes = cached
			continue
		}
		out, err := gen.Generate(ctx, in)
		if err != nil {
			// Per-entry failure: surface the error in the Notes field so the
			// user sees what went wrong, but don't abort the whole pass.
			e.Notes = fmt.Sprintf("[notes generation failed: %v]", err)
			continue
		}
		notes := out.Notes
		if notes == "" {
			notes = "[empty response from AI agent]"
		}
		s.cacheMu.Lock()
		s.notesCache[key] = notes
		s.cacheMu.Unlock()
		e.Notes = notes
	}
	return nil
}

// buildAgentInput assembles an aiagent.Input for a single entry. Window-title
// and per-session summary aggregation is left for a future enhancement; this
// minimal version provides project + date + hours + git commit messages on
// that day. The AI agent has enough to write a reasonable paragraph.
func (s *TimesheetService) buildAgentInput(e *TimesheetEntry) (aiagent.Input, error) {
	in := aiagent.Input{
		Project: e.TraqProject,
		Date:    e.Date,
		Hours:   e.Hours,
	}
	// Date range for that single day in user's local time.
	loc := time.Local
	day, err := time.ParseInLocation("2006-01-02", e.Date, loc)
	if err != nil {
		return in, fmt.Errorf("parse date: %w", err)
	}
	start := day.Unix()
	end := day.Add(24 * time.Hour).Unix()
	commits, err := s.store.GetGitCommitsByTimeRange(start, end)
	if err != nil {
		return in, fmt.Errorf("fetch git commits: %w", err)
	}
	for _, c := range commits {
		// We don't filter by repo→project here in v1 — the agent gets all
		// the day's commits. Plan C / a follow-up can add repo→project filtering
		// once the existing reports.go logic for that is exposed cleanly.
		msg := c.MessageSubject
		if msg == "" {
			msg = c.Message
		}
		if msg != "" {
			in.GitCommits = append(in.GitCommits, msg)
		}
	}
	return in, nil
}

// hashInput produces a deterministic SHA-256 hex of an aiagent.Input. Used as
// a cache key so re-rendering the same preview doesn't re-spend tokens.
func hashInput(in aiagent.Input) (string, error) {
	// Canonical encoding: JSON encoder produces field order matching struct
	// declaration, which is deterministic for our types. Slice order is
	// already deterministic from upstream sorted aggregation.
	b, err := json.Marshal(in)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:]), nil
}
