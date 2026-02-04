package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"traq/internal/service"
	"traq/internal/storage"
)

func main() {
	homeDir, _ := os.UserHomeDir()
	dbPath := filepath.Join(homeDir, ".local", "share", "traq", "data.db")
	
	store, err := storage.NewStore(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()

	svc := service.NewTimelineService(store)
	
	// 2026 dates (correct year!)
	for _, date := range []string{"2026-01-26", "2026-01-27", "2026-01-28"} {
		data, err := svc.GetTimelineGridData(date)
		if err != nil {
			fmt.Printf("%s: error - %v\n", date, err)
			continue
		}
		
		focusCount := 0
		for _, apps := range data.HourlyGrid {
			for _, blocks := range apps {
				focusCount += len(blocks)
			}
		}
		
		afkCount := 0
		for _, blocks := range data.AFKBlocks {
			afkCount += len(blocks)
		}
		
		fmt.Printf("%s: focus=%d, afk=%d, activityStates=%d\n", date, focusCount, afkCount, len(data.ActivityStates))
		
		if len(data.ActivityStates) > 0 {
			counts := map[string]int{}
			for _, s := range data.ActivityStates {
				counts[s.State]++
			}
			fmt.Printf("  States: %+v\n", counts)
			
			// Show a few examples
			shown := map[string]int{}
			for _, s := range data.ActivityStates {
				if shown[s.State] < 2 {
					b, _ := json.MarshalIndent(s, "    ", "  ")
					fmt.Printf("  %s example:\n    %s\n", s.State, string(b))
					shown[s.State]++
				}
			}
		}
	}
}
