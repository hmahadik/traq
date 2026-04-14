package lock

import "path/filepath"

const lockFileName = "traq.lock"

// InstanceLock prevents multiple instances of the application from running.
// On Unix, uses PID-based lock files with signal-0 liveness checks.
// On Windows, uses a named mutex (kernel object, automatically released on
// process exit or crash — no stale locks possible).
type InstanceLock struct {
	path   string  // PID lock file path (Unix)
	handle uintptr // named mutex handle (Windows)
}

// New creates a new InstanceLock for the given data directory.
func New(dataDir string) *InstanceLock {
	return &InstanceLock{
		path: filepath.Join(dataDir, lockFileName),
	}
}

// Acquire and Release are implemented per-platform:
//   lock_unix.go    — PID file + signal 0
//   lock_windows.go — named mutex via CreateMutexW
