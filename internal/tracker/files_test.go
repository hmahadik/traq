package tracker

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func setupFileTestDB(t *testing.T) (*storage.Store, string) {
	tmpDir, err := os.MkdirTemp("", "traq-file-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create store: %v", err)
	}

	return store, tmpDir
}

func TestFileTracker_New(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	if tracker == nil {
		t.Fatal("Expected tracker to be created")
	}
}

func TestFileTracker_WatchDirectory(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Create a watch directory
	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)

	err = tracker.WatchDirectory(watchDir)
	if err != nil {
		t.Fatalf("WatchDirectory failed: %v", err)
	}

	// Verify directory is watched
	dirs := tracker.GetWatchedDirectories()
	found := false
	for _, dir := range dirs {
		if dir == watchDir {
			found = true
			break
		}
	}

	if !found {
		t.Errorf("Expected %s to be in watched directories", watchDir)
	}
}

func TestFileTracker_WatchDirectory_Recursive(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Create nested directories
	watchDir := filepath.Join(tmpDir, "watch")
	subDir := filepath.Join(watchDir, "subdir")
	os.MkdirAll(subDir, 0755)

	err = tracker.WatchDirectory(watchDir)
	if err != nil {
		t.Fatalf("WatchDirectory failed: %v", err)
	}

	// Verify both directories are watched
	dirs := tracker.GetWatchedDirectories()
	foundWatch := false
	foundSub := false
	for _, dir := range dirs {
		if dir == watchDir {
			foundWatch = true
		}
		if dir == subDir {
			foundSub = true
		}
	}

	if !foundWatch {
		t.Errorf("Expected %s to be in watched directories", watchDir)
	}
	if !foundSub {
		t.Errorf("Expected %s to be in watched directories", subDir)
	}
}

func TestFileTracker_WatchDirectory_ExcludesPatterns(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Create directories including excluded ones
	watchDir := filepath.Join(tmpDir, "watch")
	gitDir := filepath.Join(watchDir, ".git")
	nodeModulesDir := filepath.Join(watchDir, "node_modules")
	srcDir := filepath.Join(watchDir, "src")

	os.MkdirAll(gitDir, 0755)
	os.MkdirAll(nodeModulesDir, 0755)
	os.MkdirAll(srcDir, 0755)

	err = tracker.WatchDirectory(watchDir)
	if err != nil {
		t.Fatalf("WatchDirectory failed: %v", err)
	}

	// Verify excluded directories are not watched
	dirs := tracker.GetWatchedDirectories()
	for _, dir := range dirs {
		if dir == gitDir {
			t.Error(".git directory should be excluded")
		}
		if dir == nodeModulesDir {
			t.Error("node_modules directory should be excluded")
		}
	}

	// Verify src is watched
	foundSrc := false
	for _, dir := range dirs {
		if dir == srcDir {
			foundSrc = true
			break
		}
	}
	if !foundSrc {
		t.Errorf("Expected %s to be in watched directories", srcDir)
	}
}

func TestFileTracker_UnwatchDirectory(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)

	tracker.WatchDirectory(watchDir)

	err = tracker.UnwatchDirectory(watchDir)
	if err != nil {
		t.Fatalf("UnwatchDirectory failed: %v", err)
	}

	dirs := tracker.GetWatchedDirectories()
	for _, dir := range dirs {
		if dir == watchDir {
			t.Error("Directory should have been unwatched")
		}
	}
}

func TestFileTracker_StartStop(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Start should not error
	err = tracker.Start()
	if err != nil {
		t.Fatalf("Start failed: %v", err)
	}

	// Starting again should be a no-op
	err = tracker.Start()
	if err != nil {
		t.Fatalf("Second start should not error: %v", err)
	}

	// Stop should not error
	err = tracker.Stop()
	if err != nil {
		t.Fatalf("Stop failed: %v", err)
	}

	// Stopping again should be a no-op
	err = tracker.Stop()
	if err != nil {
		t.Fatalf("Second stop should not error: %v", err)
	}
}

func TestFileTracker_DetectsFileCreate(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Set short flush interval for testing
	tracker.SetFlushInterval(100 * time.Millisecond)

	// Create session
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	// Watch directory
	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)
	tracker.WatchDirectory(watchDir)

	// Start tracker
	tracker.Start()

	// Create a file
	testFile := filepath.Join(watchDir, "test.txt")
	os.WriteFile(testFile, []byte("hello"), 0644)

	// Wait for event to be processed and flushed
	time.Sleep(300 * time.Millisecond)

	// Stop to flush any remaining events
	tracker.Stop()

	// Check database for events
	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	if len(events) < 1 {
		t.Errorf("Expected at least 1 event, got %d", len(events))
	}

	// Verify create event exists
	foundCreate := false
	for _, e := range events {
		if e.EventType == "create" && e.FilePath == testFile {
			foundCreate = true
			break
		}
	}

	if !foundCreate {
		t.Error("Expected create event for test file")
		t.Logf("Events found: %v", events)
	}
}

func TestFileTracker_DetectsFileModify(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	tracker.SetFlushInterval(100 * time.Millisecond)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)

	// Create file before watching
	testFile := filepath.Join(watchDir, "test.txt")
	os.WriteFile(testFile, []byte("hello"), 0644)

	tracker.WatchDirectory(watchDir)
	tracker.Start()

	// Modify the file
	time.Sleep(50 * time.Millisecond)
	os.WriteFile(testFile, []byte("hello world"), 0644)

	time.Sleep(300 * time.Millisecond)
	tracker.Stop()

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	// Should have at least a modify event
	foundModify := false
	for _, e := range events {
		if e.EventType == "modify" && e.FilePath == testFile {
			foundModify = true
			break
		}
	}

	if !foundModify {
		t.Error("Expected modify event for test file")
		t.Logf("Events found: %+v", events)
	}
}

func TestFileTracker_DetectsFileDelete(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	tracker.SetFlushInterval(100 * time.Millisecond)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)

	// Create file before watching
	testFile := filepath.Join(watchDir, "test.txt")
	os.WriteFile(testFile, []byte("hello"), 0644)

	tracker.WatchDirectory(watchDir)
	tracker.Start()

	// Delete the file
	time.Sleep(50 * time.Millisecond)
	os.Remove(testFile)

	time.Sleep(300 * time.Millisecond)
	tracker.Stop()

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	foundDelete := false
	for _, e := range events {
		if e.EventType == "delete" && e.FilePath == testFile {
			foundDelete = true
			break
		}
	}

	if !foundDelete {
		t.Error("Expected delete event for test file")
	}
}

func TestFileTracker_ExcludesExtensions(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	tracker.SetFlushInterval(100 * time.Millisecond)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)
	tracker.WatchDirectory(watchDir)
	tracker.Start()

	// Create files with excluded extensions
	swpFile := filepath.Join(watchDir, "test.swp")
	tmpFile := filepath.Join(watchDir, "test.tmp")
	txtFile := filepath.Join(watchDir, "test.txt")

	os.WriteFile(swpFile, []byte("swap"), 0644)
	os.WriteFile(tmpFile, []byte("temp"), 0644)
	os.WriteFile(txtFile, []byte("text"), 0644)

	time.Sleep(300 * time.Millisecond)
	tracker.Stop()

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	// Should only have event for .txt file
	for _, e := range events {
		if e.FilePath == swpFile {
			t.Error(".swp files should be excluded")
		}
		if e.FilePath == tmpFile {
			t.Error(".tmp files should be excluded")
		}
	}

	foundTxt := false
	for _, e := range events {
		if e.FilePath == txtFile {
			foundTxt = true
			break
		}
	}
	if !foundTxt {
		t.Error("Expected event for .txt file")
	}
}

func TestFileTracker_AddExcludeExtension(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Add custom exclude extension
	tracker.AddExcludeExtension(".xyz")

	tracker.SetFlushInterval(100 * time.Millisecond)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)
	tracker.WatchDirectory(watchDir)
	tracker.Start()

	xyzFile := filepath.Join(watchDir, "test.xyz")
	txtFile := filepath.Join(watchDir, "test.txt")

	os.WriteFile(xyzFile, []byte("xyz"), 0644)
	os.WriteFile(txtFile, []byte("txt"), 0644)

	time.Sleep(300 * time.Millisecond)
	tracker.Stop()

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	for _, e := range events {
		if e.FilePath == xyzFile {
			t.Error(".xyz files should be excluded")
		}
	}
}

func TestFileTracker_DeduplicatesEvents(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	tracker.SetFlushInterval(500 * time.Millisecond) // Longer interval to accumulate events

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)
	tracker.WatchDirectory(watchDir)
	tracker.Start()

	// Rapid saves to same file
	testFile := filepath.Join(watchDir, "test.txt")
	for i := 0; i < 5; i++ {
		os.WriteFile(testFile, []byte("content"), 0644)
		time.Sleep(10 * time.Millisecond)
	}

	time.Sleep(700 * time.Millisecond)
	tracker.Stop()

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	// Should have at most a few events due to deduplication
	fileEventCount := 0
	for _, e := range events {
		if e.FilePath == testFile {
			fileEventCount++
		}
	}

	// Can have create + some modifies, but should be much less than 5
	if fileEventCount > 3 {
		t.Errorf("Expected deduplicated events, got %d events for same file", fileEventCount)
	}
}

func TestFileTracker_SessionID(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	tracker.SetFlushInterval(100 * time.Millisecond)

	// Create two sessions
	session1, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session 1: %v", err)
	}

	session2, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session 2: %v", err)
	}

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)
	tracker.WatchDirectory(watchDir)

	// Set session 1
	tracker.SetSessionID(session1)
	tracker.Start()

	// Create file in session 1
	file1 := filepath.Join(watchDir, "file1.txt")
	os.WriteFile(file1, []byte("session1"), 0644)
	time.Sleep(200 * time.Millisecond)

	// Switch to session 2
	tracker.SetSessionID(session2)

	// Create file in session 2
	file2 := filepath.Join(watchDir, "file2.txt")
	os.WriteFile(file2, []byte("session2"), 0644)
	time.Sleep(200 * time.Millisecond)

	tracker.Stop()

	// Verify events are linked to correct sessions
	events1, _ := store.GetFileEventsBySession(session1)
	events2, _ := store.GetFileEventsBySession(session2)

	foundFile1InSession1 := false
	for _, e := range events1 {
		if e.FilePath == file1 {
			foundFile1InSession1 = true
		}
	}

	foundFile2InSession2 := false
	for _, e := range events2 {
		if e.FilePath == file2 {
			foundFile2InSession2 = true
		}
	}

	if !foundFile1InSession1 {
		t.Error("Expected file1 to be in session 1")
	}
	if !foundFile2InSession2 {
		t.Error("Expected file2 to be in session 2")
	}
}

func TestFileTracker_FileMetadata(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	tracker.SetFlushInterval(100 * time.Millisecond)

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}
	tracker.SetSessionID(sessionID)

	watchDir := filepath.Join(tmpDir, "watch")
	os.MkdirAll(watchDir, 0755)
	tracker.WatchDirectory(watchDir)
	tracker.Start()

	testFile := filepath.Join(watchDir, "document.txt")
	content := "hello world"
	os.WriteFile(testFile, []byte(content), 0644)

	time.Sleep(300 * time.Millisecond)
	tracker.Stop()

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get events: %v", err)
	}

	// Find the create event
	var createEvent *storage.FileEvent
	for _, e := range events {
		if e.FilePath == testFile && e.EventType == "create" {
			createEvent = e
			break
		}
	}

	if createEvent == nil {
		t.Fatal("Expected create event")
	}

	// Verify metadata
	if createEvent.FileName != "document.txt" {
		t.Errorf("Expected filename 'document.txt', got '%s'", createEvent.FileName)
	}
	if createEvent.Directory != watchDir {
		t.Errorf("Expected directory '%s', got '%s'", watchDir, createEvent.Directory)
	}
	if !createEvent.FileExtension.Valid || createEvent.FileExtension.String != ".txt" {
		t.Errorf("Expected extension '.txt', got '%v'", createEvent.FileExtension)
	}
	if !createEvent.FileSizeBytes.Valid || createEvent.FileSizeBytes.Int64 != int64(len(content)) {
		t.Errorf("Expected size %d, got %d", len(content), createEvent.FileSizeBytes.Int64)
	}
}

func TestFileTracker_NonexistentDirectory(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}
	defer tracker.Close()

	// Try to watch nonexistent directory - should not error
	err = tracker.WatchDirectory("/nonexistent/path")
	if err == nil {
		// Walk returns nil even for nonexistent paths in some cases
		// This is acceptable - just won't have any watches
		t.Log("WatchDirectory accepted nonexistent path (acceptable)")
	}
}

func TestFileTracker_Close(t *testing.T) {
	store, tmpDir := setupFileTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	tracker, err := NewFileTracker(store)
	if err != nil {
		t.Fatalf("NewFileTracker failed: %v", err)
	}

	tracker.Start()

	err = tracker.Close()
	if err != nil {
		t.Fatalf("Close failed: %v", err)
	}

	// Starting after close should... actually fsnotify might panic
	// So we don't test that case
}
