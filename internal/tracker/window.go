package tracker

import (
	"database/sql"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
)

// WindowTracker tracks the currently focused window.
type WindowTracker struct {
	platform        platform.Platform
	store           *storage.Store
	currentFocus    *WindowFocus
	onActivitySaved ActivitySavedCallback
}

// WindowFocus represents the currently focused window.
type WindowFocus struct {
	WindowTitle string
	AppName     string
	WindowClass string
	StartTime   time.Time
	SessionID   int64
}

// NewWindowTracker creates a new WindowTracker.
func NewWindowTracker(p platform.Platform, store *storage.Store) *WindowTracker {
	return &WindowTracker{
		platform: p,
		store:    store,
	}
}

// Poll checks the current window and returns info if it changed.
func (t *WindowTracker) Poll() (*platform.WindowInfo, bool, error) {
	info, err := t.platform.GetActiveWindow()
	if err != nil {
		return nil, false, err
	}

	// Check if focus changed
	changed := t.currentFocus == nil ||
		t.currentFocus.WindowTitle != info.Title ||
		t.currentFocus.AppName != info.AppName

	return info, changed, nil
}

// RecordFocusChange records a window focus change.
func (t *WindowTracker) RecordFocusChange(newWindow *platform.WindowInfo, sessionID int64) error {
	now := time.Now()

	// If we have a previous focus, record its duration
	if t.currentFocus != nil {
		duration := now.Sub(t.currentFocus.StartTime).Seconds()

		// Only record if duration is meaningful (> 1 second)
		if duration > 1 {
			event := &storage.WindowFocusEvent{
				WindowTitle:     t.currentFocus.WindowTitle,
				AppName:         t.currentFocus.AppName,
				WindowClass:     sql.NullString{String: t.currentFocus.WindowClass, Valid: t.currentFocus.WindowClass != ""},
				StartTime:       t.currentFocus.StartTime.Unix(),
				EndTime:         now.Unix(),
				DurationSeconds: duration,
				SessionID:       sql.NullInt64{Int64: t.currentFocus.SessionID, Valid: t.currentFocus.SessionID > 0},
			}

			eventID, err := t.store.SaveFocusEvent(event)
			if err != nil {
				return err
			}
			if eventID > 0 && t.onActivitySaved != nil {
				go t.onActivitySaved("focus", eventID, event.AppName, event.WindowTitle, "")
			}
		}
	}

	// Update current focus
	t.currentFocus = &WindowFocus{
		WindowTitle: newWindow.Title,
		AppName:     newWindow.AppName,
		WindowClass: newWindow.Class,
		StartTime:   now,
		SessionID:   sessionID,
	}

	return nil
}

// FlushCurrentFocus saves the current focus event (e.g., on AFK or shutdown).
func (t *WindowTracker) FlushCurrentFocus() error {
	if t.currentFocus == nil {
		return nil
	}

	now := time.Now()
	duration := now.Sub(t.currentFocus.StartTime).Seconds()

	if duration > 1 {
		event := &storage.WindowFocusEvent{
			WindowTitle:     t.currentFocus.WindowTitle,
			AppName:         t.currentFocus.AppName,
			WindowClass:     sql.NullString{String: t.currentFocus.WindowClass, Valid: t.currentFocus.WindowClass != ""},
			StartTime:       t.currentFocus.StartTime.Unix(),
			EndTime:         now.Unix(),
			DurationSeconds: duration,
			SessionID:       sql.NullInt64{Int64: t.currentFocus.SessionID, Valid: t.currentFocus.SessionID > 0},
		}

		eventID, err := t.store.SaveFocusEvent(event)
		if err != nil {
			return err
		}
		if eventID > 0 && t.onActivitySaved != nil {
			go t.onActivitySaved("focus", eventID, event.AppName, event.WindowTitle, "")
		}
	}

	t.currentFocus = nil
	return nil
}

// GetCurrentFocus returns the current focus state.
func (t *WindowTracker) GetCurrentFocus() *WindowFocus {
	return t.currentFocus
}

// Reset clears the current focus without saving.
func (t *WindowTracker) Reset() {
	t.currentFocus = nil
}

// UpdateSessionID updates the session ID for the current focus.
func (t *WindowTracker) UpdateSessionID(sessionID int64) {
	if t.currentFocus != nil {
		t.currentFocus.SessionID = sessionID
	}
}
