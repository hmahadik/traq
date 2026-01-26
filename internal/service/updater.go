package service

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// UpdateService handles automatic updates from GitHub releases.
type UpdateService struct {
	currentVersion string
	dataDir        string
	repoOwner      string
	repoName       string

	mu            sync.RWMutex
	updatePending bool
	pendingInfo   *UpdateInfo
	lastCheck     time.Time
	checkInterval time.Duration
	enabled       bool

	stopCh chan struct{}
	doneCh chan struct{}
}

// UpdateInfo contains information about an available update.
type UpdateInfo struct {
	Version      string `json:"version"`
	ReleaseNotes string `json:"releaseNotes"`
	DownloadURL  string `json:"downloadUrl"`
	PublishedAt  string `json:"publishedAt"`
}

// UpdateStatus represents the current update state.
type UpdateStatus struct {
	CurrentVersion string      `json:"currentVersion"`
	UpdatePending  bool        `json:"updatePending"`
	PendingInfo    *UpdateInfo `json:"pendingInfo"`
	LastCheck      string      `json:"lastCheck"`
	Enabled        bool        `json:"enabled"`
}

// GitHubRelease represents the GitHub API response for a release.
type GitHubRelease struct {
	TagName     string        `json:"tag_name"`
	Body        string        `json:"body"`
	PublishedAt string        `json:"published_at"`
	Assets      []GitHubAsset `json:"assets"`
}

// GitHubAsset represents a release asset.
type GitHubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	Size               int64  `json:"size"`
}

// NewUpdateService creates a new update service.
func NewUpdateService(currentVersion, dataDir string) *UpdateService {
	return &UpdateService{
		currentVersion: currentVersion,
		dataDir:        dataDir,
		repoOwner:      "hmahadik",
		repoName:       "traq",
		checkInterval:  5 * time.Hour,
		enabled:        true,
		stopCh:         make(chan struct{}),
		doneCh:         make(chan struct{}),
	}
}

// Start begins the background update checker.
func (s *UpdateService) Start() {
	go s.backgroundChecker()
}

// Stop stops the background update checker.
func (s *UpdateService) Stop() {
	close(s.stopCh)
	<-s.doneCh
}

// backgroundChecker periodically checks for updates.
func (s *UpdateService) backgroundChecker() {
	defer close(s.doneCh)

	// Initial check on startup (with small delay to not block startup)
	time.Sleep(30 * time.Second)
	s.checkAndDownload()

	ticker := time.NewTicker(s.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.checkAndDownload()
		case <-s.stopCh:
			return
		}
	}
}

// checkAndDownload checks for updates and downloads if available.
func (s *UpdateService) checkAndDownload() {
	s.mu.RLock()
	if !s.enabled {
		s.mu.RUnlock()
		return
	}
	s.mu.RUnlock()

	info, err := s.CheckForUpdate()
	if err != nil {
		log.Printf("Update check failed: %v", err)
		return
	}

	if info == nil {
		// No update available
		return
	}

	// Download the update
	if err := s.DownloadUpdate(info); err != nil {
		log.Printf("Update download failed: %v", err)
		return
	}

	log.Printf("Update v%s downloaded and staged, will apply on next restart or AFK", info.Version)
}

// CheckForUpdate checks GitHub for a newer release.
func (s *UpdateService) CheckForUpdate() (*UpdateInfo, error) {
	s.mu.Lock()
	s.lastCheck = time.Now()
	s.mu.Unlock()

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", s.repoOwner, s.repoName)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "traq-updater")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		// No releases yet
		return nil, nil
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}

	// Parse version from tag (remove 'v' prefix if present)
	remoteVersion := strings.TrimPrefix(release.TagName, "v")

	// Compare versions
	if !isNewerVersion(remoteVersion, s.currentVersion) {
		return nil, nil // Current version is up to date
	}

	// Find the appropriate asset for this platform
	assetURL := s.findAssetURL(release.Assets)
	if assetURL == "" {
		return nil, fmt.Errorf("no compatible binary found for %s/%s", runtime.GOOS, runtime.GOARCH)
	}

	return &UpdateInfo{
		Version:      remoteVersion,
		ReleaseNotes: release.Body,
		DownloadURL:  assetURL,
		PublishedAt:  release.PublishedAt,
	}, nil
}

// findAssetURL finds the download URL for the current platform.
func (s *UpdateService) findAssetURL(assets []GitHubAsset) string {
	var expectedName string

	switch runtime.GOOS {
	case "linux":
		expectedName = "traq-linux-amd64.AppImage"
	case "darwin":
		expectedName = "traq-macos-universal.zip"
	case "windows":
		expectedName = "traq-windows-amd64-installer.exe"
	default:
		return ""
	}

	for _, asset := range assets {
		if asset.Name == expectedName {
			return asset.BrowserDownloadURL
		}
	}

	return ""
}

// DownloadUpdate downloads the update to the staging folder.
func (s *UpdateService) DownloadUpdate(info *UpdateInfo) error {
	// Create updates directory
	updatesDir := filepath.Join(s.dataDir, "updates")
	if err := os.MkdirAll(updatesDir, 0755); err != nil {
		return err
	}

	// Download to temporary file first
	stagingPath := filepath.Join(updatesDir, fmt.Sprintf("traq-%s.new", info.Version))
	tmpPath := stagingPath + ".tmp"

	resp, err := http.Get(info.DownloadURL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	out, err := os.Create(tmpPath)
	if err != nil {
		return err
	}

	_, err = io.Copy(out, resp.Body)
	out.Close()
	if err != nil {
		os.Remove(tmpPath)
		return err
	}

	// Rename to final staging path
	if err := os.Rename(tmpPath, stagingPath); err != nil {
		os.Remove(tmpPath)
		return err
	}

	// Make executable on Unix
	if runtime.GOOS != "windows" {
		if err := os.Chmod(stagingPath, 0755); err != nil {
			log.Printf("Warning: failed to set executable permission: %v", err)
		}
	}

	// Mark update as pending
	s.mu.Lock()
	s.updatePending = true
	s.pendingInfo = info
	s.mu.Unlock()

	return nil
}

// HasPendingUpdate returns true if an update is staged and ready to apply.
func (s *UpdateService) HasPendingUpdate() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.updatePending
}

// ApplyPendingUpdate applies a staged update by replacing the binary.
// This should be called early in startup, before the app fully initializes.
// Returns true if an update was applied and the app should restart.
func ApplyPendingUpdate(dataDir string) (bool, error) {
	updatesDir := filepath.Join(dataDir, "updates")

	// Look for staged update files
	entries, err := os.ReadDir(updatesDir)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil // No updates directory
		}
		return false, err
	}

	var stagingPath string
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".new") {
			stagingPath = filepath.Join(updatesDir, entry.Name())
			break
		}
	}

	if stagingPath == "" {
		return false, nil // No pending update
	}

	// Get current executable path
	// For AppImage, use APPIMAGE env var which points to the actual .AppImage file
	exe := os.Getenv("APPIMAGE")
	if exe == "" {
		// Not running as AppImage, use regular executable path
		var err error
		exe, err = os.Executable()
		if err != nil {
			return false, err
		}
		// Resolve symlinks to get the real path
		exe, err = filepath.EvalSymlinks(exe)
		if err != nil {
			return false, err
		}
	}

	// Create backup of current binary
	backupPath := exe + ".backup"
	if err := copyFile(exe, backupPath); err != nil {
		log.Printf("Warning: failed to create backup: %v", err)
		// Continue anyway - update is more important
	}

	// Replace the binary
	// On Unix, we can replace a running binary
	// On Windows, this will fail if the binary is running
	if err := copyFile(stagingPath, exe); err != nil {
		// Try to restore from backup
		if backupPath != "" {
			copyFile(backupPath, exe)
		}
		return false, fmt.Errorf("failed to apply update: %w", err)
	}

	// Clean up staging file
	os.Remove(stagingPath)

	// Clean up backup (or keep it for rollback?)
	os.Remove(backupPath)

	log.Println("Update applied successfully, restarting...")
	return true, nil
}

// ApplyAndRestart applies the pending update and restarts the application.
func (s *UpdateService) ApplyAndRestart() error {
	applied, err := ApplyPendingUpdate(s.dataDir)
	if err != nil {
		// Clear pending flag on error so we don't keep retrying a broken update
		s.mu.Lock()
		s.updatePending = false
		s.pendingInfo = nil
		s.mu.Unlock()
		return err
	}

	if !applied {
		// No staged file found - clear the stale pending flag
		s.mu.Lock()
		s.updatePending = false
		s.pendingInfo = nil
		s.mu.Unlock()
		log.Println("Auto-update: no staged update file found, clearing pending flag")
		return nil
	}

	return RestartSelf()
}

// RestartSelf restarts the current process.
func RestartSelf() error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}

	// Start new process
	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin

	if err := cmd.Start(); err != nil {
		return err
	}

	// Exit current process
	os.Exit(0)
	return nil
}

// GetStatus returns the current update status.
func (s *UpdateService) GetStatus() *UpdateStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()

	lastCheck := ""
	if !s.lastCheck.IsZero() {
		lastCheck = s.lastCheck.Format(time.RFC3339)
	}

	return &UpdateStatus{
		CurrentVersion: s.currentVersion,
		UpdatePending:  s.updatePending,
		PendingInfo:    s.pendingInfo,
		LastCheck:      lastCheck,
		Enabled:        s.enabled,
	}
}

// SetEnabled enables or disables auto-updates.
func (s *UpdateService) SetEnabled(enabled bool) {
	s.mu.Lock()
	s.enabled = enabled
	s.mu.Unlock()
}

// SetCheckInterval sets the check interval.
func (s *UpdateService) SetCheckInterval(hours int) {
	s.mu.Lock()
	s.checkInterval = time.Duration(hours) * time.Hour
	s.mu.Unlock()
}

// copyFile copies a file from src to dst.
func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	// Get source file info for permissions
	info, err := sourceFile.Stat()
	if err != nil {
		return err
	}

	destFile, err := os.OpenFile(dst, os.O_RDWR|os.O_CREATE|os.O_TRUNC, info.Mode())
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	return err
}

// isNewerVersion returns true if version a is newer than version b.
// Handles semver-style versions including pre-release (e.g., "2.0.0-beta.22").
func isNewerVersion(a, b string) bool {
	// Handle "dev" version - always consider releases newer than dev
	if b == "dev" || b == "" {
		return true
	}

	// Split version and pre-release parts (e.g., "2.0.0-beta.22" -> "2.0.0", "beta.22")
	splitVersion := func(v string) (string, string) {
		if idx := strings.Index(v, "-"); idx != -1 {
			return v[:idx], v[idx+1:]
		}
		return v, ""
	}

	mainA, preA := splitVersion(a)
	mainB, preB := splitVersion(b)

	// Compare main version parts
	partsA := strings.Split(mainA, ".")
	partsB := strings.Split(mainB, ".")

	// Pad to same length
	for len(partsA) < 3 {
		partsA = append(partsA, "0")
	}
	for len(partsB) < 3 {
		partsB = append(partsB, "0")
	}

	for i := 0; i < 3; i++ {
		var numA, numB int
		fmt.Sscanf(partsA[i], "%d", &numA)
		fmt.Sscanf(partsB[i], "%d", &numB)

		if numA > numB {
			return true
		}
		if numA < numB {
			return false
		}
	}

	// Main versions are equal, compare pre-release
	// No pre-release is considered newer than any pre-release (2.0.0 > 2.0.0-beta.X)
	if preA == "" && preB != "" {
		return true
	}
	if preA != "" && preB == "" {
		return false
	}
	if preA == "" && preB == "" {
		return false // Identical versions
	}

	// Both have pre-release, compare them (e.g., beta.23 vs beta.22)
	// Extract numeric suffix
	extractNum := func(pre string) int {
		// Find last numeric part (e.g., "beta.22" -> 22)
		parts := strings.Split(pre, ".")
		if len(parts) > 0 {
			var num int
			fmt.Sscanf(parts[len(parts)-1], "%d", &num)
			return num
		}
		return 0
	}

	return extractNum(preA) > extractNum(preB)
}
