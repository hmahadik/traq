package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"traq/internal/platform"
	"traq/internal/service"
	"traq/internal/storage"
)

func main() {
	// Get dates
	endDate := time.Now().Format("2006-01-02")
	startDate := time.Now().AddDate(0, 0, -7).Format("2006-01-02")

	// Get data directory
	p := platform.New()
	dataDir := p.DataDir()
	dbPath := filepath.Join(dataDir, "data.db")

	// Initialize storage
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	// Initialize services
	analytics := service.NewAnalyticsService(store)
	timeline := service.NewTimelineService(store)
	projects := service.NewProjectAssignmentService(store)
	reports := service.NewReportsService(store, timeline, analytics, projects)

	// Generate report
	fmt.Printf("Generating enhanced weekly report from %s to %s...\n", startDate, endDate)
	html, err := reports.GenerateEnhancedWeeklyHTML(startDate, endDate)
	if err != nil {
		log.Fatalf("Failed to generate report: %v", err)
	}

	// Save to file
	outputPath := filepath.Join(os.TempDir(), fmt.Sprintf("traq_weekly_report_%s.html", time.Now().Format("20060102_150405")))
	err = os.WriteFile(outputPath, []byte(html), 0644)
	if err != nil {
		log.Fatalf("Failed to write report: %v", err)
	}

	fmt.Printf("✅ Report generated successfully!\n")
	fmt.Printf("📄 Saved to: %s\n", outputPath)
	fmt.Printf("\nOpen with: xdg-open %s\n", outputPath)
}
