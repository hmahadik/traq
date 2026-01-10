package inference

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Engine represents an inference backend
type Engine string

const (
	EngineBundled Engine = "bundled"
	EngineOllama  Engine = "ollama"
	EngineCloud   Engine = "cloud"
)

// Config contains inference configuration
type Config struct {
	Engine   Engine
	Bundled  *BundledConfig
	Ollama   *OllamaConfig
	Cloud    *CloudConfig
}

// OllamaConfig contains Ollama-specific settings
type OllamaConfig struct {
	Host  string
	Model string
}

// CloudConfig contains cloud API settings
type CloudConfig struct {
	Provider string // "anthropic" or "openai"
	APIKey   string
	Model    string
	Endpoint string // Custom endpoint (optional)
}

// SummaryResult contains the generated summary
type SummaryResult struct {
	Summary       string
	Explanation   string
	Tags          []string
	Confidence    string
	ModelUsed     string
	InferenceMs   int64
}

// Service handles AI inference
type Service struct {
	config  *Config
	client  *http.Client
	bundled *BundledEngine
}

// NewService creates a new inference service
func NewService(config *Config) *Service {
	s := &Service{
		config: config,
		client: &http.Client{
			Timeout: 120 * time.Second, // LLM calls can be slow
		},
	}

	// Initialize bundled engine if configured
	if config.Engine == EngineBundled {
		if config.Bundled == nil {
			serverPath, modelPath := GetDefaultPaths()
			config.Bundled = &BundledConfig{
				ServerPath: serverPath,
				ModelPath:  modelPath,
			}
		}
		s.bundled = NewBundledEngine(config.Bundled)
	}

	return s
}

// UpdateConfig updates the inference configuration
func (s *Service) UpdateConfig(config *Config) {
	// Stop existing bundled engine if switching away
	if s.bundled != nil && config.Engine != EngineBundled {
		s.bundled.Stop()
		s.bundled = nil
	}

	s.config = config

	// Initialize bundled engine if switching to bundled
	if config.Engine == EngineBundled && s.bundled == nil {
		if config.Bundled == nil {
			serverPath, modelPath := GetDefaultPaths()
			config.Bundled = &BundledConfig{
				ServerPath: serverPath,
				ModelPath:  modelPath,
			}
		}
		s.bundled = NewBundledEngine(config.Bundled)
	}
}

// GenerateSummary generates a summary for the given context
func (s *Service) GenerateSummary(context *SessionContext) (*SummaryResult, error) {
	if s.config == nil {
		return nil, fmt.Errorf("inference not configured")
	}

	prompt := buildPrompt(context)

	start := time.Now()
	var response string
	var modelUsed string
	var err error

	switch s.config.Engine {
	case EngineBundled:
		if s.bundled == nil {
			return nil, fmt.Errorf("bundled engine not initialized")
		}
		// Start the bundled server if not already running
		if !s.bundled.IsRunning() {
			if err := s.bundled.Start(); err != nil {
				return nil, fmt.Errorf("failed to start bundled server: %w", err)
			}
		}
		response, err = s.bundled.Complete(prompt)
		modelUsed = "bundled:" + filepath.Base(s.config.Bundled.ModelPath)
	case EngineOllama:
		if s.config.Ollama == nil {
			return nil, fmt.Errorf("Ollama not configured")
		}
		response, err = s.callOllama(prompt)
		modelUsed = s.config.Ollama.Model
	case EngineCloud:
		if s.config.Cloud == nil {
			return nil, fmt.Errorf("Cloud API not configured")
		}
		response, err = s.callCloudAPI(prompt)
		modelUsed = s.config.Cloud.Model
	default:
		return nil, fmt.Errorf("unknown inference engine: %s", s.config.Engine)
	}

	if err != nil {
		return nil, fmt.Errorf("inference failed: %w", err)
	}

	inferenceMs := time.Since(start).Milliseconds()

	// Parse the response
	result := parseResponse(response)
	result.ModelUsed = modelUsed
	result.InferenceMs = inferenceMs

	return result, nil
}

// SessionContext contains data for summary generation
type SessionContext struct {
	StartTime       int64
	EndTime         int64
	DurationSeconds int64
	ScreenshotCount int
	TopApps         []string
	FocusEvents     []FocusEvent
	ShellCommands   []string
	GitCommits      []string
	FileEvents      []string
	BrowserVisits   []string
}

// FocusEvent represents a window focus event
type FocusEvent struct {
	AppName     string
	WindowTitle string
	Duration    float64
}

func buildPrompt(ctx *SessionContext) string {
	var sb strings.Builder

	sb.WriteString("Analyze this work session and provide a brief summary.\n\n")

	// Duration info
	duration := ctx.DurationSeconds
	hours := duration / 3600
	minutes := (duration % 3600) / 60
	if hours > 0 {
		sb.WriteString(fmt.Sprintf("Session Duration: %dh %dm\n", hours, minutes))
	} else {
		sb.WriteString(fmt.Sprintf("Session Duration: %dm\n", minutes))
	}
	sb.WriteString(fmt.Sprintf("Screenshots: %d\n\n", ctx.ScreenshotCount))

	// Top applications
	if len(ctx.TopApps) > 0 {
		sb.WriteString("Applications Used:\n")
		for _, app := range ctx.TopApps {
			sb.WriteString(fmt.Sprintf("- %s\n", app))
		}
		sb.WriteString("\n")
	}

	// Focus events (window titles provide context)
	if len(ctx.FocusEvents) > 0 {
		sb.WriteString("Window Activity:\n")
		count := 0
		for _, evt := range ctx.FocusEvents {
			if evt.Duration > 30 && count < 10 { // Only significant events
				sb.WriteString(fmt.Sprintf("- %s: %s (%.0fs)\n", evt.AppName, evt.WindowTitle, evt.Duration))
				count++
			}
		}
		sb.WriteString("\n")
	}

	// Shell commands
	if len(ctx.ShellCommands) > 0 {
		sb.WriteString("Shell Commands:\n")
		for i, cmd := range ctx.ShellCommands {
			if i >= 10 {
				sb.WriteString(fmt.Sprintf("... and %d more commands\n", len(ctx.ShellCommands)-10))
				break
			}
			sb.WriteString(fmt.Sprintf("- %s\n", cmd))
		}
		sb.WriteString("\n")
	}

	// Git commits
	if len(ctx.GitCommits) > 0 {
		sb.WriteString("Git Commits:\n")
		for _, commit := range ctx.GitCommits {
			sb.WriteString(fmt.Sprintf("- %s\n", commit))
		}
		sb.WriteString("\n")
	}

	// File events
	if len(ctx.FileEvents) > 0 {
		sb.WriteString("File Activity:\n")
		for i, evt := range ctx.FileEvents {
			if i >= 5 {
				sb.WriteString(fmt.Sprintf("... and %d more file events\n", len(ctx.FileEvents)-5))
				break
			}
			sb.WriteString(fmt.Sprintf("- %s\n", evt))
		}
		sb.WriteString("\n")
	}

	// Browser visits
	if len(ctx.BrowserVisits) > 0 {
		sb.WriteString("Browser Activity:\n")
		for i, visit := range ctx.BrowserVisits {
			if i >= 5 {
				sb.WriteString(fmt.Sprintf("... and %d more visits\n", len(ctx.BrowserVisits)-5))
				break
			}
			sb.WriteString(fmt.Sprintf("- %s\n", visit))
		}
		sb.WriteString("\n")
	}

	sb.WriteString(`
Please respond in this exact JSON format:
{
  "summary": "A brief 1-2 sentence summary of what was accomplished in this session",
  "explanation": "A slightly longer explanation of the main activities",
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": "high"
}

The tags should be relevant activity categories like "coding", "browsing", "documentation", "meetings", "debugging", etc.
The confidence should be "high", "medium", or "low" based on how clear the session's purpose was.
`)

	return sb.String()
}

func parseResponse(response string) *SummaryResult {
	result := &SummaryResult{
		Confidence: "medium",
	}

	// Try to extract JSON from the response
	start := strings.Index(response, "{")
	end := strings.LastIndex(response, "}")
	if start != -1 && end != -1 && end > start {
		jsonStr := response[start : end+1]

		var parsed struct {
			Summary     string   `json:"summary"`
			Explanation string   `json:"explanation"`
			Tags        []string `json:"tags"`
			Confidence  string   `json:"confidence"`
		}

		if err := json.Unmarshal([]byte(jsonStr), &parsed); err == nil {
			result.Summary = parsed.Summary
			result.Explanation = parsed.Explanation
			result.Tags = parsed.Tags
			if parsed.Confidence != "" {
				result.Confidence = parsed.Confidence
			}
			return result
		}
	}

	// Fallback: use raw response as summary
	result.Summary = strings.TrimSpace(response)
	if len(result.Summary) > 200 {
		result.Summary = result.Summary[:200] + "..."
	}
	result.Tags = []string{"general"}

	return result
}

// Ollama API types
type ollamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

type ollamaResponse struct {
	Response string `json:"response"`
}

func (s *Service) callOllama(prompt string) (string, error) {
	reqBody := ollamaRequest{
		Model:  s.config.Ollama.Model,
		Prompt: prompt,
		Stream: false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	url := strings.TrimSuffix(s.config.Ollama.Host, "/") + "/api/generate"
	resp, err := s.client.Post(url, "application/json", bytes.NewReader(jsonBody))
	if err != nil {
		return "", fmt.Errorf("failed to call Ollama: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("Ollama returned status %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	var ollamaResp ollamaResponse
	if err := json.Unmarshal(body, &ollamaResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	return ollamaResp.Response, nil
}

func (s *Service) callCloudAPI(prompt string) (string, error) {
	switch s.config.Cloud.Provider {
	case "anthropic":
		return s.callAnthropic(prompt)
	case "openai":
		return s.callOpenAI(prompt)
	default:
		return "", fmt.Errorf("unknown cloud provider: %s", s.config.Cloud.Provider)
	}
}

// Anthropic API types
type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
}

func (s *Service) callAnthropic(prompt string) (string, error) {
	reqBody := anthropicRequest{
		Model:     s.config.Cloud.Model,
		MaxTokens: 1024,
		Messages: []anthropicMessage{
			{Role: "user", Content: prompt},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	endpoint := s.config.Cloud.Endpoint
	if endpoint == "" {
		endpoint = "https://api.anthropic.com/v1/messages"
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", s.config.Cloud.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call Anthropic: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Anthropic returned status %d: %s", resp.StatusCode, string(body))
	}

	var anthropicResp anthropicResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(anthropicResp.Content) == 0 {
		return "", fmt.Errorf("empty response from Anthropic")
	}

	return anthropicResp.Content[0].Text, nil
}

// OpenAI API types
type openaiRequest struct {
	Model    string           `json:"model"`
	Messages []openaiMessage  `json:"messages"`
}

type openaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openaiResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (s *Service) callOpenAI(prompt string) (string, error) {
	reqBody := openaiRequest{
		Model: s.config.Cloud.Model,
		Messages: []openaiMessage{
			{Role: "user", Content: prompt},
		},
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	endpoint := s.config.Cloud.Endpoint
	if endpoint == "" {
		endpoint = "https://api.openai.com/v1/chat/completions"
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewReader(jsonBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.config.Cloud.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to call OpenAI: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("OpenAI returned status %d: %s", resp.StatusCode, string(body))
	}

	var openaiResp openaiResponse
	if err := json.Unmarshal(body, &openaiResp); err != nil {
		return "", fmt.Errorf("failed to parse response: %w", err)
	}

	if len(openaiResp.Choices) == 0 {
		return "", fmt.Errorf("empty response from OpenAI")
	}

	return openaiResp.Choices[0].Message.Content, nil
}

// InferenceStatus represents the current status of the inference service
type InferenceStatus struct {
	Engine          string `json:"engine"`
	Available       bool   `json:"available"`
	ModelName       string `json:"modelName"`
	BundledRunning  bool   `json:"bundledRunning,omitempty"`
	BundledReady    bool   `json:"bundledReady,omitempty"`
	OllamaConnected bool   `json:"ollamaConnected,omitempty"`
	CloudConfigured bool   `json:"cloudConfigured,omitempty"`
}

// SetupStatus contains detailed setup status with actionable feedback
type SetupStatus struct {
	Ready      bool   `json:"ready"`
	Engine     string `json:"engine"`
	Issue      string `json:"issue,omitempty"`      // Empty if ready
	Suggestion string `json:"suggestion,omitempty"` // Actionable fix
}

// GetStatus returns the current status of the inference service
func (s *Service) GetStatus() *InferenceStatus {
	if s.config == nil {
		return &InferenceStatus{
			Engine:    "none",
			Available: false,
		}
	}

	status := &InferenceStatus{
		Engine: string(s.config.Engine),
	}

	switch s.config.Engine {
	case EngineBundled:
		if s.bundled != nil {
			status.BundledRunning = s.bundled.IsRunning()
			status.BundledReady = s.bundled.IsAvailable()
			status.Available = status.BundledReady
			if s.config.Bundled != nil {
				status.ModelName = filepath.Base(s.config.Bundled.ModelPath)
			}
		}
	case EngineOllama:
		if s.config.Ollama != nil {
			status.OllamaConnected = s.checkOllamaConnection()
			status.Available = status.OllamaConnected
			status.ModelName = s.config.Ollama.Model
		}
	case EngineCloud:
		if s.config.Cloud != nil {
			status.CloudConfigured = s.config.Cloud.APIKey != ""
			status.Available = status.CloudConfigured
			status.ModelName = s.config.Cloud.Model
		}
	}

	return status
}

// checkOllamaConnection tests if Ollama is reachable
func (s *Service) checkOllamaConnection() bool {
	if s.config.Ollama == nil {
		return false
	}

	client := &http.Client{Timeout: 2 * time.Second}
	url := strings.TrimSuffix(s.config.Ollama.Host, "/") + "/api/tags"
	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// GetSetupStatus returns detailed setup status with actionable feedback
func (s *Service) GetSetupStatus() *SetupStatus {
	if s.config == nil {
		return &SetupStatus{
			Ready:      false,
			Engine:     "none",
			Issue:      "Inference not configured",
			Suggestion: "Configure AI inference in Settings",
		}
	}

	switch s.config.Engine {
	case EngineOllama:
		if s.config.Ollama == nil {
			return &SetupStatus{
				Ready:      false,
				Engine:     "ollama",
				Issue:      "Ollama not configured",
				Suggestion: "Configure Ollama settings in Settings > AI",
			}
		}

		// Test connection to Ollama
		client := &http.Client{Timeout: 2 * time.Second}
		url := strings.TrimSuffix(s.config.Ollama.Host, "/") + "/api/tags"
		resp, err := client.Get(url)
		if err != nil {
			return &SetupStatus{
				Ready:      false,
				Engine:     "ollama",
				Issue:      "Cannot reach Ollama server",
				Suggestion: "Install and start Ollama from https://ollama.com",
			}
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return &SetupStatus{
				Ready:      false,
				Engine:     "ollama",
				Issue:      fmt.Sprintf("Ollama server returned status %d", resp.StatusCode),
				Suggestion: "Check Ollama server status",
			}
		}

		// Check if model exists
		body, err := io.ReadAll(resp.Body)
		if err == nil {
			var tagsResp struct {
				Models []struct {
					Name string `json:"name"`
				} `json:"models"`
			}
			if err := json.Unmarshal(body, &tagsResp); err == nil {
				modelFound := false
				for _, m := range tagsResp.Models {
					if m.Name == s.config.Ollama.Model {
						modelFound = true
						break
					}
				}
				if !modelFound {
					return &SetupStatus{
						Ready:      false,
						Engine:     "ollama",
						Issue:      fmt.Sprintf("Model '%s' not found in Ollama", s.config.Ollama.Model),
						Suggestion: fmt.Sprintf("Run: ollama pull %s", s.config.Ollama.Model),
					}
				}
			}
		}

		return &SetupStatus{Ready: true, Engine: "ollama"}

	case EngineBundled:
		if s.config.Bundled == nil {
			return &SetupStatus{
				Ready:      false,
				Engine:     "bundled",
				Issue:      "Bundled engine not configured",
				Suggestion: "Configure bundled model in Settings > AI",
			}
		}

		// Check if server binary exists
		if s.config.Bundled.ServerPath != "" {
			if _, err := os.Stat(s.config.Bundled.ServerPath); err != nil {
				return &SetupStatus{
					Ready:      false,
					Engine:     "bundled",
					Issue:      "llama-server binary not found",
					Suggestion: "Download bundled AI model in Settings > AI",
				}
			}
		}

		// Check if model file exists
		if s.config.Bundled.ModelPath != "" {
			if _, err := os.Stat(s.config.Bundled.ModelPath); err != nil {
				return &SetupStatus{
					Ready:      false,
					Engine:     "bundled",
					Issue:      "Model file not found",
					Suggestion: "Download bundled AI model in Settings > AI",
				}
			}
		}

		// Both exist
		return &SetupStatus{Ready: true, Engine: "bundled"}

	case EngineCloud:
		if s.config.Cloud == nil {
			return &SetupStatus{
				Ready:      false,
				Engine:     "cloud",
				Issue:      "Cloud API not configured",
				Suggestion: "Configure API key in Settings > AI",
			}
		}

		// Check API key exists
		if s.config.Cloud.APIKey == "" {
			return &SetupStatus{
				Ready:      false,
				Engine:     "cloud",
				Issue:      "API key not configured",
				Suggestion: "Add API key in Settings > AI",
			}
		}

		return &SetupStatus{Ready: true, Engine: "cloud"}

	default:
		return &SetupStatus{
			Ready:      false,
			Engine:     string(s.config.Engine),
			Issue:      fmt.Sprintf("Unknown inference engine: %s", s.config.Engine),
			Suggestion: "Select a valid inference engine in Settings > AI",
		}
	}
}

// StartBundled starts the bundled engine if configured
func (s *Service) StartBundled() error {
	if s.config.Engine != EngineBundled {
		return fmt.Errorf("bundled engine not configured")
	}
	if s.bundled == nil {
		return fmt.Errorf("bundled engine not initialized")
	}
	return s.bundled.Start()
}

// StopBundled stops the bundled engine
func (s *Service) StopBundled() error {
	if s.bundled == nil {
		return nil
	}
	return s.bundled.Stop()
}

// GetBundledStatus returns detailed status of the bundled engine
func (s *Service) GetBundledStatus() *BundledStatus {
	if s.bundled == nil {
		return &BundledStatus{
			Available:       false,
			Running:         false,
			ModelDownloaded: false,
			ServerInstalled: false,
		}
	}
	return s.bundled.GetStatus()
}

// Shutdown cleanly shuts down the inference service
func (s *Service) Shutdown() {
	if s.bundled != nil {
		s.bundled.Stop()
	}
}
