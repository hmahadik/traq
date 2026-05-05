// Meeting detection helpers for the reports service.

package service

import (
	"sort"
	"strings"

	"traq/internal/storage"
)

// detectMeetingFromTitle checks for meeting patterns in window title.
func (s *ReportsService) detectMeetingFromTitle(title string) (bool, string) {
	lower := strings.ToLower(title)

	// Slack patterns
	if strings.Contains(lower, "huddle") || strings.Contains(lower, "slack | huddle") {
		return true, "Slack"
	}

	// Zoom patterns
	if strings.Contains(lower, "zoom meeting") || strings.Contains(lower, "zoom.us") {
		return true, "Zoom"
	}

	// Google Meet patterns
	if strings.Contains(lower, "meet.google.com") || strings.Contains(lower, "meet -") {
		return true, "Google Meet"
	}

	// Microsoft Teams patterns
	if strings.Contains(lower, "microsoft teams") && strings.Contains(lower, "meeting") {
		return true, "Teams"
	}

	return false, ""
}

// detectMeetings aggregates meeting durations from all focus events.
func (s *ReportsService) detectMeetings(events []*storage.WindowFocusEvent) []MeetingDetection {
	// Group by platform + cleaned title
	meetingMap := make(map[string]*MeetingDetection)

	for _, evt := range events {
		isMeeting, platform := s.detectMeetingFromTitle(evt.WindowTitle)
		if !isMeeting {
			continue
		}

		cleanTitle := s.cleanMeetingTitle(evt.WindowTitle, platform)
		key := platform + ":" + cleanTitle

		if existing, ok := meetingMap[key]; ok {
			existing.DurationSeconds += evt.DurationSeconds
		} else {
			meetingMap[key] = &MeetingDetection{
				Platform:        platform,
				Title:           cleanTitle,
				WindowTitle:     evt.WindowTitle,
				StartTime:       evt.StartTime,
				DurationSeconds: evt.DurationSeconds,
			}
		}
	}

	// Convert to slice and sort by duration
	var meetings []MeetingDetection
	for _, m := range meetingMap {
		meetings = append(meetings, *m)
	}
	sort.Slice(meetings, func(i, j int) bool {
		return meetings[i].DurationSeconds > meetings[j].DurationSeconds
	})

	return meetings
}

// cleanMeetingTitle extracts clean meeting title from raw window title.
func (s *ReportsService) cleanMeetingTitle(windowTitle, platform string) string {
	switch platform {
	case "Slack":
		// "Huddle: #eng-mv - Arcturus in Slackspace - Slack" → "#eng-mv"
		if strings.Contains(windowTitle, "Huddle:") {
			parts := strings.Split(windowTitle, "Huddle:")
			if len(parts) > 1 {
				afterHuddle := strings.TrimSpace(parts[1])
				// Take up to first " - "
				if idx := strings.Index(afterHuddle, " - "); idx > 0 {
					return strings.TrimSpace(afterHuddle[:idx])
				}
				return afterHuddle
			}
		}
		return "Slack Huddle"

	case "Zoom":
		// "Zoom Meeting" or specific meeting name
		if strings.Contains(strings.ToLower(windowTitle), "zoom meeting") {
			return "Zoom Meeting"
		}
		return windowTitle

	case "Google Meet":
		// "Meet - abc-defg-hij" → "abc-defg-hij"
		if strings.HasPrefix(windowTitle, "Meet - ") {
			return strings.TrimPrefix(windowTitle, "Meet - ")
		}
		return "Google Meet"

	case "Teams":
		// Extract meeting name if possible
		return "Teams Meeting"
	}

	return windowTitle
}
