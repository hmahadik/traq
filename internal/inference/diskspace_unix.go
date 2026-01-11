//go:build !windows

package inference

import (
	"fmt"
	"os"
	"syscall"
)

// checkDiskSpace checks if there's enough disk space available in the given directory
func checkDiskSpace(dir string, requiredBytes int64) error {
	// Ensure directory exists for checking
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	var stat syscall.Statfs_t
	if err := syscall.Statfs(dir, &stat); err != nil {
		return fmt.Errorf("failed to check disk space: %w", err)
	}

	// Calculate available space in bytes
	availableBytes := int64(stat.Bavail) * int64(stat.Bsize)
	requiredGB := float64(requiredBytes) / (1024 * 1024 * 1024)
	availableGB := float64(availableBytes) / (1024 * 1024 * 1024)

	if availableBytes < requiredBytes {
		return fmt.Errorf("insufficient disk space: %.1fGB available, %.1fGB required", availableGB, requiredGB)
	}

	return nil
}
