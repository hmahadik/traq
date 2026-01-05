package tracker

import (
	"time"

	"traq/internal/platform"
)

// AFKDetector detects when the user is away from keyboard.
type AFKDetector struct {
	platform   platform.Platform
	timeout    time.Duration
	isAFK      bool
	lastActive time.Time
	afkStart   time.Time
	onAFK      func()
	onReturn   func()
}

// NewAFKDetector creates a new AFKDetector.
func NewAFKDetector(p platform.Platform, timeout time.Duration) *AFKDetector {
	return &AFKDetector{
		platform:   p,
		timeout:    timeout,
		isAFK:      false,
		lastActive: time.Now(),
	}
}

// SetCallbacks sets the callbacks for AFK state changes.
func (d *AFKDetector) SetCallbacks(onAFK, onReturn func()) {
	d.onAFK = onAFK
	d.onReturn = onReturn
}

// SetTimeout updates the AFK timeout duration.
func (d *AFKDetector) SetTimeout(timeout time.Duration) {
	d.timeout = timeout
}

// Poll checks the current AFK status. Returns true if state changed.
func (d *AFKDetector) Poll() bool {
	lastInput, err := d.platform.GetLastInputTime()
	if err != nil {
		// If we can't get input time, assume not AFK
		return false
	}

	idleDuration := time.Since(lastInput)
	wasAFK := d.isAFK

	if idleDuration >= d.timeout {
		// User is AFK
		if !d.isAFK {
			d.isAFK = true
			d.afkStart = lastInput
			if d.onAFK != nil {
				d.onAFK()
			}
		}
	} else {
		// User is active
		if d.isAFK {
			d.isAFK = false
			d.afkStart = time.Time{}
			if d.onReturn != nil {
				d.onReturn()
			}
		}
		d.lastActive = time.Now()
	}

	return d.isAFK != wasAFK
}

// IsAFK returns the current AFK status.
func (d *AFKDetector) IsAFK() bool {
	return d.isAFK
}

// GetLastActiveTime returns the last time the user was active.
func (d *AFKDetector) GetLastActiveTime() time.Time {
	return d.lastActive
}

// GetAFKStartTime returns when the current AFK period started.
// Returns zero time if not currently AFK.
func (d *AFKDetector) GetAFKStartTime() time.Time {
	if !d.isAFK {
		return time.Time{}
	}
	return d.afkStart
}

// GetAFKDuration returns how long the user has been AFK.
// Returns 0 if not currently AFK.
func (d *AFKDetector) GetAFKDuration() time.Duration {
	if !d.isAFK {
		return 0
	}
	return time.Since(d.afkStart)
}

// GetIdleDuration returns the current idle duration.
func (d *AFKDetector) GetIdleDuration() time.Duration {
	lastInput, err := d.platform.GetLastInputTime()
	if err != nil {
		return 0
	}
	return time.Since(lastInput)
}

// Reset resets the AFK state.
func (d *AFKDetector) Reset() {
	d.isAFK = false
	d.lastActive = time.Now()
	d.afkStart = time.Time{}
}

// ForceAFK forces the AFK state (for testing or manual control).
func (d *AFKDetector) ForceAFK() {
	if !d.isAFK {
		d.isAFK = true
		d.afkStart = time.Now()
		if d.onAFK != nil {
			d.onAFK()
		}
	}
}

// ForceReturn forces a return from AFK (for testing or manual control).
func (d *AFKDetector) ForceReturn() {
	if d.isAFK {
		d.isAFK = false
		d.afkStart = time.Time{}
		d.lastActive = time.Now()
		if d.onReturn != nil {
			d.onReturn()
		}
	}
}
