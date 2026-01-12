package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestSaveSummary(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sum := &Summary{
		Summary:         "Test summary content",
		Explanation:     sql.NullString{String: "Test explanation", Valid: true},
		Confidence:      sql.NullString{String: "high", Valid: true},
		Tags:            []string{"tag1", "tag2"},
		ModelUsed:       "test-model",
		InferenceTimeMs: sql.NullInt64{Int64: 500, Valid: true},
		ScreenshotIDs:   []int64{1, 2, 3},
	}

	id, err := store.SaveSummary(sum)
	if err != nil {
		t.Fatalf("failed to save summary: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}

	// Retrieve and verify
	saved, err := store.GetSummary(id)
	if err != nil {
		t.Fatalf("failed to get summary: %v", err)
	}
	if saved == nil {
		t.Fatal("expected summary to exist")
	}
	if saved.Summary != sum.Summary {
		t.Errorf("got Summary=%s, want %s", saved.Summary, sum.Summary)
	}
	if saved.ModelUsed != sum.ModelUsed {
		t.Errorf("got ModelUsed=%s, want %s", saved.ModelUsed, sum.ModelUsed)
	}
	if len(saved.Tags) != 2 {
		t.Errorf("got %d tags, want 2", len(saved.Tags))
	}
	if len(saved.ScreenshotIDs) != 3 {
		t.Errorf("got %d screenshot IDs, want 3", len(saved.ScreenshotIDs))
	}
}

func TestGetSummary_NotFound(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sum, err := store.GetSummary(99999)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sum != nil {
		t.Error("expected nil for non-existent summary")
	}
}

func TestGetSummaryBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sessionID, _ := store.CreateSession(time.Now().Unix())

	// Create summary linked to session
	sum := &Summary{
		SessionID: sql.NullInt64{Int64: sessionID, Valid: true},
		Summary:   "Session summary",
		ModelUsed: "test-model",
	}
	store.SaveSummary(sum)

	// Get summary by session
	found, err := store.GetSummaryBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get summary by session: %v", err)
	}
	if found == nil {
		t.Fatal("expected to find summary")
	}
	if found.Summary != "Session summary" {
		t.Errorf("got Summary=%s, want 'Session summary'", found.Summary)
	}
}

func TestGetSummaryBySession_NotFound(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sum, err := store.GetSummaryBySession(99999)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sum != nil {
		t.Error("expected nil for non-existent session")
	}
}

func TestGetRecentSummaries(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create multiple summaries
	for i := 0; i < 5; i++ {
		sum := &Summary{
			Summary:   "Summary " + string(rune('A'+i)),
			ModelUsed: "test-model",
		}
		store.SaveSummary(sum)
	}

	// Get recent 3
	summaries, err := store.GetRecentSummaries(3)
	if err != nil {
		t.Fatalf("failed to get recent summaries: %v", err)
	}
	if len(summaries) != 3 {
		t.Errorf("got %d summaries, want 3", len(summaries))
	}
}

func TestUpdateSummary(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sum := &Summary{
		Summary:   "Original",
		ModelUsed: "test-model",
		Tags:      []string{"original"},
	}
	id, _ := store.SaveSummary(sum)

	// Update
	sum.ID = id
	sum.Summary = "Updated"
	sum.Tags = []string{"updated", "new"}
	err := store.UpdateSummary(sum)
	if err != nil {
		t.Fatalf("failed to update summary: %v", err)
	}

	// Verify
	updated, _ := store.GetSummary(id)
	if updated.Summary != "Updated" {
		t.Errorf("got Summary=%s, want 'Updated'", updated.Summary)
	}
	if len(updated.Tags) != 2 {
		t.Errorf("got %d tags, want 2", len(updated.Tags))
	}
}

func TestDeleteSummary(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sum := &Summary{
		Summary:   "To delete",
		ModelUsed: "test-model",
	}
	id, _ := store.SaveSummary(sum)

	// Delete
	err := store.DeleteSummary(id)
	if err != nil {
		t.Fatalf("failed to delete summary: %v", err)
	}

	// Should not exist
	deleted, _ := store.GetSummary(id)
	if deleted != nil {
		t.Error("expected summary to be deleted")
	}
}

func TestCountSummaries(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	count, err := store.CountSummaries()
	if err != nil {
		t.Fatalf("failed to count summaries: %v", err)
	}
	if count != 0 {
		t.Errorf("expected 0, got %d", count)
	}

	// Add summaries
	for i := 0; i < 3; i++ {
		sum := &Summary{Summary: "Test", ModelUsed: "model"}
		store.SaveSummary(sum)
	}

	count, err = store.CountSummaries()
	if err != nil {
		t.Fatalf("failed to count summaries: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestGetSummariesByDateRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create summaries (created_at is set automatically)
	for i := 0; i < 3; i++ {
		sum := &Summary{
			Summary:   "Test",
			ModelUsed: "model",
		}
		store.SaveSummary(sum)
	}

	now := time.Now().Unix()
	summaries, err := store.GetSummariesByDateRange(now-60, now+60)
	if err != nil {
		t.Fatalf("failed to get summaries by date range: %v", err)
	}
	if len(summaries) != 3 {
		t.Errorf("got %d summaries, want 3", len(summaries))
	}
}

func TestGetSummariesForSessions(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create sessions
	sessionID1, _ := store.CreateSession(time.Now().Unix())
	sessionID2, _ := store.CreateSession(time.Now().Unix())
	sessionID3, _ := store.CreateSession(time.Now().Unix())

	// Create summaries linked to sessions
	sum1 := &Summary{
		SessionID: sql.NullInt64{Int64: sessionID1, Valid: true},
		Summary:   "Summary 1",
		ModelUsed: "test-model",
	}
	store.SaveSummary(sum1)

	sum2 := &Summary{
		SessionID: sql.NullInt64{Int64: sessionID2, Valid: true},
		Summary:   "Summary 2",
		ModelUsed: "test-model",
	}
	store.SaveSummary(sum2)

	// Session 3 has no summary

	// Batch load summaries
	sessionIDs := []int64{sessionID1, sessionID2, sessionID3}
	summariesMap, err := store.GetSummariesForSessions(sessionIDs)
	if err != nil {
		t.Fatalf("failed to get summaries for sessions: %v", err)
	}

	// Should have 2 summaries (session 3 has none)
	if len(summariesMap) != 2 {
		t.Errorf("got %d summaries, want 2", len(summariesMap))
	}

	// Verify summaries
	if sum, ok := summariesMap[sessionID1]; !ok || sum.Summary != "Summary 1" {
		t.Errorf("session 1 summary incorrect")
	}
	if sum, ok := summariesMap[sessionID2]; !ok || sum.Summary != "Summary 2" {
		t.Errorf("session 2 summary incorrect")
	}
	if _, ok := summariesMap[sessionID3]; ok {
		t.Errorf("session 3 should not have a summary")
	}
}

func TestGetSummariesForSessions_Empty(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Empty list should return empty map
	summariesMap, err := store.GetSummariesForSessions([]int64{})
	if err != nil {
		t.Fatalf("failed with empty list: %v", err)
	}
	if len(summariesMap) != 0 {
		t.Errorf("expected empty map, got %d entries", len(summariesMap))
	}
}
