package service

import (
	"fmt"
	"math"
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
	modelPath     string
	tokenizerPath string
	libraryPath   string
	mu            sync.Mutex
	ready         bool
	session       *ort.DynamicAdvancedSession
	tokenizer     *Tokenizer
	maxSeqLen     int
}

// ONNXConfig holds configuration for the ONNX embedding service
type ONNXConfig struct {
	// ModelPath is the path to the ONNX model file (all-MiniLM-L6-v2.onnx)
	ModelPath string

	// TokenizerPath is the path to the tokenizer.json file
	TokenizerPath string

	// LibraryPath is the path to the ONNX Runtime shared library
	// On Linux: libonnxruntime.so.1.x.x
	// On macOS: libonnxruntime.dylib
	// On Windows: onnxruntime.dll
	LibraryPath string

	// MaxSequenceLength is the maximum token sequence length (default 256)
	MaxSequenceLength int
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
	if config.TokenizerPath == "" {
		return nil, fmt.Errorf("tokenizer path is required")
	}

	maxSeqLen := config.MaxSequenceLength
	if maxSeqLen <= 0 {
		maxSeqLen = 256 // Default for all-MiniLM-L6-v2
	}

	return &ONNXEmbeddingService{
		modelPath:     config.ModelPath,
		tokenizerPath: config.TokenizerPath,
		libraryPath:   config.LibraryPath,
		maxSeqLen:     maxSeqLen,
		ready:         false,
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

	// Load tokenizer
	tokenizer, err := NewTokenizer(s.tokenizerPath, s.maxSeqLen)
	if err != nil {
		return fmt.Errorf("failed to load tokenizer: %w", err)
	}
	s.tokenizer = tokenizer

	// Set the shared library path if provided
	if s.libraryPath != "" {
		ort.SetSharedLibraryPath(s.libraryPath)
	}

	// Initialize the ONNX Runtime environment
	if err := ort.InitializeEnvironment(); err != nil {
		return fmt.Errorf("failed to initialize ONNX Runtime: %w", err)
	}

	// Create session options
	options, err := ort.NewSessionOptions()
	if err != nil {
		return fmt.Errorf("failed to create session options: %w", err)
	}
	defer options.Destroy()

	// Define input and output names for all-MiniLM-L6-v2
	// The model expects: input_ids, attention_mask, token_type_ids
	// The model outputs: last_hidden_state (we mean-pool this) or sentence_embedding
	inputNames := []string{"input_ids", "attention_mask", "token_type_ids"}
	outputNames := []string{"last_hidden_state"}

	// Create session
	session, err := ort.NewDynamicAdvancedSession(
		s.modelPath,
		inputNames,
		outputNames,
		options,
	)
	if err != nil {
		return fmt.Errorf("failed to create ONNX session: %w", err)
	}
	s.session = session

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
// Uses the all-MiniLM-L6-v2 model for semantic embeddings.
func (s *ONNXEmbeddingService) GenerateEmbedding(text string) ([]float32, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.ready {
		return nil, fmt.Errorf("ONNX service not initialized")
	}

	// 1. Tokenize text
	inputIDs, attentionMask := s.tokenizer.Encode(text)

	// 2. Create token_type_ids (all zeros for single-sentence encoding)
	tokenTypeIDs := make([]int64, s.maxSeqLen)

	// 3. Create input tensors [1, maxSeqLen] (batch size 1)
	shape := ort.NewShape(1, int64(s.maxSeqLen))

	inputIDsTensor, err := ort.NewTensor(shape, inputIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to create input_ids tensor: %w", err)
	}
	defer inputIDsTensor.Destroy()

	attentionMaskTensor, err := ort.NewTensor(shape, attentionMask)
	if err != nil {
		return nil, fmt.Errorf("failed to create attention_mask tensor: %w", err)
	}
	defer attentionMaskTensor.Destroy()

	tokenTypeIDsTensor, err := ort.NewTensor(shape, tokenTypeIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to create token_type_ids tensor: %w", err)
	}
	defer tokenTypeIDsTensor.Destroy()

	// 4. Create output tensor for last_hidden_state [1, maxSeqLen, 384]
	outputShape := ort.NewShape(1, int64(s.maxSeqLen), 384)
	outputTensor, err := ort.NewEmptyTensor[float32](outputShape)
	if err != nil {
		return nil, fmt.Errorf("failed to create output tensor: %w", err)
	}
	defer outputTensor.Destroy()

	// 5. Run inference
	inputs := []ort.Value{inputIDsTensor, attentionMaskTensor, tokenTypeIDsTensor}
	outputs := []ort.Value{outputTensor}

	if err := s.session.Run(inputs, outputs); err != nil {
		return nil, fmt.Errorf("ONNX inference failed: %w", err)
	}

	// 6. Mean-pool the output using attention mask
	// last_hidden_state is [1, seq_len, 384], we want [384]
	outputData := outputTensor.GetData()
	expectedLen := s.maxSeqLen * 384
	if len(outputData) != expectedLen {
		return nil, fmt.Errorf("unexpected output shape: got %d elements, expected %d", len(outputData), expectedLen)
	}
	embedding := meanPoolWithMask(outputData, attentionMask, s.maxSeqLen, 384)

	// 7. Normalize to unit vector
	normalizeVector(embedding)

	return embedding, nil
}

// meanPoolWithMask computes mean pooling over sequence length, considering only
// tokens where attention_mask is 1.
func meanPoolWithMask(data []float32, attentionMask []int64, seqLen, hiddenSize int) []float32 {
	embedding := make([]float32, hiddenSize)
	count := float32(0)

	for i := 0; i < seqLen; i++ {
		if attentionMask[i] == 1 {
			for j := 0; j < hiddenSize; j++ {
				embedding[j] += data[i*hiddenSize+j]
			}
			count++
		}
	}

	if count > 0 {
		for j := 0; j < hiddenSize; j++ {
			embedding[j] /= count
		}
	}

	return embedding
}

// normalizeVector normalizes a vector to unit length (L2 normalization)
func normalizeVector(v []float32) {
	var sumSq float64
	for _, val := range v {
		sumSq += float64(val) * float64(val)
	}
	norm := float32(math.Sqrt(sumSq))
	if norm > 0 {
		for i := range v {
			v[i] /= norm
		}
	}
}

// EmbeddingDimension returns the dimension of embeddings produced by this service.
// all-MiniLM-L6-v2 produces 384-dimensional embeddings.
func (s *ONNXEmbeddingService) EmbeddingDimension() int {
	return 384
}
