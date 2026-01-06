package tracker

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
)

// mockPlatformShell implements platform.Platform for shell testing.
type mockPlatformShell struct {
	shellType    string
	historyPath  string
}

func (m *mockPlatformShell) DataDir() string                             { return "" }
func (m *mockPlatformShell) ConfigDir() string                           { return "" }
func (m *mockPlatformShell) CacheDir() string                            { return "" }
func (m *mockPlatformShell) GetActiveWindow() (*platform.WindowInfo, error) { return nil, nil }
func (m *mockPlatformShell) GetLastInputTime() (time.Time, error)        { return time.Now(), nil }
func (m *mockPlatformShell) GetShellHistoryPath() string                 { return m.historyPath }
func (m *mockPlatformShell) GetShellType() string                        { return m.shellType }
func (m *mockPlatformShell) GetBrowserHistoryPaths() map[string]string   { return nil }
func (m *mockPlatformShell) OpenURL(url string) error                    { return nil }
func (m *mockPlatformShell) ShowNotification(title, body string) error   { return nil }

func setupShellTestDB(t *testing.T) (*storage.Store, string) {
	tmpDir, err := os.MkdirTemp("", "traq-shell-test-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	dbPath := filepath.Join(tmpDir, "test.db")
	store, err := storage.NewStore(dbPath)
	if err != nil {
		os.RemoveAll(tmpDir)
		t.Fatalf("Failed to create store: %v", err)
	}

	return store, tmpDir
}

func createTempHistoryFile(t *testing.T, dir, content string) string {
	histPath := filepath.Join(dir, "test_history")
	err := os.WriteFile(histPath, []byte(content), 0644)
	if err != nil {
		t.Fatalf("Failed to create history file: %v", err)
	}
	return histPath
}

func TestShellTracker_Poll_ReadsNewCommands(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	// Create bash history with timestamps
	histContent := `#1704067200
git status
#1704067260
go test ./...
#1704067320
make build
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session to link commands to
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Poll for commands
	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	// Should have saved commands (minus excluded ones like ls, cd)
	if len(saved) < 2 {
		t.Errorf("Expected at least 2 commands saved, got %d", len(saved))
	}

	// Verify commands are in database
	commands, err := store.GetShellCommandsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get commands: %v", err)
	}

	if len(commands) < 2 {
		t.Errorf("Expected at least 2 commands in DB, got %d", len(commands))
	}

	// Verify specific commands
	foundGitStatus := false
	foundGoTest := false
	for _, cmd := range commands {
		if cmd.Command == "git status" {
			foundGitStatus = true
		}
		if cmd.Command == "go test ./..." {
			foundGoTest = true
		}
	}

	if !foundGitStatus {
		t.Error("Expected 'git status' command in database")
	}
	if !foundGoTest {
		t.Error("Expected 'go test ./...' command in database")
	}
}

func TestShellTracker_Poll_FiltersExcludedCommands(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	// Create history with trivial commands that should be filtered
	histContent := `#1704067200
ls
#1704067201
cd
#1704067202
pwd
#1704067203
clear
#1704067204
exit
#1704067205
history
#1704067206
git commit -m "real work"
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	// Only "git commit" should be saved, trivial commands filtered
	if len(saved) != 1 {
		t.Errorf("Expected 1 command saved (trivial commands filtered), got %d", len(saved))
		for _, cmd := range saved {
			t.Logf("Saved command: %s", cmd.Command)
		}
	}

	if len(saved) == 1 && saved[0].Command != `git commit -m "real work"` {
		t.Errorf("Expected 'git commit' command, got %s", saved[0].Command)
	}
}

func TestShellTracker_Poll_FiltersSensitiveCommands(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	// Create history with sensitive commands
	histContent := `#1704067200
export PASSWORD=secret123
#1704067201
curl -H "Authorization: token abc123"
#1704067202
mysql -u root -pMyPassword
#1704067203
API_KEY=xyz ./script.sh
#1704067204
git push origin main
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	// Only "git push" should be saved, sensitive commands filtered
	if len(saved) != 1 {
		t.Errorf("Expected 1 command saved (sensitive commands filtered), got %d", len(saved))
		for _, cmd := range saved {
			t.Logf("Saved command: %s", cmd.Command)
		}
	}

	// Ensure no sensitive data leaked
	for _, cmd := range saved {
		if containsSensitive(cmd.Command) {
			t.Errorf("Sensitive command was not filtered: %s", cmd.Command)
		}
	}
}

func containsSensitive(cmd string) bool {
	sensitivePatterns := []string{"password", "passwd", "secret", "token", "key=", "api_key", "apikey", "auth"}
	for _, pattern := range sensitivePatterns {
		if containsIgnoreCase(cmd, pattern) {
			return true
		}
	}
	return false
}

func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr ||
		 len(s) > len(substr) && containsIgnoreCaseHelper(s, substr))
}

func containsIgnoreCaseHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			sc := s[i+j]
			pc := substr[j]
			if sc >= 'A' && sc <= 'Z' {
				sc += 32
			}
			if pc >= 'A' && pc <= 'Z' {
				pc += 32
			}
			if sc != pc {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func TestShellTracker_Poll_DeduplicatesCommands(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histContent := `#1704067200
go build
#1704067260
go test ./...
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// First poll
	saved1, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("First poll failed: %v", err)
	}
	if len(saved1) != 2 {
		t.Errorf("First poll: expected 2 commands, got %d", len(saved1))
	}

	// Second poll of same history should return 0 new commands
	saved2, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Second poll failed: %v", err)
	}
	if len(saved2) != 0 {
		t.Errorf("Second poll: expected 0 new commands (dedup), got %d", len(saved2))
	}

	// Verify total count in database is still 2
	count, err := store.CountShellCommands()
	if err != nil {
		t.Fatalf("Failed to count commands: %v", err)
	}
	if count != 2 {
		t.Errorf("Expected 2 total commands in DB, got %d", count)
	}
}

func TestShellTracker_Poll_EmptyHistory(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histPath := createTempHistoryFile(t, tmpDir, "")

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed on empty history: %v", err)
	}

	if len(saved) != 0 {
		t.Errorf("Expected 0 commands from empty history, got %d", len(saved))
	}
}

func TestShellTracker_Poll_NonExistentHistory(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: "/nonexistent/path/history",
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Should not error, just return nil
	saved, err := tracker.Poll(1)
	if err != nil {
		// Parser returns error for nonexistent file, which is acceptable
		t.Logf("Got expected error for nonexistent file: %v", err)
	}

	if saved != nil && len(saved) != 0 {
		t.Errorf("Expected 0 commands for nonexistent history, got %d", len(saved))
	}
}

func TestShellTracker_Poll_EmptyHistoryPath(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: "", // Empty path
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	saved, err := tracker.Poll(1)
	if err != nil {
		t.Fatalf("Poll should not error on empty path: %v", err)
	}

	if saved != nil && len(saved) != 0 {
		t.Errorf("Expected 0 commands for empty path, got %d", len(saved))
	}
}

func TestShellTracker_ParseBashHistory(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	// Bash format: #timestamp followed by command
	histContent := `#1704067200
echo "hello world"
#1704067260
git status
some command without timestamp
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	// Should parse all commands
	if len(saved) < 2 {
		t.Errorf("Expected at least 2 commands, got %d", len(saved))
	}

	// Check timestamp parsing
	for _, cmd := range saved {
		if cmd.Command == `echo "hello world"` {
			if cmd.Timestamp != 1704067200 {
				t.Errorf("Expected timestamp 1704067200, got %d", cmd.Timestamp)
			}
		}
	}
}

func TestShellTracker_ParseZshHistory(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	// Zsh format: : timestamp:duration;command
	histContent := `: 1704067200:0;echo "hello world"
: 1704067260:5;git status
: 1704067320:10;make build
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "zsh",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(saved) < 2 {
		t.Errorf("Expected at least 2 commands, got %d", len(saved))
	}

	// Check timestamp and duration parsing
	for _, cmd := range saved {
		if cmd.Command == `echo "hello world"` {
			if cmd.Timestamp != 1704067200 {
				t.Errorf("Expected timestamp 1704067200, got %d", cmd.Timestamp)
			}
		}
		if cmd.Command == "make build" {
			if cmd.Timestamp != 1704067320 {
				t.Errorf("Expected timestamp 1704067320, got %d", cmd.Timestamp)
			}
			if cmd.DurationSeconds.Valid && cmd.DurationSeconds.Float64 != 10 {
				t.Errorf("Expected duration 10, got %f", cmd.DurationSeconds.Float64)
			}
		}
	}
}

func TestShellTracker_SessionLinking(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histContent := `#1704067200
git status
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// Poll with session ID
	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(saved) == 0 {
		t.Fatal("Expected at least 1 saved command")
	}

	// Verify session ID is set
	cmd := saved[0]
	if !cmd.SessionID.Valid || cmd.SessionID.Int64 != sessionID {
		t.Errorf("Expected session ID %d, got %v", sessionID, cmd.SessionID)
	}

	// Verify can retrieve by session
	commands, err := store.GetShellCommandsBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get commands by session: %v", err)
	}

	if len(commands) != len(saved) {
		t.Errorf("Expected %d commands for session, got %d", len(saved), len(commands))
	}
}

func TestShellTracker_CheckpointPersistence(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histContent := `#1704067200
git status
#1704067260
go build
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	// First tracker instance
	tracker1 := NewShellTracker(mock, store, tmpDir)
	saved1, err := tracker1.Poll(sessionID)
	if err != nil {
		t.Fatalf("First poll failed: %v", err)
	}
	if len(saved1) != 2 {
		t.Errorf("First poll: expected 2 commands, got %d", len(saved1))
	}

	// Append more to history
	histContent2 := histContent + `#1704067320
make test
`
	os.WriteFile(histPath, []byte(histContent2), 0644)

	// New tracker instance (simulating restart)
	tracker2 := NewShellTracker(mock, store, tmpDir)
	saved2, err := tracker2.Poll(sessionID)
	if err != nil {
		t.Fatalf("Second poll failed: %v", err)
	}

	// Should only get the new command
	if len(saved2) != 1 {
		t.Errorf("Second poll: expected 1 new command, got %d", len(saved2))
	}

	if len(saved2) == 1 && saved2[0].Command != "make test" {
		t.Errorf("Expected 'make test', got %s", saved2[0].Command)
	}
}

func TestShellTracker_Reset(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histContent := `#1704067200
git status
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// First poll
	tracker.Poll(sessionID)

	// Reset checkpoint
	err = tracker.Reset()
	if err != nil && !os.IsNotExist(err) {
		t.Fatalf("Reset failed: %v", err)
	}

	// Create new store to avoid duplicate detection from DB
	store2, err := storage.NewStore(filepath.Join(tmpDir, "test2.db"))
	if err != nil {
		t.Fatalf("Failed to create second store: %v", err)
	}
	defer store2.Close()

	// Create a session in the new store
	sessionID2, err := store2.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session in store2: %v", err)
	}

	tracker2 := NewShellTracker(mock, store2, tmpDir)
	saved, err := tracker2.Poll(sessionID2)
	if err != nil {
		t.Fatalf("Poll after reset failed: %v", err)
	}

	// Should re-read the history
	if len(saved) != 1 {
		t.Errorf("Expected 1 command after reset, got %d", len(saved))
	}
}

func TestShellTracker_AddExcludePattern(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histContent := `#1704067200
npm install
#1704067260
npm test
#1704067320
git commit
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Add custom exclude pattern
	err := tracker.AddExcludePattern(`^npm`)
	if err != nil {
		t.Fatalf("AddExcludePattern failed: %v", err)
	}

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	// Only "git commit" should be saved
	if len(saved) != 1 {
		t.Errorf("Expected 1 command (npm filtered), got %d", len(saved))
	}

	if len(saved) == 1 && saved[0].Command != "git commit" {
		t.Errorf("Expected 'git commit', got %s", saved[0].Command)
	}
}

func TestShellTracker_InvalidExcludePattern(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: "",
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Invalid regex
	err := tracker.AddExcludePattern(`[invalid`)
	if err == nil {
		t.Error("Expected error for invalid regex pattern")
	}
}

func TestShellTracker_ShellCommandFields(t *testing.T) {
	store, tmpDir := setupShellTestDB(t)
	defer os.RemoveAll(tmpDir)
	defer store.Close()

	histContent := `#1704067200
go build -v ./...
`
	histPath := createTempHistoryFile(t, tmpDir, histContent)

	mock := &mockPlatformShell{
		shellType:   "bash",
		historyPath: histPath,
	}

	tracker := NewShellTracker(mock, store, tmpDir)

	// Create a session first (foreign key constraint)
	sessionID, err := store.CreateSession(time.Now().Unix())
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	saved, err := tracker.Poll(sessionID)
	if err != nil {
		t.Fatalf("Poll failed: %v", err)
	}

	if len(saved) == 0 {
		t.Fatal("Expected at least 1 command")
	}

	cmd := saved[0]

	// Verify fields are set
	if cmd.ID == 0 {
		t.Error("Expected ID to be set after save")
	}
	if cmd.Timestamp == 0 {
		t.Error("Expected timestamp to be set")
	}
	if cmd.Command == "" {
		t.Error("Expected command to be set")
	}
	if cmd.ShellType != "bash" {
		t.Errorf("Expected shell type 'bash', got '%s'", cmd.ShellType)
	}
	if !cmd.Hostname.Valid {
		t.Error("Expected hostname to be set")
	}
}
