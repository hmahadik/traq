package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestGetUnassignedEventCount_IncludesShellCommands(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	project, err := store.CreateProject("traq", "#6366f1", "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	// 3 shell commands, 2 unassigned + 1 assigned.
	var assignedID int64
	for i := 0; i < 3; i++ {
		id, err := store.SaveShellCommand(&ShellCommand{
			Timestamp: time.Now().Unix() + int64(i),
			Command:   "echo hi",
			ShellType: "bash",
		})
		if err != nil {
			t.Fatalf("save: %v", err)
		}
		if i == 0 {
			assignedID = id
		}
	}
	if err := store.SetEventProject("shell", assignedID, project.ID, 1.0, "user"); err != nil {
		t.Fatalf("assign: %v", err)
	}

	count, err := store.GetUnassignedEventCount()
	if err != nil {
		t.Fatalf("count: %v", err)
	}
	// Exactly 2 unassigned shell commands should contribute; no other events exist.
	if count != 2 {
		t.Errorf("expected 2 unassigned, got %d", count)
	}
}

func TestDeleteProject_ClearsShellAssignments(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	project, err := store.CreateProject("traq", "#6366f1", "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	id, err := store.SaveShellCommand(&ShellCommand{
		Timestamp: time.Now().Unix(),
		Command:   "ls",
		ShellType: "bash",
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if err := store.SetEventProject("shell", id, project.ID, 1.0, "user"); err != nil {
		t.Fatalf("assign: %v", err)
	}

	if err := store.DeleteProject(project.ID); err != nil {
		t.Fatalf("delete project: %v", err)
	}

	var gotProjectID sql.NullInt64
	var gotSource sql.NullString
	if err := store.db.QueryRow(
		`SELECT project_id, project_source FROM shell_commands WHERE id = ?`, id,
	).Scan(&gotProjectID, &gotSource); err != nil {
		t.Fatalf("select: %v", err)
	}
	if gotProjectID.Valid {
		t.Errorf("expected NULL project_id after project delete, got %+v", gotProjectID)
	}
	if gotSource.String != "unassigned" {
		t.Errorf("source: want unassigned, got %q", gotSource.String)
	}
}

func TestSetEventProject_Shell_AssignsAndUnassigns(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	project, err := store.CreateProject("traq", "#6366f1", "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	id, err := store.SaveShellCommand(&ShellCommand{
		Timestamp:        time.Now().Unix(),
		Command:          "go test ./...",
		ShellType:        "bash",
		WorkingDirectory: sql.NullString{String: "/home/jl/repos/traq", Valid: true},
	})
	if err != nil {
		t.Fatalf("save shell command: %v", err)
	}

	// Assign to project.
	if err := store.SetEventProject("shell", id, project.ID, 1.0, "user"); err != nil {
		t.Fatalf("assign: %v", err)
	}

	var gotProjectID sql.NullInt64
	var gotConf sql.NullFloat64
	var gotSource sql.NullString
	if err := store.db.QueryRow(
		`SELECT project_id, project_confidence, project_source FROM shell_commands WHERE id = ?`, id,
	).Scan(&gotProjectID, &gotConf, &gotSource); err != nil {
		t.Fatalf("select: %v", err)
	}
	if !gotProjectID.Valid || gotProjectID.Int64 != project.ID {
		t.Errorf("project_id: want %d, got %+v", project.ID, gotProjectID)
	}
	if gotConf.Float64 != 1.0 {
		t.Errorf("confidence: want 1.0, got %v", gotConf.Float64)
	}
	if gotSource.String != "user" {
		t.Errorf("source: want user, got %q", gotSource.String)
	}

	// Unassign (projectID == 0 is the documented contract).
	if err := store.SetEventProject("shell", id, 0, 0, ""); err != nil {
		t.Fatalf("unassign: %v", err)
	}
	if err := store.db.QueryRow(
		`SELECT project_id, project_confidence, project_source FROM shell_commands WHERE id = ?`, id,
	).Scan(&gotProjectID, &gotConf, &gotSource); err != nil {
		t.Fatalf("select after unassign: %v", err)
	}
	if gotProjectID.Valid {
		t.Errorf("expected NULL project_id after unassign, got %+v", gotProjectID)
	}
	if gotSource.String != "unassigned" {
		t.Errorf("source after unassign: want unassigned, got %q", gotSource.String)
	}
}
