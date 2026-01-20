package service

import (
	"fmt"
	"os"
	"path/filepath"
)

// ModelPaths contains paths to required model files
type ModelPaths struct {
	ModelFile     string
	TokenizerFile string
}

// DefaultModelDir returns the default model directory
func DefaultModelDir() string {
	// Look in several locations in order of preference
	candidates := []string{
		"assets/models",                                  // Development
		filepath.Join(os.Getenv("HOME"), ".traq/models"), // User config
		"/usr/share/traq/models",                         // System-wide
	}

	for _, dir := range candidates {
		if _, err := os.Stat(dir); err == nil {
			return dir
		}
	}

	return candidates[0] // Default to development path
}

// FindModelFiles locates the model and tokenizer files
func FindModelFiles(modelDir string) (*ModelPaths, error) {
	modelCandidates := []string{
		"model_quantized.onnx",
		"model.onnx",
	}

	var modelFile string
	for _, candidate := range modelCandidates {
		path := filepath.Join(modelDir, candidate)
		if _, err := os.Stat(path); err == nil {
			modelFile = path
			break
		}
	}

	if modelFile == "" {
		return nil, fmt.Errorf("no model file found in %s (looked for model.onnx or model_quantized.onnx)", modelDir)
	}

	tokenizerFile := filepath.Join(modelDir, "tokenizer.json")
	if _, err := os.Stat(tokenizerFile); err != nil {
		return nil, fmt.Errorf("tokenizer.json not found in %s", modelDir)
	}

	return &ModelPaths{
		ModelFile:     modelFile,
		TokenizerFile: tokenizerFile,
	}, nil
}

// EnsureModelDir creates the model directory if it doesn't exist
func EnsureModelDir(modelDir string) error {
	return os.MkdirAll(modelDir, 0755)
}
