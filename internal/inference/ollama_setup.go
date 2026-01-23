package inference

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"
)

// OllamaSetupStatus contains the current state of Ollama installation
type OllamaSetupStatus struct {
	Installed      bool     `json:"installed"`
	Running        bool     `json:"running"`
	Version        string   `json:"version,omitempty"`
	Models         []string `json:"models"`
	RecommendedModel string `json:"recommendedModel"`
	NeedsSetup     bool     `json:"needsSetup"`
}

// RecommendedOllamaModel is the default model we recommend for summaries
const RecommendedOllamaModel = "qwen2.5:7b"

// CheckOllamaSetup checks if Ollama is properly set up for use with Traq
func CheckOllamaSetup() *OllamaSetupStatus {
	status := &OllamaSetupStatus{
		RecommendedModel: RecommendedOllamaModel,
	}

	// Check if ollama binary exists
	ollamaPath, err := exec.LookPath("ollama")
	if err != nil {
		status.NeedsSetup = true
		return status
	}
	status.Installed = true

	// Get version
	if out, err := exec.Command(ollamaPath, "--version").Output(); err == nil {
		status.Version = strings.TrimSpace(string(out))
	}

	// Check if Ollama server is running
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://localhost:11434/api/tags")
	if err != nil {
		status.NeedsSetup = true
		return status
	}
	defer resp.Body.Close()
	status.Running = true

	// Get list of installed models
	if resp.StatusCode == http.StatusOK {
		var tagsResp struct {
			Models []struct {
				Name string `json:"name"`
			} `json:"models"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&tagsResp); err == nil {
			for _, m := range tagsResp.Models {
				status.Models = append(status.Models, m.Name)
			}
		}
	}

	// Check if we have a usable model
	hasRecommended := false
	hasAnyModel := len(status.Models) > 0
	for _, m := range status.Models {
		if strings.HasPrefix(m, "qwen2.5:7b") || strings.HasPrefix(m, "qwen2.5-7b") ||
			strings.HasPrefix(m, "llama3") || strings.HasPrefix(m, "mistral") {
			hasRecommended = true
			break
		}
	}

	status.NeedsSetup = !hasAnyModel || (!hasRecommended && !hasAnyModel)

	return status
}

// StartOllamaService attempts to start the Ollama service
func StartOllamaService() error {
	switch runtime.GOOS {
	case "linux":
		// Try systemctl first
		if err := exec.Command("systemctl", "start", "ollama").Run(); err == nil {
			return nil
		}
		// Fall back to running ollama serve in background
		cmd := exec.Command("ollama", "serve")
		cmd.Stdout = nil
		cmd.Stderr = nil
		return cmd.Start()

	case "darwin":
		// On macOS, Ollama runs as a launchd service or we start it manually
		cmd := exec.Command("ollama", "serve")
		cmd.Stdout = nil
		cmd.Stderr = nil
		return cmd.Start()

	case "windows":
		// On Windows, start ollama serve
		cmd := exec.Command("ollama", "serve")
		cmd.Stdout = nil
		cmd.Stderr = nil
		return cmd.Start()

	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}
}

// ModelPullProgress represents progress of a model pull operation
type ModelPullProgress struct {
	Status    string `json:"status"`
	Digest    string `json:"digest,omitempty"`
	Total     int64  `json:"total,omitempty"`
	Completed int64  `json:"completed,omitempty"`
	Percent   int    `json:"percent"`
}

// PullOllamaModel pulls a model with progress updates
func PullOllamaModel(modelName string, progressChan chan<- ModelPullProgress) error {
	defer close(progressChan)

	// Make request to Ollama API
	reqBody := strings.NewReader(fmt.Sprintf(`{"name": "%s"}`, modelName))
	resp, err := http.Post("http://localhost:11434/api/pull", "application/json", reqBody)
	if err != nil {
		return fmt.Errorf("failed to start pull: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pull failed: %s", string(body))
	}

	// Parse streaming JSON response
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		var progress struct {
			Status    string `json:"status"`
			Digest    string `json:"digest"`
			Total     int64  `json:"total"`
			Completed int64  `json:"completed"`
		}

		if err := json.Unmarshal([]byte(line), &progress); err != nil {
			continue
		}

		p := ModelPullProgress{
			Status:    progress.Status,
			Digest:    progress.Digest,
			Total:     progress.Total,
			Completed: progress.Completed,
		}

		if progress.Total > 0 {
			p.Percent = int((float64(progress.Completed) / float64(progress.Total)) * 100)
		}

		progressChan <- p
	}

	return scanner.Err()
}

// PullOllamaModelSync pulls a model synchronously (simpler, no streaming progress)
func PullOllamaModelSync(modelName string) error {
	cmd := exec.Command("ollama", "pull", modelName)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// GetOllamaInstallCommand returns the command to install Ollama for the current platform
func GetOllamaInstallCommand() string {
	switch runtime.GOOS {
	case "linux":
		return "curl -fsSL https://ollama.com/install.sh | sh"
	case "darwin":
		return "Download from https://ollama.com/download/mac"
	case "windows":
		return "Download from https://ollama.com/download/windows"
	default:
		return "Visit https://ollama.com for installation instructions"
	}
}

// GetOllamaInstallURL returns the download URL for Ollama
func GetOllamaInstallURL() string {
	switch runtime.GOOS {
	case "darwin":
		return "https://ollama.com/download/mac"
	case "windows":
		return "https://ollama.com/download/windows"
	default:
		return "https://ollama.com/download"
	}
}

// CanAutoInstallOllama returns true if we can install Ollama automatically (Linux only)
func CanAutoInstallOllama() bool {
	return runtime.GOOS == "linux"
}

// AutoInstallOllama attempts to automatically install Ollama (Linux only)
func AutoInstallOllama() error {
	if runtime.GOOS != "linux" {
		return fmt.Errorf("automatic installation only supported on Linux")
	}

	// Download and run the install script
	cmd := exec.Command("sh", "-c", "curl -fsSL https://ollama.com/install.sh | sh")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}
