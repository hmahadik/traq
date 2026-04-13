//go:build !linux

package tracker

import (
	"image"

	"github.com/kbinani/screenshot"
)

// captureRect captures a screen region. On non-Linux platforms, the kbinani
// library works without visual artifacts, so we use it directly.
func captureRect(bounds image.Rectangle) (*image.RGBA, error) {
	return screenshot.CaptureRect(bounds)
}
