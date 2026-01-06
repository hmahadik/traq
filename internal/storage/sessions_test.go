package storage

import (
	"testing"
	"time"
)

func TestCreateSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()
	id, err := store.CreateSession(now)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}

	// Verify session exists
	session, err := store.GetSession(id)
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if session == nil {
		t.Fatal("expected session to exist")
	}
	if session.StartTime != now {
		t.Errorf("got StartTime=%d, want %d", session.StartTime, now)
	}
	if session.EndTime.Valid {
		t.Error("expected EndTime to be null for open session")
	}
}

func TestEndSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	startTime := time.Now().Add(-1 * time.Hour).Unix()
	id, err := store.CreateSession(startTime)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	endTime := time.Now().Unix()
	err = store.EndSession(id, endTime)
	if err != nil {
		t.Fatalf("failed to end session: %v", err)
	}

	session, err := store.GetSession(id)
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if !session.EndTime.Valid {
		t.Fatal("expected EndTime to be set")
	}
	if session.EndTime.Int64 != endTime {
		t.Errorf("got EndTime=%d, want %d", session.EndTime.Int64, endTime)
	}
	if !session.DurationSeconds.Valid {
		t.Fatal("expected DurationSeconds to be set")
	}
	expectedDuration := endTime - startTime
	if session.DurationSeconds.Int64 != expectedDuration {
		t.Errorf("got DurationSeconds=%d, want %d", session.DurationSeconds.Int64, expectedDuration)
	}
}

func TestGetSession_NotFound(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	session, err := store.GetSession(99999)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if session != nil {
		t.Error("expected nil for non-existent session")
	}
}

func TestGetCurrentSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// No sessions, should return nil
	session, err := store.GetCurrentSession()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if session != nil {
		t.Error("expected nil when no sessions exist")
	}

	// Create an open session
	now := time.Now().Unix()
	id, err := store.CreateSession(now)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Should return the open session
	session, err = store.GetCurrentSession()
	if err != nil {
		t.Fatalf("failed to get current session: %v", err)
	}
	if session == nil {
		t.Fatal("expected to find current session")
	}
	if session.ID != id {
		t.Errorf("got ID=%d, want %d", session.ID, id)
	}

	// End the session
	err = store.EndSession(id, now+3600)
	if err != nil {
		t.Fatalf("failed to end session: %v", err)
	}

	// Should return nil now
	session, err = store.GetCurrentSession()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if session != nil {
		t.Error("expected nil after ending session")
	}
}

func TestGetRecentSessions(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create multiple sessions
	now := time.Now().Unix()
	for i := 0; i < 5; i++ {
		id, err := store.CreateSession(now - int64(i*3600))
		if err != nil {
			t.Fatalf("failed to create session %d: %v", i, err)
		}
		err = store.EndSession(id, now-int64(i*3600)+1800)
		if err != nil {
			t.Fatalf("failed to end session %d: %v", i, err)
		}
	}

	// Get recent 3 sessions
	sessions, err := store.GetRecentSessions(3)
	if err != nil {
		t.Fatalf("failed to get recent sessions: %v", err)
	}
	if len(sessions) != 3 {
		t.Errorf("got %d sessions, want 3", len(sessions))
	}

	// Verify ordering (most recent first)
	for i := 1; i < len(sessions); i++ {
		if sessions[i].StartTime > sessions[i-1].StartTime {
			t.Error("sessions not in descending order")
		}
	}
}

func TestGetSessionsWithoutSummary(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create a completed session with screenshots but no summary
	now := time.Now().Unix()
	id, err := store.CreateSession(now - 3600)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Add a screenshot to the session
	sc := &Screenshot{
		Timestamp: now - 1800,
		Filepath:  "/test/screenshot.webp",
		SessionID: NullInt64(id),
	}
	_, err = store.SaveScreenshot(sc)
	if err != nil {
		t.Fatalf("failed to save screenshot: %v", err)
	}

	// End the session
	err = store.EndSession(id, now)
	if err != nil {
		t.Fatalf("failed to end session: %v", err)
	}

	// Should find the session without summary
	sessions, err := store.GetSessionsWithoutSummary(10)
	if err != nil {
		t.Fatalf("failed to get sessions without summary: %v", err)
	}
	if len(sessions) != 1 {
		t.Errorf("got %d sessions, want 1", len(sessions))
	}
}

func TestCountSessions(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Initially 0
	count, err := store.CountSessions()
	if err != nil {
		t.Fatalf("failed to count sessions: %v", err)
	}
	if count != 0 {
		t.Errorf("got count=%d, want 0", count)
	}

	// Create sessions
	for i := 0; i < 3; i++ {
		_, err := store.CreateSession(time.Now().Unix() + int64(i))
		if err != nil {
			t.Fatalf("failed to create session: %v", err)
		}
	}

	count, err = store.CountSessions()
	if err != nil {
		t.Fatalf("failed to count sessions: %v", err)
	}
	if count != 3 {
		t.Errorf("got count=%d, want 3", count)
	}
}

func TestGetTotalActiveTime(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Session 1: 1 hour
	id1, _ := store.CreateSession(now - 7200)
	store.EndSession(id1, now-3600) // 3600 seconds

	// Session 2: 30 minutes
	id2, _ := store.CreateSession(now - 1800)
	store.EndSession(id2, now) // 1800 seconds

	total, err := store.GetTotalActiveTime()
	if err != nil {
		t.Fatalf("failed to get total active time: %v", err)
	}

	expected := int64(3600 + 1800)
	if total != expected {
		t.Errorf("got %d seconds, want %d", total, expected)
	}
}

func TestSetSessionSummary(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	// Create a summary first (foreign key constraint)
	summary := &Summary{
		Summary:   "Test summary",
		ModelUsed: "test-model",
	}
	summaryID, err := store.SaveSummary(summary)
	if err != nil {
		t.Fatalf("failed to create summary: %v", err)
	}

	err = store.SetSessionSummary(sessionID, summaryID)
	if err != nil {
		t.Fatalf("failed to set session summary: %v", err)
	}

	session, err := store.GetSession(sessionID)
	if err != nil {
		t.Fatalf("failed to get session: %v", err)
	}
	if !session.SummaryID.Valid {
		t.Fatal("expected SummaryID to be set")
	}
	if session.SummaryID.Int64 != summaryID {
		t.Errorf("got SummaryID=%d, want %d", session.SummaryID.Int64, summaryID)
	}
}

// TestEndSession_InvalidEndTime tests that EndSession rejects invalid end times
// that would result in negative durations.
func TestEndSession_InvalidEndTime(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	startTime := time.Now().Unix()
	id, err := store.CreateSession(startTime)
	if err != nil {
		t.Fatalf("failed to create session: %v", err)
	}

	tests := []struct {
		name    string
		endTime int64
		wantErr bool
	}{
		{"zero end time", 0, true},
		{"end time before start", startTime - 100, true},
		{"valid end time", startTime + 100, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset session state for each test by resuming it
			store.ResumeSession(id)

			err := store.EndSession(id, tt.endTime)
			if tt.wantErr && err == nil {
				t.Errorf("expected error for %s, got nil", tt.name)
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error for %s: %v", tt.name, err)
			}

			// If we expect success, verify no negative duration
			if !tt.wantErr {
				session, _ := store.GetSession(id)
				if session.DurationSeconds.Valid && session.DurationSeconds.Int64 < 0 {
					t.Errorf("got negative duration: %d", session.DurationSeconds.Int64)
				}
			}
		})
	}
}

// TestGetTotalActiveTime_IgnoresNegative tests that negative durations are ignored.
func TestGetTotalActiveTime_IgnoresNegative(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create valid session
	id1, _ := store.CreateSession(now - 3600)
	store.EndSession(id1, now) // 3600 seconds

	// Manually insert a corrupt session with negative duration (simulating old bug)
	_, err := store.db.Exec(`
		INSERT INTO sessions (start_time, end_time, duration_seconds, screenshot_count)
		VALUES (?, 0, ?, 0)`, now-1000, -1000)
	if err != nil {
		t.Fatalf("failed to insert corrupt session: %v", err)
	}

	total, err := store.GetTotalActiveTime()
	if err != nil {
		t.Fatalf("failed to get total active time: %v", err)
	}

	// Should only count the valid session (3600), not the corrupt one
	if total != 3600 {
		t.Errorf("got %d seconds, want 3600 (negative duration should be ignored)", total)
	}
}

func TestGetSessionsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create sessions at different times
	id1, _ := store.CreateSession(now - 7200)
	store.EndSession(id1, now-5400)

	id2, _ := store.CreateSession(now - 3600)
	store.EndSession(id2, now-1800)

	id3, _ := store.CreateSession(now - 900)
	store.EndSession(id3, now)

	// Query for sessions in the last 2 hours
	sessions, err := store.GetSessionsByTimeRange(now-7200, now)
	if err != nil {
		t.Fatalf("failed to get sessions by time range: %v", err)
	}
	if len(sessions) != 3 {
		t.Errorf("got %d sessions, want 3", len(sessions))
	}

	// Query for sessions in the last hour
	sessions, err = store.GetSessionsByTimeRange(now-3600, now)
	if err != nil {
		t.Fatalf("failed to get sessions by time range: %v", err)
	}
	if len(sessions) != 2 {
		t.Errorf("got %d sessions, want 2", len(sessions))
	}
}
