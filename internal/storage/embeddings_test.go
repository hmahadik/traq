package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestEmbeddingStorage(t *testing.T) {
	store, cleanup := testStore(t)
	defer cleanup()

	// Test embedding data
	embedding := make([]byte, 384*4) // 384 floats * 4 bytes
	for i := range embedding {
		embedding[i] = byte(i % 256)
	}
	contextText := "app:vscode title:main.go - traq"
	hash := sha256.Sum256([]byte(contextText))
	contextHash := hex.EncodeToString(hash[:])

	t.Run("SaveEmbedding", func(t *testing.T) {
		err := store.SaveEmbedding("focus", 1, embedding, contextText, contextHash)
		if err != nil {
			t.Fatalf("SaveEmbedding failed: %v", err)
		}
	})

	t.Run("GetEmbedding", func(t *testing.T) {
		emb, err := store.GetEmbedding("focus", 1)
		if err != nil {
			t.Fatalf("GetEmbedding failed: %v", err)
		}
		if emb == nil {
			t.Fatal("Expected embedding, got nil")
		}
		if emb.ContextText != contextText {
			t.Errorf("Expected context %q, got %q", contextText, emb.ContextText)
		}
	})

	t.Run("GetEmbedding_NotFound", func(t *testing.T) {
		emb, err := store.GetEmbedding("focus", 999)
		if err != nil {
			t.Fatalf("GetEmbedding failed: %v", err)
		}
		if emb != nil {
			t.Error("Expected nil for non-existent embedding")
		}
	})

	t.Run("SaveEmbedding_Upsert", func(t *testing.T) {
		// Update existing embedding
		newContextText := "app:vscode title:updated.go - traq"
		newHash := sha256.Sum256([]byte(newContextText))
		newContextHash := hex.EncodeToString(newHash[:])

		err := store.SaveEmbedding("focus", 1, embedding, newContextText, newContextHash)
		if err != nil {
			t.Fatalf("SaveEmbedding upsert failed: %v", err)
		}

		emb, _ := store.GetEmbedding("focus", 1)
		if emb.ContextText != newContextText {
			t.Errorf("Expected updated context %q, got %q", newContextText, emb.ContextText)
		}
	})

	t.Run("GetAllEmbeddingsWithProjects", func(t *testing.T) {
		embeddings, err := store.GetAllEmbeddingsWithProjects()
		if err != nil {
			t.Fatalf("GetAllEmbeddingsWithProjects failed: %v", err)
		}
		// Should return embeddings joined with project assignments
		// Since we haven't assigned projects, this should be empty
		if len(embeddings) != 0 {
			t.Logf("Found %d embeddings with projects", len(embeddings))
		}
	})
}

func TestHashContext(t *testing.T) {
	text := "app:code title:main.go"
	hash1 := HashContext(text)
	hash2 := HashContext(text)

	if hash1 != hash2 {
		t.Error("HashContext should be deterministic")
	}

	hash3 := HashContext("different text")
	if hash1 == hash3 {
		t.Error("Different text should produce different hash")
	}
}
