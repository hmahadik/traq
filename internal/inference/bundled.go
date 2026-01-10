package inference

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// DefaultBundledPort is the default port for the bundled llama server
const DefaultBundledPort = 18080

// BundledConfig contains settings for the bundled llama.cpp server
type BundledConfig struct {
	ModelPath   string // Path to the GGUF model file
	ServerPath  string // Path to llama-server binary
	Port        int    // Port to run on (default: DefaultBundledPort)
	ContextSize int    // Context window size (default: 2048)
	GPULayers   int    // Number of layers to offload to GPU (0 = CPU only)
}

// BundledEngine manages a bundled llama.cpp server
type BundledEngine struct {
	config  *BundledConfig
	cmd     *exec.Cmd
	running bool
	managed bool // true if we started the process, false if reusing existing
	mu      sync.RWMutex
	client  *http.Client
}

// NewBundledEngine creates a new bundled engine instance
func NewBundledEngine(config *BundledConfig) *BundledEngine {
	if config.Port == 0 {
		config.Port = DefaultBundledPort
	}
	if config.ContextSize == 0 {
		config.ContextSize = 2048
	}

	return &BundledEngine{
		config: config,
		client: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// GetDefaultPaths returns the default paths for the bundled model and server
func GetDefaultPaths() (serverPath, modelPath string) {
	// Get user data directory
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

	modelsDir := filepath.Join(dataDir, "models")

	// Server binary name varies by platform
	serverBinary := "llama-server"
	if runtime.GOOS == "windows" {
		serverBinary = "llama-server.exe"
	}

	serverPath = filepath.Join(dataDir, "bin", serverBinary)
	modelPath = filepath.Join(modelsDir, "gemma-2-2b-it-q4_k_m.gguf") // ~1.5GB model

	return serverPath, modelPath
}

// IsAvailable checks if the bundled engine can be used
func (e *BundledEngine) IsAvailable() bool {
	// Check if server binary exists
	if e.config.ServerPath != "" {
		if _, err := os.Stat(e.config.ServerPath); err != nil {
			return false
		}
	}

	// Check if model exists
	if e.config.ModelPath != "" {
		if _, err := os.Stat(e.config.ModelPath); err != nil {
			return false
		}
	}

	return true
}

// IsModelDownloaded checks if the model file exists
func (e *BundledEngine) IsModelDownloaded() bool {
	if e.config.ModelPath == "" {
		_, modelPath := GetDefaultPaths()
		e.config.ModelPath = modelPath
	}
	_, err := os.Stat(e.config.ModelPath)
	return err == nil
}

// IsServerInstalled checks if the llama-server binary exists
func (e *BundledEngine) IsServerInstalled() bool {
	if e.config.ServerPath == "" {
		serverPath, _ := GetDefaultPaths()
		e.config.ServerPath = serverPath
	}
	_, err := os.Stat(e.config.ServerPath)
	return err == nil
}

// pidFilePath returns the path to the PID file
func (e *BundledEngine) pidFilePath() string {
	serverPath, _ := GetDefaultPaths()
	return filepath.Join(filepath.Dir(filepath.Dir(serverPath)), "llama-server.pid")
}

// writePIDFile writes the current server PID to the PID file
func (e *BundledEngine) writePIDFile(pid int) error {
	pidPath := e.pidFilePath()
	if err := os.MkdirAll(filepath.Dir(pidPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(pidPath, []byte(strconv.Itoa(pid)), 0644)
}

// removePIDFile removes the PID file
func (e *BundledEngine) removePIDFile() {
	os.Remove(e.pidFilePath())
}

// cleanupStaleProcess checks for and kills any stale server process from previous runs
func (e *BundledEngine) cleanupStaleProcess() {
	pidPath := e.pidFilePath()
	data, err := os.ReadFile(pidPath)
	if err != nil {
		return // No PID file, nothing to clean up
	}

	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		e.removePIDFile()
		return
	}

	// Check if process is still running
	proc, err := os.FindProcess(pid)
	if err != nil {
		e.removePIDFile()
		return
	}

	// On Unix, FindProcess always succeeds - check if process exists by sending signal 0
	if err := proc.Signal(syscall.Signal(0)); err != nil {
		// Process doesn't exist
		e.removePIDFile()
		return
	}

	// Process exists - kill it
	proc.Signal(os.Interrupt)
	// Give it a moment to shut down gracefully
	time.Sleep(500 * time.Millisecond)
	// Force kill if still running
	proc.Signal(syscall.Signal(0))
	if err == nil {
		proc.Kill()
	}
	e.removePIDFile()
}

// Start starts the bundled llama server
func (e *BundledEngine) Start() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if e.running {
		return nil // Already running
	}

	// Clean up any stale process from previous runs
	e.cleanupStaleProcess()

	// Check if port is available
	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", e.config.Port))
	if err != nil {
		// Port is in use - check if there's already a healthy server we can reuse
		if e.checkHealth() {
			e.running = true
			e.managed = false // We didn't start this process
			return nil        // Reuse existing server
		}
		return fmt.Errorf("port %d is already in use by another process", e.config.Port)
	}
	ln.Close()

	// Build command arguments
	args := []string{
		"-m", e.config.ModelPath,
		"--port", fmt.Sprintf("%d", e.config.Port),
		"-c", fmt.Sprintf("%d", e.config.ContextSize),
	}

	if e.config.GPULayers > 0 {
		args = append(args, "-ngl", fmt.Sprintf("%d", e.config.GPULayers))
	}

	e.cmd = exec.Command(e.config.ServerPath, args...)

	// Set LD_LIBRARY_PATH to find libllama.so in the same directory as the server
	serverDir := filepath.Dir(e.config.ServerPath)
	e.cmd.Env = append(os.Environ(), fmt.Sprintf("LD_LIBRARY_PATH=%s", serverDir))

	// Suppress output
	e.cmd.Stdout = nil
	e.cmd.Stderr = nil

	if err := e.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start llama server: %w", err)
	}

	// Write PID file for cleanup on next run if we crash
	if e.cmd.Process != nil {
		e.writePIDFile(e.cmd.Process.Pid)
	}

	// Wait for server to be ready (up to 30 seconds)
	ready := make(chan bool)
	go func() {
		for i := 0; i < 60; i++ { // 30 seconds with 500ms intervals
			if e.checkHealth() {
				ready <- true
				return
			}
			time.Sleep(500 * time.Millisecond)
		}
		ready <- false
	}()

	if !<-ready {
		e.Stop()
		return fmt.Errorf("llama server failed to start within 30 seconds")
	}

	e.running = true
	e.managed = true // We started this process
	return nil
}

// Stop stops the bundled llama server
func (e *BundledEngine) Stop() error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// If we didn't start the process, just mark as not running
	if !e.managed {
		e.running = false
		return nil
	}

	if e.cmd == nil || e.cmd.Process == nil {
		e.running = false
		e.removePIDFile()
		return nil
	}

	if err := e.cmd.Process.Signal(os.Interrupt); err != nil {
		// Force kill if graceful shutdown fails
		e.cmd.Process.Kill()
	}

	e.cmd.Wait()
	e.running = false
	e.managed = false
	e.cmd = nil
	e.removePIDFile()

	return nil
}

// IsRunning returns whether the server is currently running
func (e *BundledEngine) IsRunning() bool {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.running
}

// checkHealth checks if the server is responding
func (e *BundledEngine) checkHealth() bool {
	resp, err := e.client.Get(fmt.Sprintf("http://localhost:%d/health", e.config.Port))
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// Complete sends a completion request to the bundled server
func (e *BundledEngine) Complete(prompt string) (string, error) {
	e.mu.RLock()
	running := e.running
	e.mu.RUnlock()

	if !running {
		return "", fmt.Errorf("bundled server is not running")
	}

	// Use the OpenAI-compatible /v1/completions endpoint
	reqBody := map[string]interface{}{
		"prompt":      prompt,
		"max_tokens":  1024,
		"temperature": 0.7,
		"stop":        []string{"\n\n\n"},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("http://localhost:%d/completion", e.config.Port)
	resp, err := e.client.Post(url, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to call bundled server: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("bundled server returned status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Content string `json:"content"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	return result.Content, nil
}

// GetModelInfo returns information about the loaded model
func (e *BundledEngine) GetModelInfo() (string, error) {
	if !e.IsRunning() {
		return "", fmt.Errorf("server not running")
	}

	resp, err := e.client.Get(fmt.Sprintf("http://localhost:%d/props", e.config.Port))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return string(body), nil
}

// Status represents the current state of the bundled engine
type BundledStatus struct {
	Available       bool   `json:"available"`
	Running         bool   `json:"running"`
	ModelDownloaded bool   `json:"modelDownloaded"`
	ServerInstalled bool   `json:"serverInstalled"`
	ModelPath       string `json:"modelPath"`
	ServerPath      string `json:"serverPath"`
	Port            int    `json:"port"`
}

// GetStatus returns the current status of the bundled engine
func (e *BundledEngine) GetStatus() *BundledStatus {
	return &BundledStatus{
		Available:       e.IsAvailable(),
		Running:         e.IsRunning(),
		ModelDownloaded: e.IsModelDownloaded(),
		ServerInstalled: e.IsServerInstalled(),
		ModelPath:       e.config.ModelPath,
		ServerPath:      e.config.ServerPath,
		Port:            e.config.Port,
	}
}
