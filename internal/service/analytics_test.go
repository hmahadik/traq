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
