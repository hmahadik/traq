package service

import (
	"database/sql"
	"testing"
	"time"

	"traq/internal/storage"
)

// Helper to build a focus event.
func focusEvent(start, end int64, app string) *storage.WindowFocusEvent {
	return &storage.WindowFocusEvent{
		AppName:         app,
		StartTime:       start,
		EndTime:         end,
		DurationSeconds: float64(end - start),
	}
}

// TestCalculateDayStats_WorkedSecondsIncludesBreaksAndAFK verifies that
// WorkedSeconds spans first-to-last activity (including breaks and AFK time),
// while TotalSeconds remains active time only (span minus AFK).
func TestCalculateDayStats_WorkedSecondsIncludesBreaksAndAFK(t *testing.T) {
	dayStart := time.Date(2026, 8, 17, 0, 0, 0, 0, time.Local)
	dayEnd := dayStart.Add(24 * time.Hour)
	base := dayStart.Unix()

	// Timeline (offsets from midnight):
	//  09:00-10:00 work
	//  10:00-10:30 break (gap, no events)
	//  10:30-12:00 work
	//  12:00-13:00 AFK
	//  13:00-17:00 work
	events := []*storage.WindowFocusEvent{
		focusEvent(base+9*3600, base+10*3600, "code"),
		focusEvent(base+10*3600+1800, base+12*3600, "code"),
		focusEvent(base+13*3600, base+17*3600, "code"),
	}
	afkEvents := []*storage.AFKEvent{
		{
			StartTime: base + 12*3600,
			EndTime:   sql.NullInt64{Int64: base + 13*3600, Valid: true},
		},
	}
	categories := map[string]string{"code": "focus"}

	s := &TimelineService{}
	stats := s.calculateDayStats(events, categories, dayStart, dayEnd, afkEvents)

	// Worked time = full span 09:00 -> 17:00 = 8h (includes the 30m break and 1h AFK)
	wantWorked := 8 * 3600.0
	if stats.WorkedSeconds != wantWorked {
		t.Errorf("WorkedSeconds = %v, want %v", stats.WorkedSeconds, wantWorked)
	}
	if stats.WorkedHours != wantWorked/3600.0 {
		t.Errorf("WorkedHours = %v, want %v", stats.WorkedHours, wantWorked/3600.0)
	}

	// Active time = span - AFK = 8h - 1h = 7h (unchanged semantics)
	wantActive := 7 * 3600.0
	if stats.TotalSeconds != wantActive {
		t.Errorf("TotalSeconds = %v, want %v", stats.TotalSeconds, wantActive)
	}

	// Sanity: worked >= active always
	if stats.WorkedSeconds < stats.TotalSeconds {
		t.Errorf("WorkedSeconds (%v) should be >= TotalSeconds (%v)", stats.WorkedSeconds, stats.TotalSeconds)
	}

	if stats.DaySpan == nil {
		t.Fatal("DaySpan should not be nil")
	}
	if stats.DaySpan.StartTime != base+9*3600 {
		t.Errorf("DaySpan.StartTime = %v, want %v", stats.DaySpan.StartTime, base+9*3600)
	}
	if stats.DaySpan.EndTime != base+17*3600 {
		t.Errorf("DaySpan.EndTime = %v, want %v", stats.DaySpan.EndTime, base+17*3600)
	}
}

// TestCalculateDayStats_WorkedSecondsEmptyDay verifies zero values for a day
// with no activity.
func TestCalculateDayStats_WorkedSecondsEmptyDay(t *testing.T) {
	dayStart := time.Date(2026, 8, 17, 0, 0, 0, 0, time.Local)
	dayEnd := dayStart.Add(24 * time.Hour)

	s := &TimelineService{}
	stats := s.calculateDayStats(nil, map[string]string{}, dayStart, dayEnd, nil)

	if stats.WorkedSeconds != 0 {
		t.Errorf("WorkedSeconds = %v, want 0", stats.WorkedSeconds)
	}
	if stats.WorkedHours != 0 {
		t.Errorf("WorkedHours = %v, want 0", stats.WorkedHours)
	}
}

// TestCalculateDayStats_WorkedSecondsClampedToDay verifies events spanning
// midnight don't inflate the worked span beyond day boundaries.
func TestCalculateDayStats_WorkedSecondsClampedToDay(t *testing.T) {
	dayStart := time.Date(2026, 8, 17, 0, 0, 0, 0, time.Local)
	dayEnd := dayStart.Add(24 * time.Hour)
	base := dayStart.Unix()

	// Event starts 1h before midnight (previous day) and ends 02:00 today,
	// plus another 22:00-23:30 (ends within day).
	events := []*storage.WindowFocusEvent{
		focusEvent(base-3600, base+2*3600, "code"),
		focusEvent(base+22*3600, base+23*3600+1800, "code"),
	}

	s := &TimelineService{}
	stats := s.calculateDayStats(events, map[string]string{"code": "focus"}, dayStart, dayEnd, nil)

	// Span clamps to [00:00, 23:30] = 23.5h
	wantWorked := 23.5 * 3600.0
	if stats.WorkedSeconds != wantWorked {
		t.Errorf("WorkedSeconds = %v, want %v", stats.WorkedSeconds, wantWorked)
	}
}
