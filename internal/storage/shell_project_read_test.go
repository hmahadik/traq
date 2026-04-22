package storage

import (
	"testing"
	"time"
)

func TestGetRecentShellCommands_ExposesProjectAssignment(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	project, err := store.CreateProject("traq", "#6366f1", "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	id, err := store.SaveShellCommand(&ShellCommand{
		Timestamp: time.Now().Unix(),
		Command:   "go test ./...",
		ShellType: "bash",
	})
	if err != nil {
		t.Fatalf("save: %v", err)
	}
	if err := store.SetEventProject("shell", id, project.ID, 1.0, "user"); err != nil {
		t.Fatalf("assign: %v", err)
	}

	cmds, err := store.GetRecentShellCommands(10)
	if err != nil {
		t.Fatalf("get recent: %v", err)
	}
	if len(cmds) != 1 {
		t.Fatalf("expected 1 command, got %d", len(cmds))
	}
	got := cmds[0]
	if !got.ProjectID.Valid || got.ProjectID.Int64 != project.ID {
		t.Errorf("ProjectID: want %d, got %+v", project.ID, got.ProjectID)
	}
	if got.ProjectConfidence.Float64 != 1.0 {
		t.Errorf("ProjectConfidence: want 1.0, got %v", got.ProjectConfidence.Float64)
	}
	if got.ProjectSource.String != "user" {
		t.Errorf("ProjectSource: want user, got %q", got.ProjectSource.String)
	}
}
