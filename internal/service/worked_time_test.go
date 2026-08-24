package service

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func setupWorkedTimeTest(t *testing.T) (*storage.Store, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "traq-worked-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	store, err := storage.NewStore(filepath.Join(dir, "test.db"))
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("failed to create store: %v", err)
	}
	cleanup := func() {
		store.Close()
		os.RemoveAll(dir)
	}
	return store, cleanup
}

// mustCreateSession inserts a completed session spanning [start, end].
func mustCreateSession(t *testing.T, store *storage.Store, start, end int64) {
	t.Helper()
	id, err := store.CreateSession(start)
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if err := store.EndSession(id, end); err != nil {
		t.Fatalf("EndSession: %v", err)
	}
}

// TestGetDailyStats_WorkedMinutes verifies that WorkedMinutes spans
// first-session-start to last-session-end, including gaps (breaks/AFK),
// while ActiveMinutes remains the sum of session durations.
func TestGetDailyStats_WorkedMinutes(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	// Use a fixed past date so no session is treated as ongoing
	day := time.Now().In(time.Local).AddDate(0, 0, -7)
	dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	base := dayStart.Unix()
	dateStr := dayStart.Format("2006-01-02")

	// 09:00-11:00 session, 2h gap, 13:00-17:00 session
	mustCreateSession(t, store, base+9*3600, base+11*3600)
	mustCreateSession(t, store, base+13*3600, base+17*3600)

	svc := NewAnalyticsService(store)
	stats, err := svc.GetDailyStats(dateStr)
	if err != nil {
		t.Fatalf("GetDailyStats: %v", err)
	}

	// Active = 2h + 4h = 360 min
	if stats.ActiveMinutes != 360 {
		t.Errorf("ActiveMinutes = %d, want 360", stats.ActiveMinutes)
	}
	// Worked = 09:00 -> 17:00 = 480 min (includes the 2h break)
	if stats.WorkedMinutes != 480 {
		t.Errorf("WorkedMinutes = %d, want 480", stats.WorkedMinutes)
	}
}

// TestGetDailyStats_WorkedMinutesEmptyDay verifies zero worked time with no sessions.
func TestGetDailyStats_WorkedMinutesEmptyDay(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	day := time.Now().In(time.Local).AddDate(0, 0, -7).Format("2006-01-02")
	svc := NewAnalyticsService(store)
	stats, err := svc.GetDailyStats(day)
	if err != nil {
		t.Fatalf("GetDailyStats: %v", err)
	}
	if stats.WorkedMinutes != 0 {
		t.Errorf("WorkedMinutes = %d, want 0", stats.WorkedMinutes)
	}
}

// TestGetDailyStats_WorkedMinutesExcludesUntrackedGap verifies that a long
// gap between sessions (machine off / suspended, no AFK recorded) splits the
// day into separate working blocks instead of inflating the span.
func TestGetDailyStats_WorkedMinutesExcludesUntrackedGap(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	day := time.Now().In(time.Local).AddDate(0, 0, -7)
	dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	base := dayStart.Unix()

	// 00:46:44-00:47:14 blip, 14h gap, 14:47:52-15:47:52, 5m AFK, 15:52:52-17:47:52
	blip := base + 46*60 + 44
	work := base + 14*3600 + 47*60 + 52
	mustCreateSession(t, store, blip, blip+30)
	mustCreateSession(t, store, work, work+3600)
	mustCreateSession(t, store, work+3600+300, work+3*3600)

	svc := NewAnalyticsService(store)
	stats, err := svc.GetDailyStats(dayStart.Format("2006-01-02"))
	if err != nil {
		t.Fatalf("GetDailyStats: %v", err)
	}

	// Active = 30s + 1h + 1h55m -> 175 min (integer minutes of 10530s)
	if stats.ActiveMinutes != 175 {
		t.Errorf("ActiveMinutes = %d, want 175", stats.ActiveMinutes)
	}
	// Worked = 30s blip + 3h block = 10830s -> 180 min, NOT 17h
	if stats.WorkedMinutes != 180 {
		t.Errorf("WorkedMinutes = %d, want 180", stats.WorkedMinutes)
	}
}

// TestGetDailyStats_WorkedMinutesOngoingSessionToday verifies that today's
// ongoing session extends worked time up to now.
func TestGetDailyStats_WorkedMinutesOngoingSessionToday(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	now := time.Now().In(time.Local)
	if now.Hour() < 2 {
		t.Skip("needs at least 2h elapsed today")
	}
	start := now.Add(-90 * time.Minute).Unix()
	if _, err := store.CreateSession(start); err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	svc := NewAnalyticsService(store)
	stats, err := svc.GetDailyStats(now.Format("2006-01-02"))
	if err != nil {
		t.Fatalf("GetDailyStats: %v", err)
	}
	if stats.WorkedMinutes < 89 || stats.WorkedMinutes > 91 {
		t.Errorf("WorkedMinutes = %d, want ~90 (ongoing session counts to now)", stats.WorkedMinutes)
	}
}

// TestGetWeeklyStats_TotalWorked verifies the weekly rollup sums worked minutes.
func TestGetWeeklyStats_TotalWorked(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	// Pick the Monday of a past week
	now := time.Now().In(time.Local)
	daysBack := 14 + (int(now.Weekday())+6)%7 // two weeks ago Monday
	monday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local).AddDate(0, 0, -daysBack)

	// Monday: 09:00-11:00 + 13:00-17:00 (worked 480, active 360)
	monBase := monday.Unix()
	mustCreateSession(t, store, monBase+9*3600, monBase+11*3600)
	mustCreateSession(t, store, monBase+13*3600, monBase+17*3600)

	// Tuesday: single 10:00-12:00 session (worked = active = 120)
	tueBase := monday.AddDate(0, 0, 1).Unix()
	mustCreateSession(t, store, tueBase+10*3600, tueBase+12*3600)

	svc := NewAnalyticsService(store)
	stats, err := svc.GetWeeklyStats(monday.Format("2006-01-02"))
	if err != nil {
		t.Fatalf("GetWeeklyStats: %v", err)
	}

	if stats.TotalActive != 360+120 {
		t.Errorf("TotalActive = %d, want %d", stats.TotalActive, 360+120)
	}
	if stats.TotalWorked != 480+120 {
		t.Errorf("TotalWorked = %d, want %d", stats.TotalWorked, 480+120)
	}
}

// TestGetWeekTimelineData_WorkedHours verifies per-day and week-level worked
// hours in the week timeline view span first-to-last activity.
func TestGetWeekTimelineData_WorkedHours(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	now := time.Now().In(time.Local)
	daysBack := 14 + (int(now.Weekday())+6)%7 // two weeks ago Monday
	monday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local).AddDate(0, 0, -daysBack)
	monBase := monday.Unix()

	// Monday: 09:00-10:00 and 12:00-14:00 focus events
	// Active = 3h, worked span = 09:00 -> 14:00 = 5h
	tueBase := monday.AddDate(0, 0, 1).Unix()
	tueBlip := tueBase + 46*60 + 44
	tueWork := tueBase + 14*3600 + 47*60 + 52
	for _, ev := range []struct{ start, end int64 }{
		{monBase + 9*3600, monBase + 10*3600},
		{monBase + 12*3600, monBase + 14*3600},
		{tueBlip, tueBlip + 30},
		{tueWork, tueWork + 3*3600},
	} {
		if _, err := store.SaveFocusEvent(&storage.WindowFocusEvent{
			WindowTitle:     "test",
			AppName:         "code",
			StartTime:       ev.start,
			EndTime:         ev.end,
			DurationSeconds: float64(ev.end - ev.start),
		}); err != nil {
			t.Fatalf("SaveFocusEvent: %v", err)
		}
	}

	svc := NewTimelineService(store)
	data, err := svc.GetWeekTimelineData(monday.Format("2006-01-02"))
	if err != nil {
		t.Fatalf("GetWeekTimelineData: %v", err)
	}

	mondayData := data.Days[0]
	if mondayData.TotalHours != 3.0 {
		t.Errorf("Monday TotalHours = %v, want 3.0", mondayData.TotalHours)
	}
	if mondayData.WorkedHours != 5.0 {
		t.Errorf("Monday WorkedHours = %v, want 5.0", mondayData.WorkedHours)
	}

	// Tuesday: 00:46-00:47 blip, 14h untracked gap, 14:47-17:47 work.
	// Worked must be 3h + 30s, not 17h.
	tueData := data.Days[1]
	wantTue := (3*3600.0 + 30) / 3600.0
	if tueData.WorkedHours != wantTue {
		t.Errorf("Tuesday WorkedHours = %v, want %v", tueData.WorkedHours, wantTue)
	}

	// Empty day has zero worked hours
	if data.Days[2].WorkedHours != 0 {
		t.Errorf("Wednesday WorkedHours = %v, want 0", data.Days[2].WorkedHours)
	}

	// Week rollup
	wantWeek := 5.0 + wantTue
	if data.WeekStats.WorkedHours != wantWeek {
		t.Errorf("WeekStats.WorkedHours = %v, want %v", data.WeekStats.WorkedHours, wantWeek)
	}
	// Two active days -> average worked = total / 2
	if data.WeekStats.AverageDailyWorked != wantWeek/2 {
		t.Errorf("WeekStats.AverageDailyWorked = %v, want %v", data.WeekStats.AverageDailyWorked, wantWeek/2)
	}
}

// TestGetMonthlyStats_TotalWorked verifies that the monthly rollup sums the
// daily worked spans (incl. breaks) and that the weekly breakdown carries it.
func TestGetMonthlyStats_TotalWorked(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	// Two fully-past days in the same month
	dayA := time.Now().In(time.Local).AddDate(0, 0, -7)
	dayA = time.Date(dayA.Year(), dayA.Month(), dayA.Day(), 0, 0, 0, 0, time.Local)
	dayB := dayA.AddDate(0, 0, -1)
	if dayB.Month() != dayA.Month() {
		dayB = dayA.AddDate(0, 0, 1)
	}

	// Day A: 09:00-10:00 + 11:00-12:00 -> active 120, worked 180 (1h break)
	baseA := dayA.Unix()
	mustCreateSession(t, store, baseA+9*3600, baseA+10*3600)
	mustCreateSession(t, store, baseA+11*3600, baseA+12*3600)
	// Day B: 09:00-11:00 -> active 120, worked 120
	baseB := dayB.Unix()
	mustCreateSession(t, store, baseB+9*3600, baseB+11*3600)

	svc := NewAnalyticsService(store)
	stats, err := svc.GetMonthlyStats(dayA.Year(), int(dayA.Month()))
	if err != nil {
		t.Fatalf("GetMonthlyStats: %v", err)
	}

	if stats.TotalActive != 240 {
		t.Errorf("TotalActive = %d, want 240", stats.TotalActive)
	}
	if stats.TotalWorked != 300 {
		t.Errorf("TotalWorked = %d, want 300", stats.TotalWorked)
	}

	var weeklyWorked int64
	for _, week := range stats.WeeklyStats {
		weeklyWorked += week.TotalWorked
	}
	if weeklyWorked != 300 {
		t.Errorf("sum of WeekStats.TotalWorked = %d, want 300", weeklyWorked)
	}
}

// TestGetYearlyStats_TotalWorked verifies the yearly rollup and per-month
// summary include worked time.
func TestGetYearlyStats_TotalWorked(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	day := time.Now().In(time.Local).AddDate(0, 0, -7)
	day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	base := day.Unix()

	// 09:00-10:00 + 11:00-12:00 -> active 120, worked 180
	mustCreateSession(t, store, base+9*3600, base+10*3600)
	mustCreateSession(t, store, base+11*3600, base+12*3600)

	svc := NewAnalyticsService(store)
	stats, err := svc.GetYearlyStats(day.Year())
	if err != nil {
		t.Fatalf("GetYearlyStats: %v", err)
	}

	if stats.TotalActive != 120 {
		t.Errorf("TotalActive = %d, want 120", stats.TotalActive)
	}
	if stats.TotalWorked != 180 {
		t.Errorf("TotalWorked = %d, want 180", stats.TotalWorked)
	}

	var monthSummary *MonthStats
	for _, m := range stats.MonthlyStats {
		if m.MonthNumber == int(day.Month()) {
			monthSummary = m
		}
	}
	if monthSummary == nil {
		t.Fatalf("no MonthStats for month %d", int(day.Month()))
	}
	if monthSummary.TotalWorked != 180 {
		t.Errorf("MonthStats.TotalWorked = %d, want 180", monthSummary.TotalWorked)
	}
}

// TestGetCustomRangeStats_TotalWorked verifies the custom-range rollup exposes
// worked time (for the range and per-day average) alongside active time.
func TestGetCustomRangeStats_TotalWorked(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	day := time.Now().In(time.Local).AddDate(0, 0, -10)
	dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	base := dayStart.Unix()

	// Day 1: 09:00-11:00 + 13:00-17:00 (active 360m, worked 480m)
	mustCreateSession(t, store, base+9*3600, base+11*3600)
	mustCreateSession(t, store, base+13*3600, base+17*3600)
	// Day 2: 10:00-12:00 (active = worked = 120m)
	day2 := dayStart.AddDate(0, 0, 1).Unix()
	mustCreateSession(t, store, day2+10*3600, day2+12*3600)

	svc := NewAnalyticsService(store)
	// 3-day range -> daily bucketing
	stats, err := svc.GetCustomRangeStats(dayStart.Format("2006-01-02"), dayStart.AddDate(0, 0, 2).Format("2006-01-02"))
	if err != nil {
		t.Fatalf("GetCustomRangeStats: %v", err)
	}
	if stats.BucketType != "daily" {
		t.Fatalf("BucketType = %q, want daily", stats.BucketType)
	}
	if stats.TotalActive != 480 {
		t.Errorf("TotalActive = %d, want 480", stats.TotalActive)
	}
	if stats.TotalWorked != 600 {
		t.Errorf("TotalWorked = %d, want 600", stats.TotalWorked)
	}
	if stats.Averages == nil {
		t.Fatal("Averages should not be nil")
	}
	if stats.Averages.WorkedMinutes != 300 {
		t.Errorf("Averages.WorkedMinutes = %d, want 300", stats.Averages.WorkedMinutes)
	}
}

// TestGetCustomRangeStats_TotalWorkedHourlyRange verifies the 1-2 day (hourly
// bucketed) path still reports range-level worked time.
func TestGetCustomRangeStats_TotalWorkedHourlyRange(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	day := time.Now().In(time.Local).AddDate(0, 0, -10)
	dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.Local)
	base := dayStart.Unix()
	mustCreateSession(t, store, base+9*3600, base+11*3600)
	mustCreateSession(t, store, base+13*3600, base+17*3600)

	svc := NewAnalyticsService(store)
	dateStr := dayStart.Format("2006-01-02")
	stats, err := svc.GetCustomRangeStats(dateStr, dateStr)
	if err != nil {
		t.Fatalf("GetCustomRangeStats: %v", err)
	}
	if stats.BucketType != "hourly" {
		t.Fatalf("BucketType = %q, want hourly", stats.BucketType)
	}
	if stats.TotalWorked != 480 {
		t.Errorf("TotalWorked = %d, want 480", stats.TotalWorked)
	}
}

// TestGetCustomRangeStats_TotalWorkedWeeklyRange verifies the 60+ day (weekly
// bucketed) path reports range-level worked time.
func TestGetCustomRangeStats_TotalWorkedWeeklyRange(t *testing.T) {
	store, cleanup := setupWorkedTimeTest(t)
	defer cleanup()

	end := time.Now().In(time.Local).AddDate(0, 0, -1)
	endStart := time.Date(end.Year(), end.Month(), end.Day(), 0, 0, 0, 0, time.Local)
	start := endStart.AddDate(0, 0, -69) // 70-day range -> weekly buckets
	base := start.AddDate(0, 0, 3).Unix()
	mustCreateSession(t, store, base+9*3600, base+11*3600)
	mustCreateSession(t, store, base+13*3600, base+17*3600)

	svc := NewAnalyticsService(store)
	stats, err := svc.GetCustomRangeStats(start.Format("2006-01-02"), endStart.Format("2006-01-02"))
	if err != nil {
		t.Fatalf("GetCustomRangeStats: %v", err)
	}
	if stats.BucketType != "weekly" {
		t.Fatalf("BucketType = %q, want weekly", stats.BucketType)
	}
	if stats.TotalWorked != 480 {
		t.Errorf("TotalWorked = %d, want 480", stats.TotalWorked)
	}
	if stats.Averages == nil || stats.Averages.WorkedMinutes != 480 {
		t.Errorf("Averages.WorkedMinutes = %+v, want 480", stats.Averages)
	}
}
