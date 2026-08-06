//go:build !linux

package platform

// ConfigureWebviewEnv applies environment quirks the embedded webview needs on
// this platform. No platform other than Linux needs any today.
func ConfigureWebviewEnv() {}
