package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

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

	fmt.Println("🔬 Generating Reports for Comparison")
	fmt.Println("=====================================\n")

	// Generate Daily Report (Jan 12, 2026)
	fmt.Println("📅 DAILY REPORT: January 12, 2026")
	fmt.Println("──────────────────────────────────\n")

	dailyReport, err := reportsService.GenerateReport("2026-01-12", "summary", false)
	if err != nil {
		log.Printf("Daily report error: %v", err)
	} else {
		// Export as markdown
		dailyMarkdown, err := reportsService.ExportReport(dailyReport.ID, "markdown")
		if err != nil {
			log.Printf("Export error: %v", err)
		} else {
			// Save to file
			dailyPath := "/tmp/traq_generated_daily.md"
			os.WriteFile(dailyPath, []byte(dailyMarkdown), 0644)
			fmt.Printf("✅ Generated daily report: %s\n\n", dailyPath)

			// Show preview
			if len(dailyMarkdown) > 1500 {
				fmt.Println(dailyMarkdown[:1500] + "\n\n... (truncated)")
			} else {
				fmt.Println(dailyMarkdown)
			}
		}
	}

	fmt.Println("\n\n")

	// Generate Weekly Report (Jan 6-12, 2026)
	fmt.Println("📅 WEEKLY REPORT: January 6-12, 2026")
	fmt.Println("─────────────────────────────────────\n")

	weeklyReport, err := reportsService.GenerateReport("2026-01-06 to 2026-01-12", "summary", false)
	if err != nil {
		log.Printf("Weekly report error: %v", err)
	} else {
		// Export as markdown
		weeklyMarkdown, err := reportsService.ExportReport(weeklyReport.ID, "markdown")
		if err != nil {
			log.Printf("Export error: %v", err)
		} else {
			// Save to file
			weeklyPath := "/tmp/traq_generated_weekly.md"
			os.WriteFile(weeklyPath, []byte(weeklyMarkdown), 0644)
			fmt.Printf("✅ Generated weekly report: %s\n\n", weeklyPath)

			// Show preview (more for weekly)
			if len(weeklyMarkdown) > 3000 {
				fmt.Println(weeklyMarkdown[:3000] + "\n\n... (truncated)")
			} else {
				fmt.Println(weeklyMarkdown)
			}
		}
	}

	fmt.Println("\n\n📊 COMPARISON READY!")
	fmt.Println("══════════════════════")
	fmt.Println("Target reports:")
	fmt.Println("  • Target_Daily_Report.md")
	fmt.Println("  • Target_Weekly_Summary.md")
	fmt.Println("\nGenerated reports:")
	fmt.Println("  • /tmp/traq_generated_daily.md")
	fmt.Println("  • /tmp/traq_generated_weekly.md")
}
