package service

import (
	"fmt"
	"math"
	"sort"
	"time"

	"traq/internal/storage"
)

// TimesheetEntry is one row in the structured timesheet preview: a single
// project's tracked time on a single date.
type TimesheetEntry struct {
	Date          string  `json:"date"`          // "YYYY-MM-DD" in user's local timezone
	TraqProject   string  `json:"traqProject"`   // canonical project name from DetectProjectFromWindowTitle
	Hours         float64 `json:"hours"`         // rounded per user's setting
	Notes         string  `json:"notes"`         // initially empty; populated by Task 6 (notes generator)
	FFClientID    string  `json:"ffClientId"`    // populated by Task 5 (mapping resolution); empty if unmapped
	FFClientName  string  `json:"ffClientName"`
	FFJobID       string  `json:"ffJobId"`
	FFJobName     string  `json:"ffJobName"`
	FFTaskID      string  `json:"ffTaskId"`
	FFTaskName    string  `json:"ffTaskName"`
	Skipped       bool    `json:"skipped"`       // user toggled off in preview
	SkipReason    string  `json:"skipReason"`    // "" or "unmapped" or "user-skipped"
	FFTimesheetID string  `json:"ffTimesheetId"` // populated by Plan C after a successful push; empty in Plan B
}

// TimesheetData is the full preview for a date range.
type TimesheetData struct {
	Start            string            `json:"start"`            // "YYYY-MM-DD"
	End              string            `json:"end"`              // "YYYY-MM-DD"
	Entries          []TimesheetEntry  `json:"entries"`          // sorted by Date ASC, then TraqProject ASC
	UnmappedProjects []string          `json:"unmappedProjects"` // distinct project names that have no FF mapping; populated by Task 5
	HoursRounding    float64           `json:"hoursRounding"`    // 0.1 / 0.25 / 0.5 / 1.0
	GeneratedAt      int64             `json:"generatedAt"`      // unix seconds
}

// TimesheetService builds TimesheetData for a date range by aggregating
// window-focus events into per-(project, date) buckets.
type TimesheetService struct {
	store   *storage.Store
	reports *ReportsService
}

// NewTimesheetService constructs a TimesheetService. The reports service is
// used for its exported project-detection methods.
func NewTimesheetService(store *storage.Store, reports *ReportsService) *TimesheetService {
	return &TimesheetService{store: store, reports: reports}
}

// BuildTimesheet builds the structured timesheet for [startDate, endDate]
// inclusive, both formatted "YYYY-MM-DD" in the user's local timezone.
// hoursRounding is the multiple to round each per-(project,date) total to
// (typically 0.25; clamps to a safe range if zero or negative).
//
// This task's scope is bucketing only — entries come back with empty Notes
// and empty FF* fields. Task 5 fills mapping IDs; Task 6 fills Notes.
func (s *TimesheetService) BuildTimesheet(startDate, endDate string, hoursRounding float64) (*TimesheetData, error) {
	if hoursRounding <= 0 {
		hoursRounding = 0.25
	}

	loc := time.Local
	start, err := time.ParseInLocation("2006-01-02", startDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid startDate %q: %w", startDate, err)
	}
	end, err := time.ParseInLocation("2006-01-02", endDate, loc)
	if err != nil {
		return nil, fmt.Errorf("invalid endDate %q: %w", endDate, err)
	}
	if end.Before(start) {
		return nil, fmt.Errorf("endDate %q is before startDate %q", endDate, startDate)
	}
	// Inclusive of the entire end day.
	endExclusive := end.Add(24 * time.Hour)

	events, err := s.store.GetFocusEventsByTimeRange(start.Unix(), endExclusive.Unix())
	if err != nil {
		return nil, fmt.Errorf("fetch focus events: %w", err)
	}

	// Bucket: key = "YYYY-MM-DD|project" → seconds.
	type bucketKey struct {
		date    string
		project string
	}
	buckets := map[bucketKey]float64{}
	distinctProjects := map[string]struct{}{}

	for _, e := range events {
		proj := s.reports.DetectProjectFromWindowTitle(e.WindowTitle, e.AppName)
		if proj == "" {
			continue // unattributed activity is omitted from the timesheet
		}
		// Use the event's start time in user's local timezone for the date bucket.
		// Events spanning midnight count entirely toward the start day. This matches
		// the existing reports convention.
		d := time.Unix(e.StartTime, 0).In(loc).Format("2006-01-02")
		buckets[bucketKey{d, proj}] += e.DurationSeconds
		distinctProjects[proj] = struct{}{}
	}

	// Convert buckets → entries with rounded hours.
	entries := make([]TimesheetEntry, 0, len(buckets))
	for k, sec := range buckets {
		hours := sec / 3600.0
		rounded := roundToMultiple(hours, hoursRounding)
		if rounded <= 0 {
			continue // sub-rounding-precision entries dropped
		}
		entries = append(entries, TimesheetEntry{
			Date:        k.date,
			TraqProject: k.project,
			Hours:       rounded,
		})
	}

	// Sort by Date ASC, then TraqProject ASC for stable preview rendering.
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Date != entries[j].Date {
			return entries[i].Date < entries[j].Date
		}
		return entries[i].TraqProject < entries[j].TraqProject
	})

	return &TimesheetData{
		Start:         startDate,
		End:           endDate,
		Entries:       entries,
		HoursRounding: hoursRounding,
		GeneratedAt:   time.Now().Unix(),
		// UnmappedProjects populated by Task 5.
	}, nil
}

// roundToMultiple rounds x to the nearest multiple of m. Both must be positive.
func roundToMultiple(x, m float64) float64 {
	if m <= 0 {
		return x
	}
	return math.Round(x/m) * m
}
