package tracker

import (
	"os"
	"path/filepath"
	"testing"

	"traq/internal/storage"
	"traq/internal/tracker/aiplugin"
)

func TestAITrackerPersistsClaudeEvents(t *testing.T) {
	root := t.TempDir()
	proj := filepath.Join(root, "-home-u-repo")
	if err := os.MkdirAll(proj, 0o755); err != nil {
		t.Fatal(err)
	}
	content := `{"type":"user","sessionId":"s","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:00Z","message":{"role":"user","content":"a"}}
{"type":"assistant","sessionId":"s","cwd":"/home/u/repo","timestamp":"2026-04-23T10:00:05Z","message":{"role":"assistant","content":[{"type":"text","text":"b"}]}}
`
	path := filepath.Join(proj, "s.jsonl")
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	tr := NewAITracker(store, []aiplugin.AIPlugin{aiplugin.NewClaudePlugin(root)})
	if err := tr.Poll(); err != nil {
		t.Fatalf("poll: %v", err)
	}

	events, err := store.GetAIEventsInRange(0, 1<<62)
	if err != nil {
		t.Fatal(err)
	}
	if len(events) != 2 {
		t.Fatalf("expected 2 persisted events, got %d", len(events))
	}

	sess, err := store.GetAISessionByFilePath(path)
	if err != nil || sess == nil {
		t.Fatalf("session not persisted: err=%v sess=%v", err, sess)
	}
	if sess.EventCount != 2 {
		t.Errorf("EventCount=%d want 2", sess.EventCount)
	}
	if sess.SourceOffset == 0 {
		t.Errorf("SourceOffset should be >0 after ingest")
	}

	if err := tr.Poll(); err != nil {
		t.Fatal(err)
	}
	after, _ := store.GetAIEventsInRange(0, 1<<62)
	if len(after) != 2 {
		t.Fatalf("expected no duplicate ingest, got %d total events", len(after))
	}
}
