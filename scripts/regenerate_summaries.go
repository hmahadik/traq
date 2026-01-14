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

	// Open database using storage.NewStore
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatal(err)
	}

	// Load inference config
	inferenceEngine := "ollama"
	if val, err := store.GetConfig("inference.engine"); err == nil && val != "" {
		inferenceEngine = val
	}

	ollamaHost := "http://localhost:11434"
	if val, err := store.GetConfig("inference.ollama.host"); err == nil && val != "" {
		ollamaHost = val
	}

	ollamaModel := "gemma3:12b-it-qat"
	if val, err := store.GetConfig("inference.ollama.model"); err == nil && val != "" {
		ollamaModel = val
	}

	fmt.Printf("Using inference engine: %s\n", inferenceEngine)
	fmt.Printf("Ollama host: %s\n", ollamaHost)
	fmt.Printf("Ollama model: %s\n", ollamaModel)

	// Create inference config
	infConfig := &inference.Config{
		Engine: inference.Engine(inferenceEngine),
		Ollama: &inference.OllamaConfig{
			Host:  ollamaHost,
			Model: ollamaModel,
		},
	}

	// Create services
	infService := inference.NewService(infConfig)
	summaryService := service.NewSummaryService(store, infService)

	// Get recent sessions with bad summaries
	sessions, err := store.GetRecentSessions(10)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("\nFound %d recent sessions\n", len(sessions))

	// Regenerate summaries for recent sessions
	regenerated := 0
	for _, sess := range sessions {
		fmt.Printf("\n[Session %d] ", sess.ID)

		// Check if session has a summary
		existingSummary, _ := store.GetSummaryBySession(sess.ID)
		if existingSummary != nil {
			fmt.Printf("Existing summary: %.80s...\n", existingSummary.Summary)
			fmt.Printf("Model used: %s\n", existingSummary.ModelUsed)
		}

		// Regenerate
		fmt.Printf("Regenerating summary...\n")
		newSummary, err := summaryService.RegenerateSummary(sess.ID)
		if err != nil {
			fmt.Printf("❌ Error: %v\n", err)
			continue
		}

		fmt.Printf("✅ New summary: %.120s...\n", newSummary.Summary)
		fmt.Printf("Model: %s, Inference time: %dms\n", newSummary.ModelUsed, newSummary.InferenceTimeMs.Int64)
		regenerated++
	}

	fmt.Printf("\n✨ Successfully regenerated %d summaries\n", regenerated)
}
