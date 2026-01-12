package service

import (
	"math"
	"testing"
)

// TestSortAppUsage_PercentageCalculation tests that percentages are calculated correctly.
func TestSortAppUsage_PercentageCalculation(t *testing.T) {
	svc := &AnalyticsService{}

	tests := []struct {
		name          string
		appDurations  map[string]float64
		expectSum100  bool
		expectNonZero bool
	}{
		{
			name: "equal durations should give equal percentages",
			appDurations: map[string]float64{
				"App1": 100,
				"App2": 100,
			},
			expectSum100:  true,
			expectNonZero: true,
		},
		{
			name: "single app should be 100%",
			appDurations: map[string]float64{
				"App1": 3600,
			},
			expectSum100:  true,
			expectNonZero: true,
		},
		{
			name:          "empty map should not panic",
			appDurations:  map[string]float64{},
			expectSum100:  false,
			expectNonZero: false,
		},
		{
			name: "three equal apps",
			appDurations: map[string]float64{
				"App1": 100,
				"App2": 100,
				"App3": 100,
			},
			expectSum100:  true,
			expectNonZero: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			apps := svc.sortAppUsage(tt.appDurations)

			var totalPct float64
			for _, app := range apps {
				totalPct += app.Percentage

				if tt.expectNonZero && app.DurationSeconds > 0 && app.Percentage == 0 {
					t.Errorf("App %s has duration %f but percentage is 0",
						app.AppName, app.DurationSeconds)
				}
			}

			// Check percentages sum to ~100 (with floating point tolerance)
			if tt.expectSum100 && len(apps) > 0 {
				if math.Abs(totalPct-100) > 0.01 {
					t.Errorf("Percentages don't sum to 100: got %f", totalPct)
				}
			}
		})
	}
}

// TestSortAppUsage_ZeroDuration tests handling of zero total duration.
func TestSortAppUsage_ZeroDuration(t *testing.T) {
	svc := &AnalyticsService{}

	// All apps with zero duration
	appDurations := map[string]float64{
		"App1": 0,
		"App2": 0,
	}

	apps := svc.sortAppUsage(appDurations)

	for _, app := range apps {
		if math.IsNaN(app.Percentage) || math.IsInf(app.Percentage, 0) {
			t.Errorf("Bug: Percentage is NaN or Inf for app %s when total duration is 0",
				app.AppName)
		}
	}
}

// TestSortAppUsage_VerySmallDurations tests that very small durations don't cause issues.
func TestSortAppUsage_VerySmallDurations(t *testing.T) {
	svc := &AnalyticsService{}

	appDurations := map[string]float64{
		"App1": 0.001, // 1 millisecond
		"App2": 0.001,
	}

	apps := svc.sortAppUsage(appDurations)

	var totalPct float64
	for _, app := range apps {
		if app.Percentage < 0 {
			t.Errorf("Bug: Negative percentage for app %s: %f", app.AppName, app.Percentage)
		}
		totalPct += app.Percentage
	}

	if math.Abs(totalPct-100) > 0.01 {
		t.Errorf("Percentages don't sum to 100 for small durations: got %f", totalPct)
	}
}

// TestSortAppUsage_Sorting tests that apps are sorted by duration descending.
func TestSortAppUsage_Sorting(t *testing.T) {
	svc := &AnalyticsService{}

	appDurations := map[string]float64{
		"Low":    100,
		"High":   1000,
		"Medium": 500,
	}

	apps := svc.sortAppUsage(appDurations)

	if len(apps) < 3 {
		t.Fatal("Expected 3 apps")
	}

	// Should be sorted descending
	for i := 0; i < len(apps)-1; i++ {
		if apps[i].DurationSeconds < apps[i+1].DurationSeconds {
			t.Errorf("Apps not sorted correctly: %s (%f) < %s (%f)",
				apps[i].AppName, apps[i].DurationSeconds,
				apps[i+1].AppName, apps[i+1].DurationSeconds)
		}
	}
}

// TestSortAppUsage_PercentageFormatting tests that percentage values are reasonable for display.
func TestSortAppUsage_PercentageFormatting(t *testing.T) {
	svc := &AnalyticsService{}

	// This tests the common case where one app dominates
	appDurations := map[string]float64{
		"DominantApp": 3600,   // 1 hour
		"MinorApp":    60,     // 1 minute
		"TinyApp":     1,      // 1 second
	}

	apps := svc.sortAppUsage(appDurations)

	for _, app := range apps {
		// Percentages should be reasonable numbers (0-100 range)
		if app.Percentage < 0 || app.Percentage > 100 {
			t.Errorf("Bug: Percentage out of range [0,100] for %s: %f",
				app.AppName, app.Percentage)
		}

		// Check for excessive decimal precision (e.g., 33.333333333...)
		// This might cause display issues in frontend
		// Round to 2 decimal places and check if significantly different
		rounded := math.Round(app.Percentage*100) / 100
		if math.Abs(app.Percentage-rounded) > 0.001 {
			// Not necessarily a bug, but worth noting
			t.Logf("Note: Percentage %f has more than 2 decimal places for %s",
				app.Percentage, app.AppName)
		}
	}
}

// TestCalculateComparison tests the comparison calculation logic.
func TestCalculateComparison(t *testing.T) {
	svc := &AnalyticsService{}

	tests := []struct {
		name     string
		current  *DailyStats
		previous *DailyStats
		expect   *Comparison
	}{
		{
			name: "all metrics increased",
			current: &DailyStats{
				TotalScreenshots: 100,
				TotalSessions:    10,
				ActiveMinutes:    300,
				ShellCommands:    50,
				GitCommits:       5,
				FilesModified:    20,
				SitesVisited:     15,
			},
			previous: &DailyStats{
				TotalScreenshots: 80,
				TotalSessions:    8,
				ActiveMinutes:    240,
				ShellCommands:    40,
				GitCommits:       4,
				FilesModified:    16,
				SitesVisited:     12,
			},
			expect: &Comparison{
				ScreenshotsDiff:      20,
				ScreenshotsPercent:   25.0,
				SessionsDiff:         2,
				SessionsPercent:      25.0,
				ActiveMinutesDiff:    60,
				ActiveMinutesPercent: 25.0,
				ShellCommandsDiff:    10,
				ShellCommandsPercent: 25.0,
				GitCommitsDiff:       1,
				GitCommitsPercent:    25.0,
				FilesModifiedDiff:    4,
				FilesModifiedPercent: 25.0,
				SitesVisitedDiff:     3,
				SitesVisitedPercent:  25.0,
			},
		},
		{
			name: "all metrics decreased",
			current: &DailyStats{
				TotalScreenshots: 60,
				TotalSessions:    6,
				ActiveMinutes:    180,
				ShellCommands:    30,
				GitCommits:       3,
				FilesModified:    12,
				SitesVisited:     9,
			},
			previous: &DailyStats{
				TotalScreenshots: 80,
				TotalSessions:    8,
				ActiveMinutes:    240,
				ShellCommands:    40,
				GitCommits:       4,
				FilesModified:    16,
				SitesVisited:     12,
			},
			expect: &Comparison{
				ScreenshotsDiff:      -20,
				ScreenshotsPercent:   -25.0,
				SessionsDiff:         -2,
				SessionsPercent:      -25.0,
				ActiveMinutesDiff:    -60,
				ActiveMinutesPercent: -25.0,
				ShellCommandsDiff:    -10,
				ShellCommandsPercent: -25.0,
				GitCommitsDiff:       -1,
				GitCommitsPercent:    -25.0,
				FilesModifiedDiff:    -4,
				FilesModifiedPercent: -25.0,
				SitesVisitedDiff:     -3,
				SitesVisitedPercent:  -25.0,
			},
		},
		{
			name: "no change",
			current: &DailyStats{
				TotalScreenshots: 80,
				TotalSessions:    8,
				ActiveMinutes:    240,
				ShellCommands:    40,
				GitCommits:       4,
				FilesModified:    16,
				SitesVisited:     12,
			},
			previous: &DailyStats{
				TotalScreenshots: 80,
				TotalSessions:    8,
				ActiveMinutes:    240,
				ShellCommands:    40,
				GitCommits:       4,
				FilesModified:    16,
				SitesVisited:     12,
			},
			expect: &Comparison{
				ScreenshotsDiff:      0,
				ScreenshotsPercent:   0.0,
				SessionsDiff:         0,
				SessionsPercent:      0.0,
				ActiveMinutesDiff:    0,
				ActiveMinutesPercent: 0.0,
				ShellCommandsDiff:    0,
				ShellCommandsPercent: 0.0,
				GitCommitsDiff:       0,
				GitCommitsPercent:    0.0,
				FilesModifiedDiff:    0,
				FilesModifiedPercent: 0.0,
				SitesVisitedDiff:     0,
				SitesVisitedPercent:  0.0,
			},
		},
		{
			name: "previous has zeros",
			current: &DailyStats{
				TotalScreenshots: 100,
				TotalSessions:    10,
				ActiveMinutes:    300,
				ShellCommands:    50,
				GitCommits:       5,
				FilesModified:    20,
				SitesVisited:     15,
			},
			previous: &DailyStats{
				TotalScreenshots: 0,
				TotalSessions:    0,
				ActiveMinutes:    0,
				ShellCommands:    0,
				GitCommits:       0,
				FilesModified:    0,
				SitesVisited:     0,
			},
			expect: &Comparison{
				ScreenshotsDiff:      100,
				ScreenshotsPercent:   0.0, // No previous value, so percentage is 0
				SessionsDiff:         10,
				SessionsPercent:      0.0,
				ActiveMinutesDiff:    300,
				ActiveMinutesPercent: 0.0,
				ShellCommandsDiff:    50,
				ShellCommandsPercent: 0.0,
				GitCommitsDiff:       5,
				GitCommitsPercent:    0.0,
				FilesModifiedDiff:    20,
				FilesModifiedPercent: 0.0,
				SitesVisitedDiff:     15,
				SitesVisitedPercent:  0.0,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.calculateComparison(tt.current, tt.previous)

			// Check screenshots
			if result.ScreenshotsDiff != tt.expect.ScreenshotsDiff {
				t.Errorf("ScreenshotsDiff = %d, want %d", result.ScreenshotsDiff, tt.expect.ScreenshotsDiff)
			}
			if math.Abs(result.ScreenshotsPercent-tt.expect.ScreenshotsPercent) > 0.01 {
				t.Errorf("ScreenshotsPercent = %f, want %f", result.ScreenshotsPercent, tt.expect.ScreenshotsPercent)
			}

			// Check sessions
			if result.SessionsDiff != tt.expect.SessionsDiff {
				t.Errorf("SessionsDiff = %d, want %d", result.SessionsDiff, tt.expect.SessionsDiff)
			}
			if math.Abs(result.SessionsPercent-tt.expect.SessionsPercent) > 0.01 {
				t.Errorf("SessionsPercent = %f, want %f", result.SessionsPercent, tt.expect.SessionsPercent)
			}

			// Check active minutes
			if result.ActiveMinutesDiff != tt.expect.ActiveMinutesDiff {
				t.Errorf("ActiveMinutesDiff = %d, want %d", result.ActiveMinutesDiff, tt.expect.ActiveMinutesDiff)
			}
			if math.Abs(result.ActiveMinutesPercent-tt.expect.ActiveMinutesPercent) > 0.01 {
				t.Errorf("ActiveMinutesPercent = %f, want %f", result.ActiveMinutesPercent, tt.expect.ActiveMinutesPercent)
			}

			// Check shell commands
			if result.ShellCommandsDiff != tt.expect.ShellCommandsDiff {
				t.Errorf("ShellCommandsDiff = %d, want %d", result.ShellCommandsDiff, tt.expect.ShellCommandsDiff)
			}
			if math.Abs(result.ShellCommandsPercent-tt.expect.ShellCommandsPercent) > 0.01 {
				t.Errorf("ShellCommandsPercent = %f, want %f", result.ShellCommandsPercent, tt.expect.ShellCommandsPercent)
			}

			// Check git commits
			if result.GitCommitsDiff != tt.expect.GitCommitsDiff {
				t.Errorf("GitCommitsDiff = %d, want %d", result.GitCommitsDiff, tt.expect.GitCommitsDiff)
			}
			if math.Abs(result.GitCommitsPercent-tt.expect.GitCommitsPercent) > 0.01 {
				t.Errorf("GitCommitsPercent = %f, want %f", result.GitCommitsPercent, tt.expect.GitCommitsPercent)
			}

			// Check files modified
			if result.FilesModifiedDiff != tt.expect.FilesModifiedDiff {
				t.Errorf("FilesModifiedDiff = %d, want %d", result.FilesModifiedDiff, tt.expect.FilesModifiedDiff)
			}
			if math.Abs(result.FilesModifiedPercent-tt.expect.FilesModifiedPercent) > 0.01 {
				t.Errorf("FilesModifiedPercent = %f, want %f", result.FilesModifiedPercent, tt.expect.FilesModifiedPercent)
			}

			// Check sites visited
			if result.SitesVisitedDiff != tt.expect.SitesVisitedDiff {
				t.Errorf("SitesVisitedDiff = %d, want %d", result.SitesVisitedDiff, tt.expect.SitesVisitedDiff)
			}
			if math.Abs(result.SitesVisitedPercent-tt.expect.SitesVisitedPercent) > 0.01 {
				t.Errorf("SitesVisitedPercent = %f, want %f", result.SitesVisitedPercent, tt.expect.SitesVisitedPercent)
			}
		})
	}
}
