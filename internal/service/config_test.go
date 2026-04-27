package service

import (
	"testing"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
)

// stubPlatform is the minimum Platform implementation needed to construct a
// ConfigService for persistence-layer tests. Only DataDir is exercised by
// GetConfig + UpdateConfig; the other methods panic loudly so an unintended
// dependency on them surfaces as a test failure rather than silent zero
// values.
type stubPlatform struct{ dataDir string }

func (s *stubPlatform) DataDir() string                                { return s.dataDir }
func (s *stubPlatform) ConfigDir() string                              { return s.dataDir }
func (s *stubPlatform) CacheDir() string                               { return s.dataDir }
func (s *stubPlatform) GetActiveWindow() (*platform.WindowInfo, error) { panic("not used") }
func (s *stubPlatform) GetLastInputTime() (time.Time, error)           { panic("not used") }
func (s *stubPlatform) GetShellHistoryPath() string                    { return "" }
func (s *stubPlatform) GetShellType() string                           { return "bash" }
func (s *stubPlatform) GetBrowserHistoryPaths() map[string]string      { return nil }
func (s *stubPlatform) OpenURL(string) error                           { return nil }
func (s *stubPlatform) ShowNotification(string, string) error          { return nil }
func (s *stubPlatform) SetAutoStart(bool) error                        { return nil }
func (s *stubPlatform) IsAutoStartEnabled() (bool, error)              { return false, nil }
func (s *stubPlatform) GetSystemTheme() string                         { return "light" }

func newTestConfigService(t *testing.T) *ConfigService {
	t.Helper()
	store := storage.NewInMemoryTestStore(t)
	t.Cleanup(func() { store.Close() })
	// Daemon is nil — the AI tracking side-effect handler guards on this and
	// becomes a no-op, which is exactly what we want for a persistence-layer
	// round-trip test.
	return NewConfigService(store, &stubPlatform{dataDir: t.TempDir()}, nil)
}

// TestUpdateConfigPersistsAITracking is the regression for the bug where
// every aiTracking.* field got silently dropped by UpdateConfig: the keys
// were missing from mapToStorageKey, so the unknown-key skip swallowed
// them, and GetConfig had no read path either. Toggles in the Settings UI
// appeared to "not click" because the round trip returned defaults.
func TestUpdateConfigPersistsAITracking(t *testing.T) {
	svc := newTestConfigService(t)

	// Defaults should be present on a fresh service so the UI has something
	// to render even before any user interaction.
	cfg, err := svc.GetConfig()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.DataSources == nil || cfg.DataSources.AITracking == nil {
		t.Fatal("default config missing aiTracking section")
	}
	if !cfg.DataSources.AITracking.Enabled {
		t.Errorf("default aiTracking.enabled = false, want true")
	}

	// Flip every field to a non-default value and persist.
	updates := map[string]interface{}{
		"dataSources": map[string]interface{}{
			"aiTracking": map[string]interface{}{
				"enabled":            false,
				"claudeEnabled":      false,
				"openCodeEnabled":    false,
				"idleGapSeconds":     float64(900), // JSON numbers arrive as float64
				"storePromptContent": true,
			},
		},
	}
	if err := svc.UpdateConfig(updates); err != nil {
		t.Fatalf("UpdateConfig: %v", err)
	}

	got, err := svc.GetConfig()
	if err != nil {
		t.Fatal(err)
	}
	ai := got.DataSources.AITracking
	if ai == nil {
		t.Fatal("aiTracking section dropped after persist")
	}
	if ai.Enabled {
		t.Errorf("Enabled = true after persist false")
	}
	if ai.ClaudeEnabled {
		t.Errorf("ClaudeEnabled = true after persist false")
	}
	if ai.OpenCodeEnabled {
		t.Errorf("OpenCodeEnabled = true after persist false")
	}
	if ai.IdleGapSeconds != 900 {
		t.Errorf("IdleGapSeconds = %d, want 900", ai.IdleGapSeconds)
	}
	if !ai.StorePromptContent {
		t.Errorf("StorePromptContent = false after persist true")
	}
}

// TestUpdateConfigPartialAITracking confirms the load path overlays stored
// values on top of defaults rather than zeroing the rest of the section.
// The frontend's settings page sends per-toggle deltas; if a partial save
// reset unspecified fields, flipping one toggle would clobber the others.
func TestUpdateConfigPartialAITracking(t *testing.T) {
	svc := newTestConfigService(t)

	updates := map[string]interface{}{
		"dataSources": map[string]interface{}{
			"aiTracking": map[string]interface{}{
				"claudeEnabled": false,
			},
		},
	}
	if err := svc.UpdateConfig(updates); err != nil {
		t.Fatal(err)
	}

	got, err := svc.GetConfig()
	if err != nil {
		t.Fatal(err)
	}
	ai := got.DataSources.AITracking
	if ai.ClaudeEnabled {
		t.Errorf("ClaudeEnabled not persisted")
	}
	// Other fields must keep their defaults.
	if !ai.Enabled {
		t.Errorf("partial save clobbered Enabled (now false, want default true)")
	}
	if !ai.OpenCodeEnabled {
		t.Errorf("partial save clobbered OpenCodeEnabled")
	}
	if ai.IdleGapSeconds != 1800 {
		t.Errorf("partial save clobbered IdleGapSeconds: got %d, want default 1800", ai.IdleGapSeconds)
	}
}
