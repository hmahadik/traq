package tracker

import (
	"database/sql"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"traq/internal/storage"
)

// FileTracker watches directories for file changes.
type FileTracker struct {
	store           *storage.Store
	watcher         *fsnotify.Watcher
	watchedDirs     map[string]bool
	excludePatterns []string
	excludeExts     map[string]bool
	eventBuffer     []*storage.FileEvent
	bufferMu        sync.Mutex
	flushInterval   time.Duration
	sessionID       int64
	sessionMu       sync.RWMutex
	stopCh          chan struct{}
	running         bool
	mu              sync.RWMutex
}

// NewFileTracker creates a new FileTracker.
func NewFileTracker(store *storage.Store) (*FileTracker, error) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	return &FileTracker{
		store:       store,
		watcher:     watcher,
		watchedDirs: make(map[string]bool),
		excludePatterns: []string{
			".git",
			"node_modules",
			"__pycache__",
			".cache",
			".venv",
			"venv",
			".idea",
			".vscode",
			"target",
			"build",
			"dist",
			".next",
		},
		excludeExts: map[string]bool{
			".swp":  true,
			".swo":  true,
			".tmp":  true,
			".pyc":  true,
			".pyo":  true,
			".o":    true,
			".a":    true,
			".so":   true,
			".dylib": true,
			".lock": true,
		},
		flushInterval: 5 * time.Second,
		stopCh:        make(chan struct{}),
	}, nil
}

// AddExcludePattern adds a directory pattern to exclude.
func (t *FileTracker) AddExcludePattern(pattern string) {
	t.excludePatterns = append(t.excludePatterns, pattern)
}

// AddExcludeExtension adds a file extension to exclude.
func (t *FileTracker) AddExcludeExtension(ext string) {
	if !strings.HasPrefix(ext, ".") {
		ext = "." + ext
	}
	t.excludeExts[ext] = true
}

// SetFlushInterval sets the interval for flushing buffered events.
func (t *FileTracker) SetFlushInterval(d time.Duration) {
	t.flushInterval = d
}

// SetSessionID sets the current session ID for events.
func (t *FileTracker) SetSessionID(id int64) {
	t.sessionMu.Lock()
	defer t.sessionMu.Unlock()
	t.sessionID = id
}

// WatchDirectory adds a directory to watch (recursively).
func (t *FileTracker) WatchDirectory(path string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	// Walk directory and add watches
	return filepath.Walk(absPath, func(walkPath string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}

		if !info.IsDir() {
			return nil
		}

		// Check exclusions
		if t.shouldExcludeDir(walkPath) {
			return filepath.SkipDir
		}

		if t.watchedDirs[walkPath] {
			return nil
		}

		if err := t.watcher.Add(walkPath); err != nil {
			return nil // Skip errors, continue with other dirs
		}

		t.watchedDirs[walkPath] = true
		return nil
	})
}

// UnwatchDirectory removes a directory from watching.
func (t *FileTracker) UnwatchDirectory(path string) error {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return err
	}

	// Remove all watches under this path
	for watchedPath := range t.watchedDirs {
		if strings.HasPrefix(watchedPath, absPath) {
			t.watcher.Remove(watchedPath)
			delete(t.watchedDirs, watchedPath)
		}
	}

	return nil
}

// Start starts the file watcher.
func (t *FileTracker) Start() error {
	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return nil
	}
	t.running = true
	t.stopCh = make(chan struct{})
	t.mu.Unlock()

	go t.run()
	return nil
}

// Stop stops the file watcher.
func (t *FileTracker) Stop() error {
	t.mu.Lock()
	if !t.running {
		t.mu.Unlock()
		return nil
	}
	t.mu.Unlock()

	close(t.stopCh)

	// Flush remaining events
	t.flush()

	t.mu.Lock()
	t.running = false
	t.mu.Unlock()

	return nil
}

// Close closes the watcher and releases resources.
func (t *FileTracker) Close() error {
	t.Stop()
	return t.watcher.Close()
}

func (t *FileTracker) run() {
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case event, ok := <-t.watcher.Events:
			if !ok {
				return
			}
			t.handleEvent(event)

		case err, ok := <-t.watcher.Errors:
			if !ok {
				return
			}
			_ = err // Log error but continue

		case <-ticker.C:
			t.flush()

		case <-t.stopCh:
			return
		}
	}
}

func (t *FileTracker) handleEvent(event fsnotify.Event) {
	// Skip excluded extensions
	ext := strings.ToLower(filepath.Ext(event.Name))
	if t.excludeExts[ext] {
		return
	}

	// Skip excluded directories
	if t.shouldExcludeDir(event.Name) {
		return
	}

	// Map fsnotify event to our event type
	var eventType string
	switch {
	case event.Op&fsnotify.Create == fsnotify.Create:
		eventType = "create"
		// If it's a new directory, add watch
		if info, err := os.Stat(event.Name); err == nil && info.IsDir() {
			if !t.shouldExcludeDir(event.Name) {
				t.watcher.Add(event.Name)
				t.watchedDirs[event.Name] = true
			}
		}
	case event.Op&fsnotify.Write == fsnotify.Write:
		eventType = "modify"
	case event.Op&fsnotify.Remove == fsnotify.Remove:
		eventType = "delete"
		// Remove watch if directory
		if t.watchedDirs[event.Name] {
			t.watcher.Remove(event.Name)
			delete(t.watchedDirs, event.Name)
		}
	case event.Op&fsnotify.Rename == fsnotify.Rename:
		eventType = "rename"
	case event.Op&fsnotify.Chmod == fsnotify.Chmod:
		return // Ignore chmod events
	default:
		return
	}

	t.sessionMu.RLock()
	sessionID := t.sessionID
	t.sessionMu.RUnlock()

	fileEvent := &storage.FileEvent{
		Timestamp: time.Now().Unix(),
		FilePath:  event.Name,
		EventType: eventType,
		SessionID: sql.NullInt64{Int64: sessionID, Valid: sessionID > 0},
	}

	// Get file info if exists
	if info, err := os.Stat(event.Name); err == nil {
		fileEvent.FileSizeBytes = sql.NullInt64{Int64: info.Size(), Valid: true}
		if ext != "" {
			fileEvent.FileExtension = sql.NullString{String: ext, Valid: true}
		}
		// Extract file name and directory
		fileEvent.FileName = filepath.Base(event.Name)
		fileEvent.Directory = filepath.Dir(event.Name)
	}

	t.bufferMu.Lock()
	t.eventBuffer = append(t.eventBuffer, fileEvent)
	t.bufferMu.Unlock()
}

func (t *FileTracker) flush() {
	t.bufferMu.Lock()
	events := t.eventBuffer
	t.eventBuffer = nil
	t.bufferMu.Unlock()

	if len(events) == 0 {
		return
	}

	// Deduplicate events on same file within flush window
	deduplicated := t.deduplicateEvents(events)

	for _, event := range deduplicated {
		t.store.SaveFileEvent(event)
	}
}

// deduplicateEvents combines multiple events on the same file.
func (t *FileTracker) deduplicateEvents(events []*storage.FileEvent) []*storage.FileEvent {
	// Group by file path
	byPath := make(map[string][]*storage.FileEvent)
	for _, e := range events {
		byPath[e.FilePath] = append(byPath[e.FilePath], e)
	}

	var result []*storage.FileEvent
	for _, fileEvents := range byPath {
		if len(fileEvents) == 1 {
			result = append(result, fileEvents[0])
			continue
		}

		// Multiple events on same file - keep most significant
		// Priority: delete > create > modify > rename
		var best *storage.FileEvent
		for _, e := range fileEvents {
			if best == nil {
				best = e
				continue
			}

			// Prioritize based on event type
			priority := map[string]int{"delete": 4, "create": 3, "modify": 2, "rename": 1}
			if priority[e.EventType] > priority[best.EventType] {
				best = e
			} else if priority[e.EventType] == priority[best.EventType] && e.Timestamp > best.Timestamp {
				best = e
			}
		}
		if best != nil {
			result = append(result, best)
		}
	}

	return result
}

func (t *FileTracker) shouldExcludeDir(path string) bool {
	for _, pattern := range t.excludePatterns {
		if strings.Contains(path, string(filepath.Separator)+pattern+string(filepath.Separator)) ||
			strings.HasSuffix(path, string(filepath.Separator)+pattern) ||
			filepath.Base(path) == pattern {
			return true
		}
	}
	return false
}

// GetWatchedDirectories returns the list of watched directories.
func (t *FileTracker) GetWatchedDirectories() []string {
	dirs := make([]string, 0, len(t.watchedDirs))
	for dir := range t.watchedDirs {
		dirs = append(dirs, dir)
	}
	return dirs
}

// GetRecentEvents returns recent file events.
func (t *FileTracker) GetRecentEvents(limit int) ([]*storage.FileEvent, error) {
	return t.store.GetRecentFileEvents(limit)
}

// GetEventsForSession returns events for a specific session.
func (t *FileTracker) GetEventsForSession(sessionID int64) ([]*storage.FileEvent, error) {
	return t.store.GetFileEventsBySession(sessionID)
}
