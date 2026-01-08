package service

import (
	"encoding/json"
	"strconv"
	"time"

	"traq/internal/platform"
	"traq/internal/storage"
	"traq/internal/tracker"
)

// ConfigService manages application configuration.
type ConfigService struct {
	store    *storage.Store
	platform platform.Platform
	daemon   *tracker.Daemon
}

// NewConfigService creates a new ConfigService.
func NewConfigService(store *storage.Store, plat platform.Platform, daemon *tracker.Daemon) *ConfigService {
	return &ConfigService{
		store:    store,
		platform: plat,
		daemon:   daemon,
	}
}

// SetDaemon sets the daemon reference (for late initialization).
func (s *ConfigService) SetDaemon(daemon *tracker.Daemon) {
	s.daemon = daemon
}

// Config represents the full application configuration.
type Config struct {
	Capture     *CaptureConfig     `json:"capture"`
	AFK         *AFKConfig         `json:"afk"`
	Inference   *InferenceConfig   `json:"inference"`
	DataSources *DataSourcesConfig `json:"dataSources"`
	UI          *UIConfig          `json:"ui"`
	System      *SystemConfig      `json:"system"`
}

// InferenceConfig contains AI inference settings.
type InferenceConfig struct {
	Engine  string                 `json:"engine"` // "bundled", "ollama", "cloud"
	Bundled *BundledInferenceConfig `json:"bundled"`
	Ollama  *OllamaConfig          `json:"ollama"`
	Cloud   *CloudConfig           `json:"cloud"`
}

// BundledInferenceConfig contains bundled model settings.
type BundledInferenceConfig struct {
	Model string `json:"model"`
}

// OllamaConfig contains Ollama settings.
type OllamaConfig struct {
	Host  string `json:"host"`
	Model string `json:"model"`
}

// CloudConfig contains cloud API settings.
type CloudConfig struct {
	Provider string `json:"provider"` // "anthropic", "openai"
	APIKey   string `json:"apiKey"`
	Model    string `json:"model"`
}

// CaptureConfig contains screenshot capture settings.
type CaptureConfig struct {
	Enabled            bool `json:"enabled"`
	IntervalSeconds    int  `json:"intervalSeconds"`
	Quality            int  `json:"quality"`
	DuplicateThreshold int  `json:"duplicateThreshold"`
}

// AFKConfig contains AFK detection settings.
type AFKConfig struct {
	TimeoutSeconds    int `json:"timeoutSeconds"`
	MinSessionMinutes int `json:"minSessionMinutes"`
}

// DataSourcesConfig contains settings for data sources.
type DataSourcesConfig struct {
	Shell   *ShellConfig   `json:"shell"`
	Git     *GitConfig     `json:"git"`
	Files   *FilesConfig   `json:"files"`
	Browser *BrowserConfig `json:"browser"`
}

// ShellConfig contains shell history settings.
type ShellConfig struct {
	Enabled         bool     `json:"enabled"`
	ExcludePatterns []string `json:"excludePatterns"`
}

// GitConfig contains git tracking settings.
type GitConfig struct {
	Enabled     bool     `json:"enabled"`
	SearchPaths []string `json:"searchPaths"`
	MaxDepth    int      `json:"maxDepth"`
}

// FilesConfig contains file watching settings.
type FilesConfig struct {
	Enabled bool          `json:"enabled"`
	Watches []*WatchPath  `json:"watches"`
}

// WatchPath represents a path to watch.
type WatchPath struct {
	Path      string `json:"path"`
	Category  string `json:"category"`
	Recursive bool   `json:"recursive"`
}

// BrowserConfig contains browser history settings.
type BrowserConfig struct {
	Enabled  bool     `json:"enabled"`
	Browsers []string `json:"browsers"`
}

// UIConfig contains UI settings.
type UIConfig struct {
	Theme             string `json:"theme"` // "light", "dark", "system"
	StartMinimized    bool   `json:"startMinimized"`
	ShowNotifications bool   `json:"showNotifications"`
}

// SystemConfig contains system settings.
type SystemConfig struct {
	AutoStart    bool   `json:"autoStart"`
	StartOnLogin bool   `json:"startOnLogin"`
	DataDir      string `json:"dataDir"`
}

// DaemonStatus represents the current daemon status.
type DaemonStatus struct {
	Running         bool   `json:"running"`
	IsAFK           bool   `json:"isAFK"`
	SessionID       int64  `json:"sessionId"`
	SessionDuration int64  `json:"sessionDuration"` // seconds
	IdleDuration    int64  `json:"idleDuration"`    // seconds
}

// GetConfig returns the current configuration.
func (s *ConfigService) GetConfig() (*Config, error) {
	config := &Config{
		Capture:     s.getDefaultCaptureConfig(),
		AFK:         s.getDefaultAFKConfig(),
		Inference:   s.getDefaultInferenceConfig(),
		DataSources: s.getDefaultDataSourcesConfig(),
		UI:          s.getDefaultUIConfig(),
		System:      s.getDefaultSystemConfig(),
	}

	// Load from database
	if val, err := s.store.GetConfig("capture.enabled"); err == nil {
		config.Capture.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("capture.interval"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Capture.IntervalSeconds = v
		}
	}
	if val, err := s.store.GetConfig("capture.quality"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Capture.Quality = v
		}
	}
	if val, err := s.store.GetConfig("capture.duplicateThreshold"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Capture.DuplicateThreshold = v
		}
	}
	if val, err := s.store.GetConfig("afk.timeout"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.AFK.TimeoutSeconds = v
		}
	}
	if val, err := s.store.GetConfig("ui.theme"); err == nil {
		config.UI.Theme = val
	}
	if val, err := s.store.GetConfig("ui.showNotifications"); err == nil {
		config.UI.ShowNotifications = val == "true"
	}
	if val, err := s.store.GetConfig("shell.enabled"); err == nil {
		config.DataSources.Shell.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("git.enabled"); err == nil {
		config.DataSources.Git.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("git.searchPaths"); err == nil {
		json.Unmarshal([]byte(val), &config.DataSources.Git.SearchPaths)
	}
	if val, err := s.store.GetConfig("files.enabled"); err == nil {
		config.DataSources.Files.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("browser.enabled"); err == nil {
		config.DataSources.Browser.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("browser.browsers"); err == nil {
		json.Unmarshal([]byte(val), &config.DataSources.Browser.Browsers)
	}

	return config, nil
}

// UpdateConfig updates configuration values.
// It handles nested objects by flattening them to dot-notation keys.
func (s *ConfigService) UpdateConfig(updates map[string]interface{}) error {
	// Flatten nested objects and map keys to storage format
	flattened := make(map[string]interface{})
	flattenUpdates("", updates, flattened)

	for key, value := range flattened {
		// Map frontend keys to storage keys
		storageKey := mapToStorageKey(key)
		if storageKey == "" {
			continue // Skip unknown keys
		}

		var strVal string
		switch v := value.(type) {
		case string:
			strVal = v
		case bool:
			strVal = strconv.FormatBool(v)
		case float64:
			strVal = strconv.Itoa(int(v))
		case int:
			strVal = strconv.Itoa(v)
		case []string:
			b, _ := json.Marshal(v)
			strVal = string(b)
		case []interface{}:
			b, _ := json.Marshal(v)
			strVal = string(b)
		default:
			b, _ := json.Marshal(v)
			strVal = string(b)
		}

		if err := s.store.SetConfig(storageKey, strVal); err != nil {
			return err
		}
	}

	return nil
}

// flattenUpdates recursively flattens nested maps to dot-notation keys.
func flattenUpdates(prefix string, input map[string]interface{}, output map[string]interface{}) {
	for key, value := range input {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}

		if nested, ok := value.(map[string]interface{}); ok {
			flattenUpdates(fullKey, nested, output)
		} else {
			output[fullKey] = value
		}
	}
}

// mapToStorageKey maps frontend config keys to storage keys.
// Returns empty string for unknown keys.
func mapToStorageKey(frontendKey string) string {
	keyMap := map[string]string{
		// Capture settings
		"capture.enabled":            "capture.enabled",
		"capture.intervalSeconds":    "capture.interval",
		"capture.quality":            "capture.quality",
		"capture.duplicateThreshold": "capture.duplicateThreshold",

		// AFK settings
		"afk.timeoutSeconds":    "afk.timeout",
		"afk.minSessionMinutes": "afk.minSessionMinutes",

		// UI settings
		"ui.theme":             "ui.theme",
		"ui.showNotifications": "ui.showNotifications",
		"ui.startMinimized":    "ui.startMinimized",

		// System settings
		"system.startOnLogin": "system.startOnLogin",
		"system.autoStart":    "system.autoStart",

		// Data sources
		"dataSources.shell.enabled":   "shell.enabled",
		"dataSources.git.enabled":     "git.enabled",
		"dataSources.git.searchPaths": "git.searchPaths",
		"dataSources.files.enabled":   "files.enabled",
		"dataSources.browser.enabled": "browser.enabled",

		// Inference settings
		"inference.engine":         "inference.engine",
		"inference.bundled.model":  "inference.bundled.model",
		"inference.ollama.host":    "inference.ollama.host",
		"inference.ollama.model":   "inference.ollama.model",
		"inference.cloud.provider": "inference.cloud.provider",
		"inference.cloud.apiKey":   "inference.cloud.apiKey",
		"inference.cloud.model":    "inference.cloud.model",
	}

	if storageKey, ok := keyMap[frontendKey]; ok {
		return storageKey
	}
	return ""
}

// GetDaemonStatus returns the current daemon status.
func (s *ConfigService) GetDaemonStatus() (*DaemonStatus, error) {
	if s.daemon == nil {
		return &DaemonStatus{Running: false}, nil
	}

	status := s.daemon.GetStatus()
	daemonStatus := &DaemonStatus{
		Running:      status.Running,
		IsAFK:        status.IsAFK,
		IdleDuration: int64(status.IdleDuration.Seconds()),
	}

	if status.CurrentSession != nil {
		daemonStatus.SessionID = status.CurrentSession.ID
	}
	daemonStatus.SessionDuration = int64(status.SessionDuration.Seconds())

	return daemonStatus, nil
}

// StartDaemon starts the tracking daemon.
func (s *ConfigService) StartDaemon() error {
	if s.daemon == nil {
		return nil
	}
	return s.daemon.Start()
}

// StopDaemon stops the tracking daemon.
func (s *ConfigService) StopDaemon() error {
	if s.daemon == nil {
		return nil
	}
	return s.daemon.Stop()
}

// RestartDaemon restarts the tracking daemon.
func (s *ConfigService) RestartDaemon() error {
	if s.daemon == nil {
		return nil
	}

	// Get updated config
	config, err := s.GetConfig()
	if err != nil {
		return err
	}

	// Stop if running
	if s.daemon.IsRunning() {
		if err := s.daemon.Stop(); err != nil {
			return err
		}
	}

	// Update daemon config
	daemonConfig := &tracker.DaemonConfig{
		Interval:           time.Duration(config.Capture.IntervalSeconds) * time.Second,
		AFKTimeout:         time.Duration(config.AFK.TimeoutSeconds) * time.Second,
		Quality:            config.Capture.Quality,
		DuplicateThreshold: config.Capture.DuplicateThreshold,
		DataDir:            s.platform.DataDir(),
	}
	s.daemon.UpdateConfig(daemonConfig)

	// Start
	return s.daemon.Start()
}

// GetStorageStats returns storage statistics.
func (s *ConfigService) GetStorageStats() (*StorageStats, error) {
	stats := &StorageStats{}

	stats.ScreenshotCount, _ = s.store.CountScreenshots()
	stats.SessionCount, _ = s.store.CountSessions()
	stats.SummaryCount, _ = s.store.CountSummaries()
	stats.ShellCommandCount, _ = s.store.CountShellCommands()
	stats.GitCommitCount, _ = s.store.CountGitCommits()
	stats.FileEventCount, _ = s.store.CountFileEvents()
	stats.BrowserVisitCount, _ = s.store.CountBrowserVisits()

	// TODO: Calculate actual storage size
	stats.DatabaseSize = 0
	stats.ScreenshotsSize = 0

	return stats, nil
}

// StorageStats contains database statistics.
type StorageStats struct {
	ScreenshotCount   int64 `json:"screenshotCount"`
	SessionCount      int64 `json:"sessionCount"`
	SummaryCount      int64 `json:"summaryCount"`
	ShellCommandCount int64 `json:"shellCommandCount"`
	GitCommitCount    int64 `json:"gitCommitCount"`
	FileEventCount    int64 `json:"fileEventCount"`
	BrowserVisitCount int64 `json:"browserVisitCount"`
	DatabaseSize      int64 `json:"databaseSize"`      // bytes
	ScreenshotsSize   int64 `json:"screenshotsSize"`   // bytes
}

func (s *ConfigService) getDefaultCaptureConfig() *CaptureConfig {
	return &CaptureConfig{
		Enabled:            true,
		IntervalSeconds:    30,
		Quality:            80,
		DuplicateThreshold: 3,
	}
}

func (s *ConfigService) getDefaultAFKConfig() *AFKConfig {
	return &AFKConfig{
		TimeoutSeconds:    180,
		MinSessionMinutes: 5,
	}
}

func (s *ConfigService) getDefaultDataSourcesConfig() *DataSourcesConfig {
	return &DataSourcesConfig{
		Shell: &ShellConfig{
			Enabled:         true,
			ExcludePatterns: []string{"^(ls|cd|pwd|clear)$"},
		},
		Git: &GitConfig{
			Enabled:     true,
			SearchPaths: []string{"~/projects", "~/code"},
			MaxDepth:    3,
		},
		Files: &FilesConfig{
			Enabled: true,
			Watches: []*WatchPath{
				{Path: "~/Downloads", Category: "downloads", Recursive: false},
			},
		},
		Browser: &BrowserConfig{
			Enabled:  true,
			Browsers: []string{"chrome", "firefox"},
		},
	}
}

func (s *ConfigService) getDefaultUIConfig() *UIConfig {
	return &UIConfig{
		Theme:             "system",
		StartMinimized:    false,
		ShowNotifications: true,
	}
}

func (s *ConfigService) getDefaultSystemConfig() *SystemConfig {
	return &SystemConfig{
		AutoStart:    true,
		StartOnLogin: true,
		DataDir:      s.platform.DataDir(),
	}
}

func (s *ConfigService) getDefaultInferenceConfig() *InferenceConfig {
	return &InferenceConfig{
		Engine: "ollama",
		Bundled: &BundledInferenceConfig{
			Model: "gemma3:4b-it-qat",
		},
		Ollama: &OllamaConfig{
			Host:  "http://localhost:11434",
			Model: "gemma3:12b-it-qat",
		},
		Cloud: &CloudConfig{
			Provider: "anthropic",
			APIKey:   "",
			Model:    "claude-sonnet-4-20250514",
		},
	}
}
