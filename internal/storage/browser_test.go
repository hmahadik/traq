package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestSaveBrowserVisit(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	visit := &BrowserVisit{
		Timestamp: time.Now().Unix(),
		URL:       "https://example.com/page",
		Title:     sql.NullString{String: "Example Page", Valid: true},
		Domain:    "example.com",
		Browser:   "chrome",
	}

	id, err := store.SaveBrowserVisit(visit)
	if err != nil {
		t.Fatalf("failed to save browser visit: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetBrowserVisitsBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sessionID, _ := store.CreateSession(time.Now().Unix())

	for i := 0; i < 3; i++ {
		visit := &BrowserVisit{
			Timestamp: time.Now().Unix() + int64(i),
			URL:       "https://example.com/page",
			Domain:    "example.com",
			Browser:   "chrome",
			SessionID: sql.NullInt64{Int64: sessionID, Valid: true},
		}
		store.SaveBrowserVisit(visit)
	}

	visits, err := store.GetBrowserVisitsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get visits: %v", err)
	}
	if len(visits) != 3 {
		t.Errorf("expected 3 visits, got %d", len(visits))
	}
}

func TestGetBrowserVisitsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		visit := &BrowserVisit{
			Timestamp: now + int64(i*60),
			URL:       "https://example.com/page",
			Domain:    "example.com",
			Browser:   "chrome",
		}
		store.SaveBrowserVisit(visit)
	}

	visits, err := store.GetBrowserVisitsByTimeRange(now, now+180)
	if err != nil {
		t.Fatalf("failed to get visits: %v", err)
	}
	if len(visits) != 4 {
		t.Errorf("expected 4 visits, got %d", len(visits))
	}
}

func TestGetTopDomains(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	// Create visits for different domains
	domains := []string{"example.com", "example.com", "example.com", "google.com", "google.com", "github.com"}
	for i, domain := range domains {
		visit := &BrowserVisit{
			Timestamp: now + int64(i),
			URL:       "https://" + domain + "/page",
			Domain:    domain,
			Browser:   "chrome",
		}
		store.SaveBrowserVisit(visit)
	}

	topDomains, err := store.GetTopDomains(now, now+100, 2)
	if err != nil {
		t.Fatalf("failed to get top domains: %v", err)
	}
	if len(topDomains) != 2 {
		t.Errorf("expected 2 domains, got %d", len(topDomains))
	}
	if topDomains[0].Domain != "example.com" {
		t.Errorf("expected example.com first, got %s", topDomains[0].Domain)
	}
}

func TestVisitExists(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()
	visit := &BrowserVisit{
		Timestamp: now,
		URL:       "https://example.com/unique",
		Domain:    "example.com",
		Browser:   "chrome",
	}
	store.SaveBrowserVisit(visit)

	exists, err := store.VisitExists(now, "https://example.com/unique", "chrome")
	if err != nil {
		t.Fatalf("failed to check visit exists: %v", err)
	}
	if !exists {
		t.Error("expected visit to exist")
	}

	exists, _ = store.VisitExists(now, "https://nonexistent.com", "chrome")
	if exists {
		t.Error("expected visit not to exist")
	}
}

func TestGetLastVisitTimestamp(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// No visits
	ts, err := store.GetLastVisitTimestamp("chrome")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if ts != 0 {
		t.Errorf("expected 0, got %d", ts)
	}

	now := time.Now().Unix()
	visit := &BrowserVisit{
		Timestamp: now,
		URL:       "https://example.com",
		Domain:    "example.com",
		Browser:   "chrome",
	}
	store.SaveBrowserVisit(visit)

	ts, err = store.GetLastVisitTimestamp("chrome")
	if err != nil {
		t.Fatalf("failed to get last timestamp: %v", err)
	}
	if ts != now {
		t.Errorf("expected %d, got %d", now, ts)
	}
}

func TestCountBrowserVisits(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 3; i++ {
		visit := &BrowserVisit{
			Timestamp: time.Now().Unix() + int64(i),
			URL:       "https://example.com",
			Domain:    "example.com",
			Browser:   "chrome",
		}
		store.SaveBrowserVisit(visit)
	}

	count, err := store.CountBrowserVisits()
	if err != nil {
		t.Fatalf("failed to count visits: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestCountBrowserVisitsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		visit := &BrowserVisit{
			Timestamp: now + int64(i*60),
			URL:       "https://example.com",
			Domain:    "example.com",
			Browser:   "chrome",
		}
		store.SaveBrowserVisit(visit)
	}

	count, err := store.CountBrowserVisitsByTimeRange(now, now+120)
	if err != nil {
		t.Fatalf("failed to count visits: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestCountUniqueDomainsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	domains := []string{"example.com", "google.com", "github.com", "example.com"}
	for i, domain := range domains {
		visit := &BrowserVisit{
			Timestamp: now + int64(i),
			URL:       "https://" + domain,
			Domain:    domain,
			Browser:   "chrome",
		}
		store.SaveBrowserVisit(visit)
	}

	count, err := store.CountUniqueDomainsByTimeRange(now, now+10)
	if err != nil {
		t.Fatalf("failed to count domains: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3 unique domains, got %d", count)
	}
}
