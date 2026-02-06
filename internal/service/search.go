package service

import (
	"fmt"
	"sort"
	"time"
)

// SearchResult represents a unified search result across all data sources.
type SearchResult struct {
	Type      string `json:"type"`      // "git", "shell", "file", "browser", "screenshot"
	ID        int64  `json:"id"`        // ID of the matched item
	Timestamp int64  `json:"timestamp"` // Unix timestamp
	Date      string `json:"date"`      // YYYY-MM-DD format for navigation
	Time      string `json:"time"`      // HH:MM:SS format for display
	Summary   string `json:"summary"`   // What matched (main text)
	Details   string `json:"details"`   // Additional context
	AppName   string `json:"appName"`   // Relevant for screenshots
}

// SearchAllDataSources searches across all event types for a query string.
// Returns results ordered by timestamp (newest first), limited to maxResults.
// All filtering is done at the SQL level using LIKE queries.
func (s *TimelineService) SearchAllDataSources(query string, maxResults int) ([]*SearchResult, error) {
	if query == "" {
		return []*SearchResult{}, nil
	}

	if maxResults <= 0 {
		maxResults = 50
	}

	var allResults []*SearchResult

	// Search git commits (message and hash)
	gitCommits, err := s.store.SearchGitCommits(query, maxResults)
	if err != nil {
		return nil, fmt.Errorf("search git commits: %w", err)
	}
	for _, commit := range gitCommits {
		allResults = append(allResults, &SearchResult{
			Type:      "git",
			ID:        commit.ID,
			Timestamp: commit.Timestamp,
			Date:      formatDate(commit.Timestamp),
			Time:      formatTime(commit.Timestamp),
			Summary:   truncate(commit.Message, 80),
			Details:   fmt.Sprintf("Hash: %s", commit.ShortHash),
		})
	}

	// Search shell commands
	shellCmds, err := s.store.SearchShellCommands(query, maxResults)
	if err != nil {
		return nil, fmt.Errorf("search shell commands: %w", err)
	}
	for _, cmd := range shellCmds {
		allResults = append(allResults, &SearchResult{
			Type:      "shell",
			ID:        cmd.ID,
			Timestamp: cmd.Timestamp,
			Date:      formatDate(cmd.Timestamp),
			Time:      formatTime(cmd.Timestamp),
			Summary:   truncate(cmd.Command, 80),
			Details:   fmt.Sprintf("Shell: %s", cmd.ShellType),
		})
	}

	// Search file events
	fileEvents, err := s.store.SearchFileEvents(query, maxResults)
	if err != nil {
		return nil, fmt.Errorf("search file events: %w", err)
	}
	for _, event := range fileEvents {
		allResults = append(allResults, &SearchResult{
			Type:      "file",
			ID:        event.ID,
			Timestamp: event.Timestamp,
			Date:      formatDate(event.Timestamp),
			Time:      formatTime(event.Timestamp),
			Summary:   event.FileName,
			Details:   fmt.Sprintf("%s: %s", event.EventType, event.Directory),
		})
	}

	// Search browser visits
	browserVisits, err := s.store.SearchBrowserVisits(query, maxResults)
	if err != nil {
		return nil, fmt.Errorf("search browser visits: %w", err)
	}
	for _, visit := range browserVisits {
		displayTitle := visit.Title.String
		if displayTitle == "" {
			displayTitle = visit.URL
		}
		allResults = append(allResults, &SearchResult{
			Type:      "browser",
			ID:        visit.ID,
			Timestamp: visit.Timestamp,
			Date:      formatDate(visit.Timestamp),
			Time:      formatTime(visit.Timestamp),
			Summary:   truncate(displayTitle, 80),
			Details:   visit.Domain,
		})
	}

	// Search screenshots
	screenshots, err := s.store.SearchScreenshots(query, maxResults)
	if err != nil {
		return nil, fmt.Errorf("search screenshots: %w", err)
	}
	for _, sc := range screenshots {
		friendlyAppName := GetFriendlyAppName(sc.AppName.String)
		allResults = append(allResults, &SearchResult{
			Type:      "screenshot",
			ID:        sc.ID,
			Timestamp: sc.Timestamp,
			Date:      formatDate(sc.Timestamp),
			Time:      formatTime(sc.Timestamp),
			Summary:   truncate(sc.WindowTitle.String, 80),
			Details:   friendlyAppName,
			AppName:   friendlyAppName,
		})
	}

	// Sort by timestamp (newest first)
	sort.Slice(allResults, func(i, j int) bool {
		return allResults[i].Timestamp > allResults[j].Timestamp
	})

	// Limit results
	if len(allResults) > maxResults {
		allResults = allResults[:maxResults]
	}

	return allResults, nil
}

// Helper functions

func formatDate(timestamp int64) string {
	t := time.Unix(timestamp, 0)
	return t.Format("2006-01-02")
}

func formatTime(timestamp int64) string {
	t := time.Unix(timestamp, 0)
	return t.Format("15:04:05")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
