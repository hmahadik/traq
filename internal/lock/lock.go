package lock

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
)

const lockFileName = "traq.lock"

// InstanceLock manages a PID-based lock file to prevent multiple instances.
type InstanceLock struct {
	path string
}

// New creates a new InstanceLock for the given data directory.
func New(dataDir string) *InstanceLock {
	return &InstanceLock{
		path: filepath.Join(dataDir, lockFileName),
	}
}

// Acquire attempts to acquire the instance lock.
// Returns nil if successful, error if another instance is running.
func (l *InstanceLock) Acquire() error {
	// Check if lock file exists
	if data, err := os.ReadFile(l.path); err == nil {
		// Lock file exists - check if process is still running
		pid, err := strconv.Atoi(string(data))
		if err == nil && pid > 0 {
			if isProcessRunning(pid) {
				return fmt.Errorf("another instance of Traq is already running (PID: %d)", pid)
			}
		}
		// Stale lock file - process is dead, remove it
		os.Remove(l.path)
	}

	// Write our PID to the lock file
	pid := os.Getpid()
	if err := os.WriteFile(l.path, []byte(strconv.Itoa(pid)), 0644); err != nil {
		return fmt.Errorf("failed to create lock file: %w", err)
	}

	return nil
}

// Release removes the lock file.
func (l *InstanceLock) Release() {
	os.Remove(l.path)
}
