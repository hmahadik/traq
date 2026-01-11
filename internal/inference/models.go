package inference

import (
	"archive/zip"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// ModelInfo contains information about an available AI model
type ModelInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Size        int64  `json:"size"`        // Size in bytes
	Downloaded  bool   `json:"downloaded"`  // Whether the model file exists locally
	DownloadURL string `json:"downloadUrl"` // URL to download the model
	Filename    string `json:"filename"`    // Local filename
}

// AvailableModels returns the list of models that can be used with the bundled engine
var AvailableModels = []ModelInfo{
	{
		ID:          "gemma-2-2b-it-q4",
		Name:        "Gemma 2 2B (Q4)",
		Description: "Google's Gemma 2 2B instruction-tuned, quantized to Q4_K_M. Fast and efficient.",
		Size:        1_500_000_000, // ~1.5GB
		DownloadURL: "https://huggingface.co/google/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-q4_k_m.gguf",
		Filename:    "gemma-2-2b-it-q4_k_m.gguf",
	},
	{
		ID:          "gemma-2-9b-it-q4",
		Name:        "Gemma 2 9B (Q4)",
		Description: "Google's Gemma 2 9B instruction-tuned, quantized to Q4_K_M. Better quality, slower.",
		Size:        5_400_000_000, // ~5.4GB
		DownloadURL: "https://huggingface.co/google/gemma-2-9b-it-GGUF/resolve/main/gemma-2-9b-it-q4_k_m.gguf",
		Filename:    "gemma-2-9b-it-q4_k_m.gguf",
	},
	{
		ID:          "phi-3-mini-4k-q4",
		Name:        "Phi 3 Mini (Q4)",
		Description: "Microsoft's Phi 3 Mini 4K context, quantized to Q4_K_M. Very compact.",
		Size:        2_200_000_000, // ~2.2GB
		DownloadURL: "https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf/resolve/main/Phi-3-mini-4k-instruct-q4.gguf",
		Filename:    "Phi-3-mini-4k-instruct-q4.gguf",
	},
	{
		ID:          "qwen2.5-1.5b-q4",
		Name:        "Qwen 2.5 1.5B (Q4)",
		Description: "Alibaba's Qwen 2.5 1.5B, quantized to Q4_K_M. Very fast, good for simple summaries.",
		Size:        1_100_000_000, // ~1.1GB
		DownloadURL: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
		Filename:    "qwen2.5-1.5b-instruct-q4_k_m.gguf",
	},
}

// GetModelsDir returns the directory where models are stored
func GetModelsDir() string {
	var dataDir string
	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		dataDir = filepath.Join(home, "Library", "Application Support", "traq")
	case "windows":
		dataDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "traq")
	default: // linux and others
		home, _ := os.UserHomeDir()
		if xdgData := os.Getenv("XDG_DATA_HOME"); xdgData != "" {
			dataDir = filepath.Join(xdgData, "traq")
		} else {
			dataDir = filepath.Join(home, ".local", "share", "traq")
		}
	}
	return filepath.Join(dataDir, "models")
}

// GetAvailableModels returns all available models with their download status
func GetAvailableModels() []ModelInfo {
	modelsDir := GetModelsDir()
	result := make([]ModelInfo, len(AvailableModels))

	for i, model := range AvailableModels {
		result[i] = model
		modelPath := filepath.Join(modelsDir, model.Filename)
		if info, err := os.Stat(modelPath); err == nil {
			result[i].Downloaded = true
			result[i].Size = info.Size() // Use actual file size
		}
	}

	return result
}

// GetModelPath returns the full path to a model file
func GetModelPath(modelID string) (string, error) {
	modelsDir := GetModelsDir()

	for _, model := range AvailableModels {
		if model.ID == modelID {
			return filepath.Join(modelsDir, model.Filename), nil
		}
	}

	return "", fmt.Errorf("unknown model: %s", modelID)
}

// DownloadProgress is called during model download with progress updates
type DownloadProgress func(bytesDownloaded, totalBytes int64)

// checkDiskSpace is implemented in platform-specific files:
// - diskspace_unix.go (Linux, macOS)
// - diskspace_windows.go (Windows)

// ModelDownloader handles downloading AI models
type ModelDownloader struct {
	mu         sync.Mutex
	inProgress map[string]bool
}

// NewModelDownloader creates a new model downloader
func NewModelDownloader() *ModelDownloader {
	return &ModelDownloader{
		inProgress: make(map[string]bool),
	}
}

// global downloader instance
var globalDownloader = NewModelDownloader()

// DownloadModel downloads a model file with progress updates
func DownloadModel(modelID string, progress DownloadProgress) error {
	return globalDownloader.Download(modelID, progress)
}

// Download downloads a model file with progress updates
func (d *ModelDownloader) Download(modelID string, progress DownloadProgress) error {
	// Find the model
	var model *ModelInfo
	for _, m := range AvailableModels {
		if m.ID == modelID {
			model = &m
			break
		}
	}
	if model == nil {
		return fmt.Errorf("unknown model: %s", modelID)
	}

	// Check if already downloading
	d.mu.Lock()
	if d.inProgress[modelID] {
		d.mu.Unlock()
		return fmt.Errorf("model %s is already being downloaded", modelID)
	}
	d.inProgress[modelID] = true
	d.mu.Unlock()

	defer func() {
		d.mu.Lock()
		delete(d.inProgress, modelID)
		d.mu.Unlock()
	}()

	// Create models directory if needed
	modelsDir := GetModelsDir()
	if err := os.MkdirAll(modelsDir, 0755); err != nil {
		return fmt.Errorf("failed to create models directory: %w", err)
	}

	// Check disk space before downloading
	if err := checkDiskSpace(modelsDir, model.Size); err != nil {
		return err
	}

	// Download to a temp file first
	modelPath := filepath.Join(modelsDir, model.Filename)
	tempPath := modelPath + ".download"

	// Start the download
	resp, err := http.Get(model.DownloadURL)
	if err != nil {
		return fmt.Errorf("failed to start download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// Get total size from response
	totalBytes := resp.ContentLength
	if totalBytes <= 0 {
		totalBytes = model.Size // Fall back to estimated size
	}

	// Create temp file
	out, err := os.Create(tempPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	// Download with progress tracking
	var downloaded int64
	buf := make([]byte, 1024*1024) // 1MB buffer

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				out.Close()
				os.Remove(tempPath)
				return fmt.Errorf("failed to write to file: %w", writeErr)
			}
			downloaded += int64(n)
			if progress != nil {
				progress(downloaded, totalBytes)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			out.Close()
			os.Remove(tempPath)
			return fmt.Errorf("download error: %w", err)
		}
	}

	out.Close()

	// Move temp file to final location
	if err := os.Rename(tempPath, modelPath); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to finalize download: %w", err)
	}

	return nil
}

// IsDownloading checks if a model is currently being downloaded
func (d *ModelDownloader) IsDownloading(modelID string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.inProgress[modelID]
}

// DeleteModel deletes a downloaded model file
func DeleteModel(modelID string) error {
	modelPath, err := GetModelPath(modelID)
	if err != nil {
		return err
	}

	if err := os.Remove(modelPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete model: %w", err)
	}

	return nil
}

// ServerBinaryInfo contains information about the llama-server binary for a platform
type ServerBinaryInfo struct {
	Platform    string // "linux", "darwin", "windows"
	Arch        string // "amd64", "arm64"
	DownloadURL string
	Filename    string
	Size        int64
}

// llama.cpp release version to download
const llamaCppVersion = "b4547"

// GetServerBinaryInfo returns download info for the llama-server binary for the current platform
func GetServerBinaryInfo() (*ServerBinaryInfo, error) {
	platform := runtime.GOOS
	arch := runtime.GOARCH

	// Map Go arch names to llama.cpp release naming
	archName := arch
	if arch == "amd64" {
		archName = "x64"
	}

	baseURL := fmt.Sprintf("https://github.com/ggerganov/llama.cpp/releases/download/%s", llamaCppVersion)

	var info ServerBinaryInfo
	info.Platform = platform
	info.Arch = arch

	switch platform {
	case "linux":
		if arch == "amd64" {
			info.DownloadURL = fmt.Sprintf("%s/llama-%s-bin-ubuntu-x64.zip", baseURL, llamaCppVersion)
			info.Filename = "llama-server"
			info.Size = 50_000_000 // ~50MB compressed
		} else if arch == "arm64" {
			info.DownloadURL = fmt.Sprintf("%s/llama-%s-bin-ubuntu-arm64.zip", baseURL, llamaCppVersion)
			info.Filename = "llama-server"
			info.Size = 50_000_000
		} else {
			return nil, fmt.Errorf("unsupported Linux architecture: %s", arch)
		}
	case "darwin":
		// macOS uses universal binary
		info.DownloadURL = fmt.Sprintf("%s/llama-%s-bin-macos-arm64.zip", baseURL, llamaCppVersion)
		info.Filename = "llama-server"
		info.Size = 30_000_000 // ~30MB compressed
		if arch == "amd64" {
			info.DownloadURL = fmt.Sprintf("%s/llama-%s-bin-macos-x64.zip", baseURL, llamaCppVersion)
		}
	case "windows":
		info.DownloadURL = fmt.Sprintf("%s/llama-%s-bin-win-%s.zip", baseURL, llamaCppVersion, archName)
		info.Filename = "llama-server.exe"
		info.Size = 60_000_000 // ~60MB compressed
	default:
		return nil, fmt.Errorf("unsupported platform: %s", platform)
	}

	return &info, nil
}

// GetServerBinDir returns the directory where the server binary is stored
func GetServerBinDir() string {
	var dataDir string
	switch runtime.GOOS {
	case "darwin":
		home, _ := os.UserHomeDir()
		dataDir = filepath.Join(home, "Library", "Application Support", "traq")
	case "windows":
		dataDir = filepath.Join(os.Getenv("LOCALAPPDATA"), "traq")
	default: // linux and others
		home, _ := os.UserHomeDir()
		if xdgData := os.Getenv("XDG_DATA_HOME"); xdgData != "" {
			dataDir = filepath.Join(xdgData, "traq")
		} else {
			dataDir = filepath.Join(home, ".local", "share", "traq")
		}
	}
	return filepath.Join(dataDir, "bin")
}

// GetServerBinaryPath returns the full path to the llama-server binary
func GetServerBinaryPath() string {
	binDir := GetServerBinDir()
	filename := "llama-server"
	if runtime.GOOS == "windows" {
		filename = "llama-server.exe"
	}
	return filepath.Join(binDir, filename)
}

// IsServerInstalled checks if the llama-server binary exists
func IsServerInstalled() bool {
	serverPath := GetServerBinaryPath()
	_, err := os.Stat(serverPath)
	return err == nil
}

// ServerDownloadStatus contains information about server installation
type ServerDownloadStatus struct {
	Installed   bool   `json:"installed"`
	ServerPath  string `json:"serverPath"`
	Version     string `json:"version"`
	DownloadURL string `json:"downloadUrl,omitempty"`
	Size        int64  `json:"size,omitempty"`
}

// GetServerStatus returns the current server installation status
func GetServerStatus() *ServerDownloadStatus {
	status := &ServerDownloadStatus{
		Installed:  IsServerInstalled(),
		ServerPath: GetServerBinaryPath(),
		Version:    llamaCppVersion,
	}

	if info, err := GetServerBinaryInfo(); err == nil {
		status.DownloadURL = info.DownloadURL
		status.Size = info.Size
	}

	return status
}

// DownloadServer downloads the llama-server binary for the current platform
func DownloadServer(progress DownloadProgress) error {
	return globalDownloader.DownloadServer(progress)
}

// DownloadServer downloads the llama-server binary
func (d *ModelDownloader) DownloadServer(progress DownloadProgress) error {
	const downloadKey = "llama-server"

	// Check if already downloading
	d.mu.Lock()
	if d.inProgress[downloadKey] {
		d.mu.Unlock()
		return fmt.Errorf("server is already being downloaded")
	}
	d.inProgress[downloadKey] = true
	d.mu.Unlock()

	defer func() {
		d.mu.Lock()
		delete(d.inProgress, downloadKey)
		d.mu.Unlock()
	}()

	// Get download info for current platform
	info, err := GetServerBinaryInfo()
	if err != nil {
		return err
	}

	// Create bin directory if needed
	binDir := GetServerBinDir()
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return fmt.Errorf("failed to create bin directory: %w", err)
	}

	// Check disk space before downloading
	if err := checkDiskSpace(binDir, info.Size); err != nil {
		return err
	}

	// Download to a temp file first
	tempZipPath := filepath.Join(binDir, "llama-server.zip.download")
	defer os.Remove(tempZipPath) // Clean up temp file

	// Start the download
	resp, err := http.Get(info.DownloadURL)
	if err != nil {
		return fmt.Errorf("failed to start download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// Get total size from response
	totalBytes := resp.ContentLength
	if totalBytes <= 0 {
		totalBytes = info.Size // Fall back to estimated size
	}

	// Create temp file
	out, err := os.Create(tempZipPath)
	if err != nil {
		return fmt.Errorf("failed to create temp file: %w", err)
	}

	// Download with progress tracking
	var downloaded int64
	buf := make([]byte, 1024*1024) // 1MB buffer

	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := out.Write(buf[:n]); writeErr != nil {
				out.Close()
				return fmt.Errorf("failed to write to file: %w", writeErr)
			}
			downloaded += int64(n)
			if progress != nil {
				progress(downloaded, totalBytes)
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			out.Close()
			return fmt.Errorf("download error: %w", err)
		}
	}
	out.Close()

	// Extract the server binary from the zip
	serverPath := GetServerBinaryPath()
	if err := extractServerFromZip(tempZipPath, serverPath, info.Filename); err != nil {
		return fmt.Errorf("failed to extract server binary: %w", err)
	}

	// Make executable on Unix
	if runtime.GOOS != "windows" {
		if err := os.Chmod(serverPath, 0755); err != nil {
			return fmt.Errorf("failed to make server executable: %w", err)
		}
	}

	return nil
}

// extractServerFromZip extracts the llama-server binary and required libraries from a downloaded zip file
func extractServerFromZip(zipPath, destPath, targetFilename string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("failed to open zip file: %w", err)
	}
	defer r.Close()

	destDir := filepath.Dir(destPath)
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	// Files we need to extract: llama-server and libllama.so (and any .dylib for macOS)
	neededFiles := map[string]bool{
		targetFilename: false,
	}

	// Extract all needed files
	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}

		filename := filepath.Base(f.Name)

		// Check if this is a file we need
		isNeeded := filename == targetFilename ||
			strings.HasPrefix(filename, "libllama.") ||
			strings.HasPrefix(filename, "libggml.")

		if !isNeeded {
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return fmt.Errorf("failed to open %s in zip: %w", filename, err)
		}

		outPath := filepath.Join(destDir, filename)
		out, err := os.Create(outPath)
		if err != nil {
			rc.Close()
			return fmt.Errorf("failed to create %s: %w", filename, err)
		}

		if _, err := io.Copy(out, rc); err != nil {
			out.Close()
			rc.Close()
			return fmt.Errorf("failed to extract %s: %w", filename, err)
		}

		out.Close()
		rc.Close()

		// Make binaries executable
		if filename == targetFilename {
			os.Chmod(outPath, 0755)
			neededFiles[targetFilename] = true
		}
	}

	if !neededFiles[targetFilename] {
		// List what we found for debugging
		var foundFiles []string
		for _, f := range r.File {
			if strings.Contains(f.Name, "llama") {
				foundFiles = append(foundFiles, f.Name)
			}
		}
		return fmt.Errorf("server binary %s not found in zip (found: %v)", targetFilename, foundFiles)
	}

	return nil
}
