//go:build !windows

package lock

import (
	"os"
	"syscall"
)

// isProcessRunning checks if a process with the given PID exists.
// On Unix, signal 0 tests for existence without actually sending a signal.
func isProcessRunning(pid int) bool {
	process, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	err = process.Signal(syscall.Signal(0))
	return err == nil
}
