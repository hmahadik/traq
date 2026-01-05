package storage

import (
	"database/sql"
	"testing"
)

func TestSaveReport(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	report := &Report{
		Title:      "Daily Report",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
		Content:    sql.NullString{String: "# Report\n\nContent here", Valid: true},
	}

	id, err := store.SaveReport(report)
	if err != nil {
		t.Fatalf("failed to save report: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetReport(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	report := &Report{
		Title:      "Test Report",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
		Content:    sql.NullString{String: "Content", Valid: true},
	}
	id, _ := store.SaveReport(report)

	found, err := store.GetReport(id)
	if err != nil {
		t.Fatalf("failed to get report: %v", err)
	}
	if found == nil {
		t.Fatal("expected to find report")
	}
	if found.Title != "Test Report" {
		t.Errorf("expected title 'Test Report', got %s", found.Title)
	}
}

func TestGetReport_NotFound(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	report, err := store.GetReport(99999)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if report != nil {
		t.Error("expected nil for non-existent report")
	}
}

func TestGetRecentReports(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 10; i++ {
		report := &Report{
			Title:      "Report " + string(rune('0'+i)),
			TimeRange:  "today",
			ReportType: "summary",
			Format:     "markdown",
		}
		store.SaveReport(report)
	}

	reports, err := store.GetRecentReports(5)
	if err != nil {
		t.Fatalf("failed to get recent reports: %v", err)
	}
	if len(reports) != 5 {
		t.Errorf("expected 5 reports, got %d", len(reports))
	}
}

func TestGetAllReports(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Create reports
	for i := 0; i < 3; i++ {
		report := &Report{
			Title:      "Report " + string(rune('0'+i)),
			TimeRange:  "today",
			ReportType: "summary",
			Format:     "markdown",
		}
		store.SaveReport(report)
	}

	reports, err := store.GetAllReports()
	if err != nil {
		t.Fatalf("failed to get all reports: %v", err)
	}
	if len(reports) != 3 {
		t.Errorf("expected 3 reports, got %d", len(reports))
	}
}

func TestDeleteReport(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	report := &Report{
		Title:      "To Delete",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
	}
	id, _ := store.SaveReport(report)

	err := store.DeleteReport(id)
	if err != nil {
		t.Fatalf("failed to delete report: %v", err)
	}

	found, _ := store.GetReport(id)
	if found != nil {
		t.Error("expected report to be deleted")
	}
}

func TestCountReports(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 3; i++ {
		report := &Report{
			Title:      "Report " + string(rune('0'+i)),
			TimeRange:  "today",
			ReportType: "summary",
			Format:     "markdown",
		}
		store.SaveReport(report)
	}

	count, err := store.CountReports()
	if err != nil {
		t.Fatalf("failed to count reports: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}
