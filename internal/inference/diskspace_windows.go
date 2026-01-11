//go:build windows

package inference

import (
	"os"
)

// checkDiskSpace on Windows - skip the check since syscall.Statfs is not available
func checkDiskSpace(dir string, requiredBytes int64) error {
	// Ensure directory exists
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	// Skip disk space check on Windows
	return nil
}
