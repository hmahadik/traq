package service

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"testing"
	"time"

	"traq/internal/integrations/aiagent"
	"traq/internal/storage"
)

// helperReportsServiceForTest builds a *ReportsService with the minimum
// dependencies needed for DetectProjectFromWindowTitle to function in tests.
// The detection methods don't actually need timeline/analytics/projects
// services to work for window-title-based detection — they're nil-safe for
// the simple title-pattern path.
func helperReportsServiceForTest(t *testing.T, store *storage.Store) *ReportsService {
	t.Helper()
	return NewReportsService(store, nil, nil, nil)
}

func TestBuildTimesheet_BucketsByProjectAndDate(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	loc := time.Local
	base := time.Date(2026, 4, 25, 10, 0, 0, 0, loc) // Saturday

	// Two events on day 1, one event on day 2, all on project "traq".
	// Project detection: "traq" appears in window titles like "VS Code — traq".
	saveEvent := func(start time.Time, durSec float64, title string) {
		_, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
			WindowTitle:     title,
			AppName:         "code",
			StartTime:       start.Unix(),
			EndTime:         start.Add(time.Duration(durSec) * time.Second).Unix(),
			DurationSeconds: durSec,
		})
		if err != nil {
			t.Fatalf("save: %v", err)
		}
	}
	// Day 1: 1800s + 600s = 2400s = 0.667h → rounds to 0.75h with 0.25 rounding.
	saveEvent(base, 1800, "main.go - traq - Visual Studio Code")
	saveEvent(base.Add(45*time.Minute), 600, "reports.go - traq - Visual Studio Code")
	// Day 2: 3600s = 1.0h.
	saveEvent(base.Add(24*time.Hour), 3600, "context.go - traq - Visual Studio Code")

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-26", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}

	if len(data.Entries) != 2 {
		t.Fatalf("expected 2 entries (2 dates × 1 project), got %d: %+v", len(data.Entries), data.Entries)
	}
	// Sorted by date ASC.
	if data.Entries[0].Date != "2026-04-25" {
		t.Errorf("entry[0].Date = %q, want 2026-04-25", data.Entries[0].Date)
	}
	if data.Entries[1].Date != "2026-04-26" {
		t.Errorf("entry[1].Date = %q, want 2026-04-26", data.Entries[1].Date)
	}
	if data.Entries[0].TraqProject != "traq" {
		t.Errorf("entry[0].TraqProject = %q, want traq", data.Entries[0].TraqProject)
	}
	if data.Entries[0].Hours != 0.75 {
		t.Errorf("entry[0].Hours = %v, want 0.75", data.Entries[0].Hours)
	}
	if data.Entries[1].Hours != 1.0 {
		t.Errorf("entry[1].Hours = %v, want 1.0", data.Entries[1].Hours)
	}
}

func TestBuildTimesheet_BucketsUndetectedAsUnattributed(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	base := time.Date(2026, 4, 25, 10, 0, 0, 0, time.Local)
	_, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
		WindowTitle:     "Some random window with no project hint",
		AppName:         "firefox",
		StartTime:       base.Unix(),
		EndTime:         base.Add(time.Hour).Unix(),
		DurationSeconds: 3600,
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if len(data.Entries) != 1 {
		t.Fatalf("expected 1 unattributed entry, got %d: %+v", len(data.Entries), data.Entries)
	}
	got := data.Entries[0]
	if got.TraqProject != UnattributedProject {
		t.Errorf("TraqProject = %q, want %q", got.TraqProject, UnattributedProject)
	}
	if !got.Skipped || got.SkipReason != "unattributed" {
		t.Errorf("expected skipped=true reason=unattributed, got skipped=%v reason=%q", got.Skipped, got.SkipReason)
	}
	if got.Hours != 1.0 {
		t.Errorf("Hours = %v, want 1.0", got.Hours)
	}
	for _, p := range data.UnmappedProjects {
		if p == UnattributedProject {
			t.Errorf("UnattributedProject leaked into UnmappedProjects: %v", data.UnmappedProjects)
		}
	}
}

func TestBuildTimesheet_AttributesByProjectID(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	proj, err := store.CreateProject("Acme Corp", "#ff0000", "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	base := time.Date(2026, 4, 25, 10, 0, 0, 0, time.Local)
	id, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
		WindowTitle:     "completely unrelated title that no pattern matches",
		AppName:         "firefox",
		StartTime:       base.Unix(),
		EndTime:         base.Add(time.Hour).Unix(),
		DurationSeconds: 3600,
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	// Assign the event to the project (simulates what auto-assign / rules would do).
	if err := store.SetEventProject("focus", id, proj.ID, 1.0, "user"); err != nil {
		t.Fatalf("assign: %v", err)
	}

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if len(data.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d: %+v", len(data.Entries), data.Entries)
	}
	if data.Entries[0].TraqProject != "Acme Corp" {
		t.Errorf("TraqProject = %q, want %q (ProjectID should win over title detection)", data.Entries[0].TraqProject, "Acme Corp")
	}
}

func TestBuildTimesheet_PrefersSummaryAllocations(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	if _, err := store.CreateProject("Acme Corp", "#ff0000", ""); err != nil {
		t.Fatalf("create project: %v", err)
	}

	base := time.Date(2026, 4, 25, 10, 0, 0, 0, time.Local)

	// Create a session for the day, plus one focus event inside it. The
	// focus event has NO project assignment and a meaningless title — so
	// the focus-event fallback would bucket it as Unattributed. The summary
	// (below) overrides this.
	sessID, err := store.CreateSession(base.Unix())
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	eventID, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
		WindowTitle:     "irrelevant",
		AppName:         "firefox",
		StartTime:       base.Unix(),
		EndTime:         base.Add(time.Hour).Unix(),
		DurationSeconds: 3600,
		SessionID:       sql.NullInt64{Int64: sessID, Valid: true},
	})
	if err != nil {
		t.Fatalf("save event: %v", err)
	}
	_ = eventID
	if err := store.EndSession(sessID, base.Add(time.Hour).Unix()); err != nil {
		t.Fatalf("end session: %v", err)
	}

	// Save a summary attributing the whole hour to Acme Corp via the LLM
	// allocation path, using a lowercase variant to verify canonicalization.
	summary := &storage.Summary{
		SessionID: sql.NullInt64{Int64: sessID, Valid: true},
		Summary:   "test",
		Projects: []storage.ProjectBreakdown{
			{Name: "acme corp", TimeMinutes: 60, Confidence: "high"},
		},
		CreatedAt: base.Unix(),
	}
	sumID, err := store.SaveSummary(summary)
	if err != nil {
		t.Fatalf("save summary: %v", err)
	}
	if err := store.SetSessionSummary(sessID, sumID); err != nil {
		t.Fatalf("link summary: %v", err)
	}

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if len(data.Entries) != 1 {
		t.Fatalf("expected 1 entry from summary path, got %d: %+v", len(data.Entries), data.Entries)
	}
	got := data.Entries[0]
	if got.TraqProject != "Acme Corp" {
		t.Errorf("TraqProject = %q, want %q (canonicalized from 'acme corp')", got.TraqProject, "Acme Corp")
	}
	if got.Hours != 1.0 {
		t.Errorf("Hours = %v, want 1.0 from 60-minute summary allocation", got.Hours)
	}
}

func TestBuildTimesheet_InvalidDateRange(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	_, err := ts.BuildTimesheet("2026-04-26", "2026-04-25", 0.25)
	if err == nil {
		t.Fatal("expected error for end-before-start, got nil")
	}
}

func TestBuildTimesheet_DefaultRoundingApplied(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	// hoursRounding = 0 should fall back to 0.25.
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if data.HoursRounding != 0.25 {
		t.Errorf("HoursRounding = %v, want 0.25 (default)", data.HoursRounding)
	}
}

func TestRoundToMultiple(t *testing.T) {
	cases := []struct {
		x, m, want float64
	}{
		{0.6, 0.25, 0.5},
		{0.667, 0.25, 0.75},
		{1.0, 0.25, 1.0},
		{0.124, 0.25, 0.0},
		{0.125, 0.25, 0.25},   // 0.5 rounds to nearest even (1), so 1 * 0.25 = 0.25
		{0.13, 0.25, 0.25},
		{3.7, 0.5, 3.5},
		{3.8, 0.5, 4.0},
	}
	for _, c := range cases {
		got := roundToMultiple(c.x, c.m)
		if got != c.want {
			t.Errorf("roundToMultiple(%v, %v) = %v, want %v", c.x, c.m, got, c.want)
		}
	}
}

func TestBuildTimesheet_ResolvesMappings(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	base := time.Date(2026, 4, 25, 10, 0, 0, 0, time.Local)
	_, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
		WindowTitle:     "main.go - traq - Visual Studio Code",
		AppName:         "code",
		StartTime:       base.Unix(),
		EndTime:         base.Add(time.Hour).Unix(),
		DurationSeconds: 3600,
	})
	if err != nil {
		t.Fatalf("save event: %v", err)
	}
	_, err = store.SaveFunctionFoxProjectMapping(&storage.FunctionFoxProjectMapping{
		TraqProject:  "traq",
		FFClientID:   "1003",
		FFClientName: "Internal",
		FFJobID:      "2020",
		FFJobName:    "Internal Tools",
		FFTaskID:     "3001",
		FFTaskName:   "Development",
		Enabled:      true,
	})
	if err != nil {
		t.Fatalf("save mapping: %v", err)
	}

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if len(data.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(data.Entries))
	}
	e := data.Entries[0]
	if e.FFJobID != "2020" {
		t.Errorf("FFJobID = %q, want 2020", e.FFJobID)
	}
	if e.FFTaskName != "Development" {
		t.Errorf("FFTaskName = %q, want Development", e.FFTaskName)
	}
	if e.Skipped {
		t.Errorf("Skipped = true, want false (mapping is enabled)")
	}
	if len(data.UnmappedProjects) != 0 {
		t.Errorf("UnmappedProjects = %v, want empty", data.UnmappedProjects)
	}
}

func TestBuildTimesheet_UnmappedSurfacesProject(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	base := time.Date(2026, 4, 25, 10, 0, 0, 0, time.Local)
	_, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
		WindowTitle:     "main.go - traq - Visual Studio Code",
		AppName:         "code",
		StartTime:       base.Unix(),
		EndTime:         base.Add(time.Hour).Unix(),
		DurationSeconds: 3600,
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	// No mapping saved.

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if len(data.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(data.Entries))
	}
	e := data.Entries[0]
	if !e.Skipped {
		t.Error("Skipped should be true (no mapping)")
	}
	if e.SkipReason != "unmapped" {
		t.Errorf("SkipReason = %q, want unmapped", e.SkipReason)
	}
	if len(data.UnmappedProjects) != 1 || data.UnmappedProjects[0] != "traq" {
		t.Errorf("UnmappedProjects = %v, want [traq]", data.UnmappedProjects)
	}
}

func TestBuildTimesheet_DisabledMappingMarksUserSkipped(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	base := time.Date(2026, 4, 25, 10, 0, 0, 0, time.Local)
	_, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
		WindowTitle:     "main.go - traq - Visual Studio Code",
		AppName:         "code",
		StartTime:       base.Unix(),
		EndTime:         base.Add(time.Hour).Unix(),
		DurationSeconds: 3600,
	})
	if err != nil {
		t.Fatalf("save event: %v", err)
	}
	_, err = store.SaveFunctionFoxProjectMapping(&storage.FunctionFoxProjectMapping{
		TraqProject: "traq", FFClientID: "1", FFClientName: "x", FFJobID: "2", FFJobName: "y", FFTaskID: "3", FFTaskName: "z",
		Enabled: false, // disabled
	})
	if err != nil {
		t.Fatalf("save mapping: %v", err)
	}

	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)
	data, err := ts.BuildTimesheet("2026-04-25", "2026-04-25", 0.25)
	if err != nil {
		t.Fatalf("BuildTimesheet: %v", err)
	}
	if len(data.Entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(data.Entries))
	}
	e := data.Entries[0]
	if !e.Skipped || e.SkipReason != "user-skipped" {
		t.Errorf("Skipped=%v SkipReason=%q, want true/user-skipped", e.Skipped, e.SkipReason)
	}
	if e.FFJobID != "2" {
		t.Errorf("FFJobID = %q, expected populated even when disabled", e.FFJobID)
	}
	if len(data.UnmappedProjects) != 0 {
		t.Errorf("UnmappedProjects should be empty when mapping exists (just disabled): %v", data.UnmappedProjects)
	}
}

// fakeAgent is a controllable aiagent.Generator for tests.
type fakeAgent struct {
	name      string
	avail     bool
	output    string
	err       error
	callCount int
}

func (f *fakeAgent) Name() string    { return f.name }
func (f *fakeAgent) Available() bool { return f.avail }
func (f *fakeAgent) Generate(ctx context.Context, in aiagent.Input) (*aiagent.Output, error) {
	f.callCount++
	if f.err != nil {
		return nil, f.err
	}
	return &aiagent.Output{Notes: f.output, Tool: f.name}, nil
}

func TestPopulateNotes_NilGenerator_NoOp(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	data := &TimesheetData{
		Entries: []TimesheetEntry{
			{Date: "2026-04-25", TraqProject: "traq", Hours: 1.0},
		},
	}
	if err := ts.PopulateNotes(context.Background(), data, nil); err != nil {
		t.Fatalf("PopulateNotes: %v", err)
	}
	if data.Entries[0].Notes != "" {
		t.Errorf("Notes = %q, expected empty for nil generator", data.Entries[0].Notes)
	}
}

func TestPopulateNotes_PopulatesEntries(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	agent := &fakeAgent{name: "fake", avail: true, output: "Worked on traq."}
	data := &TimesheetData{
		Entries: []TimesheetEntry{
			{Date: "2026-04-25", TraqProject: "traq", Hours: 1.0},
			{Date: "2026-04-25", TraqProject: "other", Hours: 2.0},
		},
	}
	if err := ts.PopulateNotes(context.Background(), data, agent); err != nil {
		t.Fatalf("PopulateNotes: %v", err)
	}
	for i := range data.Entries {
		if data.Entries[i].Notes != "Worked on traq." {
			t.Errorf("entry[%d].Notes = %q", i, data.Entries[i].Notes)
		}
	}
	if agent.callCount != 2 {
		t.Errorf("expected 2 generator calls, got %d", agent.callCount)
	}
}

func TestPopulateNotes_SkipsSkippedEntries(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	agent := &fakeAgent{name: "fake", avail: true, output: "ok"}
	data := &TimesheetData{
		Entries: []TimesheetEntry{
			{Date: "2026-04-25", TraqProject: "traq", Hours: 1.0, Skipped: true, SkipReason: "unmapped"},
			{Date: "2026-04-25", TraqProject: "other", Hours: 2.0},
		},
	}
	if err := ts.PopulateNotes(context.Background(), data, agent); err != nil {
		t.Fatalf("PopulateNotes: %v", err)
	}
	if data.Entries[0].Notes != "" {
		t.Errorf("skipped entry got Notes %q, want empty", data.Entries[0].Notes)
	}
	if data.Entries[1].Notes != "ok" {
		t.Errorf("non-skipped entry got Notes %q, want ok", data.Entries[1].Notes)
	}
	if agent.callCount != 1 {
		t.Errorf("expected 1 generator call (skipped row excluded), got %d", agent.callCount)
	}
}

func TestPopulateNotes_CachesByInputHash(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	agent := &fakeAgent{name: "fake", avail: true, output: "cached!"}
	e := TimesheetEntry{Date: "2026-04-25", TraqProject: "traq", Hours: 1.0}
	data1 := &TimesheetData{Entries: []TimesheetEntry{e}}
	data2 := &TimesheetData{Entries: []TimesheetEntry{e}}

	if err := ts.PopulateNotes(context.Background(), data1, agent); err != nil {
		t.Fatalf("first PopulateNotes: %v", err)
	}
	if err := ts.PopulateNotes(context.Background(), data2, agent); err != nil {
		t.Fatalf("second PopulateNotes: %v", err)
	}
	if agent.callCount != 1 {
		t.Errorf("expected 1 generator call (second served from cache), got %d", agent.callCount)
	}
	if data2.Entries[0].Notes != "cached!" {
		t.Errorf("cached Notes not applied: got %q", data2.Entries[0].Notes)
	}
}

func TestPopulateNotes_GeneratorError_RecordsButContinues(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()
	rs := helperReportsServiceForTest(t, store)
	ts := NewTimesheetService(store, rs)

	agent := &fakeAgent{name: "fake", avail: true, err: fmt.Errorf("boom")}
	data := &TimesheetData{
		Entries: []TimesheetEntry{
			{Date: "2026-04-25", TraqProject: "traq", Hours: 1.0},
			{Date: "2026-04-26", TraqProject: "traq", Hours: 1.0},
		},
	}
	if err := ts.PopulateNotes(context.Background(), data, agent); err != nil {
		t.Fatalf("PopulateNotes returned error (should continue past per-entry failure): %v", err)
	}
	if !strings.Contains(data.Entries[0].Notes, "notes generation failed") {
		t.Errorf("entry[0].Notes = %q, want failure marker", data.Entries[0].Notes)
	}
	if !strings.Contains(data.Entries[1].Notes, "notes generation failed") {
		t.Errorf("entry[1].Notes = %q, want failure marker", data.Entries[1].Notes)
	}
}
