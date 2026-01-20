package service

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
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

// SyncAutoStart ensures the system autostart state matches the config.
// This should be called on app startup to handle cases where:
// - Fresh install with default config (startOnLogin=true) but no .desktop file
// - Config was changed while app wasn't running
func (s *ConfigService) SyncAutoStart() error {
	config, err := s.GetConfig()
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	// Check current system state
	systemEnabled, err := s.platform.IsAutoStartEnabled()
	if err != nil {
		return fmt.Errorf("failed to check autostart state: %w", err)
	}

	// Sync if config and system state don't match
	configEnabled := config.System.StartOnLogin
	if systemEnabled != configEnabled {
		if err := s.platform.SetAutoStart(configEnabled); err != nil {
			return fmt.Errorf("failed to sync autostart: %w", err)
		}
	}

	return nil
}

// Config represents the full application configuration.
type Config struct {
	Capture     *CaptureConfig     `json:"capture"`
	AFK         *AFKConfig         `json:"afk"`
	Inference   *InferenceConfig   `json:"inference"`
	DataSources *DataSourcesConfig `json:"dataSources"`
	UI          *UIConfig          `json:"ui"`
	System      *SystemConfig      `json:"system"`
	Issues      *IssuesConfig      `json:"issues"`
	Update      *UpdateConfig      `json:"update"`
	Timeline    *TimelineConfig    `json:"timeline"`
}

// TimelineConfig contains timeline display settings.
type TimelineConfig struct {
	MinActivityDurationSeconds int    `json:"minActivityDurationSeconds"` // Filter activities shorter than this (0 = show all)
	TitleDisplay               string `json:"titleDisplay"`               // "full", "app_only", "minimal"
	AppGrouping                bool   `json:"appGrouping"`                // Merge consecutive same-app activities
	ContinuityMergeSeconds     int    `json:"continuityMergeSeconds"`     // Merge across brief switches (0, 30, 60, 120)
}

// UpdateConfig contains auto-update settings.
type UpdateConfig struct {
	AutoUpdate        bool `json:"autoUpdate"`        // Default: true
	CheckIntervalHours int  `json:"checkIntervalHours"` // Default: 5
	AFKRestartMinutes int  `json:"afkRestartMinutes"` // Default: 10
}

// IssuesConfig contains issue reporting settings.
type IssuesConfig struct {
	CrashReportingEnabled bool   `json:"crashReportingEnabled"` // Send crash reports to Sentry
	WebhookEnabled        bool   `json:"webhookEnabled"`
	WebhookUrl            string `json:"webhookUrl"`
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
	Endpoint string `json:"endpoint"` // Custom API endpoint (optional)
}

// CaptureConfig contains screenshot capture settings.
type CaptureConfig struct {
	Enabled            bool   `json:"enabled"`
	IntervalSeconds    int    `json:"intervalSeconds"`
	Quality            int    `json:"quality"`
	DuplicateThreshold int    `json:"duplicateThreshold"`
	MonitorMode        string `json:"monitorMode"`  // "active_window", "primary", "specific"
	MonitorIndex       int    `json:"monitorIndex"` // Only used when MonitorMode is "specific"
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
	ShellType       string   `json:"shellType"`       // "auto", "bash", "zsh", "fish", "powershell"
	HistoryPath     string   `json:"historyPath"`     // Custom path to history file (empty = auto-detect)
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
	Enabled           bool          `json:"enabled"`
	Watches           []*WatchPath  `json:"watches"`
	ExcludePatterns   []string      `json:"excludePatterns"`   // Directory patterns to exclude
	AllowedExtensions []string      `json:"allowedExtensions"` // File extensions to track (empty = all)
}

// WatchPath represents a path to watch.
type WatchPath struct {
	Path      string `json:"path"`
	Category  string `json:"category"`
	Recursive bool   `json:"recursive"`
}

// BrowserConfig contains browser history settings.
type BrowserConfig struct {
	Enabled          bool     `json:"enabled"`
	Browsers         []string `json:"browsers"`
	ExcludedDomains  []string `json:"excludedDomains"`
	HistoryLimitDays int      `json:"historyLimitDays"` // Limit how far back to read browser history (0 = unlimited)
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
	Paused          bool   `json:"paused"`
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
		Update:      s.getDefaultUpdateConfig(),
		Timeline:    s.getDefaultTimelineConfig(),
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
	if val, err := s.store.GetConfig("capture.monitorMode"); err == nil && val != "" {
		config.Capture.MonitorMode = val
	}
	if val, err := s.store.GetConfig("capture.monitorIndex"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Capture.MonitorIndex = v
		}
	}
	if val, err := s.store.GetConfig("afk.timeout"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.AFK.TimeoutSeconds = v
		}
	}
	if val, err := s.store.GetConfig("afk.minSessionMinutes"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.AFK.MinSessionMinutes = v
		}
	}
	if val, err := s.store.GetConfig("ui.theme"); err == nil && val != "" {
		config.UI.Theme = val
	}
	if val, err := s.store.GetConfig("ui.showNotifications"); err == nil {
		config.UI.ShowNotifications = val == "true"
	}
	if val, err := s.store.GetConfig("shell.enabled"); err == nil {
		config.DataSources.Shell.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("shell.shellType"); err == nil && val != "" {
		config.DataSources.Shell.ShellType = val
	}
	if val, err := s.store.GetConfig("shell.historyPath"); err == nil && val != "" {
		config.DataSources.Shell.HistoryPath = val
	}
	if val, err := s.store.GetConfig("shell.excludePatterns"); err == nil && val != "" {
		json.Unmarshal([]byte(val), &config.DataSources.Shell.ExcludePatterns)
	}
	if val, err := s.store.GetConfig("git.enabled"); err == nil {
		config.DataSources.Git.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("git.searchPaths"); err == nil {
		json.Unmarshal([]byte(val), &config.DataSources.Git.SearchPaths)
	}
	if val, err := s.store.GetConfig("git.maxDepth"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.DataSources.Git.MaxDepth = v
		}
	}
	if val, err := s.store.GetConfig("files.enabled"); err == nil {
		config.DataSources.Files.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("files.excludePatterns"); err == nil && val != "" {
		json.Unmarshal([]byte(val), &config.DataSources.Files.ExcludePatterns)
	}
	if val, err := s.store.GetConfig("browser.enabled"); err == nil {
		config.DataSources.Browser.Enabled = val == "true"
	}
	if val, err := s.store.GetConfig("browser.browsers"); err == nil {
		json.Unmarshal([]byte(val), &config.DataSources.Browser.Browsers)
	}
	if val, err := s.store.GetConfig("browser.excludedDomains"); err == nil && val != "" {
		json.Unmarshal([]byte(val), &config.DataSources.Browser.ExcludedDomains)
	}
	if val, err := s.store.GetConfig("browser.historyLimitDays"); err == nil && val != "" {
		if v, e := strconv.Atoi(val); e == nil {
			config.DataSources.Browser.HistoryLimitDays = v
		}
	}

	// Issues settings
	config.Issues = &IssuesConfig{
		CrashReportingEnabled: true, // Default: send crash reports to Sentry
		WebhookEnabled:        false,
		WebhookUrl:            "",
	}
	if val, err := s.store.GetConfig("issues.crashReportingEnabled"); err == nil {
		config.Issues.CrashReportingEnabled = val != "false" // Default true unless explicitly disabled
	}
	if val, err := s.store.GetConfig("issues.webhookEnabled"); err == nil {
		config.Issues.WebhookEnabled = val == "true"
	}
	if val, err := s.store.GetConfig("issues.webhookUrl"); err == nil && val != "" {
		config.Issues.WebhookUrl = val
	}

	// Inference settings
	if val, err := s.store.GetConfig("inference.engine"); err == nil && val != "" {
		config.Inference.Engine = val
	}
	if val, err := s.store.GetConfig("inference.bundled.model"); err == nil && val != "" {
		config.Inference.Bundled.Model = val
	}
	if val, err := s.store.GetConfig("inference.ollama.host"); err == nil && val != "" {
		config.Inference.Ollama.Host = val
	}
	if val, err := s.store.GetConfig("inference.ollama.model"); err == nil && val != "" {
		config.Inference.Ollama.Model = val
	}
	if val, err := s.store.GetConfig("inference.cloud.provider"); err == nil && val != "" {
		config.Inference.Cloud.Provider = val
	}
	if val, err := s.store.GetConfig("inference.cloud.apiKey"); err == nil && val != "" {
		config.Inference.Cloud.APIKey = val
	}
	if val, err := s.store.GetConfig("inference.cloud.model"); err == nil && val != "" {
		config.Inference.Cloud.Model = val
	}
	if val, err := s.store.GetConfig("inference.cloud.endpoint"); err == nil && val != "" {
		config.Inference.Cloud.Endpoint = val
	}

	// Update settings
	if val, err := s.store.GetConfig("update.autoUpdate"); err == nil {
		config.Update.AutoUpdate = val == "true"
	}
	if val, err := s.store.GetConfig("update.checkIntervalHours"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Update.CheckIntervalHours = v
		}
	}
	if val, err := s.store.GetConfig("update.afkRestartMinutes"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Update.AFKRestartMinutes = v
		}
	}

	// Timeline settings
	if val, err := s.store.GetConfig("timeline.minActivityDurationSeconds"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Timeline.MinActivityDurationSeconds = v
		}
	}
	if val, err := s.store.GetConfig("timeline.titleDisplay"); err == nil && val != "" {
		config.Timeline.TitleDisplay = val
	}
	if val, err := s.store.GetConfig("timeline.appGrouping"); err == nil {
		config.Timeline.AppGrouping = val == "true"
	}
	if val, err := s.store.GetConfig("timeline.continuityMergeSeconds"); err == nil {
		if v, e := strconv.Atoi(val); e == nil {
			config.Timeline.ContinuityMergeSeconds = v
		}
	}

	// System settings - only override if explicitly set in database
	if val, err := s.store.GetConfig("system.startOnLogin"); err == nil && val != "" {
		config.System.StartOnLogin = val == "true"
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

		// Handle side effects for specific settings
		if err := s.handleConfigSideEffect(storageKey, value); err != nil {
			return err
		}
	}

	return nil
}

// handleConfigSideEffect handles side effects when certain config values change.
func (s *ConfigService) handleConfigSideEffect(key string, value interface{}) error {
	switch key {
	case "system.startOnLogin":
		enabled, ok := value.(bool)
		if !ok {
			return nil
		}
		if err := s.platform.SetAutoStart(enabled); err != nil {
			return fmt.Errorf("failed to set autostart: %w", err)
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
		"capture.monitorMode":        "capture.monitorMode",
		"capture.monitorIndex":       "capture.monitorIndex",

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
		"dataSources.shell.enabled":     "shell.enabled",
		"dataSources.shell.shellType":   "shell.shellType",
		"dataSources.shell.historyPath":     "shell.historyPath",
		"dataSources.shell.excludePatterns": "shell.excludePatterns",
		"dataSources.git.enabled":           "git.enabled",
		"dataSources.git.searchPaths":       "git.searchPaths",
		"dataSources.git.maxDepth":          "git.maxDepth",
		"dataSources.files.enabled":         "files.enabled",
		"dataSources.files.excludePatterns": "files.excludePatterns",
		"dataSources.browser.enabled":          "browser.enabled",
		"dataSources.browser.browsers":         "browser.browsers",
		"dataSources.browser.excludedDomains":  "browser.excludedDomains",
		"dataSources.browser.historyLimitDays": "browser.historyLimitDays",

		// Inference settings
		"inference.engine":         "inference.engine",
		"inference.bundled.model":  "inference.bundled.model",
		"inference.ollama.host":    "inference.ollama.host",
		"inference.ollama.model":   "inference.ollama.model",
		"inference.cloud.provider": "inference.cloud.provider",
		"inference.cloud.apiKey":   "inference.cloud.apiKey",
		"inference.cloud.model":    "inference.cloud.model",
		"inference.cloud.endpoint": "inference.cloud.endpoint",

		// Issues settings
		"issues.crashReportingEnabled": "issues.crashReportingEnabled",
		"issues.webhookEnabled":        "issues.webhookEnabled",
		"issues.webhookUrl":            "issues.webhookUrl",

		// Update settings
		"update.autoUpdate":         "update.autoUpdate",
		"update.checkIntervalHours": "update.checkIntervalHours",
		"update.afkRestartMinutes":  "update.afkRestartMinutes",

		// Timeline settings
		"timeline.minActivityDurationSeconds": "timeline.minActivityDurationSeconds",
		"timeline.titleDisplay":               "timeline.titleDisplay",
		"timeline.appGrouping":                "timeline.appGrouping",
		"timeline.continuityMergeSeconds":     "timeline.continuityMergeSeconds",
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
		Paused:       status.Paused,
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

// PauseDaemon pauses screenshot capture without stopping the daemon.
func (s *ConfigService) PauseDaemon() {
	if s.daemon == nil {
		return
	}
	s.daemon.Pause()
}

// ResumeDaemon resumes screenshot capture after a pause.
func (s *ConfigService) ResumeDaemon() {
	if s.daemon == nil {
		return
	}
	s.daemon.Resume()
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
		ResumeWindow:       time.Duration(config.AFK.MinSessionMinutes) * time.Minute,
		Quality:            config.Capture.Quality,
		DuplicateThreshold: config.Capture.DuplicateThreshold,
		DataDir:            s.platform.DataDir(),
		MonitorMode:        config.Capture.MonitorMode,
		MonitorIndex:       config.Capture.MonitorIndex,
	}
	s.daemon.UpdateConfig(daemonConfig)

	// Apply shell configuration
	if config.DataSources != nil && config.DataSources.Shell != nil {
		s.daemon.SetShellType(config.DataSources.Shell.ShellType)
		s.daemon.SetShellHistoryPath(config.DataSources.Shell.HistoryPath)
		s.daemon.SetShellExcludePatterns(config.DataSources.Shell.ExcludePatterns)
	}

	// Apply file tracking configuration
	if config.DataSources != nil && config.DataSources.Files != nil {
		s.daemon.SetFileExcludePatterns(config.DataSources.Files.ExcludePatterns)
	}

	// Apply browser configuration
	if config.DataSources != nil && config.DataSources.Browser != nil {
		s.daemon.SetExcludedDomains(config.DataSources.Browser.ExcludedDomains)
		s.daemon.SetBrowserHistoryLimit(config.DataSources.Browser.HistoryLimitDays)
	}

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

	// Calculate actual storage sizes
	dataDir := s.platform.DataDir()

	// Database size (includes WAL and SHM files)
	dbPath := filepath.Join(dataDir, "data.db")
	if info, err := os.Stat(dbPath); err == nil {
		stats.DatabaseSize = info.Size()
	}
	// Add WAL file size
	if info, err := os.Stat(dbPath + "-wal"); err == nil {
		stats.DatabaseSize += info.Size()
	}
	// Add SHM file size
	if info, err := os.Stat(dbPath + "-shm"); err == nil {
		stats.DatabaseSize += info.Size()
	}

	// Screenshots directory size
	screenshotsDir := filepath.Join(dataDir, "screenshots")
	stats.ScreenshotsSize = calculateDirSize(screenshotsDir)

	return stats, nil
}

// calculateDirSize recursively calculates the total size of a directory.
func calculateDirSize(path string) int64 {
	var size int64
	filepath.Walk(path, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip files we can't access
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size
}

// OptimizeDatabase runs VACUUM and ANALYZE on the database to reclaim space and update statistics.
// Returns the size reduction in bytes (positive if space was reclaimed).
func (s *ConfigService) OptimizeDatabase() (int64, error) {
	return s.store.Optimize()
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
		MonitorMode:        "active_window", // Default: follow active window
		MonitorIndex:       0,
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
			ShellType:       "auto",
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
			AllowedExtensions: []string{}, // Empty = track all extensions
		},
		Browser: &BrowserConfig{
			Enabled:          true,
			Browsers:         []string{"chrome", "firefox"},
			HistoryLimitDays: 7, // Default to 7 days of history
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
		Engine: "bundled",
		Bundled: &BundledInferenceConfig{
			Model: "gemma-2-2b-it-q4",
		},
		Ollama: &OllamaConfig{
			Host:  "http://localhost:11434",
			Model: "gemma3:12b-it-qat",
		},
		Cloud: &CloudConfig{
			Provider: "anthropic",
			APIKey:   "",
			Model:    "claude-sonnet-4-20250514",
			Endpoint: "", // Empty = use default provider endpoint
		},
	}
}

func (s *ConfigService) getDefaultUpdateConfig() *UpdateConfig {
	return &UpdateConfig{
		AutoUpdate:         true,
		CheckIntervalHours: 5,
		AFKRestartMinutes:  10,
	}
}

func (s *ConfigService) getDefaultTimelineConfig() *TimelineConfig {
	return &TimelineConfig{
		MinActivityDurationSeconds: 0,      // Default: show all activities (no filtering)
		TitleDisplay:               "full", // Default: show full window titles
		AppGrouping:                false,  // Default: don't merge consecutive same-app activities
		ContinuityMergeSeconds:     0,      // Default: don't merge across brief switches
	}
}
