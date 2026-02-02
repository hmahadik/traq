//go:build ignore

package main

import (
	"encoding/json"
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
	ollamaHost := "http://localhost:11434"
	if val, err := store.GetConfig("inference.ollama.host"); err == nil && val != "" {
		ollamaHost = val
	}

	ollamaModel := "gemma3:12b-it-qat"
	if val, err := store.GetConfig("inference.ollama.model"); err == nil && val != "" {
		ollamaModel = val
	}

	// Create inference config
	infConfig := &inference.Config{
		Engine: inference.EngineOllama,
		Ollama: &inference.OllamaConfig{
			Host:  ollamaHost,
			Model: ollamaModel,
		},
	}

	// Create services
	infService := inference.NewService(infConfig)
	summaryService := service.NewSummaryService(store, infService)

	// Test with session 92 (recent session)
	sessionID := int64(92)

	fmt.Printf("🧪 Testing multi-project detection on session %d\n\n", sessionID)

	summary, err := summaryService.RegenerateSummary(sessionID)
	if err != nil {
		log.Fatalf("Error: %v", err)
	}

	fmt.Println("✅ Summary generated!")
	fmt.Printf("\n📝 Summary: %s\n", summary.Summary)
	fmt.Printf("\n🏷️  Tags: %v\n", summary.Tags)

	if len(summary.Projects) > 0 {
		fmt.Printf("\n🎯 PROJECTS DETECTED (%d):\n", len(summary.Projects))
		for i, p := range summary.Projects {
			fmt.Printf("\n  %d. %s (%d minutes, %s confidence)\n", i+1, p.Name, p.TimeMinutes, p.Confidence)
			if len(p.Activities) > 0 {
				fmt.Println("     Activities:")
				for _, activity := range p.Activities {
					fmt.Printf("       • %s\n", activity)
				}
			}
		}

		// Calculate total time
		totalTime := 0
		for _, p := range summary.Projects {
			totalTime += p.TimeMinutes
		}
		fmt.Printf("\n  📊 Total time across projects: %d minutes\n", totalTime)
	} else {
		fmt.Println("\n❌ No projects detected")
	}

	// Show raw JSON for debugging
	projectsJSON, _ := json.MarshalIndent(summary.Projects, "", "  ")
	fmt.Printf("\n📦 Raw JSON:\n%s\n", string(projectsJSON))
}
