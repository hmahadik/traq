package lock

import (
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

func TestInstanceLock_Acquire(t *testing.T) {
	// Create temp dir for test
	tmpDir, err := os.MkdirTemp("", "traq-lock-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create first lock
	lock1 := New(tmpDir)
	if err := lock1.Acquire(); err != nil {
		t.Fatalf("first lock acquisition failed: %v", err)
	}

	// Verify lock file was created with correct PID
	lockPath := filepath.Join(tmpDir, lockFileName)
	data, err := os.ReadFile(lockPath)
	if err != nil {
		t.Fatalf("failed to read lock file: %v", err)
	}
	pid, err := strconv.Atoi(string(data))
	if err != nil {
		t.Fatalf("lock file doesn't contain valid PID: %v", err)
	}
	if pid != os.Getpid() {
		t.Errorf("lock file PID mismatch: got %d, want %d", pid, os.Getpid())
	}

	// Second lock should fail (same process, but demonstrates the check)
	lock2 := New(tmpDir)
	if err := lock2.Acquire(); err == nil {
		t.Error("second lock acquisition should have failed")
	}

	// Release first lock
	lock1.Release()

	// Now second lock should succeed
	if err := lock2.Acquire(); err != nil {
		t.Fatalf("lock acquisition after release failed: %v", err)
	}
	lock2.Release()
}

func TestInstanceLock_StaleLock(t *testing.T) {
	// Create temp dir for test
	tmpDir, err := os.MkdirTemp("", "traq-lock-test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a stale lock file with a non-existent PID
	lockPath := filepath.Join(tmpDir, lockFileName)
	// PID 999999 is very unlikely to exist
	if err := os.WriteFile(lockPath, []byte("999999"), 0644); err != nil {
		t.Fatalf("failed to create stale lock file: %v", err)
	}

	// Lock should succeed (stale lock is removed)
	lock1 := New(tmpDir)
	if err := lock1.Acquire(); err != nil {
		t.Fatalf("lock acquisition with stale lock failed: %v", err)
	}
	lock1.Release()
}
