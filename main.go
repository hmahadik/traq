package main

import (
	"context"
	"embed"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"traq/internal/tray"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

// screenshotHandler serves screenshot files from the data directory
type screenshotHandler struct {
	dataDir string
}

func (h *screenshotHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Only handle paths starting with /screenshots/
	if !strings.HasPrefix(r.URL.Path, "/screenshots/") {
		// Not a screenshot request - don't handle it here.
		// Return without writing anything to let Wails serve index.html for SPA routing.
		return
	}

	// Extract the relative path after /screenshots/
	relPath := strings.TrimPrefix(r.URL.Path, "/screenshots/")
	if relPath == "" {
		http.NotFound(w, r)
		return
	}

	// Build the full path
	fullPath := filepath.Join(h.dataDir, "screenshots", relPath)

	// Security check: make sure we're not escaping the screenshots directory
	screenshotsDir := filepath.Join(h.dataDir, "screenshots")
	if !strings.HasPrefix(fullPath, screenshotsDir) {
		http.Error(w, "Invalid path", http.StatusForbidden)
		return
	}

	// Check if file exists
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}

	// Serve the file
	http.ServeFile(w, r, fullPath)
}

func main() {
	// Create an instance of the app structure
	app := NewApp()

	// Get data directory (will be set during startup, but we need path pattern)
	// This is a temporary handler that gets replaced after startup
	handler := &screenshotHandler{}

	// Wails context (set during OnStartup)
	var wailsCtx context.Context

	// System tray instance
	var sysTray *tray.Tray

	// Create application with options
	err := wails.Run(&options.App{
		Title:             "Traq",
		Width:             1680,
		Height:            1050,
		HideWindowOnClose: true, // Keep app running in tray when window is closed
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: handler,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			wailsCtx = ctx
			app.startup(ctx)
			// Now that app is initialized, set the data directory
			handler.dataDir = app.platform.DataDir()

			// Initialize and start system tray
			sysTray = tray.New(tray.Config{
				OnShowWindow: func() {
					runtime.WindowShow(wailsCtx)
					runtime.WindowSetAlwaysOnTop(wailsCtx, true)
					runtime.WindowSetAlwaysOnTop(wailsCtx, false)
				},
				OnQuit: func() {
					runtime.Quit(wailsCtx)
				},
				OnPause: func() {
					app.PauseCapture()
					if sysTray != nil {
						sysTray.SetPaused(true)
						sysTray.SetCapturing(false)
					}
				},
				OnResume: func() {
					app.ResumeCapture()
					if sysTray != nil {
						sysTray.SetPaused(false)
						sysTray.SetCapturing(true)
					}
				},
				OnForce: func() {
					if _, err := app.ForceCapture(); err != nil {
						log.Printf("Force capture failed: %v", err)
					}
				},
			})
			go sysTray.Run()
		},
		OnShutdown: func(ctx context.Context) {
			// Quit the system tray
			if sysTray != nil {
				sysTray.Quit()
			}
			app.shutdown(ctx)
		},
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
