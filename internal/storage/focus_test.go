package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestSaveFocusEvent(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()
	event := &WindowFocusEvent{
		WindowTitle:     "Test Window",
		AppName:         "TestApp",
		WindowClass:     sql.NullString{String: "test-class", Valid: true},
		StartTime:       now - 60,
		EndTime:         now,
		DurationSeconds: 60,
		SessionID:       sql.NullInt64{Int64: 0, Valid: false},
	}

	id, err := store.SaveFocusEvent(event)
	if err != nil {
		t.Fatalf("failed to save focus event: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetFocusEventsBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create a session
	sessionID, _ := store.CreateSession(time.Now().Unix())

	now := time.Now().Unix()

	// Add focus events
	for i := 0; i < 3; i++ {
		event := &WindowFocusEvent{
			WindowTitle:     "Window " + string(rune('A'+i)),
			AppName:         "App" + string(rune('1'+i)),
			StartTime:       now + int64(i*60),
			EndTime:         now + int64((i+1)*60),
			DurationSeconds: 60,
			SessionID:       sql.NullInt64{Int64: sessionID, Valid: true},
		}
		_, err := store.SaveFocusEvent(event)
		if err != nil {
			t.Fatalf("failed to save focus event %d: %v", i, err)
		}
	}

	// Get events for the session
	events, err := store.GetFocusEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 3 {
		t.Errorf("got %d events, want 3", len(events))
	}

	// Verify ordering
	for i := 1; i < len(events); i++ {
		if events[i].StartTime < events[i-1].StartTime {
			t.Error("events not in ascending order")
		}
	}
}

func TestGetFocusEventsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Add focus events
	for i := 0; i < 5; i++ {
		event := &WindowFocusEvent{
			WindowTitle:     "Window",
			AppName:         "App",
			StartTime:       now + int64(i*60),
			EndTime:         now + int64((i+1)*60),
			DurationSeconds: 60,
		}
		store.SaveFocusEvent(event)
	}

	// Query time range
	events, err := store.GetFocusEventsByTimeRange(now+60, now+180)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 3 {
		t.Errorf("got %d events, want 3", len(events))
	}
}

func TestGetFocusEventsByTimeRange_MidnightBoundary(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Simulate midnight at Unix timestamp 0 for simplicity
	midnight := int64(86400) // One day in seconds

	// Event 1: Spans midnight (starts 11pm, ends 1am next day)
	// This should appear on BOTH days
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Late night work", AppName: "Code",
		StartTime:       midnight - 3600,  // 11pm
		EndTime:         midnight + 3600,  // 1am next day
		DurationSeconds: 7200,             // 2 hours
	})

	// Event 2: Ends exactly at midnight (should NOT appear on next day)
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Before midnight", AppName: "Browser",
		StartTime:       midnight - 1800,  // 11:30pm
		EndTime:         midnight,         // exactly midnight
		DurationSeconds: 1800,             // 30 minutes
	})

	// Event 3: Starts exactly at midnight (should appear on next day only)
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "After midnight", AppName: "Terminal",
		StartTime:       midnight,         // exactly midnight
		EndTime:         midnight + 1800,  // 12:30am
		DurationSeconds: 1800,             // 30 minutes
	})

	// Query for "Day 1" (before midnight)
	day1Start := midnight - 86400  // Start of day 1
	day1End := midnight - 1        // End of day 1 (23:59:59)

	eventsDay1, err := store.GetFocusEventsByTimeRange(day1Start, day1End)
	if err != nil {
		t.Fatalf("failed to get day 1 events: %v", err)
	}

	// Day 1 should have: Event 1 (spans), Event 2 (ends at midnight)
	if len(eventsDay1) != 2 {
		t.Errorf("day 1: got %d events, want 2", len(eventsDay1))
	}

	// Query for "Day 2" (after midnight)
	day2Start := midnight          // Start of day 2 (00:00:00)
	day2End := midnight + 86400 - 1 // End of day 2

	eventsDay2, err := store.GetFocusEventsByTimeRange(day2Start, day2End)
	if err != nil {
		t.Fatalf("failed to get day 2 events: %v", err)
	}

	// Day 2 should have: Event 1 (spans), Event 3 (starts at midnight)
	// Event 2 should NOT appear (it ended exactly at midnight, not after)
	if len(eventsDay2) != 2 {
		t.Errorf("day 2: got %d events, want 2", len(eventsDay2))
	}

	// Verify event 2 (ends at midnight) is not in day 2
	for _, e := range eventsDay2 {
		if e.WindowTitle == "Before midnight" {
			t.Error("event ending at midnight should not appear on next day")
		}
	}
}

func TestGetAppUsageByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// App1: 120 seconds total
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Window 1", AppName: "App1",
		StartTime: now, EndTime: now + 60, DurationSeconds: 60,
	})
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Window 2", AppName: "App1",
		StartTime: now + 60, EndTime: now + 120, DurationSeconds: 60,
	})

	// App2: 90 seconds total
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Window 3", AppName: "App2",
		StartTime: now + 120, EndTime: now + 210, DurationSeconds: 90,
	})

	usage, err := store.GetAppUsageByTimeRange(now, now+300)
	if err != nil {
		t.Fatalf("failed to get app usage: %v", err)
	}

	if usage["App1"] != 120 {
		t.Errorf("App1 usage: got %f, want 120", usage["App1"])
	}
	if usage["App2"] != 90 {
		t.Errorf("App2 usage: got %f, want 90", usage["App2"])
	}
}

func TestGetTopApps(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create apps with different usage times
	apps := []struct {
		name     string
		duration float64
	}{
		{"App1", 300},
		{"App2", 200},
		{"App3", 100},
		{"App4", 50},
	}

	for _, app := range apps {
		store.SaveFocusEvent(&WindowFocusEvent{
			WindowTitle: "Window", AppName: app.name,
			StartTime: now, EndTime: now + int64(app.duration),
			DurationSeconds: app.duration,
		})
	}

	// Get top 2 apps
	topApps, err := store.GetTopApps(now, now+1000, 2)
	if err != nil {
		t.Fatalf("failed to get top apps: %v", err)
	}
	if len(topApps) != 2 {
		t.Errorf("got %d apps, want 2", len(topApps))
	}

	// Verify ordering (most used first)
	if topApps[0].AppName != "App1" {
		t.Errorf("expected App1 first, got %s", topApps[0].AppName)
	}
	if topApps[1].AppName != "App2" {
		t.Errorf("expected App2 second, got %s", topApps[1].AppName)
	}
}

func TestGetWindowFocusEventsByTimeRange_Alias(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Test", AppName: "App",
		StartTime: now, EndTime: now + 60, DurationSeconds: 60,
	})

	// Should work the same as GetFocusEventsByTimeRange
	events, err := store.GetWindowFocusEventsByTimeRange(now, now+120)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("got %d events, want 1", len(events))
	}
}

func TestGetWindowFocusEventsBySession_Alias(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sessionID, _ := store.CreateSession(time.Now().Unix())

	now := time.Now().Unix()
	store.SaveFocusEvent(&WindowFocusEvent{
		WindowTitle: "Test", AppName: "App",
		StartTime: now, EndTime: now + 60, DurationSeconds: 60,
		SessionID: sql.NullInt64{Int64: sessionID, Valid: true},
	})

	// Should work the same as GetFocusEventsBySession
	events, err := store.GetWindowFocusEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("got %d events, want 1", len(events))
	}
}
