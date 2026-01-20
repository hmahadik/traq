package service

import (
	"fmt"
	"hash/fnv"
	"math"
	"strings"
	"sync"

	"traq/internal/storage"
)

// EmbeddingContext holds context for generating embeddings
type EmbeddingContext struct {
	AppName     string
	WindowTitle string
	GitRepo     string
	GitBranch   string
	Domain      string
	FilePath    string
}

// EmbeddingService handles embedding generation and similarity search
type EmbeddingService struct {
	store *storage.Store
	onnx  *ONNXEmbeddingService // Real embeddings if available

	// In-memory vector index
	vectors   []LabeledVector
	vectorsMu sync.RWMutex
}

// LabeledVector holds an embedding with its project label
type LabeledVector struct {
	EventType   string
	EventID     int64
	ProjectID   int64
	ProjectName string
	Embedding   []float32
	ContextText string
}

// SimilarityResult represents a similarity search result
type SimilarityResult struct {
	EventType   string  `json:"eventType"`
	EventID     int64   `json:"eventId"`
	ProjectID   int64   `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Similarity  float64 `json:"similarity"`
	ContextText string  `json:"contextText"`
}

// NewEmbeddingService creates a new embedding service
// Pass nil for onnx to use pseudo-embeddings only
func NewEmbeddingService(store *storage.Store, onnx *ONNXEmbeddingService) *EmbeddingService {
	svc := &EmbeddingService{
		store:   store,
		onnx:    onnx,
		vectors: make([]LabeledVector, 0),
	}
	return svc
}

// BuildContextText creates a text representation for embedding
func BuildContextText(ctx *EmbeddingContext) string {
	var parts []string

	if ctx.AppName != "" {
		parts = append(parts, fmt.Sprintf("app:%s", strings.ToLower(ctx.AppName)))
	}
	if ctx.WindowTitle != "" {
		// Clean and truncate window title
		title := strings.ToLower(ctx.WindowTitle)
		if len(title) > 200 {
			title = title[:200]
		}
		parts = append(parts, fmt.Sprintf("title:%s", title))
	}
	if ctx.GitRepo != "" {
		parts = append(parts, fmt.Sprintf("repo:%s", strings.ToLower(ctx.GitRepo)))
	}
	if ctx.GitBranch != "" {
		parts = append(parts, fmt.Sprintf("branch:%s", strings.ToLower(ctx.GitBranch)))
	}
	if ctx.Domain != "" {
		parts = append(parts, fmt.Sprintf("domain:%s", strings.ToLower(ctx.Domain)))
	}
	if ctx.FilePath != "" {
		parts = append(parts, fmt.Sprintf("file:%s", strings.ToLower(ctx.FilePath)))
	}

	return strings.Join(parts, " ")
}

// GenerateEmbedding creates an embedding for the given context
// Uses ONNX if available, falls back to pseudo-embeddings
func (s *EmbeddingService) GenerateEmbedding(ctx *EmbeddingContext) []float32 {
	text := BuildContextText(ctx)

	// Use ONNX if available and ready
	if s.onnx != nil && s.onnx.IsReady() {
		embedding, err := s.onnx.GenerateEmbedding(text)
		if err == nil {
			return embedding
		}
		// Fall through to pseudo-embedding on error
	}

	// Fallback to pseudo-embeddings
	return generatePseudoEmbedding(text, 384)
}

// generatePseudoEmbedding creates a deterministic pseudo-embedding from text.
// This is NOT a real embedding - just a placeholder that provides some signal
// based on word presence and n-grams.
func generatePseudoEmbedding(text string, dims int) []float32 {
	embedding := make([]float32, dims)

	if text == "" || dims == 0 {
		return embedding
	}

	// Use FNV hash for deterministic values
	h := fnv.New64a()

	// Generate embeddings from words for some semantic signal
	words := strings.Fields(strings.ToLower(text))
	for _, word := range words {
		h.Reset()
		h.Write([]byte(word))
		hash := h.Sum64()

		// Distribute word influence across multiple dimensions
		for j := 0; j < 8; j++ {
			// Use modulo on unsigned hash to ensure positive index
			idx := int(hash % uint64(dims))
			hash = hash*31 + uint64(j) // Scramble for next iteration
			val := float32((hash>>8)&0xFF) / 255.0
			embedding[idx] += val - 0.5
		}
	}

	// Add bigram features for better similarity
	for i := 0; i < len(words)-1; i++ {
		bigram := words[i] + " " + words[i+1]
		h.Reset()
		h.Write([]byte(bigram))
		hash := h.Sum64()

		for j := 0; j < 4; j++ {
			idx := int(hash % uint64(dims))
			hash = hash*31 + uint64(j)
			val := float32((hash>>8)&0xFF) / 255.0
			embedding[idx] += (val - 0.5) * 0.5 // Lower weight for bigrams
		}
	}

	// Normalize to unit vector
	var norm float32
	for _, v := range embedding {
		norm += v * v
	}
	if norm > 0 {
		norm = float32(math.Sqrt(float64(norm)))
		for i := range embedding {
			embedding[i] /= norm
		}
	}

	return embedding
}

// CosineSimilarity calculates cosine similarity between two vectors
func CosineSimilarity(a, b []float32) float64 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// LoadVectors loads all labeled vectors into memory
func (s *EmbeddingService) LoadVectors() error {
	embeddings, err := s.store.GetAllEmbeddingsWithProjects()
	if err != nil {
		return err
	}

	s.vectorsMu.Lock()
	defer s.vectorsMu.Unlock()

	s.vectors = make([]LabeledVector, 0, len(embeddings))
	for _, emb := range embeddings {
		if !emb.ProjectID.Valid {
			continue
		}
		floats := BytesToFloats(emb.Embedding)
		if len(floats) == 0 {
			continue
		}
		s.vectors = append(s.vectors, LabeledVector{
			EventType:   emb.EventType,
			EventID:     emb.EventID,
			ProjectID:   emb.ProjectID.Int64,
			ProjectName: emb.ProjectName.String,
			Embedding:   floats,
			ContextText: emb.ContextText,
		})
	}
	return nil
}

// FindSimilar finds k most similar labeled vectors
func (s *EmbeddingService) FindSimilar(embedding []float32, k int) []SimilarityResult {
	s.vectorsMu.RLock()
	defer s.vectorsMu.RUnlock()

	type scored struct {
		idx   int
		score float64
	}

	scores := make([]scored, 0, len(s.vectors))
	for i, v := range s.vectors {
		sim := CosineSimilarity(embedding, v.Embedding)
		scores = append(scores, scored{i, sim})
	}

	// Sort by similarity descending (simple selection sort for small k)
	for i := 0; i < len(scores)-1 && i < k; i++ {
		maxIdx := i
		for j := i + 1; j < len(scores); j++ {
			if scores[j].score > scores[maxIdx].score {
				maxIdx = j
			}
		}
		scores[i], scores[maxIdx] = scores[maxIdx], scores[i]
	}

	results := make([]SimilarityResult, 0, k)
	for i := 0; i < k && i < len(scores); i++ {
		v := s.vectors[scores[i].idx]
		results = append(results, SimilarityResult{
			EventType:   v.EventType,
			EventID:     v.EventID,
			ProjectID:   v.ProjectID,
			ProjectName: v.ProjectName,
			Similarity:  scores[i].score,
			ContextText: v.ContextText,
		})
	}
	return results
}

// SuggestProject suggests a project based on embedding similarity
func (s *EmbeddingService) SuggestProject(embedding []float32, minConfidence float64) *ProjectSuggestion {
	similar := s.FindSimilar(embedding, 5)
	if len(similar) == 0 {
		return nil
	}

	// Vote by project (weighted by similarity)
	votes := make(map[int64]float64)
	names := make(map[int64]string)
	for _, r := range similar {
		votes[r.ProjectID] += r.Similarity
		names[r.ProjectID] = r.ProjectName
	}

	// Find best project
	var bestID int64
	var bestScore float64
	for pid, score := range votes {
		if score > bestScore {
			bestScore = score
			bestID = pid
		}
	}

	// Normalize confidence (0-1)
	confidence := bestScore / float64(len(similar))
	if confidence < minConfidence {
		return nil
	}

	return &ProjectSuggestion{
		ProjectID:   bestID,
		ProjectName: names[bestID],
		Confidence:  confidence,
		Source:      "embedding",
	}
}

// ProjectSuggestion represents a project suggestion
type ProjectSuggestion struct {
	ProjectID   int64   `json:"projectId"`
	ProjectName string  `json:"projectName"`
	Confidence  float64 `json:"confidence"`
	Source      string  `json:"source"`
}

// BytesToFloats converts bytes to float32 slice
func BytesToFloats(b []byte) []float32 {
	if len(b)%4 != 0 {
		return nil
	}
	floats := make([]float32, len(b)/4)
	for i := range floats {
		bits := uint32(b[i*4]) | uint32(b[i*4+1])<<8 | uint32(b[i*4+2])<<16 | uint32(b[i*4+3])<<24
		floats[i] = math.Float32frombits(bits)
	}
	return floats
}

// FloatsToBytes converts float32 slice to bytes
func FloatsToBytes(f []float32) []byte {
	b := make([]byte, len(f)*4)
	for i, v := range f {
		bits := math.Float32bits(v)
		b[i*4] = byte(bits)
		b[i*4+1] = byte(bits >> 8)
		b[i*4+2] = byte(bits >> 16)
		b[i*4+3] = byte(bits >> 24)
	}
	return b
}
