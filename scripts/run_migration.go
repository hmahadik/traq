//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

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

	// Check current version
	currentVersion, err := store.GetSchemaVersion()
	if err != nil {
		log.Printf("Error getting schema version: %v", err)
	}
	fmt.Printf("Current schema version: %d\n", currentVersion)

	// Run migration
	fmt.Println("Running migrations...")
	if err := store.Migrate(); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	// Check new version
	newVersion, err := store.GetSchemaVersion()
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("New schema version: %d\n", newVersion)
	fmt.Println("✅ Migration complete!")
}
