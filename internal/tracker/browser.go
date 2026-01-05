package tracker

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"

	// SQLite driver for reading browser databases
	_ "github.com/mattn/go-sqlite3"
)

// BrowserTracker tracks browser history from supported browsers.
type BrowserTracker struct {
	platform       platform.Platform
	store          *storage.Store
	checkpointFile string
	browsers       []string // Enabled browsers
}

// BrowserCheckpoint stores the last read timestamp for each browser.
type BrowserCheckpoint struct {
	LastTimestamps map[string]int64 `json:"last_timestamps"` // browser -> timestamp
}

// NewBrowserTracker creates a new BrowserTracker.
func NewBrowserTracker(p platform.Platform, store *storage.Store, dataDir string) *BrowserTracker {
	return &BrowserTracker{
		platform:       p,
		store:          store,
		checkpointFile: filepath.Join(dataDir, "browser_checkpoint.json"),
		browsers:       []string{"chrome", "firefox", "chromium", "brave", "edge"},
	}
}

// SetEnabledBrowsers sets which browsers to track.
func (t *BrowserTracker) SetEnabledBrowsers(browsers []string) {
	t.browsers = browsers
}

// Poll reads new browser history entries.
func (t *BrowserTracker) Poll(sessionID int64) ([]*storage.BrowserVisit, error) {
	checkpoint, err := t.loadCheckpoint()
	if err != nil {
		checkpoint = &BrowserCheckpoint{LastTimestamps: make(map[string]int64)}
	}

	browserPaths := t.platform.GetBrowserHistoryPaths()
	var allVisits []*storage.BrowserVisit

	for _, browser := range t.browsers {
		histPath, ok := browserPaths[browser]
		if !ok || histPath == "" {
			continue
		}

		// Check if history file exists
		if _, err := os.Stat(histPath); os.IsNotExist(err) {
			continue
		}

		lastTimestamp := checkpoint.LastTimestamps[browser]
		visits, newTimestamp, err := t.readBrowserHistory(browser, histPath, lastTimestamp, sessionID)
		if err != nil {
			continue // Log but continue with other browsers
		}

		if len(visits) > 0 {
			// Save visits
			for _, visit := range visits {
				// Check for duplicate
				exists, _ := t.store.VisitExists(visit.Timestamp, visit.URL, visit.Browser)
				if exists {
					continue
				}

				id, err := t.store.SaveBrowserVisit(visit)
				if err != nil {
					continue
				}
				visit.ID = id
				allVisits = append(allVisits, visit)
			}

			// Update checkpoint
			if newTimestamp > checkpoint.LastTimestamps[browser] {
				checkpoint.LastTimestamps[browser] = newTimestamp
			}
		}
	}

	t.saveCheckpoint(checkpoint)

	return allVisits, nil
}

// readBrowserHistory reads history from a browser's database.
func (t *BrowserTracker) readBrowserHistory(browser, histPath string, sinceTimestamp, sessionID int64) ([]*storage.BrowserVisit, int64, error) {
	// Copy the history file to a temp location to avoid locking issues
	tempFile, err := t.copyHistoryFile(histPath)
	if err != nil {
		return nil, sinceTimestamp, fmt.Errorf("failed to copy history file: %w", err)
	}
	defer os.Remove(tempFile)

	db, err := sql.Open("sqlite3", tempFile+"?mode=ro")
	if err != nil {
		return nil, sinceTimestamp, fmt.Errorf("failed to open history database: %w", err)
	}
	defer db.Close()

	var visits []*storage.BrowserVisit
	var maxTimestamp int64 = sinceTimestamp

	switch browser {
	case "chrome", "chromium", "brave", "edge":
		visits, maxTimestamp, err = t.readChromiumHistory(db, browser, sinceTimestamp, sessionID)
	case "firefox":
		visits, maxTimestamp, err = t.readFirefoxHistory(db, browser, sinceTimestamp, sessionID)
	}

	return visits, maxTimestamp, err
}

// readChromiumHistory reads history from Chrome/Chromium-based browsers.
func (t *BrowserTracker) readChromiumHistory(db *sql.DB, browser string, sinceTimestamp, sessionID int64) ([]*storage.BrowserVisit, int64, error) {
	// Chrome stores timestamps as microseconds since 1601-01-01
	// Convert our Unix timestamp to Chrome timestamp
	chromeEpochOffset := int64(11644473600000000) // Microseconds from 1601 to 1970
	sinceChrome := sinceTimestamp*1000000 + chromeEpochOffset

	query := `
		SELECT
			u.url,
			u.title,
			v.visit_time,
			v.visit_duration
		FROM urls u
		JOIN visits v ON u.id = v.url
		WHERE v.visit_time > ?
		ORDER BY v.visit_time ASC
		LIMIT 1000
	`

	rows, err := db.Query(query, sinceChrome)
	if err != nil {
		return nil, sinceTimestamp, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var visits []*storage.BrowserVisit
	var maxTimestamp int64 = sinceTimestamp

	for rows.Next() {
		var visitURL, title string
		var visitTime, duration int64

		if err := rows.Scan(&visitURL, &title, &visitTime, &duration); err != nil {
			continue
		}

		// Convert Chrome timestamp to Unix timestamp
		unixTimestamp := (visitTime - chromeEpochOffset) / 1000000
		if unixTimestamp > maxTimestamp {
			maxTimestamp = unixTimestamp
		}

		// Extract domain from URL
		domain := extractDomain(visitURL)

		visits = append(visits, &storage.BrowserVisit{
			Timestamp:            unixTimestamp,
			URL:                  visitURL,
			Title:                sql.NullString{String: title, Valid: title != ""},
			Domain:               domain,
			Browser:              browser,
			VisitDurationSeconds: sql.NullInt64{Int64: duration / 1000000, Valid: duration > 0},
			SessionID:            sql.NullInt64{Int64: sessionID, Valid: sessionID > 0},
		})
	}

	return visits, maxTimestamp, nil
}

// readFirefoxHistory reads history from Firefox.
func (t *BrowserTracker) readFirefoxHistory(db *sql.DB, browser string, sinceTimestamp, sessionID int64) ([]*storage.BrowserVisit, int64, error) {
	// Firefox stores timestamps as microseconds since Unix epoch
	sinceMicro := sinceTimestamp * 1000000

	query := `
		SELECT
			p.url,
			p.title,
			h.visit_date
		FROM moz_places p
		JOIN moz_historyvisits h ON p.id = h.place_id
		WHERE h.visit_date > ?
		ORDER BY h.visit_date ASC
		LIMIT 1000
	`

	rows, err := db.Query(query, sinceMicro)
	if err != nil {
		return nil, sinceTimestamp, fmt.Errorf("query failed: %w", err)
	}
	defer rows.Close()

	var visits []*storage.BrowserVisit
	var maxTimestamp int64 = sinceTimestamp

	for rows.Next() {
		var visitURL string
		var title sql.NullString
		var visitDate int64

		if err := rows.Scan(&visitURL, &title, &visitDate); err != nil {
			continue
		}

		// Convert microseconds to seconds
		unixTimestamp := visitDate / 1000000
		if unixTimestamp > maxTimestamp {
			maxTimestamp = unixTimestamp
		}

		// Extract domain from URL
		domain := extractDomain(visitURL)

		visits = append(visits, &storage.BrowserVisit{
			Timestamp: unixTimestamp,
			URL:       visitURL,
			Title:     title,
			Domain:    domain,
			Browser:   browser,
			SessionID: sql.NullInt64{Int64: sessionID, Valid: sessionID > 0},
		})
	}

	return visits, maxTimestamp, nil
}

// copyHistoryFile copies a browser history file to temp location.
func (t *BrowserTracker) copyHistoryFile(src string) (string, error) {
	tempFile, err := os.CreateTemp("", "browser_history_*.sqlite")
	if err != nil {
		return "", err
	}
	tempPath := tempFile.Name()
	tempFile.Close()

	srcData, err := os.ReadFile(src)
	if err != nil {
		os.Remove(tempPath)
		return "", err
	}

	if err := os.WriteFile(tempPath, srcData, 0644); err != nil {
		os.Remove(tempPath)
		return "", err
	}

	return tempPath, nil
}

func (t *BrowserTracker) loadCheckpoint() (*BrowserCheckpoint, error) {
	data, err := os.ReadFile(t.checkpointFile)
	if err != nil {
		return nil, err
	}

	var checkpoint BrowserCheckpoint
	if err := json.Unmarshal(data, &checkpoint); err != nil {
		return nil, err
	}

	return &checkpoint, nil
}

func (t *BrowserTracker) saveCheckpoint(checkpoint *BrowserCheckpoint) error {
	data, err := json.Marshal(checkpoint)
	if err != nil {
		return err
	}

	dir := filepath.Dir(t.checkpointFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	return os.WriteFile(t.checkpointFile, data, 0644)
}

// Reset clears the checkpoint file.
func (t *BrowserTracker) Reset() error {
	return os.Remove(t.checkpointFile)
}

// GetRecentVisits returns recent browser visits.
func (t *BrowserTracker) GetRecentVisits(limit int) ([]*storage.BrowserVisit, error) {
	// Get visits from all time
	end := time.Now().Unix()
	return t.store.GetBrowserVisitsByTimeRange(0, end)
}

// GetVisitsForSession returns visits for a specific session.
func (t *BrowserTracker) GetVisitsForSession(sessionID int64) ([]*storage.BrowserVisit, error) {
	return t.store.GetBrowserVisitsBySession(sessionID)
}

// extractDomain extracts the domain from a URL.
func extractDomain(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return u.Host
}

// GetAvailableBrowsers returns browsers that have history files available.
func (t *BrowserTracker) GetAvailableBrowsers() []string {
	browserPaths := t.platform.GetBrowserHistoryPaths()
	var available []string

	for browser, path := range browserPaths {
		if path != "" {
			if _, err := os.Stat(path); err == nil {
				available = append(available, browser)
			}
		}
	}

	return available
}
