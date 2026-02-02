//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"traq/internal/inference"
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

	// Load inference config
	infConfig := &inference.Config{
		Engine: inference.EngineOllama,
		Ollama: &inference.OllamaConfig{
			Host:  "http://localhost:11434",
			Model: "gemma3:12b-it-qat",
		},
	}

	// Create services
	infService := inference.NewService(infConfig)
	summaryService := service.NewSummaryService(store, infService)

	// Test sessions: pick diverse ones
	testSessions := []int64{93, 89, 86, 85, 79, 78}

	fmt.Println("🧪 Testing AI Project Detection on Historical Sessions")
	fmt.Println("========================================================\n")

	for _, sessionID := range testSessions {
		fmt.Printf("\n━━━ SESSION %d ━━━\n", sessionID)

		// Get session info
		session, _ := store.GetSession(sessionID)
		if session == nil {
			fmt.Printf("❌ Session not found\n")
			continue
		}

		mins := session.DurationSeconds.Int64 / 60
		fmt.Printf("Duration: %d minutes, %d screenshots\n", mins, session.ScreenshotCount)

		// Regenerate summary
		summary, err := summaryService.RegenerateSummary(sessionID)
		if err != nil {
			fmt.Printf("❌ Error: %v\n", err)
			continue
		}

		fmt.Printf("\n📝 Summary:\n%s\n", summary.Summary)

		if len(summary.Projects) > 0 {
			fmt.Printf("\n🎯 PROJECTS DETECTED (%d):\n", len(summary.Projects))

			totalTime := 0
			for i, p := range summary.Projects {
				hours := p.TimeMinutes / 60
				mins := p.TimeMinutes % 60
				timeStr := ""
				if hours > 0 {
					timeStr = fmt.Sprintf("%dh %dm", hours, mins)
				} else {
					timeStr = fmt.Sprintf("%dm", mins)
				}

				// Calculate percentage
				totalMins := 0
				for _, proj := range summary.Projects {
					totalMins += proj.TimeMinutes
				}
				percentage := 0
				if totalMins > 0 {
					percentage = (p.TimeMinutes * 100) / totalMins
				}

				fmt.Printf("\n  %d. %s (%s, %d%%, %s confidence)\n",
					i+1, p.Name, timeStr, percentage, p.Confidence)

				if len(p.Activities) > 0 {
					fmt.Println("     Activities:")
					for _, activity := range p.Activities {
						// Truncate long activities
						if len(activity) > 80 {
							activity = activity[:77] + "..."
						}
						fmt.Printf("       • %s\n", activity)
					}
				}

				totalTime += p.TimeMinutes
			}

			fmt.Printf("\n  📊 Total: %d minutes estimated\n", totalTime)
			fmt.Printf("  📊 Actual: %d minutes\n", mins)
			accuracy := float64(totalTime) / float64(mins) * 100
			fmt.Printf("  📊 Accuracy: %.0f%%\n", accuracy)
		} else {
			fmt.Println("\n❌ No projects detected")
		}

		fmt.Printf("\n⏱️  Inference: %dms\n", summary.InferenceTimeMs.Int64)
	}

	fmt.Println("\n\n✅ Test complete!")
}
