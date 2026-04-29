package service

import (
	"testing"
	"time"

	"traq/internal/storage"
)

func TestAutoDiscoverProjects_NamesByRepoBasename(t *testing.T) {
	svc, store, cleanup := setupProjectAssignmentTest(t)
	defer cleanup()

	// AutoDiscoverProjects requires a reports service for DetectProjectFromGitRepo.
	reports := NewReportsService(store, nil, nil, svc)
	svc.SetReportsService(reports)

	repoID, err := store.SaveGitRepository(&storage.GitRepository{
		Path: "/home/jl/repos/synaptics-sl261",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.DB().Exec(`
		INSERT INTO git_commits (repository_id, commit_hash, short_hash, message, message_subject, author_name, timestamp)
		VALUES (?, 'a1b2c3d4', 'a1b2c3d', 'msg', 'msg', 'jl', ?)`,
		repoID, time.Now().Unix(),
	)
	if err != nil {
		t.Fatal(err)
	}

	created, err := svc.AutoDiscoverProjects()
	if err != nil {
		t.Fatal(err)
	}

	found := false
	for _, p := range created {
		if p.Name == "synaptics-sl261" {
			found = true
			break
		}
	}
	if !found {
		names := make([]string, len(created))
		for i, p := range created {
			names[i] = p.Name
		}
		t.Errorf("expected discovered project 'synaptics-sl261', got %v", names)
	}
}
