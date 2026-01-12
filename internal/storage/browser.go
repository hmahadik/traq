package storage

import (
	"database/sql"
	"fmt"
)

// SaveBrowserVisit saves a browser visit to the database.
func (s *Store) SaveBrowserVisit(visit *BrowserVisit) (int64, error) {
	result, err := s.db.Exec(`
		INSERT INTO browser_history (
			timestamp, url, title, domain, browser,
			visit_duration_seconds, transition_type, session_id
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		visit.Timestamp, visit.URL, visit.Title, visit.Domain, visit.Browser,
		visit.VisitDurationSeconds, visit.TransitionType, visit.SessionID,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to insert browser visit: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get last insert ID: %w", err)
	}

	return id, nil
}

// GetBrowserVisitsBySession retrieves all browser visits for a session.
func (s *Store) GetBrowserVisitsBySession(sessionID int64) ([]*BrowserVisit, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, url, title, domain, browser,
		       visit_duration_seconds, transition_type, session_id, created_at
		FROM browser_history
		WHERE session_id = ?
		ORDER BY timestamp ASC`, sessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to query browser visits: %w", err)
	}
	defer rows.Close()

	return scanBrowserVisits(rows)
}

// GetBrowserVisitsByTimeRange retrieves browser visits within a time range.
func (s *Store) GetBrowserVisitsByTimeRange(start, end int64) ([]*BrowserVisit, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, url, title, domain, browser,
		       visit_duration_seconds, transition_type, session_id, created_at
		FROM browser_history
		WHERE timestamp >= ? AND timestamp <= ?
		ORDER BY timestamp ASC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query browser visits by time: %w", err)
	}
	defer rows.Close()

	return scanBrowserVisits(rows)
}

// GetTopDomains returns the top N domains by visit count.
func (s *Store) GetTopDomains(start, end int64, limit int) ([]struct {
	Domain     string
	VisitCount int64
}, error) {
	rows, err := s.db.Query(`
		SELECT domain, COUNT(*) as visit_count
		FROM browser_history
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY domain
		ORDER BY visit_count DESC
		LIMIT ?`, start, end, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query top domains: %w", err)
	}
	defer rows.Close()

	var domains []struct {
		Domain     string
		VisitCount int64
	}
	for rows.Next() {
		var d struct {
			Domain     string
			VisitCount int64
		}
		if err := rows.Scan(&d.Domain, &d.VisitCount); err != nil {
			return nil, fmt.Errorf("failed to scan top domains: %w", err)
		}
		domains = append(domains, d)
	}
	return domains, rows.Err()
}

// GetDomainStats returns visit statistics grouped by domain.
func (s *Store) GetDomainStats(start, end int64) (map[string]int64, error) {
	rows, err := s.db.Query(`
		SELECT domain, COUNT(*) as count
		FROM browser_history
		WHERE timestamp >= ? AND timestamp <= ?
		GROUP BY domain
		ORDER BY count DESC`, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to query domain stats: %w", err)
	}
	defer rows.Close()

	stats := make(map[string]int64)
	for rows.Next() {
		var domain string
		var count int64
		if err := rows.Scan(&domain, &count); err != nil {
			return nil, fmt.Errorf("failed to scan domain stats: %w", err)
		}
		stats[domain] = count
	}
	return stats, rows.Err()
}

// VisitExists checks if a visit with the given timestamp and URL already exists.
func (s *Store) VisitExists(timestamp int64, url string, browser string) (bool, error) {
	var exists bool
	err := s.db.QueryRow(`
		SELECT EXISTS(SELECT 1 FROM browser_history WHERE timestamp = ? AND url = ? AND browser = ?)`,
		timestamp, url, browser).Scan(&exists)
	return exists, err
}

// GetLastVisitTimestamp returns the most recent visit timestamp for a browser.
func (s *Store) GetLastVisitTimestamp(browser string) (int64, error) {
	var timestamp sql.NullInt64
	err := s.db.QueryRow(`
		SELECT MAX(timestamp) FROM browser_history WHERE browser = ?`, browser).Scan(&timestamp)
	if err != nil {
		return 0, err
	}
	if !timestamp.Valid {
		return 0, nil
	}
	return timestamp.Int64, nil
}

// CountBrowserVisits returns the total number of browser visits.
func (s *Store) CountBrowserVisits() (int64, error) {
	var count int64
	err := s.db.QueryRow("SELECT COUNT(*) FROM browser_history").Scan(&count)
	return count, err
}

// CountBrowserVisitsByTimeRange returns the count of visits in a time range.
func (s *Store) CountBrowserVisitsByTimeRange(start, end int64) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(*) FROM browser_history
		WHERE timestamp >= ? AND timestamp <= ?`, start, end).Scan(&count)
	return count, err
}

// GetAllBrowserVisits retrieves all browser visits (for search).
func (s *Store) GetAllBrowserVisits() ([]*BrowserVisit, error) {
	rows, err := s.db.Query(`
		SELECT id, timestamp, url, title, domain, browser, visit_duration_seconds,
		       transition_type, session_id, created_at
		FROM browser_history
		ORDER BY timestamp DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query all browser visits: %w", err)
	}
	defer rows.Close()

	return scanBrowserVisits(rows)
}

// CountUniqueDomainsByTimeRange returns the count of unique domains in a time range.
func (s *Store) CountUniqueDomainsByTimeRange(start, end int64) (int64, error) {
	var count int64
	err := s.db.QueryRow(`
		SELECT COUNT(DISTINCT domain) FROM browser_history
		WHERE timestamp >= ? AND timestamp <= ?`, start, end).Scan(&count)
	return count, err
}

func scanBrowserVisits(rows *sql.Rows) ([]*BrowserVisit, error) {
	var visits []*BrowserVisit
	for rows.Next() {
		visit := &BrowserVisit{}
		err := rows.Scan(
			&visit.ID, &visit.Timestamp, &visit.URL, &visit.Title, &visit.Domain, &visit.Browser,
			&visit.VisitDurationSeconds, &visit.TransitionType, &visit.SessionID, &visit.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan browser visit: %w", err)
		}
		visits = append(visits, visit)
	}
	return visits, rows.Err()
}
