package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestSaveFileEvent(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	event := &FileEvent{
		Timestamp:     time.Now().Unix(),
		EventType:     "created",
		FilePath:      "/home/user/downloads/file.pdf",
		FileName:      "file.pdf",
		Directory:     "/home/user/downloads",
		FileExtension: sql.NullString{String: ".pdf", Valid: true},
		WatchCategory: "downloads",
	}

	id, err := store.SaveFileEvent(event)
	if err != nil {
		t.Fatalf("failed to save file event: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetFileEventsBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sessionID, _ := store.CreateSession(time.Now().Unix())

	for i := 0; i < 3; i++ {
		event := &FileEvent{
			Timestamp:     time.Now().Unix() + int64(i),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: "downloads",
			SessionID:     sql.NullInt64{Int64: sessionID, Valid: true},
		}
		store.SaveFileEvent(event)
	}

	events, err := store.GetFileEventsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get events: %v", err)
	}
	if len(events) != 3 {
		t.Errorf("expected 3 events, got %d", len(events))
	}
}

func TestGetFileEventsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		event := &FileEvent{
			Timestamp:     now + int64(i*60),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: "downloads",
		}
		store.SaveFileEvent(event)
	}

	events, err := store.GetFileEventsByTimeRange(now, now+180)
	if err != nil {
		t.Fatalf("failed to get events: %v", err)
	}
	if len(events) != 4 {
		t.Errorf("expected 4 events, got %d", len(events))
	}
}

func TestGetFileEventsByCategory(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create events in different categories
	categories := []string{"downloads", "projects", "downloads", "documents"}
	for i, cat := range categories {
		event := &FileEvent{
			Timestamp:     now + int64(i),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: cat,
		}
		store.SaveFileEvent(event)
	}

	events, err := store.GetFileEventsByCategory("downloads", 10)
	if err != nil {
		t.Fatalf("failed to get events: %v", err)
	}
	if len(events) != 2 {
		t.Errorf("expected 2 downloads events, got %d", len(events))
	}
}

func TestGetRecentFileEvents(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 10; i++ {
		event := &FileEvent{
			Timestamp:     time.Now().Unix() + int64(i),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: "downloads",
		}
		store.SaveFileEvent(event)
	}

	events, err := store.GetRecentFileEvents(5)
	if err != nil {
		t.Fatalf("failed to get recent events: %v", err)
	}
	if len(events) != 5 {
		t.Errorf("expected 5 events, got %d", len(events))
	}
}

func TestGetFileEventStats(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create events with different categories (stats groups by watch_category)
	categories := []string{"downloads", "projects", "downloads", "documents", "projects"}
	for i, cat := range categories {
		event := &FileEvent{
			Timestamp:     now + int64(i),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: cat,
		}
		store.SaveFileEvent(event)
	}

	stats, err := store.GetFileEventStats(now, now+10)
	if err != nil {
		t.Fatalf("failed to get stats: %v", err)
	}
	if stats["downloads"] != 2 {
		t.Errorf("expected 2 downloads, got %d", stats["downloads"])
	}
	if stats["projects"] != 2 {
		t.Errorf("expected 2 projects, got %d", stats["projects"])
	}
}

func TestCountFileEvents(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 3; i++ {
		event := &FileEvent{
			Timestamp:     time.Now().Unix() + int64(i),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: "downloads",
		}
		store.SaveFileEvent(event)
	}

	count, err := store.CountFileEvents()
	if err != nil {
		t.Fatalf("failed to count events: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestCountFileEventsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		event := &FileEvent{
			Timestamp:     now + int64(i*60),
			EventType:     "created",
			FilePath:      "/path/file.txt",
			FileName:      "file.txt",
			Directory:     "/path",
			WatchCategory: "downloads",
		}
		store.SaveFileEvent(event)
	}

	count, err := store.CountFileEventsByTimeRange(now, now+120)
	if err != nil {
		t.Fatalf("failed to count events: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}
