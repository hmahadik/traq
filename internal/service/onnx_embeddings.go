package service

import (
	"fmt"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
)

// ONNXEmbeddingService wraps the ONNX runtime for real semantic embeddings
// using the all-MiniLM-L6-v2 model.
//
// NOTE: Requires ONNX Runtime C library to be installed.
// On Ubuntu: Download from https://github.com/microsoft/onnxruntime/releases
//
// The model outputs 384-dimensional embeddings, same as our pseudo-embeddings,
// so it's a drop-in replacement for GenerateEmbedding.
type ONNXEmbeddingService struct {
	modelPath   string
	libraryPath string
	mu          sync.Mutex
	ready       bool
	session     *ort.DynamicAdvancedSession
}

// ONNXConfig holds configuration for the ONNX embedding service
type ONNXConfig struct {
	// ModelPath is the path to the ONNX model file (all-MiniLM-L6-v2.onnx)
	ModelPath string

	// LibraryPath is the path to the ONNX Runtime shared library
	// On Linux: libonnxruntime.so.1.x.x
	// On macOS: libonnxruntime.dylib
	// On Windows: onnxruntime.dll
	LibraryPath string
}

// NewONNXEmbeddingService creates a new ONNX embedding service.
// Returns nil if ONNX Runtime is not available or model cannot be loaded.
//
// The service is created in an uninitialized state. Call Initialize() to
// load the model and prepare for inference.
func NewONNXEmbeddingService(config ONNXConfig) (*ONNXEmbeddingService, error) {
	if config.ModelPath == "" {
		return nil, fmt.Errorf("model path is required")
	}

	return &ONNXEmbeddingService{
		modelPath:   config.ModelPath,
		libraryPath: config.LibraryPath,
		ready:       false,
	}, nil
}

// Initialize loads the ONNX Runtime and model.
// This must be called before GenerateEmbedding.
func (s *ONNXEmbeddingService) Initialize() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.ready {
		return nil
	}

	// Set the shared library path if provided
	if s.libraryPath != "" {
		ort.SetSharedLibraryPath(s.libraryPath)
	}

	// Initialize the ONNX Runtime environment
	if err := ort.InitializeEnvironment(); err != nil {
		return fmt.Errorf("failed to initialize ONNX Runtime: %w", err)
	}

	// TODO: Load the model and create session
	// This will be implemented in the next task (2.2)
	//
	// The model expects:
	// - input_ids: int64 tensor [batch_size, sequence_length]
	// - attention_mask: int64 tensor [batch_size, sequence_length]
	// - token_type_ids: int64 tensor [batch_size, sequence_length] (optional)
	//
	// The model outputs:
	// - last_hidden_state: float32 tensor [batch_size, sequence_length, 384]
	// - We'll mean-pool this to get [batch_size, 384] embeddings

	s.ready = true
	return nil
}

// Close releases ONNX Runtime resources
func (s *ONNXEmbeddingService) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.session != nil {
		if err := s.session.Destroy(); err != nil {
			return fmt.Errorf("failed to destroy session: %w", err)
		}
		s.session = nil
	}

	// Cleanup ONNX Runtime environment
	// Note: This affects all sessions, so only call when shutting down
	if err := ort.DestroyEnvironment(); err != nil {
		return fmt.Errorf("failed to destroy ONNX environment: %w", err)
	}

	s.ready = false
	return nil
}

// IsReady returns true if the service is initialized and ready for inference
func (s *ONNXEmbeddingService) IsReady() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ready
}

// GenerateEmbedding creates a 384-dimensional embedding for the given text.
// This is a placeholder that will be implemented in task 2.2.
//
// For now, it falls back to the pseudo-embedding generator.
func (s *ONNXEmbeddingService) GenerateEmbedding(text string) ([]float32, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.ready {
		return nil, fmt.Errorf("ONNX service not initialized")
	}

	// TODO: Implement actual ONNX inference in task 2.2
	// 1. Tokenize text using the model's tokenizer
	// 2. Create input tensors (input_ids, attention_mask)
	// 3. Run inference
	// 4. Mean-pool the output to get embeddings
	// 5. Normalize to unit vector

	// For now, return placeholder
	return nil, fmt.Errorf("ONNX inference not yet implemented")
}

// EmbeddingDimension returns the dimension of embeddings produced by this service.
// all-MiniLM-L6-v2 produces 384-dimensional embeddings.
func (s *ONNXEmbeddingService) EmbeddingDimension() int {
	return 384
}
