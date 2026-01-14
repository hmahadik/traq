package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"traq/internal/service"
	"traq/internal/storage"
)

func main() {
	// Get data directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	dataDir := filepath.Join(homeDir, ".local", "share", "traq")
	dbPath := filepath.Join(dataDir, "data.db")

	// Open database
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatal(err)
	}

	// Create services
	timelineService := service.NewTimelineService(store)
	analyticsService := service.NewAnalyticsService(store)
	reportsService := service.NewReportsService(store, timelineService, analyticsService)

	// Generate report for this week
	now := time.Now()
	startOfWeek := now.AddDate(0, 0, -7)

	startDate := startOfWeek.Format("2006-01-02")
	endDate := now.Format("2006-01-02")

	fmt.Printf("🔬 Testing report generation with AI projects\n")
	fmt.Printf("Date range: %s to %s\n\n", startDate, endDate)

	// Build the data
	data, err := reportsService.GenerateReport("yesterday", "summary", false)
	if err != nil {
		log.Fatalf("Failed to generate report: %v", err)
	}

	// Export as markdown
	markdown, err := reportsService.ExportReport(data.ID, "markdown")
	if err != nil {
		log.Fatalf("Failed to export report: %v", err)
	}

	// Save to file for review
	testPath := "/tmp/traq_test_report.md"
	if err := os.WriteFile(testPath, []byte(markdown), 0644); err != nil {
		log.Fatalf("Failed to write report: %v", err)
	}

	fmt.Printf("✅ Report generated successfully!\n")
	fmt.Printf("📄 Saved to: %s\n\n", testPath)
	fmt.Printf("Preview (first 2000 chars):\n")
	fmt.Printf("─────────────────────────────────\n")
	preview := markdown
	if len(preview) > 2000 {
		preview = preview[:2000] + "\n\n... (truncated)"
	}
	fmt.Println(preview)
}
