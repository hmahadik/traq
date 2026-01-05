package tracker

import (
	"errors"
	"testing"
	"time"
)

func TestNewAFKDetector(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	if detector == nil {
		t.Fatal("expected non-nil AFKDetector")
	}
	if detector.timeout != 5*time.Minute {
		t.Errorf("got timeout=%v, want 5m", detector.timeout)
	}
	if detector.isAFK {
		t.Error("expected isAFK=false initially")
	}
}

func TestAFKDetector_SetTimeout(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	detector.SetTimeout(10 * time.Minute)
	if detector.timeout != 10*time.Minute {
		t.Errorf("got timeout=%v, want 10m", detector.timeout)
	}
}

func TestAFKDetector_IsAFK(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	if detector.IsAFK() {
		t.Error("expected IsAFK=false initially")
	}

	detector.isAFK = true
	if !detector.IsAFK() {
		t.Error("expected IsAFK=true")
	}
}

func TestAFKDetector_Poll_Active(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 1*time.Second)

	// Recent input - should be active
	mock.SetLastInputTime(time.Now())

	changed := detector.Poll()
	if changed {
		t.Error("expected no state change")
	}
	if detector.IsAFK() {
		t.Error("expected not AFK with recent input")
	}
}

func TestAFKDetector_Poll_BecomeAFK(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 1*time.Second)

	// Set input time to be old enough to trigger AFK
	mock.SetLastInputTime(time.Now().Add(-2 * time.Second))

	afkCallbackCalled := false
	detector.SetCallbacks(func() {
		afkCallbackCalled = true
	}, nil)

	changed := detector.Poll()
	if !changed {
		t.Error("expected state change when becoming AFK")
	}
	if !detector.IsAFK() {
		t.Error("expected to be AFK")
	}
	if !afkCallbackCalled {
		t.Error("expected AFK callback to be called")
	}
}

func TestAFKDetector_Poll_ReturnFromAFK(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 1*time.Second)

	// Start as AFK
	detector.isAFK = true
	detector.afkStart = time.Now().Add(-5 * time.Minute)

	returnCallbackCalled := false
	detector.SetCallbacks(nil, func() {
		returnCallbackCalled = true
	})

	// Recent input - should return from AFK
	mock.SetLastInputTime(time.Now())

	changed := detector.Poll()
	if !changed {
		t.Error("expected state change when returning from AFK")
	}
	if detector.IsAFK() {
		t.Error("expected not AFK after return")
	}
	if !returnCallbackCalled {
		t.Error("expected return callback to be called")
	}
}

func TestAFKDetector_Poll_Error(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 1*time.Second)

	mock.SetLastInputError(errors.New("input error"))

	changed := detector.Poll()
	if changed {
		t.Error("expected no state change on error")
	}
}

func TestAFKDetector_GetLastActiveTime(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	lastActive := detector.GetLastActiveTime()
	if lastActive.IsZero() {
		t.Error("expected non-zero last active time")
	}
}

func TestAFKDetector_GetAFKStartTime(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	// Not AFK - should return zero time
	afkStart := detector.GetAFKStartTime()
	if !afkStart.IsZero() {
		t.Error("expected zero time when not AFK")
	}

	// Set AFK
	detector.isAFK = true
	detector.afkStart = time.Now()

	afkStart = detector.GetAFKStartTime()
	if afkStart.IsZero() {
		t.Error("expected non-zero time when AFK")
	}
}

func TestAFKDetector_GetAFKDuration(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	// Not AFK - should return 0
	duration := detector.GetAFKDuration()
	if duration != 0 {
		t.Errorf("expected 0 duration when not AFK, got %v", duration)
	}

	// Set AFK
	detector.isAFK = true
	detector.afkStart = time.Now().Add(-5 * time.Minute)

	duration = detector.GetAFKDuration()
	if duration < 5*time.Minute {
		t.Errorf("expected >= 5m duration, got %v", duration)
	}
}

func TestAFKDetector_GetIdleDuration(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	// Set input time 30 seconds ago
	mock.SetLastInputTime(time.Now().Add(-30 * time.Second))

	idle := detector.GetIdleDuration()
	if idle < 29*time.Second || idle > 31*time.Second {
		t.Errorf("expected ~30s idle, got %v", idle)
	}
}

func TestAFKDetector_GetIdleDuration_Error(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	mock.SetLastInputError(errors.New("input error"))

	idle := detector.GetIdleDuration()
	if idle != 0 {
		t.Errorf("expected 0 duration on error, got %v", idle)
	}
}

func TestAFKDetector_Reset(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	detector.isAFK = true
	detector.afkStart = time.Now()

	detector.Reset()

	if detector.isAFK {
		t.Error("expected isAFK=false after reset")
	}
	if !detector.afkStart.IsZero() {
		t.Error("expected afkStart to be zero after reset")
	}
}

func TestAFKDetector_ForceAFK(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	callbackCalled := false
	detector.SetCallbacks(func() {
		callbackCalled = true
	}, nil)

	detector.ForceAFK()

	if !detector.isAFK {
		t.Error("expected isAFK=true after ForceAFK")
	}
	if detector.afkStart.IsZero() {
		t.Error("expected afkStart to be set")
	}
	if !callbackCalled {
		t.Error("expected callback to be called")
	}

	// Calling again should not trigger callback again
	callbackCalled = false
	detector.ForceAFK()
	if callbackCalled {
		t.Error("callback should not be called when already AFK")
	}
}

func TestAFKDetector_ForceReturn(t *testing.T) {
	mock := NewMockPlatform()
	detector := NewAFKDetector(mock, 5*time.Minute)

	detector.isAFK = true
	detector.afkStart = time.Now()

	callbackCalled := false
	detector.SetCallbacks(nil, func() {
		callbackCalled = true
	})

	detector.ForceReturn()

	if detector.isAFK {
		t.Error("expected isAFK=false after ForceReturn")
	}
	if !detector.afkStart.IsZero() {
		t.Error("expected afkStart to be zero")
	}
	if !callbackCalled {
		t.Error("expected callback to be called")
	}

	// Calling again should not trigger callback
	callbackCalled = false
	detector.ForceReturn()
	if callbackCalled {
		t.Error("callback should not be called when already active")
	}
}
