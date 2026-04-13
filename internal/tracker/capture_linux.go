//go:build linux

package tracker

import (
	"context"
	"fmt"
	"image"
	"image/draw"
	"image/png"
	"log"
	"os"
	"os/exec"
	"sync"
	"time"

	"github.com/godbus/dbus/v5"
	"github.com/kbinani/screenshot"
)

// captureMethod tracks which Wayland capture approach works on this system.
// Once a method succeeds, we stick with it to avoid re-probing every tick.
type captureMethod int

const (
	captureMethodUnknown captureMethod = iota
	captureMethodGrim
	captureMethodGnomeShell
	captureMethodPortal // fallback — will flash
)

var (
	detectedMethod captureMethod
	detectOnce     sync.Once
)

// captureRect captures a screen region, using a flash-free method on Wayland.
func captureRect(bounds image.Rectangle) (*image.RGBA, error) {
	if os.Getenv("XDG_SESSION_TYPE") != "wayland" {
		return screenshot.CaptureRect(bounds)
	}
	return captureWayland(bounds)
}

// captureWayland tries flash-free capture methods before falling back to the portal.
func captureWayland(bounds image.Rectangle) (*image.RGBA, error) {
	detectOnce.Do(func() {
		detectedMethod = probeWaylandMethod()
	})

	switch detectedMethod {
	case captureMethodGrim:
		img, err := captureWithGrim(bounds)
		if err == nil {
			return img, nil
		}
		log.Printf("grim capture failed, falling back to portal: %v", err)
	case captureMethodGnomeShell:
		img, err := captureWithGnomeShell(bounds)
		if err == nil {
			return img, nil
		}
		log.Printf("GNOME Shell capture failed, falling back to portal: %v", err)
	}

	// Portal fallback — this will flash
	return screenshot.CaptureRect(bounds)
}

// probeWaylandMethod detects which flash-free capture method is available.
func probeWaylandMethod() captureMethod {
	// 1. Check for grim (wlroots compositors: Sway, Hyprland, river, etc.)
	if _, err := exec.LookPath("grim"); err == nil {
		log.Println("Wayland capture: using grim (no flash)")
		return captureMethodGrim
	}

	// 2. Check for GNOME Shell's private screenshot API
	conn, err := dbus.ConnectSessionBus()
	if err == nil {
		defer conn.Close()
		obj := conn.Object("org.gnome.Shell.Screenshot", "/org/gnome/Shell/Screenshot")
		// Ping the interface — if it exists, we can use it
		call := obj.Call("org.freedesktop.DBus.Peer.Ping", 0)
		if call.Err == nil {
			log.Println("Wayland capture: using GNOME Shell Screenshot API (no flash)")
			return captureMethodGnomeShell
		}
	}

	log.Println("Wayland capture: no flash-free method available, using portal (will flash)")
	return captureMethodPortal
}

// captureWithGrim captures a screen region using the grim CLI tool.
// grim works on wlroots-based compositors without any visual feedback.
func captureWithGrim(bounds image.Rectangle) (*image.RGBA, error) {
	tmpFile, err := os.CreateTemp("", "traq-capture-*.png")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	geometry := fmt.Sprintf("%d,%d %dx%d",
		bounds.Min.X, bounds.Min.Y,
		bounds.Dx(), bounds.Dy())

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "grim", "-g", geometry, "-t", "png", tmpPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("grim failed: %w: %s", err, string(out))
	}

	return decodePNGFile(tmpPath)
}

// captureWithGnomeShell captures a screen region using GNOME Shell's D-Bus API.
// The ScreenshotArea method accepts a flash parameter which we set to false.
func captureWithGnomeShell(bounds image.Rectangle) (*image.RGBA, error) {
	tmpFile, err := os.CreateTemp("", "traq-capture-*.png")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmpFile.Name()
	tmpFile.Close()
	defer os.Remove(tmpPath)

	conn, err := dbus.ConnectSessionBus()
	if err != nil {
		return nil, fmt.Errorf("failed to connect to session bus: %w", err)
	}
	defer conn.Close()

	obj := conn.Object("org.gnome.Shell.Screenshot", "/org/gnome/Shell/Screenshot")

	var success bool
	var resultPath string

	err = obj.Call(
		"org.gnome.Shell.Screenshot.ScreenshotArea",
		0,
		int32(bounds.Min.X),
		int32(bounds.Min.Y),
		int32(bounds.Dx()),
		int32(bounds.Dy()),
		false,      // flash = false (the whole point)
		tmpPath,
	).Store(&success, &resultPath)

	if err != nil {
		return nil, fmt.Errorf("GNOME Shell ScreenshotArea failed: %w", err)
	}
	if !success {
		return nil, fmt.Errorf("GNOME Shell ScreenshotArea returned false")
	}

	// GNOME may write to a different path than requested
	readPath := tmpPath
	if resultPath != "" {
		readPath = resultPath
		if readPath != tmpPath {
			defer os.Remove(readPath)
		}
	}

	return decodePNGFile(readPath)
}

// decodePNGFile reads a PNG file and returns it as *image.RGBA.
func decodePNGFile(path string) (*image.RGBA, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open %s: %w", path, err)
	}
	defer f.Close()

	img, err := png.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("failed to decode PNG: %w", err)
	}

	// Convert to RGBA if needed
	if rgba, ok := img.(*image.RGBA); ok {
		return rgba, nil
	}

	b := img.Bounds()
	rgba := image.NewRGBA(b)
	draw.Draw(rgba, b, img, b.Min, draw.Src)
	return rgba, nil
}
