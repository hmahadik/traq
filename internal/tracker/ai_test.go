package tracker

import (
	"context"
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

// stubPlugin records Poll calls; lets us assert which plugins ran without
// touching the disk readers.
type stubPlugin struct {
	name   string
	polled int
}

func (s *stubPlugin) Name() string { return s.name }
func (s *stubPlugin) Available() bool { return true }
func (s *stubPlugin) Poll(_ context.Context, _ *storage.Store) ([]aiplugin.AIEvent, error) {
	s.polled++
	return nil, nil
}

func TestAITrackerPollSkipsDisabledTool(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	claude := &stubPlugin{name: "claude"}
	opencode := &stubPlugin{name: "opencode"}
	tr := NewAITracker(store, []aiplugin.AIPlugin{claude, opencode})
	tr.SetToolEnabled("claude", false)

	if err := tr.Poll(); err != nil {
		t.Fatal(err)
	}
	if claude.polled != 0 {
		t.Errorf("disabled claude polled %d times, want 0", claude.polled)
	}
	if opencode.polled != 1 {
		t.Errorf("opencode polled %d times, want 1", opencode.polled)
	}
}

func TestAITrackerPollNoOpWhenDisabled(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	claude := &stubPlugin{name: "claude"}
	opencode := &stubPlugin{name: "opencode"}
	tr := NewAITracker(store, []aiplugin.AIPlugin{claude, opencode})
	tr.SetEnabled(false)

	if err := tr.Poll(); err != nil {
		t.Fatal(err)
	}
	if claude.polled != 0 || opencode.polled != 0 {
		t.Errorf("master-disabled tracker polled plugins: claude=%d opencode=%d", claude.polled, opencode.polled)
	}
}
