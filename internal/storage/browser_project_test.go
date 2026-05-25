package storage

import (
	"testing"
	"time"
)

func TestSetEventProject_BrowserVisit(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Acme", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	res, err := store.DB().Exec(`
		INSERT INTO browser_history (timestamp, url, title, domain, browser)
		VALUES (?, ?, ?, ?, ?)`,
		time.Now().Unix(), "https://docs.acme.com/x", "X — Acme Docs", "docs.acme.com", "chrome",
	)
	if err != nil {
		t.Fatal(err)
	}
	visitID, _ := res.LastInsertId()

	if err := store.SetEventProject("browser", visitID, proj.ID, 0.9, "rule"); err != nil {
		t.Fatalf("SetEventProject(browser) failed: %v", err)
	}

	var pid int64
	var conf float64
	var src string
	err = store.DB().QueryRow(`
		SELECT project_id, project_confidence, project_source FROM browser_history WHERE id = ?`,
		visitID,
	).Scan(&pid, &conf, &src)
	if err != nil {
		t.Fatal(err)
	}

	if pid != proj.ID || conf != 0.9 || src != "rule" {
		t.Errorf("got project_id=%d conf=%.2f src=%q; want %d 0.90 rule", pid, conf, src, proj.ID)
	}
}
