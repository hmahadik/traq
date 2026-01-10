package service

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
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
	service := NewReportsService(store, timeline)

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
