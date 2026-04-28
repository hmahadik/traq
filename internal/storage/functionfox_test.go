package storage

import (
	"testing"
)

func TestSaveFunctionFoxProjectMapping_InsertAndGet(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	m := &FunctionFoxProjectMapping{
		TraqProject:  "MyProject",
		FFClientID:   "cli-123",
		FFClientName: "ACME Corp",
		FFJobID:      "job-456",
		FFJobName:    "Development",
		FFTaskID:     "task-789",
		FFTaskName:   "Feature Work",
		Enabled:      true,
	}

	id, err := store.SaveFunctionFoxProjectMapping(m)
	if err != nil {
		t.Fatalf("save failed: %v", err)
	}
	if id <= 0 {
		t.Fatalf("expected id > 0, got %d", id)
	}

	got, err := store.GetFunctionFoxProjectMapping("MyProject")
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	if got == nil {
		t.Fatal("expected non-nil mapping")
	}

	if got.TraqProject != "MyProject" {
		t.Errorf("got TraqProject %q, want %q", got.TraqProject, "MyProject")
	}
	if got.FFClientID != "cli-123" {
		t.Errorf("got FFClientID %q, want %q", got.FFClientID, "cli-123")
	}
	if got.FFClientName != "ACME Corp" {
		t.Errorf("got FFClientName %q, want %q", got.FFClientName, "ACME Corp")
	}
	if got.FFJobID != "job-456" {
		t.Errorf("got FFJobID %q, want %q", got.FFJobID, "job-456")
	}
	if got.FFJobName != "Development" {
		t.Errorf("got FFJobName %q, want %q", got.FFJobName, "Development")
	}
	if got.FFTaskID != "task-789" {
		t.Errorf("got FFTaskID %q, want %q", got.FFTaskID, "task-789")
	}
	if got.FFTaskName != "Feature Work" {
		t.Errorf("got FFTaskName %q, want %q", got.FFTaskName, "Feature Work")
	}
	if !got.Enabled {
		t.Error("got Enabled false, want true")
	}
	if got.CreatedAt <= 0 {
		t.Errorf("got CreatedAt %d, want > 0", got.CreatedAt)
	}
	if got.UpdatedAt <= 0 {
		t.Errorf("got UpdatedAt %d, want > 0", got.UpdatedAt)
	}
}

func TestSaveFunctionFoxProjectMapping_Upsert(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	m := &FunctionFoxProjectMapping{
		TraqProject:  "MyProject",
		FFClientID:   "cli-123",
		FFClientName: "ACME Corp",
		FFJobID:      "job-456",
		FFJobName:    "Development",
		FFTaskID:     "task-789",
		FFTaskName:   "Feature Work",
		Enabled:      true,
	}

	id1, err := store.SaveFunctionFoxProjectMapping(m)
	if err != nil {
		t.Fatalf("first save failed: %v", err)
	}

	// Save again with same traq_project but different values
	m.FFClientID = "cli-999"
	m.FFClientName = "XYZ Inc"
	m.FFJobID = "job-999"
	m.FFJobName = "Support"
	m.FFTaskID = "task-999"
	m.FFTaskName = "Bug Fixes"
	m.Enabled = false

	id2, err := store.SaveFunctionFoxProjectMapping(m)
	if err != nil {
		t.Fatalf("second save failed: %v", err)
	}

	// Both should return the same ID (UPSERT)
	if id1 != id2 {
		t.Errorf("expected same ID on upsert: first %d, second %d", id1, id2)
	}

	// Verify only one row exists
	all, err := store.ListFunctionFoxProjectMappings()
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(all) != 1 {
		t.Errorf("expected 1 row after upsert, got %d", len(all))
	}

	// Verify updated values
	got, err := store.GetFunctionFoxProjectMapping("MyProject")
	if err != nil {
		t.Fatalf("get after upsert failed: %v", err)
	}

	if got.FFClientID != "cli-999" {
		t.Errorf("got FFClientID %q, want %q", got.FFClientID, "cli-999")
	}
	if got.FFClientName != "XYZ Inc" {
		t.Errorf("got FFClientName %q, want %q", got.FFClientName, "XYZ Inc")
	}
	if got.FFJobName != "Support" {
		t.Errorf("got FFJobName %q, want %q", got.FFJobName, "Support")
	}
	if got.Enabled {
		t.Error("got Enabled true, want false")
	}
}

func TestListFunctionFoxProjectMappings_OrderedByName(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	// Insert in non-alphabetical order
	mappings := []*FunctionFoxProjectMapping{
		{
			TraqProject:  "Zebra",
			FFClientID:   "cli-z",
			FFClientName: "Z Client",
			FFJobID:      "job-z",
			FFJobName:    "Z Job",
			FFTaskID:     "task-z",
			FFTaskName:   "Z Task",
			Enabled:      true,
		},
		{
			TraqProject:  "Alpha",
			FFClientID:   "cli-a",
			FFClientName: "A Client",
			FFJobID:      "job-a",
			FFJobName:    "A Job",
			FFTaskID:     "task-a",
			FFTaskName:   "A Task",
			Enabled:      true,
		},
		{
			TraqProject:  "Bravo",
			FFClientID:   "cli-b",
			FFClientName: "B Client",
			FFJobID:      "job-b",
			FFJobName:    "B Job",
			FFTaskID:     "task-b",
			FFTaskName:   "B Task",
			Enabled:      false,
		},
	}

	for _, m := range mappings {
		if _, err := store.SaveFunctionFoxProjectMapping(m); err != nil {
			t.Fatalf("save failed: %v", err)
		}
	}

	// List should return in alphabetical order
	got, err := store.ListFunctionFoxProjectMappings()
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}

	if len(got) != 3 {
		t.Fatalf("expected 3 mappings, got %d", len(got))
	}

	expectedOrder := []string{"Alpha", "Bravo", "Zebra"}
	for i, expected := range expectedOrder {
		if got[i].TraqProject != expected {
			t.Errorf("at index %d: got TraqProject %q, want %q", i, got[i].TraqProject, expected)
		}
	}
}

func TestDeleteFunctionFoxProjectMapping_RemovesRow(t *testing.T) {
	store := NewInMemoryTestStore(t)
	defer store.Close()

	m := &FunctionFoxProjectMapping{
		TraqProject:  "ToDelete",
		FFClientID:   "cli-del",
		FFClientName: "Delete Client",
		FFJobID:      "job-del",
		FFJobName:    "Delete Job",
		FFTaskID:     "task-del",
		FFTaskName:   "Delete Task",
		Enabled:      true,
	}

	if _, err := store.SaveFunctionFoxProjectMapping(m); err != nil {
		t.Fatalf("save failed: %v", err)
	}

	got, err := store.GetFunctionFoxProjectMapping("ToDelete")
	if err != nil {
		t.Fatalf("get after save failed: %v", err)
	}
	if got == nil {
		t.Fatal("expected mapping to exist after save")
	}

	// Delete it
	if err := store.DeleteFunctionFoxProjectMapping("ToDelete"); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	// Verify it's gone
	got, err = store.GetFunctionFoxProjectMapping("ToDelete")
	if err != nil {
		t.Fatalf("get after delete failed: %v", err)
	}
	if got != nil {
		t.Fatal("expected mapping to be deleted, but it still exists")
	}
}
