package aiplugin

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func TestClaudePluginParsesFixtureJSONL(t *testing.T) {
	root := filepath.Join("testdata", "claude")
	p := NewClaudePlugin(root)
	if !p.Available() {
		t.Fatalf("fixture dir should make plugin available")
	}

	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	events, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatalf("poll: %v", err)
	}
	if len(events) != 3 {
		t.Fatalf("expected 3 events (snapshot skipped), got %d", len(events))
	}

	want := []struct {
		kind string
		ts   string
	}{
		{"user_prompt", "2026-04-23T10:00:00Z"},
		{"assistant_turn", "2026-04-23T10:00:05Z"},
		{"tool_use", "2026-04-23T10:00:10Z"},
	}
	for i, w := range want {
		if events[i].Kind != w.kind {
			t.Errorf("event[%d].Kind = %q, want %q", i, events[i].Kind, w.kind)
		}
		ts, _ := time.Parse(time.RFC3339, w.ts)
		if !events[i].Timestamp.Equal(ts) {
			t.Errorf("event[%d].Timestamp = %v, want %v", i, events[i].Timestamp, ts)
		}
		if events[i].SessionID != "sess-1" {
			t.Errorf("event[%d].SessionID = %q", i, events[i].SessionID)
		}
		if events[i].ProjectDir != "/home/u/repo" {
			t.Errorf("event[%d].ProjectDir = %q", i, events[i].ProjectDir)
		}
		if events[i].Tool != "claude" {
			t.Errorf("event[%d].Tool = %q", i, events[i].Tool)
		}
	}
}

func TestClaudePluginResumesFromSourceOffset(t *testing.T) {
	root := filepath.Join("testdata", "claude")
	p := NewClaudePlugin(root)
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	first, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(first) == 0 {
		t.Fatal("expected events on first poll")
	}
	persistOffsetForTest(t, store, first)

	second, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatal(err)
	}
	if len(second) != 0 {
		t.Fatalf("expected 0 new events on repeat poll, got %d", len(second))
	}
}

func persistOffsetForTest(t *testing.T, store *storage.Store, events []AIEvent) {
	t.Helper()
	last := events[len(events)-1]
	sess := &storage.AISession{
		ID:           last.SessionID,
		Tool:         last.Tool,
		ProjectDir:   last.ProjectDir,
		FilePath:     last.FilePath,
		StartedAt:    events[0].Timestamp.Unix(),
		LastEventAt:  last.Timestamp.Unix(),
		EventCount:   len(events),
		SourceOffset: last.Offset,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}
}

func TestClaudePluginSkipsCorruptLines(t *testing.T) {
	dir := t.TempDir()
	projDir := filepath.Join(dir, "-tmp-proj")
	if err := os.MkdirAll(projDir, 0o755); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(projDir, "sess-2.jsonl")
	content := `{"type":"user","sessionId":"s","cwd":"/t","timestamp":"2026-04-23T10:00:00Z","message":{"role":"user","content":"a"}}
NOT_JSON_GARBAGE
{"type":"assistant","sessionId":"s","cwd":"/t","timestamp":"2026-04-23T10:00:01Z","message":{"role":"assistant","content":[{"type":"text","text":"b"}]}}
`
	if err := os.WriteFile(file, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	p := NewClaudePlugin(dir)
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	events, err := p.Poll(context.Background(), store)
	if err != nil {
		t.Fatalf("poll returned error: %v", err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 valid events (garbage skipped), got %d", len(events))
	}
}
