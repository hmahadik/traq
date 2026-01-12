package service

import (
	"fmt"
	"strings"
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
// Returns results ordered by timestamp (newest first).
func (s *TimelineService) SearchAllDataSources(query string, maxResults int) ([]*SearchResult, error) {
	if query == "" {
		return []*SearchResult{}, nil
	}

	// Normalize query for case-insensitive search
	queryLower := strings.ToLower(query)

	var allResults []*SearchResult

	// Search git commits (message and hash)
	gitResults, err := s.searchGitCommits(queryLower)
	if err != nil {
		return nil, fmt.Errorf("search git commits: %w", err)
	}
	allResults = append(allResults, gitResults...)

	// Search shell commands
	shellResults, err := s.searchShellCommands(queryLower)
	if err != nil {
		return nil, fmt.Errorf("search shell commands: %w", err)
	}
	allResults = append(allResults, shellResults...)

	// Search file events
	fileResults, err := s.searchFileEvents(queryLower)
	if err != nil {
		return nil, fmt.Errorf("search file events: %w", err)
	}
	allResults = append(allResults, fileResults...)

	// Search browser visits
	browserResults, err := s.searchBrowserVisits(queryLower)
	if err != nil {
		return nil, fmt.Errorf("search browser visits: %w", err)
	}
	allResults = append(allResults, browserResults...)

	// Search screenshots
	screenshotResults, err := s.searchScreenshots(queryLower)
	if err != nil {
		return nil, fmt.Errorf("search screenshots: %w", err)
	}
	allResults = append(allResults, screenshotResults...)

	// Sort by timestamp (newest first)
	sortSearchResultsByTimestamp(allResults)

	// Limit results
	if maxResults > 0 && len(allResults) > maxResults {
		allResults = allResults[:maxResults]
	}

	return allResults, nil
}

// searchGitCommits searches git commit messages and hashes.
func (s *TimelineService) searchGitCommits(query string) ([]*SearchResult, error) {
	// Get all git commits (we'll filter in memory for now)
	// In production, this should be a database query with LIKE
	commits, err := s.store.GetAllGitCommits()
	if err != nil {
		return nil, err
	}

	var results []*SearchResult
	for _, commit := range commits {
		message := strings.ToLower(commit.Message)
		hash := strings.ToLower(commit.CommitHash)

		if strings.Contains(message, query) || strings.Contains(hash, query) {
			results = append(results, &SearchResult{
				Type:      "git",
				ID:        commit.ID,
				Timestamp: commit.Timestamp,
				Date:      formatDate(commit.Timestamp),
				Time:      formatTime(commit.Timestamp),
				Summary:   truncate(commit.Message, 80),
				Details:   fmt.Sprintf("Hash: %s", commit.ShortHash),
			})
		}
	}

	return results, nil
}

// searchShellCommands searches shell command text.
func (s *TimelineService) searchShellCommands(query string) ([]*SearchResult, error) {
	commands, err := s.store.GetAllShellCommands()
	if err != nil {
		return nil, err
	}

	var results []*SearchResult
	for _, cmd := range commands {
		command := strings.ToLower(cmd.Command)

		if strings.Contains(command, query) {
			results = append(results, &SearchResult{
				Type:      "shell",
				ID:        cmd.ID,
				Timestamp: cmd.Timestamp,
				Date:      formatDate(cmd.Timestamp),
				Time:      formatTime(cmd.Timestamp),
				Summary:   truncate(cmd.Command, 80),
				Details:   fmt.Sprintf("Shell: %s", cmd.ShellType),
			})
		}
	}

	return results, nil
}

// searchFileEvents searches file names and paths.
func (s *TimelineService) searchFileEvents(query string) ([]*SearchResult, error) {
	events, err := s.store.GetAllFileEvents()
	if err != nil {
		return nil, err
	}

	var results []*SearchResult
	for _, event := range events {
		fileName := strings.ToLower(event.FileName)
		filePath := strings.ToLower(event.FilePath)

		if strings.Contains(fileName, query) || strings.Contains(filePath, query) {
			results = append(results, &SearchResult{
				Type:      "file",
				ID:        event.ID,
				Timestamp: event.Timestamp,
				Date:      formatDate(event.Timestamp),
				Time:      formatTime(event.Timestamp),
				Summary:   event.FileName,
				Details:   fmt.Sprintf("%s: %s", event.EventType, event.Directory),
			})
		}
	}

	return results, nil
}

// searchBrowserVisits searches page titles and URLs.
func (s *TimelineService) searchBrowserVisits(query string) ([]*SearchResult, error) {
	visits, err := s.store.GetAllBrowserVisits()
	if err != nil {
		return nil, err
	}

	var results []*SearchResult
	for _, visit := range visits {
		title := strings.ToLower(visit.Title.String)
		url := strings.ToLower(visit.URL)

		if strings.Contains(title, query) || strings.Contains(url, query) {
			displayTitle := visit.Title.String
			if displayTitle == "" {
				displayTitle = visit.URL
			}

			results = append(results, &SearchResult{
				Type:      "browser",
				ID:        visit.ID,
				Timestamp: visit.Timestamp,
				Date:      formatDate(visit.Timestamp),
				Time:      formatTime(visit.Timestamp),
				Summary:   truncate(displayTitle, 80),
				Details:   visit.Domain,
			})
		}
	}

	return results, nil
}

// searchScreenshots searches window titles and app names.
func (s *TimelineService) searchScreenshots(query string) ([]*SearchResult, error) {
	// Get recent screenshots (last 90 days to avoid loading everything)
	end := time.Now().Unix()
	start := end - (90 * 24 * 60 * 60)

	screenshots, err := s.store.GetScreenshots(start, end)
	if err != nil {
		return nil, err
	}

	var results []*SearchResult
	for _, screenshot := range screenshots {
		windowTitle := strings.ToLower(screenshot.WindowTitle.String)
		appName := strings.ToLower(screenshot.AppName.String)

		if strings.Contains(windowTitle, query) || strings.Contains(appName, query) {
			friendlyAppName := GetFriendlyAppName(screenshot.AppName.String)

			results = append(results, &SearchResult{
				Type:      "screenshot",
				ID:        screenshot.ID,
				Timestamp: screenshot.Timestamp,
				Date:      formatDate(screenshot.Timestamp),
				Time:      formatTime(screenshot.Timestamp),
				Summary:   truncate(screenshot.WindowTitle.String, 80),
				Details:   friendlyAppName,
				AppName:   friendlyAppName,
			})
		}
	}

	return results, nil
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

func sortSearchResultsByTimestamp(results []*SearchResult) {
	// Simple bubble sort (descending by timestamp)
	n := len(results)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if results[j].Timestamp < results[j+1].Timestamp {
				results[j], results[j+1] = results[j+1], results[j]
			}
		}
	}
}
