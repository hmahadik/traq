package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"traq/internal/storage"
)

// ScreenshotService provides screenshot access.
type ScreenshotService struct {
	store   *storage.Store
	dataDir string
}

// NewScreenshotService creates a new ScreenshotService.
func NewScreenshotService(store *storage.Store, dataDir string) *ScreenshotService {
	return &ScreenshotService{
		store:   store,
		dataDir: dataDir,
	}
}

// GetScreenshot returns screenshot metadata by ID.
func (s *ScreenshotService) GetScreenshot(id int64) (*storage.Screenshot, error) {
	return s.store.GetScreenshot(id)
}

// GetScreenshotImage returns the full screenshot image bytes.
func (s *ScreenshotService) GetScreenshotImage(id int64) ([]byte, error) {
	screenshot, err := s.store.GetScreenshot(id)
	if err != nil {
		return nil, fmt.Errorf("screenshot not found: %w", err)
	}

	data, err := os.ReadFile(screenshot.Filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read image: %w", err)
	}

	return data, nil
}

// GetThumbnail returns the thumbnail image bytes.
func (s *ScreenshotService) GetThumbnail(id int64) ([]byte, error) {
	screenshot, err := s.store.GetScreenshot(id)
	if err != nil {
		return nil, fmt.Errorf("screenshot not found: %w", err)
	}

	// Derive thumbnail path from screenshot path
	thumbPath := s.thumbnailPath(screenshot.Filepath)

	data, err := os.ReadFile(thumbPath)
	if err != nil {
		// Fallback to full image if thumbnail doesn't exist
		return s.GetScreenshotImage(id)
	}

	return data, nil
}

// GetScreenshotPath returns the URL path to a screenshot.
// Returns a path like "/screenshots/2026/01/05/123456.webp" that can be loaded via the asset handler.
func (s *ScreenshotService) GetScreenshotPath(id int64) (string, error) {
	screenshot, err := s.store.GetScreenshot(id)
	if err != nil {
		return "", fmt.Errorf("screenshot not found: %w", err)
	}
	return s.toURLPath(screenshot.Filepath), nil
}

// GetThumbnailPath returns the URL path to a thumbnail.
// Falls back to the original screenshot path if thumbnail doesn't exist.
// Returns a path like "/screenshots/2026/01/05/123456_thumb.webp" that can be loaded via the asset handler.
func (s *ScreenshotService) GetThumbnailPath(id int64) (string, error) {
	screenshot, err := s.store.GetScreenshot(id)
	if err != nil {
		return "", fmt.Errorf("screenshot not found: %w", err)
	}

	thumbPath := s.thumbnailPath(screenshot.Filepath)

	// Check if thumbnail exists, fall back to original if not
	if _, err := os.Stat(thumbPath); os.IsNotExist(err) {
		return s.toURLPath(screenshot.Filepath), nil
	}

	return s.toURLPath(thumbPath), nil
}

// toURLPath converts a filesystem path to a URL path for the asset handler.
// Converts "/home/user/.local/share/traq/screenshots/2026/01/05/file.webp"
// to "/screenshots/2026/01/05/file.webp"
func (s *ScreenshotService) toURLPath(fsPath string) string {
	// Find the screenshots directory in the path
	screenshotsDir := filepath.Join(s.dataDir, "screenshots")
	if strings.HasPrefix(fsPath, screenshotsDir) {
		relPath := strings.TrimPrefix(fsPath, screenshotsDir)
		return "/screenshots" + relPath
	}
	// Fallback: try to extract just the filename and date parts
	return fsPath
}

// DeleteScreenshot deletes a screenshot and its files.
func (s *ScreenshotService) DeleteScreenshot(id int64) error {
	screenshot, err := s.store.GetScreenshot(id)
	if err != nil {
		return fmt.Errorf("screenshot not found: %w", err)
	}

	// Delete image file
	if err := os.Remove(screenshot.Filepath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete image: %w", err)
	}

	// Delete thumbnail
	thumbPath := s.thumbnailPath(screenshot.Filepath)
	os.Remove(thumbPath) // Ignore errors

	// Delete from database
	return s.store.DeleteScreenshot(id)
}

// DeleteScreenshotsForSession deletes all screenshots for a session.
func (s *ScreenshotService) DeleteScreenshotsForSession(sessionID int64) error {
	screenshots, err := s.store.GetScreenshotsBySession(sessionID)
	if err != nil {
		return err
	}

	for _, sc := range screenshots {
		s.DeleteScreenshot(sc.ID)
	}

	return nil
}

// GetScreenshotsByDate returns screenshots for a specific date.
func (s *ScreenshotService) GetScreenshotsByDate(date string) ([]*storage.Screenshot, error) {
	// Parse date and get time range
	// Implementation depends on date format
	return nil, nil
}

// CleanupOldScreenshots removes screenshots older than the given number of days.
func (s *ScreenshotService) CleanupOldScreenshots(olderThanDays int) (int, error) {
	// Get old screenshots
	// Delete them
	// Return count
	return 0, nil
}

// thumbnailPath derives the thumbnail path from the screenshot path.
func (s *ScreenshotService) thumbnailPath(screenshotPath string) string {
	// Convert "123456.webp" to "123456_thumb.webp"
	ext := filepath.Ext(screenshotPath)
	base := strings.TrimSuffix(screenshotPath, ext)
	return base + "_thumb" + ext
}

// ScreenshotInfo contains detailed info about a screenshot.
type ScreenshotInfo struct {
	ID            int64  `json:"id"`
	Timestamp     int64  `json:"timestamp"`
	Filepath      string `json:"filepath"`
	ThumbnailPath string `json:"thumbnailPath"`
	Width         int    `json:"width"`
	Height        int    `json:"height"`
	WindowTitle   string `json:"windowTitle"`
	AppName       string `json:"appName"`
	SessionID     int64  `json:"sessionId"`
	FileSize      int64  `json:"fileSize"`
}

// GetScreenshotInfo returns detailed info about a screenshot.
func (s *ScreenshotService) GetScreenshotInfo(id int64) (*ScreenshotInfo, error) {
	screenshot, err := s.store.GetScreenshot(id)
	if err != nil {
		return nil, err
	}

	info := &ScreenshotInfo{
		ID:            screenshot.ID,
		Timestamp:     screenshot.Timestamp,
		Filepath:      screenshot.Filepath,
		ThumbnailPath: s.thumbnailPath(screenshot.Filepath),
	}

	if screenshot.WindowTitle.Valid {
		info.WindowTitle = screenshot.WindowTitle.String
	}
	if screenshot.AppName.Valid {
		info.AppName = screenshot.AppName.String
	}
	if screenshot.SessionID.Valid {
		info.SessionID = screenshot.SessionID.Int64
	}
	if screenshot.MonitorWidth.Valid {
		info.Width = int(screenshot.MonitorWidth.Int64)
	}
	if screenshot.MonitorHeight.Valid {
		info.Height = int(screenshot.MonitorHeight.Int64)
	}

	// Get file size
	if stat, err := os.Stat(screenshot.Filepath); err == nil {
		info.FileSize = stat.Size()
	}

	return info, nil
}
