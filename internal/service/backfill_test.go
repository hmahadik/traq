package service

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func TestBackfill_AssignsBrowserVisitsByDomain(t *testing.T) {
	dir, err := os.MkdirTemp("", "traq-backfill-*")
	if err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	defer os.RemoveAll(dir)

	store, err := storage.NewStore(filepath.Join(dir, "test.db"))
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	defer store.Close()

	projects := NewProjectAssignmentService(store)
	reports := NewReportsService(store, nil, nil, projects)
	projects.SetReportsService(reports)

	proj, err := store.CreateProject("Acme", "#6366f1", "")
	if err != nil {
		t.Fatalf("CreateProject: %v", err)
	}

	// refreshPatternCache debounces refreshes within 1s of the previous load
	// (NewProjectAssignmentService loads on construction). Sleep so the
	// CreateProjectRule refresh below isn't a no-op.
	time.Sleep(1100 * time.Millisecond)

	if _, err := projects.CreateProjectRule(ProjectRuleInput{
		ProjectID:    proj.ID,
		PatternType:  "domain",
		PatternValue: "acme.com",
		MatchType:    "contains",
		Weight:       1.0,
	}); err != nil {
		t.Fatalf("CreateProjectRule: %v", err)
	}

	now := time.Now().Unix()
	if _, err := store.DB().Exec(`
		INSERT INTO browser_history (timestamp, url, title, domain, browser)
		VALUES (?, ?, ?, ?, ?)`,
		now, "https://docs.acme.com/api", "API — Acme", "docs.acme.com", "chrome",
	); err != nil {
		t.Fatalf("insert browser_history: %v", err)
	}

	backfill := NewBackfillService(store, projects, reports)
	res, err := backfill.BackfillProjects(
		time.Unix(now-3600, 0).Format("2006-01-02"),
		time.Unix(now+3600, 0).Format("2006-01-02"),
		0.3,
	)
	if err != nil {
		t.Fatalf("BackfillProjects: %v", err)
	}
	if res.AutoAssigned < 1 {
		t.Errorf("expected >=1 browser visit assigned, got %d", res.AutoAssigned)
	}

	var pid int64
	if err := store.DB().QueryRow(
		`SELECT COALESCE(project_id, 0) FROM browser_history WHERE domain = 'docs.acme.com'`,
	).Scan(&pid); err != nil {
		t.Fatalf("select project_id: %v", err)
	}
	if pid != proj.ID {
		t.Errorf("browser_history project_id = %d, want %d", pid, proj.ID)
	}
}
