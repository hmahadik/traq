package service

import (
	"testing"
	"time"

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

func TestBuildTimesheet_DropsUndetectedProjects(t *testing.T) {
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
	if len(data.Entries) != 0 {
		t.Errorf("expected 0 entries (no project detected), got %d: %+v", len(data.Entries), data.Entries)
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
