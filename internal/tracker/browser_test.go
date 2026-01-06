package tracker

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"traq/internal/platform"
	"traq/internal/storage"
)

// MockBrowserPlatform implements platform.Platform for browser testing.
type MockBrowserPlatform struct {
	browserPaths map[string]string
}

func (m *MockBrowserPlatform) DataDir() string                              { return "" }
func (m *MockBrowserPlatform) ConfigDir() string                            { return "" }
func (m *MockBrowserPlatform) CacheDir() string                             { return "" }
func (m *MockBrowserPlatform) GetActiveWindow() (*platform.WindowInfo, error) { return nil, nil }
func (m *MockBrowserPlatform) GetLastInputTime() (time.Time, error)         { return time.Time{}, nil }
func (m *MockBrowserPlatform) GetShellHistoryPath() string                  { return "" }
func (m *MockBrowserPlatform) GetShellType() string                         { return "bash" }
func (m *MockBrowserPlatform) GetBrowserHistoryPaths() map[string]string {
	return m.browserPaths
}
func (m *MockBrowserPlatform) OpenURL(url string) error                  { return nil }
func (m *MockBrowserPlatform) ShowNotification(title, body string) error { return nil }

// setupBrowserTestStore creates a test store for browser tests.
func setupBrowserTestStore(t *testing.T) (*storage.Store, func()) {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	if err := store.Migrate(); err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}
	return store, func() { store.Close() }
}

// createTestChromiumDB creates a test Chrome-style history database.
func createTestChromiumDB(path string, visits []struct {
	URL       string
	Title     string
	Timestamp int64 // Unix timestamp
}) error {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return err
	}
	defer db.Close()

	// Create Chrome schema
	_, err = db.Exec(`
		CREATE TABLE urls (
			id INTEGER PRIMARY KEY,
			url TEXT NOT NULL,
			title TEXT
		);
		CREATE TABLE visits (
			id INTEGER PRIMARY KEY,
			url INTEGER,
			visit_time INTEGER,
			visit_duration INTEGER DEFAULT 0
		);
	`)
	if err != nil {
		return err
	}

	// Chrome epoch offset: microseconds from 1601-01-01 to 1970-01-01
	chromeEpochOffset := int64(11644473600000000)

	for i, v := range visits {
		// Insert URL
		_, err = db.Exec("INSERT INTO urls (id, url, title) VALUES (?, ?, ?)",
			i+1, v.URL, v.Title)
		if err != nil {
			return err
		}

		// Convert Unix timestamp to Chrome timestamp (microseconds since 1601)
		chromeTime := v.Timestamp*1000000 + chromeEpochOffset

		// Insert visit
		_, err = db.Exec("INSERT INTO visits (url, visit_time, visit_duration) VALUES (?, ?, ?)",
			i+1, chromeTime, 5000000) // 5 seconds duration
		if err != nil {
			return err
		}
	}

	return nil
}

// createTestFirefoxDB creates a test Firefox-style history database.
func createTestFirefoxDB(path string, visits []struct {
	URL       string
	Title     string
	Timestamp int64 // Unix timestamp
}) error {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return err
	}
	defer db.Close()

	// Create Firefox schema
	_, err = db.Exec(`
		CREATE TABLE moz_places (
			id INTEGER PRIMARY KEY,
			url TEXT NOT NULL,
			title TEXT
		);
		CREATE TABLE moz_historyvisits (
			id INTEGER PRIMARY KEY,
			place_id INTEGER,
			visit_date INTEGER
		);
	`)
	if err != nil {
		return err
	}

	for i, v := range visits {
		// Insert place
		_, err = db.Exec("INSERT INTO moz_places (id, url, title) VALUES (?, ?, ?)",
			i+1, v.URL, v.Title)
		if err != nil {
			return err
		}

		// Firefox uses microseconds since Unix epoch
		_, err = db.Exec("INSERT INTO moz_historyvisits (place_id, visit_date) VALUES (?, ?)",
			i+1, v.Timestamp*1000000)
		if err != nil {
			return err
		}
	}

	return nil
}

func TestBrowserTracker_New(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	mockPlat := &MockBrowserPlatform{
		browserPaths: make(map[string]string),
	}

	tracker := NewBrowserTracker(mockPlat, store, t.TempDir())
	if tracker == nil {
		t.Fatal("Expected non-nil tracker")
	}

	// Default browsers should be set
	if len(tracker.browsers) != 5 {
		t.Errorf("Expected 5 default browsers, got %d", len(tracker.browsers))
	}
}

func TestBrowserTracker_SetEnabledBrowsers(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	mockPlat := &MockBrowserPlatform{
		browserPaths: make(map[string]string),
	}

	tracker := NewBrowserTracker(mockPlat, store, t.TempDir())
	tracker.SetEnabledBrowsers([]string{"chrome", "firefox"})

	if len(tracker.browsers) != 2 {
		t.Errorf("Expected 2 browsers, got %d", len(tracker.browsers))
	}
}

func TestBrowserTracker_Poll_Chrome(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	// Create session for foreign key
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Create test Chrome history
	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "History")

	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://github.com", "GitHub", time.Now().Add(-1 * time.Hour).Unix()},
		{"https://google.com", "Google", time.Now().Add(-30 * time.Minute).Unix()},
		{"https://example.com", "Example", time.Now().Unix()},
	}

	if err := createTestChromiumDB(chromePath, testVisits); err != nil {
		t.Fatalf("Failed to create test Chrome DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"chrome": chromePath},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"chrome"})

	// Poll for visits
	visits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(visits) != 3 {
		t.Errorf("Expected 3 visits, got %d", len(visits))
	}

	// Verify visit data
	for _, v := range visits {
		if v.Browser != "chrome" {
			t.Errorf("Expected browser 'chrome', got '%s'", v.Browser)
		}
		if !v.SessionID.Valid || v.SessionID.Int64 != sessionID {
			t.Errorf("Expected session ID %d, got %v", sessionID, v.SessionID)
		}
	}
}

func TestBrowserTracker_Poll_Firefox(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	firefoxPath := filepath.Join(tempDir, "places.sqlite")

	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://mozilla.org", "Mozilla", time.Now().Add(-2 * time.Hour).Unix()},
		{"https://developer.mozilla.org", "MDN", time.Now().Unix()},
	}

	if err := createTestFirefoxDB(firefoxPath, testVisits); err != nil {
		t.Fatalf("Failed to create test Firefox DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"firefox": firefoxPath},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"firefox"})

	visits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(visits) != 2 {
		t.Errorf("Expected 2 visits, got %d", len(visits))
	}

	for _, v := range visits {
		if v.Browser != "firefox" {
			t.Errorf("Expected browser 'firefox', got '%s'", v.Browser)
		}
	}
}

func TestBrowserTracker_Poll_Deduplication(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "History")

	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://github.com", "GitHub", time.Now().Unix()},
	}

	if err := createTestChromiumDB(chromePath, testVisits); err != nil {
		t.Fatalf("Failed to create test Chrome DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"chrome": chromePath},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"chrome"})

	// First poll
	visits1, _ := tracker.Poll(sessionID)
	if len(visits1) != 1 {
		t.Errorf("Expected 1 visit on first poll, got %d", len(visits1))
	}

	// Second poll should return 0 (deduplication)
	visits2, _ := tracker.Poll(sessionID)
	if len(visits2) != 0 {
		t.Errorf("Expected 0 visits on second poll (deduplicated), got %d", len(visits2))
	}

	// Verify only 1 entry in database
	count, _ := store.CountBrowserVisits()
	if count != 1 {
		t.Errorf("Expected 1 visit in database, got %d", count)
	}
}

func TestBrowserTracker_Poll_CheckpointPersistence(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "History")

	baseTime := time.Now().Add(-1 * time.Hour).Unix()
	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://github.com", "GitHub", baseTime},
	}

	if err := createTestChromiumDB(chromePath, testVisits); err != nil {
		t.Fatalf("Failed to create test Chrome DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"chrome": chromePath},
	}

	// First tracker instance
	tracker1 := NewBrowserTracker(mockPlat, store, tempDir)
	tracker1.SetEnabledBrowsers([]string{"chrome"})
	tracker1.Poll(sessionID)

	// Verify checkpoint file exists
	checkpointPath := filepath.Join(tempDir, "browser_checkpoint.json")
	if _, err := os.Stat(checkpointPath); os.IsNotExist(err) {
		t.Error("Expected checkpoint file to exist")
	}

	// New tracker instance should load checkpoint
	tracker2 := NewBrowserTracker(mockPlat, store, tempDir)
	tracker2.SetEnabledBrowsers([]string{"chrome"})
	visits, _ := tracker2.Poll(sessionID)

	// Should not return old visits (checkpoint loaded)
	if len(visits) != 0 {
		t.Errorf("Expected 0 visits (checkpoint should skip old), got %d", len(visits))
	}
}

func TestBrowserTracker_Poll_NoBrowserPaths(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{},
	}

	tracker := NewBrowserTracker(mockPlat, store, t.TempDir())
	visits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll should not error with no paths: %v", err)
	}

	if len(visits) != 0 {
		t.Errorf("Expected 0 visits, got %d", len(visits))
	}
}

func TestBrowserTracker_Poll_NonexistentPath(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{
			"chrome": "/nonexistent/path/History",
		},
	}

	tracker := NewBrowserTracker(mockPlat, store, t.TempDir())
	visits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll should not error for nonexistent path: %v", err)
	}

	if len(visits) != 0 {
		t.Errorf("Expected 0 visits, got %d", len(visits))
	}
}

func TestBrowserTracker_DomainExtraction(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "History")

	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://www.github.com/user/repo", "GitHub Repo", time.Now().Unix()},
	}

	if err := createTestChromiumDB(chromePath, testVisits); err != nil {
		t.Fatalf("Failed to create test Chrome DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"chrome": chromePath},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"chrome"})

	visits, _ := tracker.Poll(sessionID)
	if len(visits) != 1 {
		t.Fatalf("Expected 1 visit, got %d", len(visits))
	}

	if visits[0].Domain != "www.github.com" {
		t.Errorf("Expected domain 'www.github.com', got '%s'", visits[0].Domain)
	}
}

func TestBrowserTracker_Reset(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "History")

	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://github.com", "GitHub", time.Now().Unix()},
	}

	if err := createTestChromiumDB(chromePath, testVisits); err != nil {
		t.Fatalf("Failed to create test Chrome DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"chrome": chromePath},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"chrome"})
	tracker.Poll(sessionID)

	// Reset checkpoint
	err = tracker.Reset()
	if err != nil {
		t.Fatalf("Reset failed: %v", err)
	}

	// Checkpoint file should be removed
	checkpointPath := filepath.Join(tempDir, "browser_checkpoint.json")
	if _, err := os.Stat(checkpointPath); !os.IsNotExist(err) {
		t.Error("Expected checkpoint file to be removed")
	}
}

func TestBrowserTracker_GetAvailableBrowsers(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "chrome_history")
	firefoxPath := filepath.Join(tempDir, "firefox_history")

	// Create only chrome path
	os.WriteFile(chromePath, []byte{}, 0644)

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{
			"chrome":  chromePath,
			"firefox": firefoxPath, // doesn't exist
		},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	available := tracker.GetAvailableBrowsers()

	if len(available) != 1 {
		t.Errorf("Expected 1 available browser, got %d", len(available))
	}

	if len(available) > 0 && available[0] != "chrome" {
		t.Errorf("Expected 'chrome', got '%s'", available[0])
	}
}

func TestBrowserTracker_MultipleBrowsers(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "ChromeHistory")
	firefoxPath := filepath.Join(tempDir, "places.sqlite")

	chromeVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://github.com", "GitHub", time.Now().Unix()},
	}

	firefoxVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://mozilla.org", "Mozilla", time.Now().Unix()},
	}

	if err := createTestChromiumDB(chromePath, chromeVisits); err != nil {
		t.Fatalf("Failed to create Chrome DB: %v", err)
	}

	if err := createTestFirefoxDB(firefoxPath, firefoxVisits); err != nil {
		t.Fatalf("Failed to create Firefox DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{
			"chrome":  chromePath,
			"firefox": firefoxPath,
		},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"chrome", "firefox"})

	visits, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(visits) != 2 {
		t.Errorf("Expected 2 visits (1 from each browser), got %d", len(visits))
	}

	// Verify both browsers are represented
	browsers := make(map[string]bool)
	for _, v := range visits {
		browsers[v.Browser] = true
	}

	if !browsers["chrome"] {
		t.Error("Expected chrome visit")
	}
	if !browsers["firefox"] {
		t.Error("Expected firefox visit")
	}
}

func TestBrowserTracker_VisitMetadata(t *testing.T) {
	store, cleanup := setupBrowserTestStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tempDir := t.TempDir()
	chromePath := filepath.Join(tempDir, "History")

	now := time.Now().Unix()
	testVisits := []struct {
		URL       string
		Title     string
		Timestamp int64
	}{
		{"https://github.com/test/repo?query=1", "Test Repo", now},
	}

	if err := createTestChromiumDB(chromePath, testVisits); err != nil {
		t.Fatalf("Failed to create test Chrome DB: %v", err)
	}

	mockPlat := &MockBrowserPlatform{
		browserPaths: map[string]string{"chrome": chromePath},
	}

	tracker := NewBrowserTracker(mockPlat, store, tempDir)
	tracker.SetEnabledBrowsers([]string{"chrome"})

	visits, _ := tracker.Poll(sessionID)
	if len(visits) != 1 {
		t.Fatalf("Expected 1 visit, got %d", len(visits))
	}

	v := visits[0]

	// Verify all metadata
	if v.URL != "https://github.com/test/repo?query=1" {
		t.Errorf("Unexpected URL: %s", v.URL)
	}

	if !v.Title.Valid || v.Title.String != "Test Repo" {
		t.Errorf("Unexpected title: %v", v.Title)
	}

	if v.Domain != "github.com" {
		t.Errorf("Expected domain 'github.com', got '%s'", v.Domain)
	}

	if v.Browser != "chrome" {
		t.Errorf("Expected browser 'chrome', got '%s'", v.Browser)
	}

	// Chrome visits have duration
	if !v.VisitDurationSeconds.Valid {
		t.Error("Expected visit duration to be set")
	}

	// Timestamp should be close to now
	if v.Timestamp < now-60 || v.Timestamp > now+60 {
		t.Errorf("Timestamp %d not close to expected %d", v.Timestamp, now)
	}
}

func TestExtractDomain(t *testing.T) {
	tests := []struct {
		url      string
		expected string
	}{
		{"https://github.com/user/repo", "github.com"},
		{"https://www.example.com", "www.example.com"},
		{"http://localhost:8080/path", "localhost:8080"},
		{"ftp://files.example.com", "files.example.com"},
		{"invalid-url", ""},
	}

	for _, tt := range tests {
		result := extractDomain(tt.url)
		if result != tt.expected {
			t.Errorf("extractDomain(%q) = %q, expected %q", tt.url, result, tt.expected)
		}
	}
}
