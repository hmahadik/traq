package storage

import (
	"testing"
	"time"
)

func TestSaveScreenshot(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sc := &Screenshot{
		Timestamp:    time.Now().Unix(),
		Filepath:     "/test/screenshot.webp",
		DHash:        "d:abc123",
		WindowTitle:  NullString("Test Window"),
		AppName:      NullString("TestApp"),
		WindowX:      NullInt64(0),
		WindowY:      NullInt64(0),
		WindowWidth:  NullInt64(1920),
		WindowHeight: NullInt64(1080),
		MonitorName:  NullString("Display 0"),
		MonitorWidth: NullInt64(1920),
	}

	id, err := store.SaveScreenshot(sc)
	if err != nil {
		t.Fatalf("failed to save screenshot: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}

	// Retrieve and verify
	saved, err := store.GetScreenshot(id)
	if err != nil {
		t.Fatalf("failed to get screenshot: %v", err)
	}
	if saved == nil {
		t.Fatal("expected screenshot to exist")
	}
	if saved.Filepath != sc.Filepath {
		t.Errorf("got Filepath=%s, want %s", saved.Filepath, sc.Filepath)
	}
	if saved.DHash != sc.DHash {
		t.Errorf("got DHash=%s, want %s", saved.DHash, sc.DHash)
	}
}

func TestSaveScreenshotUpdatesSessionCount(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create a session
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Initially 0 screenshots
	session, _ := store.GetSession(sessionID)
	if session.ScreenshotCount != 0 {
		t.Errorf("expected 0 screenshots, got %d", session.ScreenshotCount)
	}

	// Save screenshots
	for i := 0; i < 3; i++ {
		sc := &Screenshot{
			Timestamp: time.Now().Unix() + int64(i),
			Filepath:  "/test/screenshot.webp",
			SessionID: NullInt64(sessionID),
		}
		_, err := store.SaveScreenshot(sc)
		if err != nil {
			t.Fatalf("failed to save screenshot %d: %v", i, err)
		}
	}

	// Count should be 3
	session, _ = store.GetSession(sessionID)
	if session.ScreenshotCount != 3 {
		t.Errorf("expected 3 screenshots, got %d", session.ScreenshotCount)
	}
}

func TestGetScreenshot_NotFound(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sc, err := store.GetScreenshot(99999)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sc != nil {
		t.Error("expected nil for non-existent screenshot")
	}
}

func TestGetScreenshots(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create screenshots at different times
	for i := 0; i < 5; i++ {
		sc := &Screenshot{
			Timestamp: now + int64(i*60), // 1 minute apart
			Filepath:  "/test/screenshot.webp",
		}
		_, err := store.SaveScreenshot(sc)
		if err != nil {
			t.Fatalf("failed to save screenshot %d: %v", i, err)
		}
	}

	// Get all screenshots
	screenshots, err := store.GetScreenshots(now-1, now+300)
	if err != nil {
		t.Fatalf("failed to get screenshots: %v", err)
	}
	if len(screenshots) != 5 {
		t.Errorf("got %d screenshots, want 5", len(screenshots))
	}

	// Get subset
	screenshots, err = store.GetScreenshots(now+60, now+180)
	if err != nil {
		t.Fatalf("failed to get screenshots: %v", err)
	}
	if len(screenshots) != 3 {
		t.Errorf("got %d screenshots, want 3", len(screenshots))
	}
}

func TestGetScreenshotsBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create two sessions
	session1, _ := store.CreateSession(time.Now().Unix())
	session2, _ := store.CreateSession(time.Now().Unix() + 1)

	// Add screenshots to each session
	for i := 0; i < 3; i++ {
		sc := &Screenshot{
			Timestamp: time.Now().Unix() + int64(i),
			Filepath:  "/test/screenshot.webp",
			SessionID: NullInt64(session1),
		}
		store.SaveScreenshot(sc)
	}

	for i := 0; i < 2; i++ {
		sc := &Screenshot{
			Timestamp: time.Now().Unix() + int64(i+10),
			Filepath:  "/test/screenshot.webp",
			SessionID: NullInt64(session2),
		}
		store.SaveScreenshot(sc)
	}

	// Get screenshots for session 1
	screenshots, err := store.GetScreenshotsBySession(session1)
	if err != nil {
		t.Fatalf("failed to get screenshots: %v", err)
	}
	if len(screenshots) != 3 {
		t.Errorf("got %d screenshots for session 1, want 3", len(screenshots))
	}

	// Get screenshots for session 2
	screenshots, err = store.GetScreenshotsBySession(session2)
	if err != nil {
		t.Fatalf("failed to get screenshots: %v", err)
	}
	if len(screenshots) != 2 {
		t.Errorf("got %d screenshots for session 2, want 2", len(screenshots))
	}
}

func TestDeleteScreenshot(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sc := &Screenshot{
		Timestamp: time.Now().Unix(),
		Filepath:  "/test/screenshot.webp",
	}
	id, err := store.SaveScreenshot(sc)
	if err != nil {
		t.Fatalf("failed to save screenshot: %v", err)
	}

	// Delete it
	err = store.DeleteScreenshot(id)
	if err != nil {
		t.Fatalf("failed to delete screenshot: %v", err)
	}

	// Should not exist
	deleted, err := store.GetScreenshot(id)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted != nil {
		t.Error("expected screenshot to be deleted")
	}
}

func TestCountScreenshots(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	count, err := store.CountScreenshots()
	if err != nil {
		t.Fatalf("failed to count screenshots: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0, got %d", count)
	}

	// Add screenshots
	for i := 0; i < 5; i++ {
		sc := &Screenshot{
			Timestamp: time.Now().Unix() + int64(i),
			Filepath:  "/test/screenshot.webp",
		}
		store.SaveScreenshot(sc)
	}

	count, err = store.CountScreenshots()
	if err != nil {
		t.Fatalf("failed to count screenshots: %v", err)
	}
	if count != 5 {
		t.Errorf("expected 5, got %d", count)
	}
}

func TestCountScreenshotsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Add screenshots
	for i := 0; i < 5; i++ {
		sc := &Screenshot{
			Timestamp: now + int64(i*60),
			Filepath:  "/test/screenshot.webp",
		}
		store.SaveScreenshot(sc)
	}

	count, err := store.CountScreenshotsByTimeRange(now, now+120)
	if err != nil {
		t.Fatalf("failed to count screenshots: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}
