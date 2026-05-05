package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
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

// TimesheetPromptPreview is the per-row payload returned by GetTimesheetPrompts.
// The structured fields drive the collapsible sections in the modal;
// FullPrompt is the verbatim string that will be sent to the LLM.
type TimesheetPromptPreview struct {
	Date         string   `json:"date"`
	Project      string   `json:"project"`
	Hours        float64  `json:"hours"`
	AISummaries  []string `json:"aiSummaries"`
	GitCommits   []string `json:"gitCommits"`
	WindowTitles []string `json:"windowTitles"`
	FullPrompt   string   `json:"fullPrompt"`
}

// TimesheetPromptResult is the top-level response from GetTimesheetPrompts.
// Previews contains one entry per LLM-eligible row; BackendName is the
// human-readable name of the configured notes backend (for modal header).
type TimesheetPromptResult struct {
	Previews    []TimesheetPromptPreview `json:"previews"`
	BackendName string                   `json:"backendName"`
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
	sessions, err := s.store.GetSessionsByTimeRange(start.Unix(), endExclusive.Unix())
	if err != nil {
		return nil, fmt.Errorf("fetch sessions: %w", err)
	}

	// Pre-load all projects so we can:
	//   1) Attribute focus events by their stored ProjectID without a per-event DB call.
	//   2) Canonicalize project names returned by the AI summary (LLM may use
	//      slight variants like "acme" vs "Acme Corp"; we want the canonical
	//      Traq project name so FF-mapping resolution finds them).
	projects, err := s.store.GetProjects()
	if err != nil {
		return nil, fmt.Errorf("fetch projects: %w", err)
	}
	projectNameByID := make(map[int64]string, len(projects))
	canonicalByLower := make(map[string]string, len(projects))
	for _, p := range projects {
		projectNameByID[p.ID] = p.Name
		canonicalByLower[strings.ToLower(p.Name)] = p.Name
	}

	// Bucket: key = "YYYY-MM-DD|project" → seconds.
	type bucketKey struct {
		date    string
		project string
	}
	buckets := map[bucketKey]float64{}

	// Group focus events by session so we can fall back per-session when the
	// session has no AI summary. Events without a session ID fall through to
	// the sessionless slice.
	eventsBySession := map[int64][]*storage.WindowFocusEvent{}
	var sessionlessEvents []*storage.WindowFocusEvent
	for _, e := range events {
		if e.SessionID.Valid {
			eventsBySession[e.SessionID.Int64] = append(eventsBySession[e.SessionID.Int64], e)
		} else {
			sessionlessEvents = append(sessionlessEvents, e)
		}
	}

	// Per-session attribution: prefer the LLM-allocated project breakdown
	// from the session's summary; fall back to focus-event ProjectID
	// attribution when no summary exists.
	for _, sess := range sessions {
		summary, _ := s.store.GetSummaryBySession(sess.ID)
		if summary != nil && len(summary.Projects) > 0 {
			sessDate := time.Unix(sess.StartTime, 0).In(loc).Format("2006-01-02")
			for _, pb := range summary.Projects {
				name := canonicalizeProjectName(pb.Name, canonicalByLower)
				if name == "" {
					name = UnattributedProject
				}
				buckets[bucketKey{sessDate, name}] += float64(pb.TimeMinutes) * 60
			}
			continue
		}
		// Focus-event fallback for this session.
		for _, e := range eventsBySession[sess.ID] {
			proj := s.attributeEvent(e, projectNameByID)
			d := time.Unix(e.StartTime, 0).In(loc).Format("2006-01-02")
			buckets[bucketKey{d, proj}] += e.DurationSeconds
		}
	}

	// Sessionless focus events: attribute via the same fallback path.
	for _, e := range sessionlessEvents {
		proj := s.attributeEvent(e, projectNameByID)
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

// BuildPromptPreviews runs the same pipeline as BuildTimesheet (aggregate
// events → resolve mappings) but stops before the LLM call. It returns
// the structured prompt data for every non-unattributed entry so the
// frontend can show a pre-flight review modal.
func (s *TimesheetService) BuildPromptPreviews(startDate, endDate string, rounding float64) ([]TimesheetPromptPreview, error) {
	if rounding <= 0 {
		rounding = 0.25
	}
	data, err := s.BuildTimesheet(startDate, endDate, rounding)
	if err != nil {
		return nil, err
	}

	var previews []TimesheetPromptPreview
	for i := range data.Entries {
		e := &data.Entries[i]
		if e.SkipReason == "unattributed" {
			continue
		}
		in, err := s.buildAgentInput(e)
		if err != nil {
			return nil, fmt.Errorf("build input for %s/%s: %w", e.Date, e.TraqProject, err)
		}
		previews = append(previews, TimesheetPromptPreview{
			Date:         e.Date,
			Project:      e.TraqProject,
			Hours:        e.Hours,
			AISummaries:  in.AISummaries,
			GitCommits:   in.GitCommits,
			WindowTitles: in.WindowTitles,
			FullPrompt:   aiagent.BuildPrompt(in),
		})
	}
	if previews == nil {
		previews = []TimesheetPromptPreview{}
	}
	return previews, nil
}

// canonicalizeProjectName matches an LLM-returned project name (which may
// be a casing/whitespace variant of an actual Traq project) against the
// canonical project list and returns the canonical name. Returns the
// original trimmed name if no match is found — the caller decides whether
// to bucket it as Unattributed.
func canonicalizeProjectName(name string, canonicalByLower map[string]string) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return ""
	}
	if canonical, ok := canonicalByLower[strings.ToLower(trimmed)]; ok {
		return canonical
	}
	return trimmed
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

// PopulateNotes invokes the given backend for each non-skipped entry and
// writes the result to entry.Notes. If backend is nil, this is a no-op.
//
// Each entry's input bundle is hashed; cache hits skip the backend call.
// Per-entry failures are surfaced in the Notes field as a best-effort
// marker but do not abort the whole pass — other entries can still succeed.
func (s *TimesheetService) PopulateNotes(ctx context.Context, data *TimesheetData, backend NotesBackend) error {
	if backend == nil {
		log.Printf("[notes] PopulateNotes: nil backend, skipping")
		return nil
	}
	log.Printf("[notes] PopulateNotes start backend=%s entries=%d", backend.Name(), len(data.Entries))
	for i := range data.Entries {
		e := &data.Entries[i]
		// Only skip the synthetic Unattributed bucket — there's no real
		// project signal to summarize. Rows that are Skipped because they
		// lack an FF mapping or were toggled off by the user *should* still
		// get notes: in preview-only mode the user wants to see the AI's
		// take regardless of push eligibility, and for mapped-but-disabled
		// rows the notes inform whether they should re-enable the mapping.
		if e.SkipReason == "unattributed" {
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
			log.Printf("[notes] %s/%s cache-hit", e.Date, e.TraqProject)
			e.Notes = cached
			continue
		}
		callStart := time.Now()
		notes, err := backend.Generate(ctx, in)
		log.Printf("[notes] %s/%s err=%v bytes=%d duration=%vs",
			e.Date, e.TraqProject, err, len(notes), time.Since(callStart).Seconds())
		if err != nil {
			e.Notes = fmt.Sprintf("[notes generation failed: %v]", err)
			continue
		}
		if notes == "" {
			notes = "[empty response from AI backend]"
		}
		s.cacheMu.Lock()
		s.notesCache[key] = notes
		s.cacheMu.Unlock()
		e.Notes = notes
	}
	return nil
}

// buildAgentInput assembles an aiagent.Input for a single entry. The bundle
// is filtered to *this* project's signals: only commits assigned to this
// project, and only the activities each session summary attributed to this
// project. Without that filter every project's notes saw the whole day's
// commits and bled features from project A into project B's prose.
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

	// Resolve project ID by name. Used to filter commits whose ProjectID
	// (set by auto-assign / rules / manual / AI) matches this row's project.
	// Unknown project names (e.g. names the LLM canonicalized but that
	// never made it into the projects table) get no project-id filter and
	// fall back to including no commits — better silence than contamination.
	var projectID int64
	if projects, err := s.store.GetProjects(); err == nil {
		for _, p := range projects {
			if strings.EqualFold(p.Name, e.TraqProject) {
				projectID = p.ID
				break
			}
		}
	}

	commits, err := s.store.GetGitCommitsByTimeRange(start, end)
	if err != nil {
		return in, fmt.Errorf("fetch git commits: %w", err)
	}
	for _, c := range commits {
		// Filter: include only commits attributed to this project. If we
		// couldn't resolve the project ID at all, we skip every commit —
		// the agent will then write notes from project + hours alone, which
		// is less rich but at least won't be wrong.
		if projectID == 0 || !c.ProjectID.Valid || c.ProjectID.Int64 != projectID {
			continue
		}
		msg := c.MessageSubject
		if msg == "" {
			msg = c.Message
		}
		if msg != "" {
			in.GitCommits = append(in.GitCommits, msg)
		}
	}

	// Pull per-project activities from session summaries that overlap this
	// day. The session-level LLM has already decomposed each session by
	// project; we collect just the entries it tagged with this project name
	// (case-insensitive, since the LLM may use casing variants).
	if sessions, err := s.store.GetSessionsByTimeRange(start, end); err == nil {
		want := strings.ToLower(e.TraqProject)
		for _, sess := range sessions {
			summary, _ := s.store.GetSummaryBySession(sess.ID)
			if summary == nil {
				continue
			}
			for _, pb := range summary.Projects {
				if strings.ToLower(pb.Name) != want {
					continue
				}
				for _, act := range pb.Activities {
					if act = strings.TrimSpace(act); act != "" {
						in.AISummaries = append(in.AISummaries, act)
					}
				}
			}
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
