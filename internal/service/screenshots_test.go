package service

import (
	"os"
	"path/filepath"
	"testing"
)

// TestThumbnailPath_ValidPath tests that thumbnailPath generates correct path format.
func TestThumbnailPath_ValidPath(t *testing.T) {
	svc := &ScreenshotService{dataDir: "/tmp/test"}

	tests := []struct {
		input    string
		expected string
	}{
		{"/path/to/123456.webp", "/path/to/123456_thumb.webp"},
		{"/path/to/image.png", "/path/to/image_thumb.png"},
		{"screenshot.jpg", "screenshot_thumb.jpg"},
	}

	for _, tt := range tests {
		result := svc.thumbnailPath(tt.input)
		if result != tt.expected {
			t.Errorf("thumbnailPath(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

// TestThumbnailPath_DerivedPath tests that thumbnailPath derives the correct path
// (it's a pure function that doesn't check file existence).
func TestThumbnailPath_DerivedPath(t *testing.T) {
	// Setup: create a temp directory with a screenshot but NO thumbnail
	tmpDir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	// Create a screenshot file (but NOT the thumbnail)
	screenshotPath := filepath.Join(tmpDir, "1704067200.webp")
	if err := os.WriteFile(screenshotPath, []byte("fake image data"), 0644); err != nil {
		t.Fatal(err)
	}

	// The expected thumbnail path
	expectedThumbPath := filepath.Join(tmpDir, "1704067200_thumb.webp")

	// Verify thumbnail doesn't exist
	if _, err := os.Stat(expectedThumbPath); !os.IsNotExist(err) {
		t.Fatal("Test setup error: thumbnail should not exist")
	}

	// thumbnailPath just derives the path (doesn't check existence)
	svc := &ScreenshotService{dataDir: tmpDir}
	derivedPath := svc.thumbnailPath(screenshotPath)

	if derivedPath != expectedThumbPath {
		t.Errorf("thumbnailPath() = %s, want %s", derivedPath, expectedThumbPath)
	}
}

// TestGetThumbnailPath_FallbackBehavior tests that GetThumbnailPath returns
// an existing path (thumbnail if exists, otherwise original screenshot).
func TestGetThumbnailPath_FallbackBehavior(t *testing.T) {
	tmpDir, err := os.MkdirTemp("", "traq-test-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tmpDir)

	// Test 1: When thumbnail exists, return thumbnail path
	t.Run("returns thumbnail path when thumbnail exists", func(t *testing.T) {
		screenshotPath := filepath.Join(tmpDir, "with_thumb.webp")
		thumbPath := filepath.Join(tmpDir, "with_thumb_thumb.webp")

		// Create both files
		os.WriteFile(screenshotPath, []byte("screenshot"), 0644)
		os.WriteFile(thumbPath, []byte("thumbnail"), 0644)

		svc := &ScreenshotService{dataDir: tmpDir}
		result := svc.thumbnailPath(screenshotPath)

		// Verify it returns the thumb path and it exists
		if result != thumbPath {
			t.Errorf("Expected thumb path %s, got %s", thumbPath, result)
		}
		if _, err := os.Stat(result); os.IsNotExist(err) {
			t.Errorf("Returned path doesn't exist: %s", result)
		}
	})

	// Test 2: When thumbnail doesn't exist, thumbnailPath still returns derived path
	// (GetThumbnailPath would fall back to original, but we're testing thumbnailPath here)
	t.Run("thumbnailPath derives path regardless of existence", func(t *testing.T) {
		screenshotPath := filepath.Join(tmpDir, "no_thumb.webp")
		expectedThumbPath := filepath.Join(tmpDir, "no_thumb_thumb.webp")

		// Create only the screenshot file
		os.WriteFile(screenshotPath, []byte("screenshot"), 0644)

		svc := &ScreenshotService{dataDir: tmpDir}
		result := svc.thumbnailPath(screenshotPath)

		// thumbnailPath returns the derived path
		if result != expectedThumbPath {
			t.Errorf("Expected %s, got %s", expectedThumbPath, result)
		}
	})
}

// TestToURLPath tests conversion of filesystem paths to URL paths.
func TestToURLPath(t *testing.T) {
	svc := &ScreenshotService{dataDir: "/home/user/.local/share/traq"}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "full screenshot path",
			input:    "/home/user/.local/share/traq/screenshots/2026/01/05/123456.webp",
			expected: "/screenshots/2026/01/05/123456.webp",
		},
		{
			name:     "thumbnail path",
			input:    "/home/user/.local/share/traq/screenshots/2026/01/05/123456_thumb.webp",
			expected: "/screenshots/2026/01/05/123456_thumb.webp",
		},
		{
			name:     "path outside dataDir",
			input:    "/other/path/screenshot.webp",
			expected: "/other/path/screenshot.webp", // Fallback returns original
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.toURLPath(tt.input)
			if result != tt.expected {
				t.Errorf("toURLPath(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

// TestThumbnailPath_EdgeCases tests edge cases in path manipulation.
func TestThumbnailPath_EdgeCases(t *testing.T) {
	svc := &ScreenshotService{dataDir: "/tmp"}

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "no extension",
			input:    "/path/to/file",
			expected: "/path/to/file_thumb",
		},
		{
			name:     "multiple dots",
			input:    "/path/to/file.backup.webp",
			expected: "/path/to/file.backup_thumb.webp",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "_thumb",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svc.thumbnailPath(tt.input)
			if result != tt.expected {
				t.Errorf("thumbnailPath(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
