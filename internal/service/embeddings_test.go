package service

import (
	"strings"
	"testing"
)

func TestEmbeddingService(t *testing.T) {
	t.Run("BuildContextText", func(t *testing.T) {
		ctx := &EmbeddingContext{
			AppName:     "code",
			WindowTitle: "main.go - traq (Workspace) - Visual Studio Code",
			GitRepo:     "traq",
		}
		text := BuildContextText(ctx)
		if text == "" {
			t.Error("Expected non-empty context text")
		}
		if !strings.Contains(text, "app:code") {
			t.Error("Expected context to contain app:code")
		}
		if !strings.Contains(text, "repo:traq") {
			t.Error("Expected context to contain repo:traq")
		}
	})

	t.Run("BuildContextText_Empty", func(t *testing.T) {
		ctx := &EmbeddingContext{}
		text := BuildContextText(ctx)
		if text != "" {
			t.Errorf("Expected empty context text for empty input, got %q", text)
		}
	})

	t.Run("BuildContextText_AllFields", func(t *testing.T) {
		ctx := &EmbeddingContext{
			AppName:     "code",
			WindowTitle: "file.go",
			GitRepo:     "repo",
			GitBranch:   "main",
			Domain:      "github.com",
			FilePath:    "/home/user/project/file.go",
		}
		text := BuildContextText(ctx)
		if !strings.Contains(text, "app:code") {
			t.Error("Missing app")
		}
		if !strings.Contains(text, "title:file.go") {
			t.Error("Missing title")
		}
		if !strings.Contains(text, "repo:repo") {
			t.Error("Missing repo")
		}
		if !strings.Contains(text, "branch:main") {
			t.Error("Missing branch")
		}
		if !strings.Contains(text, "domain:github.com") {
			t.Error("Missing domain")
		}
		if !strings.Contains(text, "file:/home/user/project/file.go") {
			t.Error("Missing file path")
		}
	})

	t.Run("CosineSimilarity", func(t *testing.T) {
		// Identical vectors should have similarity 1.0
		a := []float32{1, 0, 0}
		b := []float32{1, 0, 0}
		sim := CosineSimilarity(a, b)
		if sim < 0.99 {
			t.Errorf("Expected similarity ~1.0, got %f", sim)
		}

		// Orthogonal vectors should have similarity 0.0
		c := []float32{0, 1, 0}
		sim2 := CosineSimilarity(a, c)
		if sim2 > 0.01 {
			t.Errorf("Expected similarity ~0.0, got %f", sim2)
		}

		// Opposite vectors should have similarity -1.0
		d := []float32{-1, 0, 0}
		sim3 := CosineSimilarity(a, d)
		if sim3 > -0.99 {
			t.Errorf("Expected similarity ~-1.0, got %f", sim3)
		}
	})

	t.Run("CosineSimilarity_EdgeCases", func(t *testing.T) {
		// Empty vectors
		sim := CosineSimilarity([]float32{}, []float32{})
		if sim != 0 {
			t.Errorf("Expected 0 for empty vectors, got %f", sim)
		}

		// Different lengths
		sim2 := CosineSimilarity([]float32{1, 0}, []float32{1, 0, 0})
		if sim2 != 0 {
			t.Errorf("Expected 0 for different lengths, got %f", sim2)
		}

		// Zero vector
		sim3 := CosineSimilarity([]float32{0, 0, 0}, []float32{1, 0, 0})
		if sim3 != 0 {
			t.Errorf("Expected 0 for zero vector, got %f", sim3)
		}
	})
}

func TestBytesToFloats(t *testing.T) {
	// Test round-trip conversion
	original := []float32{1.0, 2.5, -3.14, 0.0}
	bytes := FloatsToBytes(original)
	result := BytesToFloats(bytes)

	if len(result) != len(original) {
		t.Fatalf("Length mismatch: expected %d, got %d", len(original), len(result))
	}

	for i, v := range original {
		if result[i] != v {
			t.Errorf("Value mismatch at %d: expected %f, got %f", i, v, result[i])
		}
	}
}

func TestBytesToFloats_Invalid(t *testing.T) {
	// Invalid length (not multiple of 4)
	result := BytesToFloats([]byte{1, 2, 3})
	if result != nil {
		t.Error("Expected nil for invalid byte length")
	}
}

func TestGenerateEmbedding(t *testing.T) {
	svc := &EmbeddingService{}

	ctx := &EmbeddingContext{
		AppName:     "code",
		WindowTitle: "main.go - traq",
	}

	embedding := svc.GenerateEmbedding(ctx)
	if len(embedding) != 384 {
		t.Errorf("Expected 384-dim embedding, got %d", len(embedding))
	}

	// Same context should produce same embedding (deterministic)
	embedding2 := svc.GenerateEmbedding(ctx)
	if CosineSimilarity(embedding, embedding2) < 0.99 {
		t.Error("Expected deterministic embeddings for same context")
	}

	// Different context should produce different embedding
	ctx2 := &EmbeddingContext{
		AppName:     "firefox",
		WindowTitle: "Google Search",
	}
	embedding3 := svc.GenerateEmbedding(ctx2)
	sim := CosineSimilarity(embedding, embedding3)
	if sim > 0.99 {
		t.Errorf("Expected different embeddings for different context, got similarity %f", sim)
	}
}

func TestGenerateEmbedding_SimilarContexts(t *testing.T) {
	svc := &EmbeddingService{}

	// Similar contexts should have higher similarity than dissimilar ones
	ctx1 := &EmbeddingContext{
		AppName:     "code",
		WindowTitle: "main.go - traq",
		GitRepo:     "traq",
	}
	ctx2 := &EmbeddingContext{
		AppName:     "code",
		WindowTitle: "app.go - traq",
		GitRepo:     "traq",
	}
	ctx3 := &EmbeddingContext{
		AppName:     "firefox",
		WindowTitle: "YouTube",
		Domain:      "youtube.com",
	}

	emb1 := svc.GenerateEmbedding(ctx1)
	emb2 := svc.GenerateEmbedding(ctx2)
	emb3 := svc.GenerateEmbedding(ctx3)

	sim12 := CosineSimilarity(emb1, emb2) // Similar: both code/traq
	sim13 := CosineSimilarity(emb1, emb3) // Different: code vs firefox

	// Similar contexts should have higher similarity
	if sim12 <= sim13 {
		t.Errorf("Expected similar contexts to have higher similarity: sim12=%f, sim13=%f", sim12, sim13)
	}
}
