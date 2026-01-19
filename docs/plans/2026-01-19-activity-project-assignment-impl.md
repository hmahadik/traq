# Activity-to-Project Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace brittle pattern-based project assignment with embedding-based similarity matching, add timeline bulk assignment UI, enhance project page with activity browser, and add project filtering to reports.

**Architecture:** Local embedding model (all-MiniLM-L6-v2 via ONNX) generates vectors for activity context. Similarity search finds nearest labeled activities. UI enables bulk assignment via timeline drag-select. Reports filter by project.

**Tech Stack:** Go (backend), ONNX Runtime (embeddings), SQLite (vector storage), React/TypeScript (frontend), TanStack Query (data fetching)

---

## Phase 1: Embedding Infrastructure

### Task 1.1: Add Embedding Storage Schema

**Files:**
- Modify: `internal/storage/migrations.go`
- Modify: `internal/storage/models.go`

**Step 1: Add migration for activity_embeddings table**

In `internal/storage/migrations.go`, add migration ID 11:

```go
{
    ID:   11,
    Name: "add_activity_embeddings",
    Up: `
        CREATE TABLE IF NOT EXISTS activity_embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            event_id INTEGER NOT NULL,
            embedding BLOB NOT NULL,
            context_text TEXT NOT NULL,
            context_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(event_type, event_id)
        );
        CREATE INDEX IF NOT EXISTS idx_embeddings_event ON activity_embeddings(event_type, event_id);
        CREATE INDEX IF NOT EXISTS idx_embeddings_hash ON activity_embeddings(context_hash);
    `,
    Down: `
        DROP INDEX IF EXISTS idx_embeddings_hash;
        DROP INDEX IF EXISTS idx_embeddings_event;
        DROP TABLE IF EXISTS activity_embeddings;
    `,
},
```

**Step 2: Add model types**

In `internal/storage/models.go`, add:

```go
// ActivityEmbedding stores vector embeddings for activities
type ActivityEmbedding struct {
    ID          int64   `json:"id"`
    EventType   string  `json:"eventType"`
    EventID     int64   `json:"eventId"`
    Embedding   []byte  `json:"embedding"` // Float32 array as bytes
    ContextText string  `json:"contextText"`
    ContextHash string  `json:"contextHash"`
    CreatedAt   int64   `json:"createdAt"`
}

// EmbeddingContext holds the text components for embedding generation
type EmbeddingContext struct {
    AppName     string `json:"appName"`
    WindowTitle string `json:"windowTitle"`
    GitRepo     string `json:"gitRepo,omitempty"`
    GitBranch   string `json:"gitBranch,omitempty"`
    Domain      string `json:"domain,omitempty"`
    FilePath    string `json:"filePath,omitempty"`
}
```

**Step 3: Run migration test**

Run: `go test ./internal/storage/... -v -run TestMigrations`
Expected: PASS

**Step 4: Commit**

```bash
git add internal/storage/migrations.go internal/storage/models.go
git commit -m "feat(storage): add activity_embeddings schema"
```

---

### Task 1.2: Create Embedding Storage CRUD

**Files:**
- Create: `internal/storage/embeddings.go`
- Create: `internal/storage/embeddings_test.go`

**Step 1: Write the test file**

Create `internal/storage/embeddings_test.go`:

```go
package storage

import (
    "crypto/sha256"
    "encoding/hex"
    "testing"
)

func TestEmbeddingStorage(t *testing.T) {
    store := setupTestStore(t)
    defer store.Close()

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

    t.Run("GetAllEmbeddingsWithProjects", func(t *testing.T) {
        embeddings, err := store.GetAllEmbeddingsWithProjects()
        if err != nil {
            t.Fatalf("GetAllEmbeddingsWithProjects failed: %v", err)
        }
        // Should return embeddings joined with project assignments
        if len(embeddings) == 0 {
            t.Log("No embeddings with projects yet (expected)")
        }
    })
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/storage/... -v -run TestEmbeddingStorage`
Expected: FAIL with "SaveEmbedding not defined"

**Step 3: Implement embedding storage**

Create `internal/storage/embeddings.go`:

```go
package storage

import (
    "crypto/sha256"
    "database/sql"
    "encoding/hex"
    "time"
)

// SaveEmbedding stores or updates an embedding for an activity
func (s *Store) SaveEmbedding(eventType string, eventID int64, embedding []byte, contextText, contextHash string) error {
    _, err := s.db.Exec(`
        INSERT INTO activity_embeddings (event_type, event_id, embedding, context_text, context_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(event_type, event_id) DO UPDATE SET
            embedding = excluded.embedding,
            context_text = excluded.context_text,
            context_hash = excluded.context_hash
    `, eventType, eventID, embedding, contextText, contextHash, time.Now().Unix())
    return err
}

// GetEmbedding retrieves an embedding for an activity
func (s *Store) GetEmbedding(eventType string, eventID int64) (*ActivityEmbedding, error) {
    var emb ActivityEmbedding
    err := s.db.QueryRow(`
        SELECT id, event_type, event_id, embedding, context_text, context_hash, created_at
        FROM activity_embeddings
        WHERE event_type = ? AND event_id = ?
    `, eventType, eventID).Scan(
        &emb.ID, &emb.EventType, &emb.EventID, &emb.Embedding,
        &emb.ContextText, &emb.ContextHash, &emb.CreatedAt,
    )
    if err == sql.ErrNoRows {
        return nil, nil
    }
    return &emb, err
}

// EmbeddingWithProject holds an embedding with its project assignment
type EmbeddingWithProject struct {
    ActivityEmbedding
    ProjectID   sql.NullInt64  `json:"projectId"`
    ProjectName sql.NullString `json:"projectName"`
}

// GetAllEmbeddingsWithProjects returns all embeddings that have project assignments
func (s *Store) GetAllEmbeddingsWithProjects() ([]EmbeddingWithProject, error) {
    rows, err := s.db.Query(`
        SELECT
            e.id, e.event_type, e.event_id, e.embedding, e.context_text, e.context_hash, e.created_at,
            COALESCE(f.project_id, s.project_id) as project_id,
            p.name as project_name
        FROM activity_embeddings e
        LEFT JOIN window_focus_events f ON e.event_type = 'focus' AND e.event_id = f.id
        LEFT JOIN screenshots s ON e.event_type = 'screenshot' AND e.event_id = s.id
        LEFT JOIN projects p ON p.id = COALESCE(f.project_id, s.project_id)
        WHERE COALESCE(f.project_id, s.project_id) IS NOT NULL
    `)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var results []EmbeddingWithProject
    for rows.Next() {
        var emb EmbeddingWithProject
        err := rows.Scan(
            &emb.ID, &emb.EventType, &emb.EventID, &emb.Embedding,
            &emb.ContextText, &emb.ContextHash, &emb.CreatedAt,
            &emb.ProjectID, &emb.ProjectName,
        )
        if err != nil {
            return nil, err
        }
        results = append(results, emb)
    }
    return results, rows.Err()
}

// HashContext generates a deterministic hash for embedding context
func HashContext(contextText string) string {
    hash := sha256.Sum256([]byte(contextText))
    return hex.EncodeToString(hash[:])
}
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/storage/... -v -run TestEmbeddingStorage`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/storage/embeddings.go internal/storage/embeddings_test.go
git commit -m "feat(storage): add embedding CRUD operations"
```

---

### Task 1.3: Create Embedding Service (In-Memory Vector Store)

**Files:**
- Create: `internal/service/embeddings.go`
- Create: `internal/service/embeddings_test.go`

**Step 1: Write the test file**

Create `internal/service/embeddings_test.go`:

```go
package service

import (
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
        if !contains(text, "app:code") {
            t.Error("Expected context to contain app:code")
        }
        if !contains(text, "repo:traq") {
            t.Error("Expected context to contain repo:traq")
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
    })
}

func contains(s, substr string) bool {
    return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
    for i := 0; i <= len(s)-len(substr); i++ {
        if s[i:i+len(substr)] == substr {
            return true
        }
    }
    return false
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/service/... -v -run TestEmbeddingService`
Expected: FAIL with "BuildContextText not defined"

**Step 3: Implement embedding service**

Create `internal/service/embeddings.go`:

```go
package service

import (
    "fmt"
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
    store      *storage.Store

    // In-memory vector index
    vectors    []LabeledVector
    vectorsMu  sync.RWMutex
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
func NewEmbeddingService(store *storage.Store) *EmbeddingService {
    svc := &EmbeddingService{
        store:   store,
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
        floats := bytesToFloats(emb.Embedding)
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

    // Sort by similarity descending (simple bubble sort for small k)
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

// Helper to convert bytes to float32 slice
func bytesToFloats(b []byte) []float32 {
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

// Helper to convert float32 slice to bytes
func floatsToBytes(f []float32) []byte {
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
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/service/... -v -run TestEmbeddingService`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/service/embeddings.go internal/service/embeddings_test.go
git commit -m "feat(service): add embedding service with similarity search"
```

---

### Task 1.4: Add Mock Embedding Generator (Placeholder for ONNX)

**Files:**
- Modify: `internal/service/embeddings.go`
- Modify: `internal/service/embeddings_test.go`

**Step 1: Add test for embedding generation**

Add to `internal/service/embeddings_test.go`:

```go
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
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/service/... -v -run TestGenerateEmbedding`
Expected: FAIL

**Step 3: Implement mock embedding generator**

Add to `internal/service/embeddings.go`:

```go
import (
    "hash/fnv"
)

// GenerateEmbedding creates an embedding for the given context
// NOTE: This is a placeholder using hash-based pseudo-embeddings.
// TODO: Replace with ONNX model (all-MiniLM-L6-v2) for real semantic embeddings
func (s *EmbeddingService) GenerateEmbedding(ctx *EmbeddingContext) []float32 {
    text := BuildContextText(ctx)
    return generatePseudoEmbedding(text, 384)
}

// generatePseudoEmbedding creates a deterministic pseudo-embedding from text
// This is NOT a real embedding - just a placeholder that provides some signal
func generatePseudoEmbedding(text string, dims int) []float32 {
    embedding := make([]float32, dims)

    // Use FNV hash for deterministic values
    h := fnv.New64a()

    // Generate embeddings from n-grams for some semantic signal
    words := strings.Fields(strings.ToLower(text))
    for i, word := range words {
        h.Reset()
        h.Write([]byte(word))
        hash := h.Sum64()

        // Distribute word influence across multiple dimensions
        for j := 0; j < 8 && (i*8+j) < dims; j++ {
            idx := (int(hash>>uint(j*8)) + i*8 + j) % dims
            val := float32(hash>>(uint(j*8)&0xFF)) / 255.0
            embedding[idx] += val - 0.5
        }
    }

    // Normalize
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
```

**Step 4: Run test to verify it passes**

Run: `go test ./internal/service/... -v -run TestGenerateEmbedding`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/service/embeddings.go internal/service/embeddings_test.go
git commit -m "feat(service): add placeholder embedding generator"
```

---

### Task 1.5: Wire Embedding Service into App

**Files:**
- Modify: `app.go`

**Step 1: Add embedding service to App struct**

In `app.go`, add to imports and App struct:

```go
// In App struct, add:
embeddingService *service.EmbeddingService
```

**Step 2: Initialize in startup**

In the `startup` method (or equivalent initialization), add:

```go
a.embeddingService = service.NewEmbeddingService(a.store)
// Load existing vectors on startup
go func() {
    if err := a.embeddingService.LoadVectors(); err != nil {
        log.Printf("Failed to load embedding vectors: %v", err)
    }
}()
```

**Step 3: Build to verify compilation**

Run: `go build -o /dev/null ./...`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add app.go
git commit -m "feat(app): wire embedding service into app"
```

---

## Phase 2: Timeline Assignment UI

### Task 2.1: Add Project Assignment API Endpoints

**Files:**
- Modify: `app.go`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/hooks.ts`

**Step 1: Add backend method for bulk assignment**

In `app.go`, add:

```go
// BulkAssignProject assigns multiple activities to a project
func (a *App) BulkAssignProject(assignments []BulkAssignment) error {
    for _, assign := range assignments {
        if err := a.projectService.ManualAssign(assign.EventType, assign.EventID, assign.ProjectID); err != nil {
            return fmt.Errorf("failed to assign %s/%d: %w", assign.EventType, assign.EventID, err)
        }

        // Generate and store embedding for newly assigned activity
        ctx, err := a.projectService.ExtractEventContext(assign.EventType, assign.EventID)
        if err == nil && ctx != nil {
            embCtx := &service.EmbeddingContext{
                AppName:     ctx.AppName,
                WindowTitle: ctx.WindowTitle,
                GitRepo:     ctx.GitRepo,
                Domain:      ctx.Domain,
            }
            embedding := a.embeddingService.GenerateEmbedding(embCtx)
            contextText := service.BuildContextText(embCtx)
            contextHash := storage.HashContext(contextText)
            a.store.SaveEmbedding(assign.EventType, assign.EventID, service.FloatsToBytes(embedding), contextText, contextHash)
        }
    }

    // Reload vectors after bulk assignment
    go a.embeddingService.LoadVectors()

    return nil
}

// BulkAssignment represents a single assignment in a bulk operation
type BulkAssignment struct {
    EventType string `json:"eventType"`
    EventID   int64  `json:"eventId"`
    ProjectID int64  `json:"projectId"`
}
```

**Step 2: Regenerate Wails bindings**

Run: `wails generate bindings`
Expected: SUCCESS

**Step 3: Update frontend API client**

In `frontend/src/api/client.ts`, add to the api object:

```typescript
assignments: {
    bulk: (assignments: Array<{eventType: string; eventId: number; projectId: number}>) =>
        BulkAssignProject(assignments),
},
```

**Step 4: Add React Query mutation hook**

In `frontend/src/api/hooks.ts`, add:

```typescript
// Bulk assignment mutation
export function useBulkAssignProject() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (assignments: Array<{eventType: string; eventId: number; projectId: number}>) =>
            api.assignments.bulk(assignments),
        onSuccess: () => {
            // Invalidate timeline and project queries
            queryClient.invalidateQueries({ queryKey: queryKeys.timeline.all });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            toast.success('Activities assigned successfully');
        },
        onError: (error: Error) => {
            toast.error(`Assignment failed: ${error.message}`);
        },
    });
}
```

**Step 5: Build frontend to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add app.go frontend/src/api/client.ts frontend/src/api/hooks.ts
git commit -m "feat(api): add bulk project assignment endpoint"
```

---

### Task 2.2: Add Selection State to Timeline Grid

**Files:**
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`
- Create: `frontend/src/components/timeline/useActivitySelection.ts`

**Step 1: Create selection hook**

Create `frontend/src/components/timeline/useActivitySelection.ts`:

```typescript
import { useState, useCallback } from 'react';

export interface SelectableActivity {
    eventType: string;
    eventId: number;
    projectId?: number;
}

export function useActivitySelection() {
    const [selectedActivities, setSelectedActivities] = useState<Map<string, SelectableActivity>>(new Map());

    const getKey = (activity: SelectableActivity) => `${activity.eventType}-${activity.eventId}`;

    const toggleSelection = useCallback((activity: SelectableActivity) => {
        setSelectedActivities(prev => {
            const next = new Map(prev);
            const key = getKey(activity);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.set(key, activity);
            }
            return next;
        });
    }, []);

    const selectRange = useCallback((activities: SelectableActivity[]) => {
        setSelectedActivities(prev => {
            const next = new Map(prev);
            activities.forEach(a => next.set(getKey(a), a));
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedActivities(new Map());
    }, []);

    const isSelected = useCallback((activity: SelectableActivity) => {
        return selectedActivities.has(getKey(activity));
    }, [selectedActivities]);

    return {
        selectedActivities: Array.from(selectedActivities.values()),
        selectedCount: selectedActivities.size,
        toggleSelection,
        selectRange,
        clearSelection,
        isSelected,
    };
}
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/useActivitySelection.ts
git commit -m "feat(ui): add activity selection hook for timeline"
```

---

### Task 2.3: Add Assignment Toolbar Component

**Files:**
- Create: `frontend/src/components/timeline/AssignmentToolbar.tsx`

**Step 1: Create the toolbar component**

Create `frontend/src/components/timeline/AssignmentToolbar.tsx`:

```typescript
import { useState } from 'react';
import { Check, X, FolderKanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useProjects, useBulkAssignProject } from '@/api/hooks';
import type { SelectableActivity } from './useActivitySelection';

interface AssignmentToolbarProps {
    selectedActivities: SelectableActivity[];
    onClearSelection: () => void;
    onAssignmentComplete?: () => void;
}

export function AssignmentToolbar({
    selectedActivities,
    onClearSelection,
    onAssignmentComplete,
}: AssignmentToolbarProps) {
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const { data: projects } = useProjects();
    const bulkAssign = useBulkAssignProject();

    if (selectedActivities.length === 0) {
        return null;
    }

    const handleAssign = async () => {
        if (!selectedProjectId) return;

        const assignments = selectedActivities.map(a => ({
            eventType: a.eventType,
            eventId: a.eventId,
            projectId: parseInt(selectedProjectId, 10),
        }));

        await bulkAssign.mutateAsync(assignments);
        onClearSelection();
        onAssignmentComplete?.();
    };

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
                <FolderKanban className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{selectedActivities.length} selected</span>
            </div>

            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select project..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="0">
                        <span className="text-muted-foreground">Unassigned</span>
                    </SelectItem>
                    {projects?.map(project => (
                        <SelectItem key={project.id} value={String(project.id)}>
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: project.color }}
                                />
                                {project.name}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                size="sm"
                onClick={handleAssign}
                disabled={!selectedProjectId || bulkAssign.isPending}
            >
                <Check className="w-4 h-4 mr-1" />
                Assign
            </Button>

            <Button
                size="sm"
                variant="ghost"
                onClick={onClearSelection}
            >
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
}
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/AssignmentToolbar.tsx
git commit -m "feat(ui): add assignment toolbar for bulk project assignment"
```

---

### Task 2.4: Integrate Selection into EntriesColumn

**Files:**
- Modify: `frontend/src/components/timeline/EntriesColumn.tsx`
- Modify: `frontend/src/components/timeline/EntryBlock.tsx`

**Step 1: Update EntryBlock to support selection**

In `frontend/src/components/timeline/EntryBlock.tsx`, add selection props:

```typescript
interface EntryBlockProps {
    entry: EntryBlockData;
    hourHeight: number;
    isSelected?: boolean;
    onClick?: (entry: EntryBlockData) => void;
    onContextMenu?: (entry: EntryBlockData, e: React.MouseEvent) => void;
    onSelect?: (entry: EntryBlockData, e: React.MouseEvent) => void;
}
```

Add visual indicator for selection:

```typescript
// In the component's className, add:
className={`... ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}

// Add click handler for selection:
onClick={(e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
        onSelect?.(entry, e);
    } else {
        onClick?.(entry);
    }
}}
```

**Step 2: Update EntriesColumn to pass selection props**

In `frontend/src/components/timeline/EntriesColumn.tsx`, add:

```typescript
interface EntriesColumnProps {
    entries: EntryBlockData[];
    hours: number[];
    hourHeight: number;
    selectedIds?: Set<string>;
    onEntryClick?: (entry: EntryBlockData) => void;
    onEntrySelect?: (entry: EntryBlockData, e: React.MouseEvent) => void;
    onEntryContextMenu?: (entry: EntryBlockData, e: React.MouseEvent) => void;
}

// In the map over entries:
<EntryBlock
    key={`${entry.eventType}-${entry.id}`}
    entry={entry}
    hourHeight={hourHeight}
    isSelected={selectedIds?.has(`${entry.eventType}-${entry.id}`)}
    onClick={onEntryClick}
    onSelect={onEntrySelect}
    onContextMenu={onEntryContextMenu}
/>
```

**Step 3: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/EntriesColumn.tsx frontend/src/components/timeline/EntryBlock.tsx
git commit -m "feat(ui): add selection support to entries column"
```

---

### Task 2.5: Integrate Selection into TimelineGridView

**Files:**
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`

**Step 1: Import and wire up selection**

In `frontend/src/components/timeline/TimelineGridView.tsx`:

```typescript
import { useActivitySelection } from './useActivitySelection';
import { AssignmentToolbar } from './AssignmentToolbar';

// In the component:
const {
    selectedActivities,
    selectedCount,
    toggleSelection,
    clearSelection,
    isSelected,
} = useActivitySelection();

// Create a Set for efficient lookup
const selectedIds = new Set(
    selectedActivities.map(a => `${a.eventType}-${a.eventId}`)
);

// In the JSX, add the toolbar:
<AssignmentToolbar
    selectedActivities={selectedActivities}
    onClearSelection={clearSelection}
/>

// Pass to EntriesColumn:
<EntriesColumn
    entries={entries}
    hours={hours}
    hourHeight={hourHeight}
    selectedIds={selectedIds}
    onEntryClick={handleEntryClick}
    onEntrySelect={(entry, e) => {
        toggleSelection({
            eventType: entry.eventType,
            eventId: entry.id,
            projectId: entry.projectId,
        });
    }}
/>
```

**Step 2: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 3: Test manually**

Run: `wails dev -tags webkit2_41`
Expected: Can Ctrl/Cmd+click entries to select, toolbar appears, can assign to project

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/TimelineGridView.tsx
git commit -m "feat(ui): integrate activity selection into timeline grid"
```

---

### Task 2.6: Add Projects Lane to Drops View

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx`
- Modify: `frontend/src/components/timeline/eventDrops/useEventDropsData.ts`

**Step 1: Add projects as a swim lane type**

In the event drops data hook, add projects lane:

```typescript
// Add 'projects' to the event types
export type EventDropType = 'activity' | 'git' | 'shell' | 'browser' | 'file' | 'afk' | 'screenshot' | 'projects';

// In the data transformation, add projects lane from entries data
if (data?.entries) {
    lanes.push({
        type: 'projects' as EventDropType,
        label: 'Projects',
        events: data.entries.map(entry => ({
            id: `project-${entry.eventType}-${entry.id}`,
            timestamp: new Date(entry.startTime * 1000),
            endTimestamp: new Date(entry.endTime * 1000),
            type: 'projects' as EventDropType,
            data: {
                projectId: entry.projectId,
                projectName: entry.projectName,
                projectColor: entry.projectColor,
                eventType: entry.eventType,
                eventId: entry.id,
            },
        })),
    });
}
```

**Step 2: Render projects lane at top**

In `EventDropsTimeline.tsx`, render projects lane first with special styling:

```typescript
// Sort lanes to put projects first
const sortedLanes = useMemo(() => {
    const projectsLane = eventDropsData.find(l => l.type === 'projects');
    const otherLanes = eventDropsData.filter(l => l.type !== 'projects');
    return projectsLane ? [projectsLane, ...otherLanes] : otherLanes;
}, [eventDropsData]);

// Render project events as colored rectangles spanning their time range
```

**Step 3: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx frontend/src/components/timeline/eventDrops/useEventDropsData.ts
git commit -m "feat(ui): add projects lane to drops timeline view"
```

---

## Phase 3: Project Page Enhancement

### Task 3.1: Add Activity List API Endpoint

**Files:**
- Modify: `app.go`
- Modify: `internal/storage/projects.go`

**Step 1: Add storage method for project activities**

In `internal/storage/projects.go`, add:

```go
// ProjectActivity represents an activity assigned to a project
type ProjectActivity struct {
    EventType       string  `json:"eventType"`
    EventID         int64   `json:"eventId"`
    AppName         string  `json:"appName"`
    WindowTitle     string  `json:"windowTitle"`
    StartTime       int64   `json:"startTime"`
    DurationSeconds float64 `json:"durationSeconds"`
    Confidence      float64 `json:"confidence"`
    Source          string  `json:"source"`
}

// GetProjectActivities returns activities assigned to a project
func (s *Store) GetProjectActivities(projectID int64, startTime, endTime int64, limit int) ([]ProjectActivity, error) {
    query := `
        SELECT
            'focus' as event_type,
            id,
            app_name,
            window_title,
            start_time,
            duration_seconds,
            COALESCE(project_confidence, 0) as confidence,
            COALESCE(project_source, 'unknown') as source
        FROM window_focus_events
        WHERE project_id = ?
          AND start_time >= ? AND start_time <= ?
        ORDER BY start_time DESC
        LIMIT ?
    `

    rows, err := s.db.Query(query, projectID, startTime, endTime, limit)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var activities []ProjectActivity
    for rows.Next() {
        var a ProjectActivity
        err := rows.Scan(&a.EventType, &a.EventID, &a.AppName, &a.WindowTitle,
            &a.StartTime, &a.DurationSeconds, &a.Confidence, &a.Source)
        if err != nil {
            return nil, err
        }
        activities = append(activities, a)
    }
    return activities, rows.Err()
}
```

**Step 2: Add app.go endpoint**

In `app.go`, add:

```go
// GetProjectActivities returns activities for a project in a time range
func (a *App) GetProjectActivities(projectID int64, startDate, endDate string) ([]storage.ProjectActivity, error) {
    start, _ := time.ParseInLocation("2006-01-02", startDate, time.Local)
    end, _ := time.ParseInLocation("2006-01-02", endDate, time.Local)
    end = end.Add(24 * time.Hour) // Include full end day

    return a.store.GetProjectActivities(projectID, start.Unix(), end.Unix(), 500)
}
```

**Step 3: Build and generate bindings**

Run: `wails generate bindings && go build -o /dev/null ./...`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add app.go internal/storage/projects.go
git commit -m "feat(api): add endpoint for project activities"
```

---

### Task 3.2: Add Activities Tab to Project Page

**Files:**
- Modify: `frontend/src/pages/ProjectsPage.tsx`
- Create: `frontend/src/components/projects/ProjectActivitiesTab.tsx`

**Step 1: Create ProjectActivitiesTab component**

Create `frontend/src/components/projects/ProjectActivitiesTab.tsx`:

```typescript
import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Pencil, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useProjectActivities, useBulkAssignProject, useProjects } from '@/api/hooks';
import type { Project } from '@/api/client';

interface ProjectActivitiesTabProps {
    project: Project;
}

function formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function ProjectActivitiesTab({ project }: ProjectActivitiesTabProps) {
    const [dateRange, setDateRange] = useState('7'); // days
    const [reassigning, setReassigning] = useState<number | null>(null);

    const endDate = format(new Date(), 'yyyy-MM-dd');
    const startDate = format(subDays(new Date(), parseInt(dateRange)), 'yyyy-MM-dd');

    const { data: activities, isLoading } = useProjectActivities(project.id, startDate, endDate);
    const { data: allProjects } = useProjects();
    const bulkAssign = useBulkAssignProject();

    const handleReassign = async (activity: any, newProjectId: number) => {
        await bulkAssign.mutateAsync([{
            eventType: activity.eventType,
            eventId: activity.eventId,
            projectId: newProjectId,
        }]);
        setReassigning(null);
    };

    if (isLoading) {
        return <div className="p-4 text-muted-foreground">Loading activities...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">Today</SelectItem>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>

                <span className="text-sm text-muted-foreground">
                    {activities?.length || 0} activities
                </span>
            </div>

            <div className="border rounded-lg divide-y">
                {activities?.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                        No activities in this time range
                    </div>
                ) : (
                    activities?.map((activity) => (
                        <div
                            key={`${activity.eventType}-${activity.eventId}`}
                            className="p-3 flex items-center gap-3 hover:bg-muted/50"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                    {activity.appName}
                                </div>
                                <div className="text-sm text-muted-foreground truncate">
                                    {activity.windowTitle}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-3 h-3" />
                                {formatDuration(activity.durationSeconds)}
                            </div>

                            <Badge variant="outline" className="text-xs">
                                {activity.source}
                            </Badge>

                            {reassigning === activity.eventId ? (
                                <Select
                                    onValueChange={(v) => handleReassign(activity, parseInt(v))}
                                >
                                    <SelectTrigger className="w-32">
                                        <SelectValue placeholder="Move to..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">Unassigned</SelectItem>
                                        {allProjects?.filter(p => p.id !== project.id).map(p => (
                                            <SelectItem key={p.id} value={String(p.id)}>
                                                {p.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setReassigning(activity.eventId)}
                                >
                                    <Pencil className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
```

**Step 2: Add hook for project activities**

In `frontend/src/api/hooks.ts`, add:

```typescript
export function useProjectActivities(projectId: number, startDate: string, endDate: string) {
    return useQuery({
        queryKey: ['projects', projectId, 'activities', startDate, endDate],
        queryFn: () => api.projects.getActivities(projectId, startDate, endDate),
        enabled: !!projectId,
    });
}
```

**Step 3: Update API client**

In `frontend/src/api/client.ts`, add to projects:

```typescript
projects: {
    // ... existing methods
    getActivities: (projectId: number, startDate: string, endDate: string) =>
        GetProjectActivities(projectId, startDate, endDate),
},
```

**Step 4: Integrate into ProjectsPage**

In `frontend/src/pages/ProjectsPage.tsx`, add tabs to ProjectCard:

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProjectActivitiesTab } from '@/components/projects/ProjectActivitiesTab';

// In ProjectCard, wrap content in tabs:
<Tabs defaultValue="overview">
    <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="activities">Activities</TabsTrigger>
        <TabsTrigger value="patterns">Patterns</TabsTrigger>
    </TabsList>
    <TabsContent value="overview">
        {/* existing stats content */}
    </TabsContent>
    <TabsContent value="activities">
        <ProjectActivitiesTab project={project} />
    </TabsContent>
    <TabsContent value="patterns">
        {/* existing patterns content */}
    </TabsContent>
</Tabs>
```

**Step 5: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add frontend/src/pages/ProjectsPage.tsx frontend/src/components/projects/ProjectActivitiesTab.tsx frontend/src/api/hooks.ts frontend/src/api/client.ts
git commit -m "feat(ui): add activities tab to project page"
```

---

## Phase 4: Report Filtering

### Task 4.1: Add Project Filter to Report Generation

**Files:**
- Modify: `internal/service/reports.go`
- Modify: `app.go`

**Step 1: Add project filter to GenerateReport**

In `internal/service/reports.go`, modify the `GenerateReport` signature and implementation:

```go
// GenerateReportWithFilter generates a report filtered by project
func (s *ReportsService) GenerateReportWithFilter(timeRange, reportType string, includeScreenshots bool, projectID int64) (*Report, error) {
    // Parse time range
    tr, err := s.parseTimeRange(timeRange)
    if err != nil {
        return nil, err
    }

    // Build context with optional project filter
    ctx, err := s.buildEnhancedReportContextWithFilter(tr, projectID)
    if err != nil {
        return nil, err
    }

    // ... rest of report generation
}

// buildEnhancedReportContextWithFilter adds project filtering
func (s *ReportsService) buildEnhancedReportContextWithFilter(tr *TimeRange, projectID int64) (*EnhancedReportContext, error) {
    ctx := &EnhancedReportContext{
        TimeRange:    tr,
        SummariesMap: make(map[int64]*storage.Summary),
        ProjectID:    projectID, // Add this field
    }

    // Get focus events with optional project filter
    var focusEvents []*storage.WindowFocusEvent
    var err error
    if projectID > 0 {
        focusEvents, err = s.store.GetFocusEventsByProject(tr.Start, tr.End, projectID)
    } else {
        focusEvents, err = s.store.GetWindowFocusEventsByTimeRange(tr.Start, tr.End)
    }
    // ... continue with filtering other data types
}
```

**Step 2: Add storage method for filtered focus events**

In `internal/storage/projects.go`, add:

```go
// GetFocusEventsByProject returns focus events for a specific project
func (s *Store) GetFocusEventsByProject(startTime, endTime int64, projectID int64) ([]*WindowFocusEvent, error) {
    query := `
        SELECT id, session_id, app_name, window_title, start_time, end_time, duration_seconds,
               project_id, project_confidence, project_source
        FROM window_focus_events
        WHERE start_time >= ? AND start_time <= ?
          AND project_id = ?
        ORDER BY start_time
    `
    return s.queryFocusEvents(query, startTime, endTime, projectID)
}
```

**Step 3: Update app.go endpoint**

In `app.go`, add:

```go
// GenerateProjectReport generates a report for a specific project
func (a *App) GenerateProjectReport(timeRange, reportType string, includeScreenshots bool, projectID int64) (*service.Report, error) {
    return a.reportsService.GenerateReportWithFilter(timeRange, reportType, includeScreenshots, projectID)
}
```

**Step 4: Build and verify**

Run: `go build -o /dev/null ./...`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add internal/service/reports.go internal/storage/projects.go app.go
git commit -m "feat(reports): add project filtering to report generation"
```

---

### Task 4.2: Add Project Filter UI to Reports Page

**Files:**
- Modify: `frontend/src/pages/ReportsPage.tsx`

**Step 1: Add project selector to report form**

In `frontend/src/pages/ReportsPage.tsx`, add project filter:

```typescript
import { useProjects } from '@/api/hooks';

// In the component:
const { data: projects } = useProjects();
const [selectedProjectId, setSelectedProjectId] = useState<string>('all');

// In the form JSX, add:
<div className="space-y-2">
    <label className="text-sm font-medium">Project Filter</label>
    <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
        <SelectTrigger>
            <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="all">All projects (combined)</SelectItem>
            {projects?.map(project => (
                <SelectItem key={project.id} value={String(project.id)}>
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: project.color }}
                        />
                        {project.name}
                    </div>
                </SelectItem>
            ))}
        </SelectContent>
    </Select>
</div>

// Update the generate function to pass projectId:
const handleGenerate = async () => {
    const projectId = selectedProjectId === 'all' ? 0 : parseInt(selectedProjectId, 10);
    const report = await api.reports.generateWithFilter(
        timeRange,
        reportType,
        includeScreenshots,
        projectId
    );
    // ... handle report
};
```

**Step 2: Update API client**

In `frontend/src/api/client.ts`, add:

```typescript
reports: {
    // ... existing methods
    generateWithFilter: (timeRange: string, reportType: string, includeScreenshots: boolean, projectId: number) =>
        GenerateProjectReport(timeRange, reportType, includeScreenshots, projectId),
},
```

**Step 3: Build to verify**

Run: `cd frontend && npm run build`
Expected: SUCCESS

**Step 4: Test manually**

Run: `wails dev -tags webkit2_41`
Expected: Can select a project and generate a filtered report

**Step 5: Commit**

```bash
git add frontend/src/pages/ReportsPage.tsx frontend/src/api/client.ts
git commit -m "feat(ui): add project filter to reports page"
```

---

## Phase 5: Accuracy Tracking

### Task 5.1: Add Assignment Accuracy Metrics

**Files:**
- Create: `internal/storage/metrics.go`
- Modify: `app.go`

**Step 1: Create metrics storage**

Create `internal/storage/metrics.go`:

```go
package storage

import "time"

// AssignmentMetrics holds accuracy statistics
type AssignmentMetrics struct {
    PeriodStart     int64   `json:"periodStart"`
    PeriodEnd       int64   `json:"periodEnd"`
    TotalActivities int     `json:"totalActivities"`
    AutoAssigned    int     `json:"autoAssigned"`
    UserAssigned    int     `json:"userAssigned"`
    Corrections     int     `json:"corrections"`
    AccuracyRate    float64 `json:"accuracyRate"`
}

// GetAssignmentMetrics calculates assignment accuracy for a time period
func (s *Store) GetAssignmentMetrics(startTime, endTime int64) (*AssignmentMetrics, error) {
    metrics := &AssignmentMetrics{
        PeriodStart: startTime,
        PeriodEnd:   endTime,
    }

    // Count total activities with assignments
    err := s.db.QueryRow(`
        SELECT COUNT(*) FROM window_focus_events
        WHERE start_time >= ? AND start_time <= ?
          AND project_id IS NOT NULL
    `, startTime, endTime).Scan(&metrics.TotalActivities)
    if err != nil {
        return nil, err
    }

    // Count by source
    rows, err := s.db.Query(`
        SELECT project_source, COUNT(*) FROM window_focus_events
        WHERE start_time >= ? AND start_time <= ?
          AND project_id IS NOT NULL
        GROUP BY project_source
    `, startTime, endTime)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    for rows.Next() {
        var source string
        var count int
        rows.Scan(&source, &count)
        switch source {
        case "user":
            metrics.UserAssigned = count
        case "rule", "embedding":
            metrics.AutoAssigned += count
        }
    }

    // TODO: Track corrections separately (requires storing original assignment)

    if metrics.AutoAssigned > 0 {
        metrics.AccuracyRate = float64(metrics.AutoAssigned-metrics.Corrections) / float64(metrics.AutoAssigned)
    }

    return metrics, nil
}
```

**Step 2: Add app endpoint**

In `app.go`, add:

```go
// GetAssignmentMetrics returns accuracy metrics for the past week
func (a *App) GetAssignmentMetrics() (*storage.AssignmentMetrics, error) {
    now := time.Now()
    weekAgo := now.AddDate(0, 0, -7)
    return a.store.GetAssignmentMetrics(weekAgo.Unix(), now.Unix())
}
```

**Step 3: Build and verify**

Run: `go build -o /dev/null ./...`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add internal/storage/metrics.go app.go
git commit -m "feat(metrics): add assignment accuracy tracking"
```

---

## Summary

This plan covers:

1. **Phase 1: Embedding Infrastructure** (Tasks 1.1-1.5)
   - Database schema for embeddings
   - CRUD operations
   - In-memory vector store with similarity search
   - Mock embedding generator (placeholder for ONNX)
   - App wiring

2. **Phase 2: Timeline Assignment UI** (Tasks 2.1-2.6)
   - Bulk assignment API
   - Selection state management
   - Assignment toolbar component
   - Integration with EntriesColumn
   - Integration with TimelineGridView
   - Projects lane in Drops view

3. **Phase 3: Project Page Enhancement** (Tasks 3.1-3.2)
   - Activity list API endpoint
   - Activities tab with filtering and reassignment

4. **Phase 4: Report Filtering** (Tasks 4.1-4.2)
   - Project filter in report generation
   - UI for selecting project in reports

5. **Phase 5: Accuracy Tracking** (Task 5.1)
   - Metrics storage and calculation

**Future work (not in this plan):**
- ONNX integration for real embeddings
- LLM-based classification for ambiguous cases
- Report → Timeline deep links
