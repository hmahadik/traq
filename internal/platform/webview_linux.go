//go:build linux

package platform

import "os"

// nvidiaProcPath exists only on Linux with the proprietary NVIDIA driver
// loaded. Indirected so the probe is testable.
var nvidiaProcPath = "/proc/driver/nvidia"

// ConfigureWebviewEnv applies environment quirks the embedded webview needs on
// this platform. It must run before the webview is created.
//
// WebKitGTK's DMABuf renderer is pathologically slow on NVIDIA proprietary
// drivers (large-surface paints take 100ms+); the legacy GL path is several
// times faster. Users can override by setting the variable themselves.
func ConfigureWebviewEnv() {
	if _, set := os.LookupEnv("WEBKIT_DISABLE_DMABUF_RENDERER"); set {
		return
	}
	if _, err := os.Stat(nvidiaProcPath); err != nil {
		return
	}
	os.Setenv("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
}
