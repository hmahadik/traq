package service

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/storage"
)

func setupProjectAssignmentTest(t *testing.T) (*ProjectAssignmentService, *storage.Store, func()) {
	t.Helper()

	dir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	store, err := storage.NewStore(filepath.Join(dir, "test.db"))
	if err != nil {
		os.RemoveAll(dir)
		t.Fatalf("NewStore: %v", err)
	}
	svc := NewProjectAssignmentService(store)
	cleanup := func() {
		store.Close()
		os.RemoveAll(dir)
	}
	return svc, store, cleanup
}

func TestExtractEventContext_Shell(t *testing.T) {
	svc, store, cleanup := setupProjectAssignmentTest(t)
	defer cleanup()

	id, err := store.SaveShellCommand(&storage.ShellCommand{
		Timestamp:        time.Now().Unix(),
		Command:          "go test ./...",
		ShellType:        "bash",
		WorkingDirectory: sql.NullString{String: "/home/jl/repos/traq", Valid: true},
	})
	if err != nil {
		t.Fatalf("save shell command: %v", err)
	}

	ctx, err := svc.ExtractEventContext("shell", id)
	if err != nil {
		t.Fatalf("extract: %v", err)
	}
	if ctx == nil {
		t.Fatal("expected non-nil context")
	}
	if ctx.FilePath != "/home/jl/repos/traq" {
		t.Errorf("FilePath: want /home/jl/repos/traq, got %q", ctx.FilePath)
	}
}

// ManualAssign is the end-to-end path the UI uses: it calls SetEventProject,
// then ExtractEventContext, then learnFromAssignment, then AddAssignmentExample.
// Before this change, SetEventProject rejected "shell" and the user saw
// "unknown event type: shell" in a dialog.
func TestManualAssign_Shell_EndToEnd(t *testing.T) {
	svc, store, cleanup := setupProjectAssignmentTest(t)
	defer cleanup()

	project, err := store.CreateProject("traq", "#6366f1", "")
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	id, err := store.SaveShellCommand(&storage.ShellCommand{
		Timestamp:        time.Now().Unix(),
		Command:          "wails dev -tags webkit2_41",
		ShellType:        "bash",
		WorkingDirectory: sql.NullString{String: "/home/jl/repos/traq", Valid: true},
	})
	if err != nil {
		t.Fatalf("save shell command: %v", err)
	}

	if err := svc.ManualAssign("shell", id, project.ID); err != nil {
		t.Fatalf("manual assign: %v", err)
	}

	// The row should now point at the project with source="user".
	var gotProjectID sql.NullInt64
	var gotSource sql.NullString
	if err := store.DB().QueryRow(
		`SELECT project_id, project_source FROM shell_commands WHERE id = ?`, id,
	).Scan(&gotProjectID, &gotSource); err != nil {
		t.Fatalf("select: %v", err)
	}
	if !gotProjectID.Valid || gotProjectID.Int64 != project.ID {
		t.Errorf("project_id: want %d, got %+v", project.ID, gotProjectID)
	}
	if gotSource.String != "user" {
		t.Errorf("source: want user, got %q", gotSource.String)
	}
}
