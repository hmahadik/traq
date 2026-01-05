//go:build integration

package tracker

import (
	"os"
	"path/filepath"
	"testing"

	"traq/internal/storage"
)

// Integration tests that require a real display
// Run with: go test -tags=integration ./internal/tracker/...

func integrationTestStore(t *testing.T) (*storage.Store, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "traq-integration-test-*")
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

func TestIntegration_ScreenCapture(t *testing.T) {
	// Skip if no display available
	if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		t.Skip("No display available")
	}

	dir, err := os.MkdirTemp("", "traq-screenshot-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	sc := NewScreenCapture(dir, 80)

	// Test actual screen capture
	result, err := sc.Capture()
	if err != nil {
		t.Fatalf("failed to capture screen: %v", err)
	}

	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Verify file was created
	if _, err := os.Stat(result.Filepath); os.IsNotExist(err) {
		t.Errorf("screenshot file not created: %s", result.Filepath)
	}

	// Verify thumbnail was created
	if result.ThumbnailPath != "" {
		if _, err := os.Stat(result.ThumbnailPath); os.IsNotExist(err) {
			t.Errorf("thumbnail file not created: %s", result.ThumbnailPath)
		}
	}

	// Verify DHash was computed
	if result.DHash == "" {
		t.Error("expected non-empty DHash")
	}

	// Verify dimensions are reasonable
	if result.Width <= 0 || result.Height <= 0 {
		t.Errorf("expected positive dimensions, got %dx%d", result.Width, result.Height)
	}
}

func TestIntegration_CaptureMonitor(t *testing.T) {
	// Skip if no display available
	if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		t.Skip("No display available")
	}

	dir, err := os.MkdirTemp("", "traq-screenshot-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	sc := NewScreenCapture(dir, 80)

	// Get monitor count
	numMonitors := GetMonitorCount()
	if numMonitors == 0 {
		t.Skip("No monitors detected")
	}

	// Capture first monitor
	result, err := sc.CaptureMonitor(0)
	if err != nil {
		t.Fatalf("failed to capture monitor 0: %v", err)
	}

	if result == nil {
		t.Fatal("expected non-nil result")
	}

	// Verify file was created
	if _, err := os.Stat(result.Filepath); os.IsNotExist(err) {
		t.Errorf("screenshot file not created: %s", result.Filepath)
	}
}

func TestIntegration_CaptureMonitor_Invalid(t *testing.T) {
	// Skip if no display available
	if os.Getenv("DISPLAY") == "" && os.Getenv("WAYLAND_DISPLAY") == "" {
		t.Skip("No display available")
	}

	dir, err := os.MkdirTemp("", "traq-screenshot-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	sc := NewScreenCapture(dir, 80)

	// Try to capture invalid monitor
	_, err = sc.CaptureMonitor(999)
	if err == nil {
		t.Error("expected error for invalid monitor index")
	}
}

func TestIntegration_SQLitePersistence(t *testing.T) {
	store, cleanup := integrationTestStore(t)
	defer cleanup()

	// Create a session
	sessionID, err := store.CreateSession(1704067200) // 2024-01-01
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Add a screenshot
	sc := &storage.Screenshot{
		Timestamp: 1704067200,
		Filepath:  "/test/screenshot.webp",
		SessionID: storage.NullInt64(sessionID),
	}
	_, err = store.SaveScreenshot(sc)
	if err != nil {
		t.Fatalf("failed to save screenshot: %v", err)
	}

	// End the session
	err = store.EndSession(sessionID, 1704070800)
	if err != nil {
		t.Fatalf("failed to end session: %v", err)
	}

	// Retrieve and verify
	session, err := store.GetSession(sessionID)
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if session == nil {
		t.Fatal("expected session to exist")
	}
	if session.ScreenshotCount != 1 {
		t.Errorf("expected 1 screenshot, got %d", session.ScreenshotCount)
	}
	if !session.EndTime.Valid {
		t.Error("expected EndTime to be set")
	}
	if !session.DurationSeconds.Valid {
		t.Error("expected DurationSeconds to be set")
	}
	if session.DurationSeconds.Int64 != 3600 {
		t.Errorf("expected 3600 seconds, got %d", session.DurationSeconds.Int64)
	}
}
