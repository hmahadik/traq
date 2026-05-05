package storage

import (
	"testing"
)

func TestSetAISessionProject_Direct(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	sess := &AISession{
		ID:           "claude-abc123",
		Tool:         "claude",
		ProjectDir:   "/home/jl/repos/traq",
		FilePath:     "/home/jl/.claude/sessions/abc.jsonl",
		StartedAt:    100,
		LastEventAt:  200,
		EventCount:   5,
		SourceOffset: 0,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}

	if err := store.SetAISessionProject(sess.ID, proj.ID, 0.95, "rule"); err != nil {
		t.Fatalf("SetAISessionProject: %v", err)
	}

	got, err := store.GetAISessionByID(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProjectID.Valid || got.ProjectID.Int64 != proj.ID {
		t.Errorf("ProjectID = %v, want %d", got.ProjectID, proj.ID)
	}
	if !got.ProjectConfidence.Valid || got.ProjectConfidence.Float64 != 0.95 {
		t.Errorf("ProjectConfidence = %v, want 0.95", got.ProjectConfidence)
	}
	if !got.ProjectSource.Valid || got.ProjectSource.String != "rule" {
		t.Errorf("ProjectSource = %v, want rule", got.ProjectSource)
	}
}

func TestSetEventProject_AI_ResolvesToSession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	proj, err := store.CreateProject("Traq", "#6366f1", "")
	if err != nil {
		t.Fatal(err)
	}

	sess := &AISession{
		ID:          "claude-xyz",
		Tool:        "claude",
		ProjectDir:  "/home/jl/repos/traq",
		StartedAt:   100,
		LastEventAt: 200,
		EventCount:  1,
	}
	if err := store.UpsertAISession(sess); err != nil {
		t.Fatal(err)
	}

	res, err := store.DB().Exec(`
		INSERT INTO ai_events (session_id, tool, kind, timestamp, project_dir)
		VALUES (?, 'claude', 'message', 150, '/home/jl/repos/traq')`,
		sess.ID,
	)
	if err != nil {
		t.Fatal(err)
	}
	eventID, _ := res.LastInsertId()

	// Manual-assign path: SetEventProject("ai", <ai_events.id>, ...) attributes the SESSION.
	if err := store.SetEventProject("ai", eventID, proj.ID, 0.9, "user"); err != nil {
		t.Fatalf("SetEventProject(ai): %v", err)
	}

	got, err := store.GetAISessionByID(sess.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.ProjectID.Valid || got.ProjectID.Int64 != proj.ID {
		t.Errorf("session ProjectID = %v, want %d (assignment must propagate to session)", got.ProjectID, proj.ID)
	}
}
