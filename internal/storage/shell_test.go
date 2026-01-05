package storage

import (
	"database/sql"
	"testing"
	"time"
)

func TestSaveShellCommand(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	cmd := &ShellCommand{
		Timestamp:        time.Now().Unix(),
		Command:          "ls -la",
		ShellType:        "bash",
		WorkingDirectory: sql.NullString{String: "/home/user", Valid: true},
	}

	id, err := store.SaveShellCommand(cmd)
	if err != nil {
		t.Fatalf("failed to save shell command: %v", err)
	}
	if id <= 0 {
		t.Errorf("expected positive ID, got %d", id)
	}
}

func TestGetShellCommandsBySession(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	sessionID, _ := store.CreateSession(time.Now().Unix())

	// Add commands
	for i := 0; i < 3; i++ {
		cmd := &ShellCommand{
			Timestamp: time.Now().Unix() + int64(i),
			Command:   "echo test",
			ShellType: "bash",
			SessionID: sql.NullInt64{Int64: sessionID, Valid: true},
		}
		store.SaveShellCommand(cmd)
	}

	commands, err := store.GetShellCommandsBySession(sessionID)
	if err != nil {
		t.Fatalf("failed to get commands: %v", err)
	}
	if len(commands) != 3 {
		t.Errorf("expected 3 commands, got %d", len(commands))
	}
}

func TestGetShellCommandsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		cmd := &ShellCommand{
			Timestamp: now + int64(i*60),
			Command:   "echo test",
			ShellType: "bash",
		}
		store.SaveShellCommand(cmd)
	}

	commands, err := store.GetShellCommandsByTimeRange(now, now+180)
	if err != nil {
		t.Fatalf("failed to get commands: %v", err)
	}
	if len(commands) != 4 {
		t.Errorf("expected 4 commands, got %d", len(commands))
	}
}

func TestGetRecentShellCommands(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 10; i++ {
		cmd := &ShellCommand{
			Timestamp: time.Now().Unix() + int64(i),
			Command:   "echo test",
			ShellType: "bash",
		}
		store.SaveShellCommand(cmd)
	}

	commands, err := store.GetRecentShellCommands(5)
	if err != nil {
		t.Fatalf("failed to get recent commands: %v", err)
	}
	if len(commands) != 5 {
		t.Errorf("expected 5 commands, got %d", len(commands))
	}
}

func TestCommandExists(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()
	cmd := &ShellCommand{
		Timestamp: now,
		Command:   "unique_command",
		ShellType: "bash",
	}
	store.SaveShellCommand(cmd)

	exists, err := store.CommandExists(now, "unique_command")
	if err != nil {
		t.Fatalf("failed to check command exists: %v", err)
	}
	if !exists {
		t.Error("expected command to exist")
	}

	exists, _ = store.CommandExists(now, "nonexistent")
	if exists {
		t.Error("expected command not to exist")
	}
}

func TestCountShellCommands(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	for i := 0; i < 3; i++ {
		cmd := &ShellCommand{
			Timestamp: time.Now().Unix() + int64(i),
			Command:   "echo test",
			ShellType: "bash",
		}
		store.SaveShellCommand(cmd)
	}

	count, err := store.CountShellCommands()
	if err != nil {
		t.Fatalf("failed to count commands: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}

func TestCountShellCommandsByTimeRange(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	now := time.Now().Unix()

	for i := 0; i < 5; i++ {
		cmd := &ShellCommand{
			Timestamp: now + int64(i*60),
			Command:   "echo test",
			ShellType: "bash",
		}
		store.SaveShellCommand(cmd)
	}

	count, err := store.CountShellCommandsByTimeRange(now, now+120)
	if err != nil {
		t.Fatalf("failed to count commands: %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3, got %d", count)
	}
}
