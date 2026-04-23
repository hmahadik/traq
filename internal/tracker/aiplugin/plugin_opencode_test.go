package aiplugin

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"traq/internal/storage"
)

func buildOpencodeFixtureDB(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "opencode.db")

	schemaBytes, err := os.ReadFile(filepath.Join("testdata", "opencode", "schema.sql"))
	if err != nil {
		t.Fatal(err)
	}
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(string(schemaBytes)); err != nil {
		t.Fatalf("schema exec: %v", err)
	}

	_, err = db.Exec(`
		INSERT INTO project (id, worktree, time_created, time_updated, sandboxes)
		VALUES ('proj-1', '/home/u/repo', 1700000000000, 1700000000000, '[]');
		INSERT INTO session (id, project_id, slug, directory, title, version, time_created, time_updated)
		VALUES ('ses_abc', 'proj-1', 'slug', '/home/u/repo', 't', '1', 1700000000000, 1700000030000);
		INSERT INTO message (id, session_id, time_created, time_updated, data)
		VALUES
			('m1', 'ses_abc', 1700000010000, 1700000010000, '{}'),
			('m2', 'ses_abc', 1700000020000, 1700000020000, '{}'),
			('m3', 'ses_abc', 1700000030000, 1700000030000, '{}');
	`)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	return dbPath
}

func TestOpenCodePluginReadsMessages(t *testing.T) {
	dbPath := buildOpencodeFixtureDB(t)
	p := NewOpenCodePlugin(dbPath)
	if !p.Available() {
		t.Fatal("plugin should be available with fixture DB")
	}

	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	events, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	if len(events) != 3 {
		t.Fatalf("expected 3 events, got %d", len(events))
	}
	for _, e := range events {
		if e.Tool != "opencode" {
			t.Errorf("Tool=%q", e.Tool)
		}
		if e.SessionID != "ses_abc" {
			t.Errorf("SessionID=%q", e.SessionID)
		}
		if e.ProjectDir != "/home/u/repo" {
			t.Errorf("ProjectDir=%q", e.ProjectDir)
		}
		if e.Kind != "message" {
			t.Errorf("Kind=%q", e.Kind)
		}
	}
}

func TestOpenCodePluginResumesByMaxTimestamp(t *testing.T) {
	dbPath := buildOpencodeFixtureDB(t)
	p := NewOpenCodePlugin(dbPath)
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	first, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) != 3 {
		t.Fatalf("expected 3, got %d", len(first))
	}

	var dbEvents []storage.AIEvent
	for _, e := range first {
		dbEvents = append(dbEvents, storage.AIEvent{
			SessionID: e.SessionID, Tool: e.Tool, Kind: e.Kind,
			Timestamp: e.Timestamp.Unix(), ProjectDir: e.ProjectDir,
		})
	}
	if err := store.UpsertAISession(&storage.AISession{
		ID: first[0].SessionID, Tool: "opencode",
		ProjectDir:  first[0].ProjectDir,
		StartedAt:   first[0].Timestamp.Unix(),
		LastEventAt: first[len(first)-1].Timestamp.Unix(),
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.InsertAIEvents(dbEvents); err != nil {
		t.Fatal(err)
	}

	second, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 0 {
		t.Fatalf("expected 0 new events, got %d", len(second))
	}
}
