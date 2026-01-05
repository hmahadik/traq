package tracker

import (
	"testing"
	"time"
)

func TestNewSessionManager(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	if manager == nil {
		t.Fatal("expected non-nil SessionManager")
	}
	if manager.minDuration != 5*time.Minute {
		t.Errorf("got minDuration=%v, want 5m", manager.minDuration)
	}
	if manager.resumeWindow != 5*time.Minute {
		t.Errorf("got resumeWindow=%v, want 5m", manager.resumeWindow)
	}
}

func TestSessionManager_SetMinDuration(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	manager.SetMinDuration(10 * time.Minute)
	if manager.minDuration != 10*time.Minute {
		t.Errorf("got minDuration=%v, want 10m", manager.minDuration)
	}
}

func TestSessionManager_SetResumeWindow(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	manager.SetResumeWindow(3 * time.Minute)
	if manager.resumeWindow != 3*time.Minute {
		t.Errorf("got resumeWindow=%v, want 3m", manager.resumeWindow)
	}
}

func TestSessionManager_StartSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	session, err := manager.StartSession()
	if err != nil {
		t.Fatalf("failed to start session: %v", err)
	}
	if session == nil {
		t.Fatal("expected non-nil session")
	}
	if session.ID <= 0 {
		t.Errorf("expected positive session ID, got %d", session.ID)
	}

	// Starting again should return the same session
	session2, err := manager.StartSession()
	if err != nil {
		t.Fatalf("failed to start session: %v", err)
	}
	if session2.ID != session.ID {
		t.Errorf("expected same session ID, got %d vs %d", session2.ID, session.ID)
	}
}

func TestSessionManager_EndSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	_, err := manager.StartSession()
	if err != nil {
		t.Fatalf("failed to start session: %v", err)
	}

	err = manager.EndSession()
	if err != nil {
		t.Fatalf("failed to end session: %v", err)
	}

	if manager.currentSession != nil {
		t.Error("expected currentSession to be nil after ending")
	}
}

func TestSessionManager_EndSession_NoSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	// Should not error
	err := manager.EndSession()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestSessionManager_GetCurrentSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	// No session yet
	if manager.GetCurrentSession() != nil {
		t.Error("expected nil when no session")
	}

	session, _ := manager.StartSession()
	if manager.GetCurrentSession() != session {
		t.Error("expected GetCurrentSession to return started session")
	}
}

func TestSessionManager_GetCurrentSessionID(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	// No session yet
	if manager.GetCurrentSessionID() != 0 {
		t.Error("expected 0 when no session")
	}

	session, _ := manager.StartSession()
	if manager.GetCurrentSessionID() != session.ID {
		t.Error("expected GetCurrentSessionID to return session ID")
	}
}

func TestSessionManager_IsActive(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	if manager.IsActive() {
		t.Error("expected IsActive=false when no session")
	}

	manager.StartSession()
	if !manager.IsActive() {
		t.Error("expected IsActive=true after starting session")
	}

	manager.EndSession()
	if manager.IsActive() {
		t.Error("expected IsActive=false after ending session")
	}
}

func TestSessionManager_GetSessionDuration(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	// No session
	if manager.GetSessionDuration() != 0 {
		t.Error("expected 0 duration when no session")
	}

	manager.StartSession()
	// GetSessionDuration uses Unix timestamps (seconds resolution)
	// so we need to wait at least 1 second for a measurable duration
	time.Sleep(1100 * time.Millisecond)

	duration := manager.GetSessionDuration()
	if duration < 1*time.Second {
		t.Errorf("expected duration >= 1s, got %v", duration)
	}
}

func TestSessionManager_EnsureSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	// Should create a session
	session, err := manager.EnsureSession()
	if err != nil {
		t.Fatalf("failed to ensure session: %v", err)
	}
	if session == nil {
		t.Fatal("expected non-nil session")
	}

	// Should return the same session
	session2, err := manager.EnsureSession()
	if err != nil {
		t.Fatalf("failed to ensure session: %v", err)
	}
	if session2.ID != session.ID {
		t.Errorf("expected same session ID")
	}
}

func TestSessionManager_HandleAFK(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	manager.StartSession()

	err := manager.HandleAFK()
	if err != nil {
		t.Fatalf("failed to handle AFK: %v", err)
	}

	if manager.IsActive() {
		t.Error("expected session to be ended after AFK")
	}
}

func TestSessionManager_HandleReturn(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	session, err := manager.HandleReturn()
	if err != nil {
		t.Fatalf("failed to handle return: %v", err)
	}
	if session == nil {
		t.Fatal("expected non-nil session")
	}
	if !manager.IsActive() {
		t.Error("expected session to be active after return")
	}
}

func TestSessionManager_RefreshCurrentSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	mock := NewMockPlatform()
	afk := NewAFKDetector(mock, 5*time.Minute)
	manager := NewSessionManager(store, afk)

	// No session - should not error
	err := manager.RefreshCurrentSession()
	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}

	manager.StartSession()

	err = manager.RefreshCurrentSession()
	if err != nil {
		t.Errorf("failed to refresh session: %v", err)
	}
}
