package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"traq/internal/platform"
	"traq/internal/service"
	"traq/internal/storage"
)

func main() {
	// Initialize platform
	p := platform.New()
	dataDir := p.DataDir()
	dbPath := filepath.Join(dataDir, "data.db")

	// Initialize storage
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	// Run migrations
	if err := store.Migrate(); err != nil {
		log.Printf("Warning: Failed to run migrations: %v", err)
	}

	// Initialize services
	analytics := service.NewAnalyticsService(store)
	timeline := service.NewTimelineService(store)
	projects := service.NewProjectAssignmentService(store)
	reports := service.NewReportsService(store, timeline, analytics, projects)

	// Generate weekly summary for Jan 6-12, 2026
	startDate := "2026-01-06"
	endDate := "2026-01-12"

	// Silent generation - no status messages to stdout

	markdown, err := reports.GenerateWeeklySummaryMarkdown(startDate, endDate)
	if err != nil {
		log.Fatalf("Failed to generate report: %v", err)
	}

	// Output to stdout (clean, no extra messages)
	fmt.Print(markdown)

	// Also save to file silently
	outputPath := "Generated_Weekly_Summary.md"
	if err := os.WriteFile(outputPath, []byte(markdown), 0644); err != nil {
		log.Printf("Warning: Failed to write output file: %v", err)
	}
}
