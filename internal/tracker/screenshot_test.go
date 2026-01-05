package tracker

import (
	"image"
	"os"
	"path/filepath"
	"testing"
)

func TestNewScreenCapture(t *testing.T) {
	sc := NewScreenCapture("/tmp/test", 80)
	if sc == nil {
		t.Fatal("expected non-nil ScreenCapture")
	}
	if sc.quality != 80 {
		t.Errorf("got quality=%d, want 80", sc.quality)
	}
	if sc.thumbnailWidth != 200 {
		t.Errorf("got thumbnailWidth=%d, want 200", sc.thumbnailWidth)
	}
	if sc.duplicateThresh != 3 {
		t.Errorf("got duplicateThresh=%d, want 3", sc.duplicateThresh)
	}
}

func TestNewScreenCapture_InvalidQuality(t *testing.T) {
	// Quality <= 0 should default to 80
	sc := NewScreenCapture("/tmp/test", 0)
	if sc.quality != 80 {
		t.Errorf("got quality=%d, want 80 for invalid quality", sc.quality)
	}

	// Quality > 100 should default to 80
	sc = NewScreenCapture("/tmp/test", 150)
	if sc.quality != 80 {
		t.Errorf("got quality=%d, want 80 for quality > 100", sc.quality)
	}
}

func TestSetThumbnailWidth(t *testing.T) {
	sc := NewScreenCapture("/tmp/test", 80)
	sc.SetThumbnailWidth(300)
	if sc.thumbnailWidth != 300 {
		t.Errorf("got thumbnailWidth=%d, want 300", sc.thumbnailWidth)
	}
}

func TestSetDuplicateThreshold(t *testing.T) {
	sc := NewScreenCapture("/tmp/test", 80)
	sc.SetDuplicateThreshold(5)
	if sc.duplicateThresh != 5 {
		t.Errorf("got duplicateThresh=%d, want 5", sc.duplicateThresh)
	}
}

func TestAreSimilar(t *testing.T) {
	sc := NewScreenCapture("/tmp/test", 80)
	sc.SetDuplicateThreshold(3)

	tests := []struct {
		name     string
		hash1    string
		hash2    string
		expected bool
		wantErr  bool
	}{
		{
			name:     "identical hashes",
			hash1:    "d:0000000000000000",
			hash2:    "d:0000000000000000",
			expected: true,
		},
		{
			name:     "empty hash1",
			hash1:    "",
			hash2:    "d:0000000000000000",
			expected: false,
		},
		{
			name:     "empty hash2",
			hash1:    "d:0000000000000000",
			hash2:    "",
			expected: false,
		},
		{
			name:     "both empty",
			hash1:    "",
			hash2:    "",
			expected: false,
		},
		{
			name:    "invalid hash1",
			hash1:   "invalid",
			hash2:   "d:0000000000000000",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			similar, err := sc.AreSimilar(tt.hash1, tt.hash2)
			if tt.wantErr && err == nil {
				t.Error("expected error")
				return
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if !tt.wantErr && similar != tt.expected {
				t.Errorf("got %v, want %v", similar, tt.expected)
			}
		})
	}
}

func TestHammingDistance(t *testing.T) {
	sc := NewScreenCapture("/tmp/test", 80)

	tests := []struct {
		name     string
		hash1    string
		hash2    string
		expected int
		wantErr  bool
	}{
		{
			name:     "identical hashes",
			hash1:    "d:0000000000000000",
			hash2:    "d:0000000000000000",
			expected: 0,
		},
		{
			name:    "empty hash1",
			hash1:   "",
			hash2:   "d:0000000000000000",
			wantErr: true,
		},
		{
			name:    "invalid hash",
			hash1:   "invalid",
			hash2:   "d:0000000000000000",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dist, err := sc.HammingDistance(tt.hash1, tt.hash2)
			if tt.wantErr && err == nil {
				t.Error("expected error")
				return
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}
			if !tt.wantErr && dist != tt.expected {
				t.Errorf("got %d, want %d", dist, tt.expected)
			}
		})
	}
}

func TestComputeDHash(t *testing.T) {
	sc := NewScreenCapture("/tmp/test", 80)

	// Create a simple test image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))

	hash, err := sc.ComputeDHash(img)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if hash == "" {
		t.Error("expected non-empty hash")
	}
	// DHash format should start with "d:"
	if len(hash) < 2 || hash[:2] != "d:" {
		t.Errorf("expected hash to start with 'd:', got %s", hash)
	}
}

func TestGetMonitorCount(t *testing.T) {
	// This just tests the wrapper function exists
	// Actual value depends on system
	count := GetMonitorCount()
	if count < 0 {
		t.Errorf("expected non-negative count, got %d", count)
	}
}

func TestGetMonitorBounds(t *testing.T) {
	// Test with index 0 (primary monitor)
	bounds := GetMonitorBounds(0)
	// Just verify it returns something reasonable
	if bounds.Dx() < 0 || bounds.Dy() < 0 {
		t.Error("expected non-negative bounds")
	}
}

func TestSavePNG(t *testing.T) {
	dir, err := os.MkdirTemp("", "screenshot-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	// Create a simple test image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	path := filepath.Join(dir, "test.png")

	err = SavePNG(img, path)
	if err != nil {
		t.Fatalf("failed to save PNG: %v", err)
	}

	// Verify file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("expected PNG file to exist")
	}
}

func TestSaveWebP(t *testing.T) {
	dir, err := os.MkdirTemp("", "screenshot-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	sc := NewScreenCapture(dir, 80)

	// Create a simple test image
	img := image.NewRGBA(image.Rect(0, 0, 100, 100))
	path := filepath.Join(dir, "test.webp")

	err = sc.saveWebP(img, path)
	if err != nil {
		t.Fatalf("failed to save WebP: %v", err)
	}

	// Verify file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("expected WebP file to exist")
	}
}

func TestSaveThumbnail(t *testing.T) {
	dir, err := os.MkdirTemp("", "screenshot-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(dir)

	sc := NewScreenCapture(dir, 80)
	sc.SetThumbnailWidth(100)

	// Create a simple test image
	img := image.NewRGBA(image.Rect(0, 0, 1920, 1080))
	path := filepath.Join(dir, "thumb.webp")

	err = sc.saveThumbnail(img, path)
	if err != nil {
		t.Fatalf("failed to save thumbnail: %v", err)
	}

	// Verify file exists
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Error("expected thumbnail file to exist")
	}
}
