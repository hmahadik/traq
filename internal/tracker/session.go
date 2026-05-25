package tracker

import (
	"time"

	"traq/internal/storage"
)

// SessionEndedCallback fires after a session is closed in storage. It runs
// in a goroutine so callers must not assume synchronous semantics. Used to
// kick off the AI summary pipeline without coupling the tracker to the
// service layer.
type SessionEndedCallback func(sessionID int64)

// SessionManager manages work sessions.
type SessionManager struct {
	store          *storage.Store
	currentSession *storage.Session
	afkDetector    *AFKDetector
	minDuration    time.Duration // Minimum session duration to keep
	resumeWindow   time.Duration // Time window to resume a session after return

	onSessionEnded SessionEndedCallback
}

// SetOnSessionEnded registers a callback that fires (in a goroutine) every
// time EndSession successfully closes a session in storage.
func (m *SessionManager) SetOnSessionEnded(fn SessionEndedCallback) {
	m.onSessionEnded = fn
}

// NewSessionManager creates a new SessionManager.
func NewSessionManager(store *storage.Store, afk *AFKDetector) *SessionManager {
	return &SessionManager{
		store:        store,
		afkDetector:  afk,
		minDuration:  5 * time.Minute,
		resumeWindow: 5 * time.Minute,
	}
}

// SetMinDuration sets the minimum session duration.
func (m *SessionManager) SetMinDuration(d time.Duration) {
	m.minDuration = d
}

// SetResumeWindow sets the time window for resuming sessions.
func (m *SessionManager) SetResumeWindow(d time.Duration) {
	m.resumeWindow = d
}

// StartSession starts a new session or resumes an existing one.
func (m *SessionManager) StartSession() (*storage.Session, error) {
	now := time.Now().Unix()

	// Check if there's a recent ended session we can resume
	lastSession, err := m.store.GetLastEndedSession()
	if err != nil {
		return nil, err
	}

	if lastSession != nil && lastSession.EndTime.Valid {
		timeSinceEnd := time.Duration(now-lastSession.EndTime.Int64) * time.Second
		if timeSinceEnd <= m.resumeWindow {
			// Resume the session by clearing end time and duration
			err := m.store.ResumeSession(lastSession.ID)
			if err != nil {
				// If we can't resume, just start a new session
			} else {
				// Re-fetch the session to get updated state
				m.currentSession, _ = m.store.GetSession(lastSession.ID)
				if m.currentSession != nil {
					return m.currentSession, nil
				}
			}
		}
	}

	// Check if there's already an open session
	openSession, err := m.store.GetCurrentSession()
	if err != nil {
		return nil, err
	}

	if openSession != nil {
		m.currentSession = openSession
		return openSession, nil
	}

	// Create new session
	id, err := m.store.CreateSession(now)
	if err != nil {
		return nil, err
	}

	session, err := m.store.GetSession(id)
	if err != nil {
		return nil, err
	}

	m.currentSession = session
	return session, nil
}

// EndSession ends the current session.
func (m *SessionManager) EndSession() error {
	if m.currentSession == nil {
		return nil
	}

	endedID := m.currentSession.ID
	now := time.Now().Unix()
	err := m.store.EndSession(endedID, now)
	if err != nil {
		return err
	}

	m.currentSession = nil
	if m.onSessionEnded != nil {
		go m.onSessionEnded(endedID)
	}
	return nil
}

// GetCurrentSession returns the current session.
func (m *SessionManager) GetCurrentSession() *storage.Session {
	return m.currentSession
}

// GetCurrentSessionID returns the current session ID, or 0 if no session.
func (m *SessionManager) GetCurrentSessionID() int64 {
	if m.currentSession == nil {
		return 0
	}
	return m.currentSession.ID
}

// RefreshCurrentSession reloads the current session from the database.
func (m *SessionManager) RefreshCurrentSession() error {
	if m.currentSession == nil {
		return nil
	}

	session, err := m.store.GetSession(m.currentSession.ID)
	if err != nil {
		return err
	}

	m.currentSession = session
	return nil
}

// HandleAFK is called when AFK is detected.
func (m *SessionManager) HandleAFK() error {
	return m.EndSession()
}

// HandleReturn is called when user returns from AFK.
func (m *SessionManager) HandleReturn() (*storage.Session, error) {
	return m.StartSession()
}

// IsActive returns true if there's an active session.
func (m *SessionManager) IsActive() bool {
	return m.currentSession != nil
}

// GetSessionDuration returns the duration of the current session.
func (m *SessionManager) GetSessionDuration() time.Duration {
	if m.currentSession == nil {
		return 0
	}
	return time.Duration(time.Now().Unix()-m.currentSession.StartTime) * time.Second
}

// EnsureSession ensures there's an active session, creating one if needed.
func (m *SessionManager) EnsureSession() (*storage.Session, error) {
	if m.currentSession != nil {
		return m.currentSession, nil
	}
	return m.StartSession()
}
