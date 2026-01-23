//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"traq/internal/inference"
	"traq/internal/service"
	"traq/internal/storage"
)

func main() {
	// Get data directory
	home, _ := os.UserHomeDir()
	dbPath := filepath.Join(home, ".local", "share", "traq", "data.db")

	// Open database
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer store.Close()

	// Create inference service with Ollama config
	infConfig := &inference.Config{
		Engine: inference.EngineOllama,
		Ollama: &inference.OllamaConfig{
			Host:  "http://localhost:11434",
			Model: "qwen2.5:7b",
		},
	}
	inf := inference.NewService(infConfig)

	// Create summary service
	summaryService := service.NewSummaryService(store, inf)

	// Get today's sessions
	now := time.Now()
	sessions, err := store.GetSessionsForDate(now.Year(), int(now.Month()), now.Day())
	if err != nil {
		log.Fatalf("Failed to get sessions: %v", err)
	}

	fmt.Printf("Found %d sessions today\n", len(sessions))

	for _, sess := range sessions {
		fmt.Printf("\nRegenerating summary for session %d...\n", sess.ID)
		summary, err := summaryService.RegenerateSummary(sess.ID)
		if err != nil {
			fmt.Printf("  ERROR: %v\n", err)
			continue
		}
		fmt.Printf("  Summary: %s\n", truncate(summary.Summary, 100))
		if len(summary.Projects) > 0 {
			fmt.Printf("  Projects: %d\n", len(summary.Projects))
			for _, p := range summary.Projects {
				fmt.Printf("    - %s (%d min): %v\n", p.Name, p.TimeMinutes, p.Activities)
			}
		}
	}

	fmt.Println("\nDone!")
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
