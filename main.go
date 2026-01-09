package main

import (
	"context"
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
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

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Traq",
		Width:  1680,
		Height: 1050,
		AssetServer: &assetserver.Options{
			Assets:  assets,
			Handler: handler,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup: func(ctx context.Context) {
			app.startup(ctx)
			// Now that app is initialized, set the data directory
			handler.dataDir = app.platform.DataDir()
		},
		OnShutdown:    app.shutdown,
		OnBeforeClose: app.beforeClose,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
