//go:build !windows

package lock

import (
	"fmt"
	"os"
	"strconv"
)

// Acquire attempts to acquire the instance lock using a PID file.
// Returns nil if successful, error if another instance is running.
func (l *InstanceLock) Acquire() error {
	if data, err := os.ReadFile(l.path); err == nil {
		pid, err := strconv.Atoi(string(data))
		if err == nil && pid > 0 {
			if isProcessRunning(pid) {
				return fmt.Errorf("another instance of Traq is already running (PID: %d)", pid)
			}
		}
		// Stale lock file — process is dead, remove it
		os.Remove(l.path)
	}

	pid := os.Getpid()
	if err := os.WriteFile(l.path, []byte(strconv.Itoa(pid)), 0644); err != nil {
		return fmt.Errorf("failed to create lock file: %w", err)
	}

	return nil
}

// Release removes the PID lock file.
func (l *InstanceLock) Release() {
	os.Remove(l.path)
}
