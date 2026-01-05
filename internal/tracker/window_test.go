package tracker

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
)

func testStore(t *testing.T) (*storage.Store, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "tracker-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(dir, "test.db")
	store, err := storage.NewStore(dbPath)
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

func TestNewWindowTracker(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	if tracker == nil {
		t.Fatal("expected non-nil WindowTracker")
	}
	if tracker.platform != mock {
		t.Error("platform not set correctly")
	}
}

func TestWindowTracker_Poll(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	// First poll should show change (no previous focus)
	info, changed, err := tracker.Poll()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !changed {
		t.Error("expected changed=true on first poll")
	}
	if info.Title != "Test Window" {
		t.Errorf("got Title=%s, want 'Test Window'", info.Title)
	}

	// Set current focus to match
	tracker.currentFocus = &WindowFocus{
		WindowTitle: "Test Window",
		AppName:     "TestApp",
	}

	// Same window should not show change
	_, changed, err = tracker.Poll()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if changed {
		t.Error("expected changed=false for same window")
	}

	// Different window should show change
	mock.SetActiveWindow(&platform.WindowInfo{
		Title:   "New Window",
		AppName: "NewApp",
	})

	_, changed, err = tracker.Poll()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !changed {
		t.Error("expected changed=true for different window")
	}
}

func TestWindowTracker_RecordFocusChange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	// Create a session
	sessionID, _ := store.CreateSession(time.Now().Unix())

	// First focus change
	newWindow := &platform.WindowInfo{
		Title:   "Window 1",
		AppName: "App1",
		Class:   "class1",
	}

	err := tracker.RecordFocusChange(newWindow, sessionID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify current focus is set
	focus := tracker.GetCurrentFocus()
	if focus == nil {
		t.Fatal("expected current focus to be set")
	}
	if focus.WindowTitle != "Window 1" {
		t.Errorf("got WindowTitle=%s, want 'Window 1'", focus.WindowTitle)
	}
	if focus.SessionID != sessionID {
		t.Errorf("got SessionID=%d, want %d", focus.SessionID, sessionID)
	}

	// Wait a bit so duration is > 1 second
	time.Sleep(1100 * time.Millisecond)

	// Second focus change should save the first
	newWindow2 := &platform.WindowInfo{
		Title:   "Window 2",
		AppName: "App2",
	}
	err = tracker.RecordFocusChange(newWindow2, sessionID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify focus event was saved
	events, err := store.GetFocusEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("got %d events, want 1", len(events))
	}
	if len(events) > 0 && events[0].WindowTitle != "Window 1" {
		t.Errorf("got WindowTitle=%s, want 'Window 1'", events[0].WindowTitle)
	}
}

func TestWindowTracker_FlushCurrentFocus(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	sessionID, _ := store.CreateSession(time.Now().Unix())

	// Set up a focus
	tracker.currentFocus = &WindowFocus{
		WindowTitle: "Test Window",
		AppName:     "TestApp",
		WindowClass: "test-class",
		StartTime:   time.Now().Add(-5 * time.Second),
		SessionID:   sessionID,
	}

	err := tracker.FlushCurrentFocus()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Current focus should be cleared
	if tracker.currentFocus != nil {
		t.Error("expected current focus to be nil after flush")
	}

	// Event should be saved
	events, err := store.GetFocusEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("got %d events, want 1", len(events))
	}
}

func TestWindowTracker_FlushCurrentFocus_NoFocus(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	// Should not error when no current focus
	err := tracker.FlushCurrentFocus()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestWindowTracker_FlushCurrentFocus_ShortDuration(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	sessionID, _ := store.CreateSession(time.Now().Unix())

	// Set up a focus with short duration (< 1 second)
	tracker.currentFocus = &WindowFocus{
		WindowTitle: "Test Window",
		AppName:     "TestApp",
		StartTime:   time.Now(), // Just started
		SessionID:   sessionID,
	}

	err := tracker.FlushCurrentFocus()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Event should NOT be saved (duration too short)
	events, err := store.GetFocusEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get focus events: %v", err)
	}
	if len(events) != 0 {
		t.Errorf("got %d events, want 0 for short duration", len(events))
	}
}

func TestWindowTracker_Reset(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	tracker.currentFocus = &WindowFocus{
		WindowTitle: "Test",
		AppName:     "App",
	}

	tracker.Reset()

	if tracker.currentFocus != nil {
		t.Error("expected current focus to be nil after reset")
	}
}

func TestWindowTracker_UpdateSessionID(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	tracker.currentFocus = &WindowFocus{
		WindowTitle: "Test",
		AppName:     "App",
		SessionID:   1,
	}

	tracker.UpdateSessionID(42)

	if tracker.currentFocus.SessionID != 42 {
		t.Errorf("got SessionID=%d, want 42", tracker.currentFocus.SessionID)
	}
}

func TestWindowTracker_UpdateSessionID_NoFocus(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	tracker := NewWindowTracker(mock, store)

	// Should not panic when no current focus
	tracker.UpdateSessionID(42)
}
