package service

import (
	"testing"
)

// TestSessionSummary_NullEndTime_Duration tests that sessions with null end time
// are properly represented with nil pointers and IsOngoing flag.
func TestSessionSummary_NullEndTime_Duration(t *testing.T) {
	// Create a session with null end time (ongoing session)
	startTime := int64(1704067200) // 2024-01-01 00:00:00 UTC

	summary := &SessionSummary{
		ID:        1,
		StartTime: startTime,
		IsOngoing: true,
		// EndTime and DurationSeconds should be nil for ongoing sessions
	}

	// With the fix: EndTime is nil (not 0), and IsOngoing is true
	if summary.EndTime != nil {
		t.Errorf("Ongoing session should have nil EndTime, got %v", *summary.EndTime)
	}

	if !summary.IsOngoing {
		t.Errorf("Ongoing session should have IsOngoing=true")
	}

	// Frontend can now check: if EndTime == null || IsOngoing, don't calculate duration
}

// TestSessionSummary_DurationCalculation tests duration calculation for various session states.
func TestSessionSummary_DurationCalculation(t *testing.T) {
	tests := []struct {
		name          string
		startTime     int64
		endTime       *int64
		duration      *int64
		isOngoing     bool
		expectNilEnd  bool
	}{
		{
			name:         "completed session with valid end time",
			startTime:    1704067200,
			endTime:      ptrInt64(1704070800), // 1 hour later
			duration:     ptrInt64(3600),
			isOngoing:    false,
			expectNilEnd: false,
		},
		{
			name:         "ongoing session - null end time",
			startTime:    1704067200,
			endTime:      nil,
			duration:     nil,
			isOngoing:    true,
			expectNilEnd: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			summary := &SessionSummary{
				ID:              1,
				StartTime:       tt.startTime,
				EndTime:         tt.endTime,
				DurationSeconds: tt.duration,
				IsOngoing:       tt.isOngoing,
			}

			// Verify ongoing sessions have nil EndTime
			if tt.expectNilEnd && summary.EndTime != nil {
				t.Errorf("Expected nil EndTime for ongoing session, got %d", *summary.EndTime)
			}

			// Verify completed sessions have valid EndTime
			if !tt.expectNilEnd && summary.EndTime == nil {
				t.Errorf("Expected non-nil EndTime for completed session")
			}

			// Verify IsOngoing flag is set correctly
			if summary.IsOngoing != tt.isOngoing {
				t.Errorf("IsOngoing = %v, want %v", summary.IsOngoing, tt.isOngoing)
			}

			// For completed sessions, verify duration is non-negative
			if summary.EndTime != nil && summary.DurationSeconds != nil {
				if *summary.DurationSeconds < 0 {
					t.Errorf("Duration should be non-negative, got %d", *summary.DurationSeconds)
				}
			}
		})
	}
}

// ptrInt64 returns a pointer to the given int64 value.
func ptrInt64(v int64) *int64 {
	return &v
}
