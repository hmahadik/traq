package storage

import (
	"testing"
)

func TestMigration15CreatesAITables(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	var count int
	err := store.db.QueryRow(`
		SELECT COUNT(*) FROM sqlite_master
		WHERE type='table' AND name IN ('ai_sessions','ai_events')
	`).Scan(&count)
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if count != 2 {
		t.Fatalf("expected 2 AI tables, got %d", count)
	}
}

func TestUpsertAISessionInsertsAndUpdates(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	s := &AISession{
		ID:           "sess-1",
		Tool:         "claude",
		ProjectDir:   "/home/u/repo",
		FilePath:     "/home/u/.claude/projects/-home-u-repo/sess-1.jsonl",
		StartedAt:    1700000000,
		LastEventAt:  1700000100,
		EventCount:   5,
		SourceOffset: 2048,
	}
	if err := store.UpsertAISession(s); err != nil {
		t.Fatalf("insert: %v", err)
	}

	got, err := store.GetAISessionByFilePath(s.FilePath)
	if err != nil || got == nil {
		t.Fatalf("get after insert: got=%v err=%v", got, err)
	}
	if got.EventCount != 5 || got.SourceOffset != 2048 {
		t.Fatalf("mismatched fields: %+v", got)
	}

	s.EventCount = 9
	s.SourceOffset = 4096
	s.LastEventAt = 1700000200
	if err := store.UpsertAISession(s); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, _ = store.GetAISessionByFilePath(s.FilePath)
	if got.EventCount != 9 || got.SourceOffset != 4096 {
		t.Fatalf("update did not apply: %+v", got)
	}
}

func TestInsertAndQueryAIEvents(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	s := &AISession{ID: "sess-1", Tool: "claude", StartedAt: 1000, LastEventAt: 1000}
	if err := store.UpsertAISession(s); err != nil {
		t.Fatal(err)
	}

	events := []AIEvent{
		{SessionID: "sess-1", Tool: "claude", Kind: "user_prompt", Timestamp: 1010},
		{SessionID: "sess-1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1020},
		{SessionID: "sess-1", Tool: "claude", Kind: "tool_use", Timestamp: 1030},
	}
	if err := store.InsertAIEvents(events); err != nil {
		t.Fatalf("insert: %v", err)
	}

	got, err := store.GetAIEventsInRange(1000, 2000)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 events, got %d", len(got))
	}

	maxTs, err := store.GetMaxAIEventTimestamp("claude")
	if err != nil {
		t.Fatal(err)
	}
	if maxTs != 1030 {
		t.Fatalf("expected max ts 1030, got %d", maxTs)
	}

	sessions, err := store.ListAISessionsForDate(1000, 2000)
	if err != nil {
		t.Fatal(err)
	}
	if len(sessions) != 1 {
		t.Fatalf("expected 1 session, got %d", len(sessions))
	}
}
