package service

import (
	"testing"
	"time"

	"traq/internal/storage"
)

func TestListAISessionsForDate(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	if err := store.UpsertAISession(&storage.AISession{
		ID: "s1", Tool: "claude", ProjectDir: "/a/b",
		StartedAt: 1700000000, LastEventAt: 1700000100, EventCount: 3,
	}); err != nil {
		t.Fatal(err)
	}
	if err := store.InsertAIEvents([]storage.AIEvent{
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000000},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000050},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000100},
	}); err != nil {
		t.Fatal(err)
	}

	svc := NewAIService(store)
	// pick a date from the event timestamps in local time
	date := time.Unix(1700000000, 0).In(time.Local).Format("2006-01-02")
	got, err := svc.ListAISessions(date)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 session, got %d", len(got))
	}
	if got[0].ProjectName != "b" {
		t.Errorf("ProjectName=%q want %q", got[0].ProjectName, "b")
	}
	if got[0].Tool != "claude" {
		t.Errorf("Tool=%q", got[0].Tool)
	}
}

func TestDeriveAIBlocksSplitsOnIdleGap(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	_ = store.UpsertAISession(&storage.AISession{ID: "s1", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	events := []storage.AIEvent{
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000000},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000060},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000120},
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700004000},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700004060},
	}
	_ = store.InsertAIEvents(events)

	svc := NewAIService(store)
	blocks, err := svc.deriveBlocks(1700000000, 1700100000)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 blocks after gap split, got %d", len(blocks))
	}
	if blocks[0].EventCount != 3 || blocks[1].EventCount != 2 {
		t.Errorf("counts: %d, %d", blocks[0].EventCount, blocks[1].EventCount)
	}
}

func TestDeriveAIBlocksSplitsPerSession(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	_ = store.UpsertAISession(&storage.AISession{ID: "s1", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	_ = store.UpsertAISession(&storage.AISession{ID: "s2", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	_ = store.InsertAIEvents([]storage.AIEvent{
		{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000000},
		{SessionID: "s2", Tool: "claude", Kind: "user_prompt", Timestamp: 1700000010},
		{SessionID: "s1", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000020},
		{SessionID: "s2", Tool: "claude", Kind: "assistant_turn", Timestamp: 1700000030},
	})

	svc := NewAIService(store)
	blocks, err := svc.deriveBlocks(0, 1<<62)
	if err != nil {
		t.Fatal(err)
	}
	if len(blocks) != 2 {
		t.Fatalf("expected 2 per-session blocks, got %d", len(blocks))
	}
}

func TestGetAIActivityForDayBucketsByHour(t *testing.T) {
	store := storage.NewInMemoryTestStore(t)
	defer store.Close()

	_ = store.UpsertAISession(&storage.AISession{ID: "s1", Tool: "claude", StartedAt: 0, LastEventAt: 0})
	base, _ := time.ParseInLocation("2006-01-02 15:04", "2026-04-23 09:30", time.Local)
	ts := []int64{
		base.Unix(),
		base.Add(15 * time.Minute).Unix(),
		base.Add(90 * time.Minute).Unix(), // 11:00, separate block
	}
	var events []storage.AIEvent
	for _, t := range ts {
		events = append(events, storage.AIEvent{SessionID: "s1", Tool: "claude", Kind: "user_prompt", Timestamp: t})
	}
	_ = store.InsertAIEvents(events)

	svc := NewAIService(store)
	byHour, err := svc.GetAIActivityForDay("2026-04-23")
	if err != nil {
		t.Fatal(err)
	}
	if len(byHour[9]) != 1 {
		t.Errorf("hour 9: expected 1 block, got %d", len(byHour[9]))
	}
	if len(byHour[11]) != 1 {
		t.Errorf("hour 11: expected 1 block, got %d", len(byHour[11]))
	}
}
