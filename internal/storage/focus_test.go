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
