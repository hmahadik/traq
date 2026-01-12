package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
	"traq/internal/storage"
)

func setupReportsTest(t *testing.T) (*ReportsService, *storage.Store, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(dir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("failed to create store: %v", err)
	}

	timeline := NewTimelineService(store)
	analytics := NewAnalyticsService(store)
	service := NewReportsService(store, timeline, analytics)

	cleanup := func() {
		store.Close()
		os.RemoveAll(dir)
	}

	return service, store, cleanup
}

func TestExportReportPDF(t *testing.T) {
	service, store, cleanup := setupReportsTest(t)
	defer cleanup()

	// Create a test report
	report := &storage.Report{
		Title:      "Test Report",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
		Content:    storage.NullString("# Test Report\n\n## Section 1\n\nSome content here.\n\n- Item 1\n- Item 2\n\n### Subsection\n\nMore text with **bold** and *italic*."),
	}

	id, err := store.SaveReport(report)
	if err != nil {
		t.Fatalf("failed to save report: %v", err)
	}

	// Export as PDF
	pdfContent, err := service.ExportReport(id, "pdf")
	if err != nil {
		t.Fatalf("failed to export report as PDF: %v", err)
	}

	// Verify PDF content starts with PDF magic bytes
	if !strings.HasPrefix(pdfContent, "%PDF-") {
		t.Errorf("expected PDF content to start with '%%PDF-', got: %s", pdfContent[:10])
	}

	// Verify it's not empty
	if len(pdfContent) == 0 {
		t.Error("PDF content is empty")
	}
}

func TestExportReportHTML(t *testing.T) {
	service, store, cleanup := setupReportsTest(t)
	defer cleanup()

	report := &storage.Report{
		Title:      "Test Report",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
		Content:    storage.NullString("# Test\n\n**bold**"),
	}

	id, _ := store.SaveReport(report)
	html, err := service.ExportReport(id, "html")
	if err != nil {
		t.Fatalf("failed to export as HTML: %v", err)
	}

	if !strings.Contains(html, "<h1>Test</h1>") {
		t.Error("expected HTML to contain h1 tag")
	}
	if !strings.Contains(html, "<strong>bold</strong>") {
		t.Error("expected HTML to contain strong tag")
	}
}

func TestExportReportMarkdown(t *testing.T) {
	service, store, cleanup := setupReportsTest(t)
	defer cleanup()

	content := "# Test\n\nContent"
	report := &storage.Report{
		Title:      "Test Report",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
		Content:    storage.NullString(content),
	}

	id, _ := store.SaveReport(report)
	md, err := service.ExportReport(id, "markdown")
	if err != nil {
		t.Fatalf("failed to export as markdown: %v", err)
	}

	if md != content {
		t.Errorf("expected markdown content %q, got %q", content, md)
	}
}

func TestExportReportJSON(t *testing.T) {
	service, store, cleanup := setupReportsTest(t)
	defer cleanup()

	report := &storage.Report{
		Title:      "Test Report",
		TimeRange:  "today",
		ReportType: "summary",
		Format:     "markdown",
		Content:    storage.NullString("Content"),
	}

	id, _ := store.SaveReport(report)
	json, err := service.ExportReport(id, "json")
	if err != nil {
		t.Fatalf("failed to export as JSON: %v", err)
	}

	if !strings.Contains(json, `"title":"Test Report"`) {
		t.Error("expected JSON to contain title field")
	}
	if !strings.Contains(json, `"content":"Content"`) {
		t.Error("expected JSON to contain content field")
	}
}

func TestParseTimeRangeDateRange(t *testing.T) {
	service, _, cleanup := setupReportsTest(t)
	defer cleanup()

	tests := []struct {
		name      string
		input     string
		wantLabel string
		wantErr   bool
	}{
		{
			name:      "lowercase month abbrev with comma",
			input:     "jan 5, 2026 - jan 12, 2026",
			wantLabel: "Jan 5, 2026 - Jan 12, 2026",
			wantErr:   false,
		},
		{
			name:      "lowercase full month name",
			input:     "january 5, 2026 - january 12, 2026",
			wantLabel: "Jan 5, 2026 - Jan 12, 2026",
			wantErr:   false,
		},
		{
			name:      "mixed case month",
			input:     "Jan 5, 2026 - Jan 12, 2026",
			wantLabel: "Jan 5, 2026 - Jan 12, 2026",
			wantErr:   false,
		},
		{
			name:      "ISO date format",
			input:     "2026-01-05 - 2026-01-12",
			wantLabel: "Jan 5, 2026 - Jan 12, 2026",
			wantErr:   false,
		},
		{
			name:      "using 'to' separator",
			input:     "jan 5, 2026 to jan 12, 2026",
			wantLabel: "Jan 5, 2026 - Jan 12, 2026",
			wantErr:   false,
		},
		{
			name:      "day month year format",
			input:     "5 jan 2026 - 12 jan 2026",
			wantLabel: "Jan 5, 2026 - Jan 12, 2026",
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := service.ParseTimeRange(tt.input)
			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if result.Label != tt.wantLabel {
				t.Errorf("label = %q, want %q", result.Label, tt.wantLabel)
			}
		})
	}
}

func TestGenerateDetailedReportHTML(t *testing.T) {
	service, store, cleanup := setupReportsTest(t)
	defer cleanup()

	// Create test data
	startTime := time.Now().Add(-24 * time.Hour)
	now := startTime.Unix()

	_, _ = store.CreateSession(now)

	_, _ = store.SaveGitCommit(&storage.GitCommit{
		ShortHash: "abc123",
		Message:   "Test commit",
		Timestamp: now + 300,
	})

	_, _ = store.SaveShellCommand(&storage.ShellCommand{
		Command:   "go test ./...",
		Timestamp: now + 600,
	})

	_, _ = store.SaveFileEvent(&storage.FileEvent{
		FileName:      "test",
		FileExtension: storage.NullString(".go"),
		EventType:     "modified",
		Timestamp:     now + 900,
	})

	// Generate detailed report for yesterday (where we have data)
	report, err := service.GenerateReport("yesterday", "detailed", false)
	if err != nil {
		t.Fatalf("failed to generate detailed report: %v", err)
	}

	// Verify it's HTML (not markdown)
	if !strings.Contains(report.Content, "<div style=") {
		t.Error("detailed report should contain HTML div elements with inline styles")
	}

	// Verify no markdown syntax
	if strings.Contains(report.Content, "## ") || strings.Contains(report.Content, "### ") {
		t.Error("detailed report should not contain markdown headers")
	}

	// Verify required sections
	if !strings.Contains(report.Content, "Event Timeline") {
		t.Error("detailed report should contain Event Timeline section")
	}

	// The report may not have events if there's no data, so let's just check HTML structure is valid
	// and verify markdown syntax is NOT present
	if strings.HasPrefix(report.Content, "# ") {
		t.Error("detailed report should not start with markdown heading")
	}

	t.Logf("Report type: %s", report.ReportType)
	t.Logf("Report content length: %d", len(report.Content))
	t.Logf("Report preview: %s", report.Content[:min(500, len(report.Content))])
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
