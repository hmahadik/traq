package tracker

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/chai2010/webp"
	"github.com/corona10/goimagehash"
	"github.com/disintegration/imaging"
	"github.com/kbinani/screenshot"
)

// ScreenCapture handles screenshot capture and processing.
type ScreenCapture struct {
	outputDir       string
	quality         int
	thumbnailWidth  int
	duplicateThresh int
}

// CaptureResult contains the result of a screen capture.
type CaptureResult struct {
	Filepath      string
	ThumbnailPath string
	DHash         string
	Width         int
	Height        int
	MonitorIndex  int
	MonitorName   string
}

// NewScreenCapture creates a new ScreenCapture instance.
func NewScreenCapture(outputDir string, quality int) *ScreenCapture {
	if quality <= 0 || quality > 100 {
		quality = 80
	}
	return &ScreenCapture{
		outputDir:       outputDir,
		quality:         quality,
		thumbnailWidth:  200,
		duplicateThresh: 3, // Hamming distance threshold for duplicates
	}
}

// SetThumbnailWidth sets the width for thumbnail generation.
func (c *ScreenCapture) SetThumbnailWidth(width int) {
	c.thumbnailWidth = width
}

// SetDuplicateThreshold sets the hamming distance threshold for duplicate detection.
func (c *ScreenCapture) SetDuplicateThreshold(threshold int) {
	c.duplicateThresh = threshold
}

// Capture captures the active monitor's screen.
func (c *ScreenCapture) Capture() (*CaptureResult, error) {
	// Get number of displays
	n := screenshot.NumActiveDisplays()
	if n == 0 {
		return nil, fmt.Errorf("no active displays found")
	}

	// Capture the primary display (index 0)
	// Note: The daemon uses CaptureMonitor() with GetMonitorForWindow() for active window detection
	monitorIndex := 0
	bounds := screenshot.GetDisplayBounds(monitorIndex)

	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return nil, fmt.Errorf("failed to capture screen: %w", err)
	}

	// Generate timestamp-based filename
	now := time.Now()
	dateDir := filepath.Join(c.outputDir, "screenshots",
		fmt.Sprintf("%04d", now.Year()),
		fmt.Sprintf("%02d", now.Month()),
		fmt.Sprintf("%02d", now.Day()))

	if err := os.MkdirAll(dateDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create screenshot directory: %w", err)
	}

	filename := fmt.Sprintf("%02d%02d%02d.webp", now.Hour(), now.Minute(), now.Second())
	filePath := filepath.Join(dateDir, filename)

	// Save as WebP
	if err := c.saveWebP(img, filePath); err != nil {
		return nil, fmt.Errorf("failed to save screenshot: %w", err)
	}

	// Generate thumbnail
	thumbnailFilename := fmt.Sprintf("%02d%02d%02d_thumb.webp", now.Hour(), now.Minute(), now.Second())
	thumbnailPath := filepath.Join(dateDir, thumbnailFilename)
	if err := c.saveThumbnail(img, thumbnailPath); err != nil {
		// Non-fatal: log but continue
		thumbnailPath = ""
	}

	// Compute dhash
	dhash, err := c.ComputeDHash(img)
	if err != nil {
		dhash = "" // Non-fatal
	}

	return &CaptureResult{
		Filepath:      filePath,
		ThumbnailPath: thumbnailPath,
		DHash:         dhash,
		Width:         bounds.Dx(),
		Height:        bounds.Dy(),
		MonitorIndex:  monitorIndex,
		MonitorName:   fmt.Sprintf("Display %d", monitorIndex),
	}, nil
}

// CaptureMonitor captures a specific monitor by index.
func (c *ScreenCapture) CaptureMonitor(monitorIndex int) (*CaptureResult, error) {
	n := screenshot.NumActiveDisplays()
	if monitorIndex < 0 || monitorIndex >= n {
		return nil, fmt.Errorf("invalid monitor index: %d (have %d displays)", monitorIndex, n)
	}

	bounds := screenshot.GetDisplayBounds(monitorIndex)
	img, err := screenshot.CaptureRect(bounds)
	if err != nil {
		return nil, fmt.Errorf("failed to capture monitor %d: %w", monitorIndex, err)
	}

	// Same processing as Capture()
	now := time.Now()
	dateDir := filepath.Join(c.outputDir, "screenshots",
		fmt.Sprintf("%04d", now.Year()),
		fmt.Sprintf("%02d", now.Month()),
		fmt.Sprintf("%02d", now.Day()))

	if err := os.MkdirAll(dateDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create screenshot directory: %w", err)
	}

	filename := fmt.Sprintf("%02d%02d%02d_m%d.webp", now.Hour(), now.Minute(), now.Second(), monitorIndex)
	filePath := filepath.Join(dateDir, filename)

	if err := c.saveWebP(img, filePath); err != nil {
		return nil, fmt.Errorf("failed to save screenshot: %w", err)
	}

	thumbnailFilename := fmt.Sprintf("%02d%02d%02d_m%d_thumb.webp", now.Hour(), now.Minute(), now.Second(), monitorIndex)
	thumbnailPath := filepath.Join(dateDir, thumbnailFilename)
	if err := c.saveThumbnail(img, thumbnailPath); err != nil {
		thumbnailPath = ""
	}

	dhash, err := c.ComputeDHash(img)
	if err != nil {
		dhash = ""
	}

	return &CaptureResult{
		Filepath:      filePath,
		ThumbnailPath: thumbnailPath,
		DHash:         dhash,
		Width:         bounds.Dx(),
		Height:        bounds.Dy(),
		MonitorIndex:  monitorIndex,
		MonitorName:   fmt.Sprintf("Display %d", monitorIndex),
	}, nil
}

// saveWebP saves an image as WebP format.
func (c *ScreenCapture) saveWebP(img image.Image, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	options := &webp.Options{
		Lossless: false,
		Quality:  float32(c.quality),
	}

	return webp.Encode(f, img, options)
}

// saveThumbnail generates and saves a thumbnail.
func (c *ScreenCapture) saveThumbnail(img image.Image, path string) error {
	// Resize maintaining aspect ratio
	thumb := imaging.Resize(img, c.thumbnailWidth, 0, imaging.Lanczos)

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	options := &webp.Options{
		Lossless: false,
		Quality:  float32(c.quality),
	}

	return webp.Encode(f, thumb, options)
}

// ComputeDHash computes a difference hash for an image.
func (c *ScreenCapture) ComputeDHash(img image.Image) (string, error) {
	hash, err := goimagehash.DifferenceHash(img)
	if err != nil {
		return "", fmt.Errorf("failed to compute dhash: %w", err)
	}
	return hash.ToString(), nil
}

// AreSimilar checks if two dhash values indicate similar images.
func (c *ScreenCapture) AreSimilar(hash1, hash2 string) (bool, error) {
	if hash1 == "" || hash2 == "" {
		return false, nil
	}

	h1, err := goimagehash.ImageHashFromString(hash1)
	if err != nil {
		return false, fmt.Errorf("failed to parse hash1: %w", err)
	}

	h2, err := goimagehash.ImageHashFromString(hash2)
	if err != nil {
		return false, fmt.Errorf("failed to parse hash2: %w", err)
	}

	distance, err := h1.Distance(h2)
	if err != nil {
		return false, fmt.Errorf("failed to compute distance: %w", err)
	}

	return distance <= c.duplicateThresh, nil
}

// HammingDistance returns the hamming distance between two dhash values.
func (c *ScreenCapture) HammingDistance(hash1, hash2 string) (int, error) {
	if hash1 == "" || hash2 == "" {
		return -1, fmt.Errorf("empty hash")
	}

	h1, err := goimagehash.ImageHashFromString(hash1)
	if err != nil {
		return -1, fmt.Errorf("failed to parse hash1: %w", err)
	}

	h2, err := goimagehash.ImageHashFromString(hash2)
	if err != nil {
		return -1, fmt.Errorf("failed to parse hash2: %w", err)
	}

	return h1.Distance(h2)
}

// GetMonitorCount returns the number of active displays.
func GetMonitorCount() int {
	return screenshot.NumActiveDisplays()
}

// GetMonitorBounds returns the bounds of a specific monitor.
func GetMonitorBounds(index int) image.Rectangle {
	return screenshot.GetDisplayBounds(index)
}

// GetMonitorForPoint returns the monitor index that contains the given point.
// If the point is outside all monitors, returns 0 (primary monitor).
func GetMonitorForPoint(x, y int) int {
	n := screenshot.NumActiveDisplays()
	point := image.Point{X: x, Y: y}

	for i := 0; i < n; i++ {
		bounds := screenshot.GetDisplayBounds(i)
		if point.In(bounds) {
			return i
		}
	}

	// Point outside all monitors, use primary
	return 0
}

// GetMonitorForWindow returns the monitor index that contains the center of the window.
func GetMonitorForWindow(windowX, windowY, windowWidth, windowHeight int) int {
	// Calculate window center
	centerX := windowX + windowWidth/2
	centerY := windowY + windowHeight/2
	return GetMonitorForPoint(centerX, centerY)
}

// MonitorInfo contains information about a display monitor.
type MonitorInfo struct {
	Index     int    `json:"index"`
	Name      string `json:"name"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	X         int    `json:"x"`
	Y         int    `json:"y"`
	IsPrimary bool   `json:"isPrimary"`
}

// GetAvailableMonitors returns information about all active monitors.
func GetAvailableMonitors() []MonitorInfo {
	n := screenshot.NumActiveDisplays()
	monitors := make([]MonitorInfo, n)

	for i := 0; i < n; i++ {
		bounds := screenshot.GetDisplayBounds(i)
		monitors[i] = MonitorInfo{
			Index:     i,
			Name:      fmt.Sprintf("Display %d", i+1),
			Width:     bounds.Dx(),
			Height:    bounds.Dy(),
			X:         bounds.Min.X,
			Y:         bounds.Min.Y,
			IsPrimary: i == 0, // First display is typically primary
		}
	}

	return monitors
}

// SavePNG saves an image as PNG (for debugging).
func SavePNG(img image.Image, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}
