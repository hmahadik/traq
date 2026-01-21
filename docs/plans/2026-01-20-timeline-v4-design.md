# Timeline V4 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Traq's timeline into a flexible workspace with synchronized views, unified selection, real embeddings, and AI learning from user feedback.

**Architecture:** Split-panel layout with Grid, Drops, and List as first-class views sharing a unified selection model. Real semantic embeddings via ONNX replace pseudo-embeddings. Draft behavior system for AI features with learning from user corrections.

**Tech Stack:** Go 1.21+ (backend), React 18 + TypeScript (frontend), D3.js (drops), ONNX Runtime (embeddings), SQLite (storage), TailwindCSS (styling)

---

## Current Codebase Reference

**Key Files:**
- Timeline Grid: `frontend/src/components/timeline/TimelineGridView.tsx` (562 lines)
- EventDrops: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx` (746 lines)
- Event types: `frontend/src/types/timeline.ts` (338 lines)
- Config service: `internal/service/config.go` (800+ lines)
- Embeddings: `internal/service/embeddings.go` (325 lines)
- Grid data: `internal/service/timeline_grid.go`

**Existing Patterns:**
- Column components follow consistent props: `hours`, `hourHeight`, `selectedEventKeys`, `onEvent`
- Selection uses `Set<EventKey>` where `EventKey = "${type}:${id}"`
- Config uses dot notation (`timeline.minActivityDurationSeconds`)
- D3 renders dots at line 366-411 in EventDropsTimeline.tsx

---

## Phase 1: Foundation & Critical Fixes

### Task 1.1: Drops View Duration Bars - Backend Type Update

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/eventDropsTypes.ts:1-50`

**Step 1: Read the current types file**

Verify the EventDot interface structure before modifying.

**Step 2: Add duration field to EventDot**

```typescript
// In eventDropsTypes.ts, update EventDot interface
export interface EventDot {
  id: string;
  timestamp: Date;
  row: string;
  type: EventDropType;
  color: string;
  originalData: unknown;
  duration?: number; // Duration in seconds (for activities)
}
```

**Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/eventDropsTypes.ts
git commit -m "$(cat <<'EOF'
feat(drops): add duration field to EventDot type

Prepare for duration-aware rendering where activities render as
horizontal bars instead of dots.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Drops View Duration Bars - Data Transformation

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/useEventDropsData.ts`

**Step 1: Read the data hook**

Review how events are transformed to EventDot.

**Step 2: Pass duration through for activities**

Find where activity events are mapped and add duration:

```typescript
// In the activity mapping section
const activityDots: EventDot[] = activities.map((activity) => ({
  id: `activity-${activity.id}`,
  timestamp: new Date(activity.startTime * 1000),
  row: activity.appName,
  type: 'activity' as const,
  color: getEventTypeColor('activity'),
  originalData: activity,
  duration: activity.durationSeconds, // Add duration
}));
```

**Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/useEventDropsData.ts
git commit -m "$(cat <<'EOF'
feat(drops): pass duration through to EventDot for activities

Activities now carry their duration for use in rendering decisions.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Drops View Duration Bars - Rendering Logic

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx:350-420`

**Step 1: Add duration threshold constant**

After the existing DOT_RADIUS constant (around line 30):

```typescript
const DOT_RADIUS = 5;
const DOT_HOVER_RADIUS = 8;
const BAR_HEIGHT = 14; // Height of duration bars
const BAR_MIN_DURATION = 10; // Minimum duration (seconds) to render as bar
const BAR_MIN_PIXELS = 6; // Minimum pixel width to render as bar
```

**Step 2: Add helper function to determine rendering type**

Before the component (or at the top of the useEffect):

```typescript
// Helper to determine if event should render as bar vs dot
const shouldRenderAsBar = (
  event: EventDot,
  xScale: d3.ScaleTime<number, number>
): boolean => {
  if (!event.duration || event.duration < BAR_MIN_DURATION) return false;

  const startTime = event.timestamp.getTime();
  const endTime = startTime + (event.duration * 1000);
  const pixelWidth = xScale(new Date(endTime)) - xScale(event.timestamp);

  return pixelWidth >= BAR_MIN_PIXELS;
};
```

**Step 3: Split events into dots and bars**

Replace the single dots rendering (lines 365-411) with:

```typescript
// Separate events by rendering type
const dotEvents = allEvents.filter(d => !shouldRenderAsBar(d, xScale));
const barEvents = allEvents.filter(d => shouldRenderAsBar(d, xScale));

// Render dots (for instant/brief events)
dotsGroup.selectAll('.event-dot')
  .data(dotEvents, (d) => (d as EventDot).id)
  .join('circle')
  .attr('class', 'event-dot')
  .attr('cx', (d) => xScale(d.timestamp))
  .attr('cy', (d) => (yScale(d.row) || 0) + yScale.bandwidth() / 2)
  .attr('r', DOT_RADIUS)
  .attr('fill', (d) => d.color)
  .attr('stroke', (d) => d.color)
  .attr('stroke-width', 1.5)
  .style('cursor', 'pointer')
  .on('mouseenter', function (event, d) {
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = null;
    }
    d3.select(this)
      .transition()
      .duration(100)
      .attr('r', DOT_HOVER_RADIUS);
    setHoveredEvent(d);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  })
  .on('mousemove', function (event) {
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  })
  .on('mouseleave', function () {
    d3.select(this)
      .transition()
      .duration(100)
      .attr('r', DOT_RADIUS);
    hideTooltipTimeoutRef.current = setTimeout(() => {
      if (!isTooltipHovered) {
        setHoveredEvent(null);
        setTooltipPosition(null);
      }
    }, 150);
  })
  .on('click', function (_, d) {
    onEventClick?.(d);
  });

// Render bars (for duration events)
dotsGroup.selectAll('.event-bar')
  .data(barEvents, (d) => (d as EventDot).id)
  .join('rect')
  .attr('class', 'event-bar')
  .attr('x', (d) => xScale(d.timestamp))
  .attr('y', (d) => (yScale(d.row) || 0) + (yScale.bandwidth() - BAR_HEIGHT) / 2)
  .attr('width', (d) => {
    const startTime = d.timestamp.getTime();
    const endTime = startTime + ((d.duration || 0) * 1000);
    return Math.max(BAR_MIN_PIXELS, xScale(new Date(endTime)) - xScale(d.timestamp));
  })
  .attr('height', BAR_HEIGHT)
  .attr('rx', BAR_HEIGHT / 2) // Pill shape
  .attr('ry', BAR_HEIGHT / 2)
  .attr('fill', (d) => d.color)
  .attr('fill-opacity', 0.7)
  .attr('stroke', (d) => d.color)
  .attr('stroke-width', 1.5)
  .style('cursor', 'pointer')
  .on('mouseenter', function (event, d) {
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current);
      hideTooltipTimeoutRef.current = null;
    }
    d3.select(this)
      .transition()
      .duration(100)
      .attr('fill-opacity', 0.9);
    setHoveredEvent(d);
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  })
  .on('mousemove', function (event) {
    setTooltipPosition({ x: event.clientX, y: event.clientY });
  })
  .on('mouseleave', function () {
    d3.select(this)
      .transition()
      .duration(100)
      .attr('fill-opacity', 0.7);
    hideTooltipTimeoutRef.current = setTimeout(() => {
      if (!isTooltipHovered) {
        setHoveredEvent(null);
        setTooltipPosition(null);
      }
    }, 150);
  })
  .on('click', function (_, d) {
    onEventClick?.(d);
  });
```

**Step 4: Build frontend**

Run: `cd frontend && npm run build`
Expected: Success

**Step 5: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(drops): render duration events as horizontal bars

- Events >= 10 seconds with >= 6px width render as pills
- Brief/instant events remain as dots
- Same hover/click interactions for both
- Pill shape (rx/ry = height/2) for visual distinction

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Drops View Duration Bars - Zoom Handler Update

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx:280-300`

**Step 1: Find the zoom handler**

Look for the zoom behavior callback that updates dot positions.

**Step 2: Add bar updates to zoom handler**

After the existing dot position update:

```typescript
// Existing: Update dot positions
svg.selectAll<SVGCircleElement, EventDot>('.event-dot')
  .attr('cx', (d) => newXScale(d.timestamp));

// Add: Update bar positions and widths
svg.selectAll<SVGRectElement, EventDot>('.event-bar')
  .attr('x', (d) => newXScale(d.timestamp))
  .attr('width', (d) => {
    const startTime = d.timestamp.getTime();
    const endTime = startTime + ((d.duration || 0) * 1000);
    return Math.max(BAR_MIN_PIXELS, newXScale(new Date(endTime)) - newXScale(d.timestamp));
  });
```

**Step 3: Also update "now" line if it exists**

Ensure now-line updates in zoom too (if not already).

**Step 4: Build and test**

Run: `cd frontend && npm run build`
Expected: Success

Test manually:
1. Navigate to Timeline, switch to Drops view
2. Zoom in/out with mouse wheel
3. Verify bars resize correctly with zoom

**Step 5: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(drops): update bar widths on zoom

Bars now correctly resize when zooming in/out, maintaining
accurate duration representation at all zoom levels.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.5: Extended Zoom Range - Drops View

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx`

**Step 1: Find current zoom extent**

Look for `d3.zoom().scaleExtent([min, max])`.

**Step 2: Increase zoom range**

Change from current (likely [1, 20]) to:

```typescript
const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.5, 48]) // 0.5x = 48 hours visible, 48x = 30 min visible
  .translateExtent([
    [0, 0],
    [width, height]
  ])
  .extent([
    [MARGIN.left, 0],
    [width - MARGIN.right, height]
  ])
  .on('zoom', zoomed);
```

**Step 3: Add zoom indicator to toolbar**

Find the toolbar/controls area and add zoom level display:

```typescript
// Calculate visible time range
const visibleHours = 24 / zoomTransform.k;
const zoomLabel = visibleHours >= 1
  ? `${Math.round(visibleHours)}h visible`
  : `${Math.round(visibleHours * 60)}m visible`;
```

**Step 4: Build and test**

Run: `cd frontend && npm run build`
Test: Can zoom to show 30 min or 24+ hours

**Step 5: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(drops): extend zoom range (30min - 48hours visible)

Allows viewing from granular 30-minute windows to full 48-hour
overview. Adds zoom level indicator showing visible time range.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.6: Remove Clusters Column

**Files:**
- Delete: `frontend/src/components/timeline/ClusterColumn.tsx`
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`
- Modify: `frontend/src/types/timeline.ts`
- Modify: `internal/service/timeline_grid.go`

**Step 1: Remove ClusterColumn import and usage from TimelineGridView**

Find and remove:
- Import statement for ClusterColumn
- The `<ClusterColumn ... />` component usage
- Any props related to clusters

**Step 2: Delete the ClusterColumn file**

```bash
rm frontend/src/components/timeline/ClusterColumn.tsx
```

**Step 3: Remove ActivityCluster type from timeline.ts**

Remove:
```typescript
export interface ActivityCluster {
  // ... entire interface
}
```

And remove from TimelineGridData:
```typescript
activityClusters: Record<number, ActivityCluster[]>; // Remove this line
```

**Step 4: Remove from backend TimelineGridData**

In `internal/service/timeline_grid.go`, remove:
- `ActivityClusters` field from struct
- Any cluster-related logic

**Step 5: Verify builds**

Run: `go build -o /dev/null . && cd frontend && npm run build`
Expected: Success

**Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(timeline): remove unused Clusters column

ActivityClusters was never fully implemented and added visual noise.
Removes ClusterColumn component, types, and backend support.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.7: Rename Entries → Projects

**Files:**
- Rename: `frontend/src/components/timeline/EntriesColumn.tsx` → `ProjectsColumn.tsx`
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`

**Step 1: Rename the file**

```bash
git mv frontend/src/components/timeline/EntriesColumn.tsx frontend/src/components/timeline/ProjectsColumn.tsx
```

**Step 2: Update component name inside the file**

Change `EntriesColumn` to `ProjectsColumn` throughout.

**Step 3: Update import in TimelineGridView**

```typescript
// Old
import { EntriesColumn } from './EntriesColumn';

// New
import { ProjectsColumn } from './ProjectsColumn';
```

**Step 4: Update component usage**

```typescript
// Old
<EntriesColumn ... />

// New
<ProjectsColumn ... />
```

**Step 5: Build and test**

Run: `cd frontend && npm run build`
Expected: Success

**Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(timeline): rename EntriesColumn to ProjectsColumn

Clearer naming that matches the feature's purpose.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.8: Consolidate AFK → Breaks

**Files:**
- Rename: `frontend/src/components/timeline/AFKColumn.tsx` → `BreaksColumn.tsx`
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`

**Step 1: Rename the file**

```bash
git mv frontend/src/components/timeline/AFKColumn.tsx frontend/src/components/timeline/BreaksColumn.tsx
```

**Step 2: Update component name and terminology**

Inside the file:
- Rename `AFKColumn` to `BreaksColumn`
- Update any "AFK" labels to "Break" (user-facing text only)

**Step 3: Update import and usage in TimelineGridView**

```typescript
import { BreaksColumn } from './BreaksColumn';

// In render:
<BreaksColumn ... />
```

**Step 4: Keep backend type names unchanged**

Don't rename `AFKBlock` in types - only user-facing labels.

**Step 5: Build and test**

Run: `cd frontend && npm run build`
Expected: Success

**Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(timeline): rename AFKColumn to BreaksColumn

User-facing terminology now uses "Break" instead of "AFK".
Backend types remain unchanged for compatibility.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: Real Embeddings

### Task 2.1: Add ONNX Runtime Dependency

**Files:**
- Modify: `go.mod`
- Create: `internal/service/onnx_embeddings.go`

**Step 1: Research ONNX Runtime Go bindings**

The recommended library is `github.com/yalue/onnxruntime_go`.

**Step 2: Add dependency**

```bash
go get github.com/yalue/onnxruntime_go
```

**Step 3: Create placeholder service file**

```go
// internal/service/onnx_embeddings.go
package service

import (
	"sync"
)

// ONNXEmbeddingService wraps the ONNX runtime for real embeddings
type ONNXEmbeddingService struct {
	modelPath string
	mu        sync.Mutex
	ready     bool
}

// NewONNXEmbeddingService creates a new ONNX embedding service
func NewONNXEmbeddingService(modelPath string) (*ONNXEmbeddingService, error) {
	return &ONNXEmbeddingService{
		modelPath: modelPath,
		ready:     false,
	}, nil
}
```

**Step 4: Verify Go builds**

Run: `go build -o /dev/null .`
Expected: Success (may need to install ONNX runtime libraries)

**Step 5: Commit**

```bash
git add go.mod go.sum internal/service/onnx_embeddings.go
git commit -m "$(cat <<'EOF'
feat(embeddings): add ONNX runtime dependency

Adds onnxruntime_go for real semantic embeddings.
Placeholder service created, model integration next.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Download and Bundle MiniLM Model

**Files:**
- Create: `assets/models/` directory
- Create: `internal/service/model_loader.go`

**Step 1: Create model directory**

```bash
mkdir -p assets/models
```

**Step 2: Download all-MiniLM-L6-v2 ONNX model**

Download from Hugging Face (quantized version ~22MB):
- URL: `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx`
- Also need tokenizer: `tokenizer.json`

**Step 3: Create model loader**

```go
// internal/service/model_loader.go
package service

import (
	"embed"
	"os"
	"path/filepath"
)

//go:embed ../../assets/models/*
var modelFS embed.FS

// ExtractModel extracts the embedded model to a temp directory
func ExtractModel() (string, error) {
	tmpDir := filepath.Join(os.TempDir(), "traq-models")
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return "", err
	}

	// Extract model file
	modelData, err := modelFS.ReadFile("assets/models/model_quantized.onnx")
	if err != nil {
		return "", err
	}

	modelPath := filepath.Join(tmpDir, "model_quantized.onnx")
	if err := os.WriteFile(modelPath, modelData, 0644); err != nil {
		return "", err
	}

	return modelPath, nil
}
```

**Step 4: Add to .gitignore if model is too large**

```bash
echo "assets/models/*.onnx" >> .gitignore
```

**Step 5: Commit**

```bash
git add internal/service/model_loader.go assets/models/.gitkeep
git commit -m "$(cat <<'EOF'
feat(embeddings): add model loader infrastructure

Creates assets/models directory and loader for extracting
embedded ONNX model at runtime. Model file added separately.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Implement ONNX Tokenizer

**Files:**
- Create: `internal/service/tokenizer.go`

**Step 1: Create tokenizer wrapper**

The all-MiniLM-L6-v2 model uses WordPiece tokenization. We need to implement or wrap it:

```go
// internal/service/tokenizer.go
package service

import (
	"encoding/json"
	"os"
	"strings"
)

// Tokenizer handles text tokenization for the embedding model
type Tokenizer struct {
	vocab    map[string]int32
	invVocab map[int32]string
	maxLen   int
}

// NewTokenizer loads a tokenizer from vocab file
func NewTokenizer(vocabPath string) (*Tokenizer, error) {
	data, err := os.ReadFile(vocabPath)
	if err != nil {
		return nil, err
	}

	var vocabData struct {
		Model struct {
			Vocab map[string]int32 `json:"vocab"`
		} `json:"model"`
	}
	if err := json.Unmarshal(data, &vocabData); err != nil {
		return nil, err
	}

	invVocab := make(map[int32]string, len(vocabData.Model.Vocab))
	for k, v := range vocabData.Model.Vocab {
		invVocab[v] = k
	}

	return &Tokenizer{
		vocab:    vocabData.Model.Vocab,
		invVocab: invVocab,
		maxLen:   256,
	}, nil
}

// Encode tokenizes text into input IDs
func (t *Tokenizer) Encode(text string) []int32 {
	// Simplified WordPiece tokenization
	text = strings.ToLower(text)
	words := strings.Fields(text)

	tokens := []int32{101} // [CLS]
	for _, word := range words {
		if id, ok := t.vocab[word]; ok {
			tokens = append(tokens, id)
		} else {
			// Try subword tokenization
			tokens = append(tokens, t.tokenizeSubword(word)...)
		}
		if len(tokens) >= t.maxLen-1 {
			break
		}
	}
	tokens = append(tokens, 102) // [SEP]

	// Pad to maxLen
	for len(tokens) < t.maxLen {
		tokens = append(tokens, 0) // [PAD]
	}

	return tokens[:t.maxLen]
}

func (t *Tokenizer) tokenizeSubword(word string) []int32 {
	var tokens []int32
	remaining := word

	for len(remaining) > 0 {
		found := false
		for l := len(remaining); l > 0; l-- {
			subword := remaining[:l]
			if len(tokens) > 0 {
				subword = "##" + subword
			}
			if id, ok := t.vocab[subword]; ok {
				tokens = append(tokens, id)
				remaining = remaining[l:]
				found = true
				break
			}
		}
		if !found {
			tokens = append(tokens, t.vocab["[UNK]"])
			break
		}
	}
	return tokens
}
```

**Step 2: Verify Go builds**

Run: `go build -o /dev/null .`
Expected: Success

**Step 3: Commit**

```bash
git add internal/service/tokenizer.go
git commit -m "$(cat <<'EOF'
feat(embeddings): implement WordPiece tokenizer

Tokenizer for all-MiniLM-L6-v2 model with:
- Vocab loading from tokenizer.json
- WordPiece subword tokenization
- [CLS]/[SEP] special tokens
- Padding to maxLen

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.4: Implement ONNX Inference

**Files:**
- Modify: `internal/service/onnx_embeddings.go`

**Step 1: Complete the ONNX service implementation**

```go
// internal/service/onnx_embeddings.go
package service

import (
	"fmt"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
)

// ONNXEmbeddingService wraps the ONNX runtime for real embeddings
type ONNXEmbeddingService struct {
	session   *ort.AdvancedSession
	tokenizer *Tokenizer
	mu        sync.Mutex
	ready     bool
}

// NewONNXEmbeddingService creates a new ONNX embedding service
func NewONNXEmbeddingService(modelPath, tokenizerPath string) (*ONNXEmbeddingService, error) {
	// Initialize ONNX runtime
	if err := ort.InitializeEnvironment(); err != nil {
		return nil, fmt.Errorf("failed to init ONNX: %w", err)
	}

	// Load tokenizer
	tokenizer, err := NewTokenizer(tokenizerPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load tokenizer: %w", err)
	}

	// Create session options
	opts, err := ort.NewSessionOptions()
	if err != nil {
		return nil, err
	}
	defer opts.Destroy()

	// Define input/output shapes
	inputShape := ort.NewShape(1, 256) // batch_size=1, seq_len=256
	outputShape := ort.NewShape(1, 384) // batch_size=1, embedding_dim=384

	// Create session
	session, err := ort.NewAdvancedSession(
		modelPath,
		[]string{"input_ids", "attention_mask", "token_type_ids"},
		[]string{"sentence_embedding"},
		[]ort.ArbitraryTensor{
			ort.NewTensor(inputShape, make([]int64, 256)),
			ort.NewTensor(inputShape, make([]int64, 256)),
			ort.NewTensor(inputShape, make([]int64, 256)),
		},
		[]ort.ArbitraryTensor{
			ort.NewTensor(outputShape, make([]float32, 384)),
		},
		opts,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return &ONNXEmbeddingService{
		session:   session,
		tokenizer: tokenizer,
		ready:     true,
	}, nil
}

// GenerateEmbedding creates a 384-dim embedding for text
func (s *ONNXEmbeddingService) GenerateEmbedding(text string) ([]float32, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.ready {
		return nil, fmt.Errorf("ONNX service not ready")
	}

	// Tokenize
	inputIDs := s.tokenizer.Encode(text)
	attentionMask := make([]int64, len(inputIDs))
	tokenTypeIDs := make([]int64, len(inputIDs))

	inputIDs64 := make([]int64, len(inputIDs))
	for i, id := range inputIDs {
		inputIDs64[i] = int64(id)
		if id != 0 {
			attentionMask[i] = 1
		}
	}

	// Run inference
	outputs, err := s.session.Run([]ort.ArbitraryTensor{
		ort.NewTensor(ort.NewShape(1, 256), inputIDs64),
		ort.NewTensor(ort.NewShape(1, 256), attentionMask),
		ort.NewTensor(ort.NewShape(1, 256), tokenTypeIDs),
	})
	if err != nil {
		return nil, err
	}

	// Extract embedding
	embedding := outputs[0].GetData().([]float32)
	return embedding, nil
}

// Close releases ONNX resources
func (s *ONNXEmbeddingService) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.session != nil {
		s.session.Destroy()
	}
	ort.DestroyEnvironment()
	s.ready = false
}
```

**Step 2: Verify Go builds**

Run: `go build -o /dev/null .`
Expected: Success (with ONNX runtime installed)

**Step 3: Commit**

```bash
git add internal/service/onnx_embeddings.go
git commit -m "$(cat <<'EOF'
feat(embeddings): implement ONNX inference for MiniLM

Complete ONNX embedding service:
- Session management with mutex for thread safety
- Tokenization integration
- 384-dim output extraction
- Resource cleanup

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.5: Migrate EmbeddingService to Use ONNX

**Files:**
- Modify: `internal/service/embeddings.go`

**Step 1: Add ONNX service as optional backend**

```go
// In EmbeddingService struct
type EmbeddingService struct {
	store *storage.Store
	onnx  *ONNXEmbeddingService // Real embeddings if available

	vectors   []LabeledVector
	vectorsMu sync.RWMutex
}

// NewEmbeddingService creates a new embedding service
func NewEmbeddingService(store *storage.Store, onnx *ONNXEmbeddingService) *EmbeddingService {
	return &EmbeddingService{
		store:   store,
		onnx:    onnx,
		vectors: make([]LabeledVector, 0),
	}
}
```

**Step 2: Update GenerateEmbedding to prefer ONNX**

```go
// GenerateEmbedding creates an embedding for the given context
func (s *EmbeddingService) GenerateEmbedding(ctx *EmbeddingContext) []float32 {
	text := BuildContextText(ctx)

	// Use ONNX if available
	if s.onnx != nil {
		embedding, err := s.onnx.GenerateEmbedding(text)
		if err == nil {
			return embedding
		}
		// Fall through to pseudo-embedding on error
	}

	// Fallback to pseudo-embeddings
	return generatePseudoEmbedding(text, 384)
}
```

**Step 3: Update callers in app.go**

Find where EmbeddingService is created and pass onnx service.

**Step 4: Build and test**

Run: `go build -o /dev/null .`
Expected: Success

**Step 5: Commit**

```bash
git add internal/service/embeddings.go
git commit -m "$(cat <<'EOF'
feat(embeddings): migrate to ONNX with pseudo fallback

EmbeddingService now prefers ONNX for real semantic embeddings,
falling back to hash-based pseudo-embeddings if ONNX unavailable.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.6: Add Embedding Backfill Migration

**Files:**
- Create: `internal/service/embedding_backfill.go`
- Modify: `internal/storage/migrations.go`

**Step 1: Create backfill service**

```go
// internal/service/embedding_backfill.go
package service

import (
	"context"
	"log"
	"time"

	"traq/internal/storage"
)

// BackfillEmbeddings regenerates embeddings for historical data
func (s *EmbeddingService) BackfillEmbeddings(ctx context.Context, since time.Time) error {
	log.Printf("Starting embedding backfill from %s", since.Format("2006-01-02"))

	// Get activities without embeddings (or with old pseudo-embeddings)
	activities, err := s.store.GetActivitiesWithoutEmbeddings(since)
	if err != nil {
		return err
	}

	batchSize := 100
	for i := 0; i < len(activities); i += batchSize {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		end := i + batchSize
		if end > len(activities) {
			end = len(activities)
		}

		batch := activities[i:end]
		for _, act := range batch {
			embCtx := &EmbeddingContext{
				AppName:     act.AppName,
				WindowTitle: act.WindowTitle,
			}
			embedding := s.GenerateEmbedding(embCtx)

			if err := s.store.SaveEmbedding(storage.Embedding{
				EventType:   "activity",
				EventID:     act.ID,
				Embedding:   FloatsToBytes(embedding),
				ContextText: BuildContextText(embCtx),
			}); err != nil {
				log.Printf("Failed to save embedding for activity %d: %v", act.ID, err)
			}
		}

		log.Printf("Backfilled %d/%d activities", end, len(activities))
	}

	return nil
}
```

**Step 2: Add storage method for getting activities without embeddings**

```go
// In storage, add GetActivitiesWithoutEmbeddings
func (s *Store) GetActivitiesWithoutEmbeddings(since time.Time) ([]ActivityRecord, error) {
	query := `
		SELECT a.id, a.app_name, a.window_title
		FROM screenshots a
		LEFT JOIN embeddings e ON e.event_type = 'activity' AND e.event_id = a.id
		WHERE a.captured_at >= ? AND e.id IS NULL
		ORDER BY a.captured_at
	`
	// ... implementation
}
```

**Step 3: Verify Go builds**

Run: `go build -o /dev/null .`

**Step 4: Commit**

```bash
git add internal/service/embedding_backfill.go
git commit -m "$(cat <<'EOF'
feat(embeddings): add backfill for historical data

BackfillEmbeddings regenerates embeddings for activities
missing real embeddings. Processes in batches with context
cancellation support.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: List View & Split Panel

### Task 3.1: Create Split Panel Component

**Files:**
- Create: `frontend/src/components/common/SplitPanel.tsx`

**Step 1: Create the split panel component**

```typescript
// frontend/src/components/common/SplitPanel.tsx
import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SplitPanelProps {
  left: ReactNode;
  right: ReactNode;
  direction?: 'horizontal' | 'vertical';
  defaultSize?: number; // 0-100 percentage for left/top panel
  minSize?: number; // minimum percentage
  maxSize?: number; // maximum percentage
  storageKey?: string; // localStorage key for persistence
  className?: string;
}

export function SplitPanel({
  left,
  right,
  direction = 'horizontal',
  defaultSize = 60,
  minSize = 0,
  maxSize = 100,
  storageKey,
  className,
}: SplitPanelProps) {
  const [size, setSize] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) return parseFloat(saved);
    }
    return defaultSize;
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    let newSize: number;

    if (direction === 'horizontal') {
      newSize = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      newSize = ((e.clientY - rect.top) / rect.height) * 100;
    }

    newSize = Math.max(minSize, Math.min(maxSize, newSize));
    setSize(newSize);

    if (storageKey) {
      localStorage.setItem(storageKey, newSize.toString());
    }
  }, [direction, minSize, maxSize, storageKey]);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full w-full',
        isHorizontal ? 'flex-row' : 'flex-col',
        className
      )}
    >
      <div
        style={{ [isHorizontal ? 'width' : 'height']: `${size}%` }}
        className="overflow-auto"
      >
        {left}
      </div>

      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'flex-shrink-0 bg-border hover:bg-primary/20 transition-colors',
          isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
        )}
      />

      <div
        style={{ [isHorizontal ? 'width' : 'height']: `${100 - size}%` }}
        className="overflow-auto"
      >
        {right}
      </div>
    </div>
  );
}
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`
Expected: Success

**Step 3: Commit**

```bash
git add frontend/src/components/common/SplitPanel.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add SplitPanel component

Resizable split panel with:
- Horizontal/vertical direction
- 0-100% resize range
- localStorage persistence
- Mouse drag handling

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.2: Create List View Component - Types

**Files:**
- Modify: `frontend/src/types/timeline.ts`

**Step 1: Add ListView types**

```typescript
// At the end of timeline.ts

// List View Types
export interface TimelineListItem {
  id: string; // Unique: `${type}-${originalId}`
  type: TimelineEventType;
  timestamp: number;
  endTime?: number;
  duration?: number;
  appName?: string;
  title: string;
  subtitle?: string;
  project?: {
    id: number;
    name: string;
    color: string;
  };
  summary?: string;
  category?: CategoryType;
}

export interface ListViewSort {
  column: 'time' | 'duration' | 'app' | 'title' | 'project';
  direction: 'asc' | 'desc';
}

export interface ListViewFilter {
  search?: string;
  apps?: string[];
  projects?: number[];
  types?: TimelineEventType[];
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add frontend/src/types/timeline.ts
git commit -m "$(cat <<'EOF'
feat(timeline): add ListView types

Types for list view items, sorting, and filtering.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.3: Create List View Component - Data Hook

**Files:**
- Create: `frontend/src/components/timeline/useListViewData.ts`

**Step 1: Create the data transformation hook**

```typescript
// frontend/src/components/timeline/useListViewData.ts
import { useMemo } from 'react';
import {
  TimelineGridData,
  TimelineListItem,
  ListViewSort,
  ListViewFilter,
  TimelineEventType,
} from '@/types/timeline';

export function useListViewData(
  data: TimelineGridData | undefined,
  sort: ListViewSort,
  filter: ListViewFilter
): TimelineListItem[] {
  return useMemo(() => {
    if (!data) return [];

    const items: TimelineListItem[] = [];

    // Convert activities
    Object.entries(data.hourlyGrid).forEach(([hour, apps]) => {
      Object.entries(apps).forEach(([appName, blocks]) => {
        blocks.forEach((block) => {
          items.push({
            id: `activity-${block.id}`,
            type: 'activity',
            timestamp: block.startTime,
            endTime: block.endTime,
            duration: block.durationSeconds,
            appName: block.appName,
            title: block.windowTitle || block.appName,
            subtitle: block.windowTitle ? block.appName : undefined,
            project: block.projectId ? {
              id: block.projectId,
              name: '', // Would need project name lookup
              color: block.projectColor || '',
            } : undefined,
            category: block.category as any,
          });
        });
      });
    });

    // Convert git events
    Object.values(data.gitEvents).flat().forEach((evt) => {
      items.push({
        id: `git-${evt.id}`,
        type: 'git',
        timestamp: evt.timestamp,
        title: evt.messageSubject,
        subtitle: `${evt.repository} @ ${evt.branch}`,
        appName: 'Git',
      });
    });

    // Convert shell events
    Object.values(data.shellEvents).flat().forEach((evt) => {
      items.push({
        id: `shell-${evt.id}`,
        type: 'shell',
        timestamp: evt.timestamp,
        duration: evt.durationSeconds,
        title: evt.command,
        subtitle: evt.workingDirectory,
        appName: 'Terminal',
      });
    });

    // Apply filters
    let filtered = items;

    if (filter.search) {
      const search = filter.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(search) ||
        item.subtitle?.toLowerCase().includes(search)
      );
    }

    if (filter.apps?.length) {
      filtered = filtered.filter(item =>
        item.appName && filter.apps!.includes(item.appName)
      );
    }

    if (filter.types?.length) {
      filtered = filtered.filter(item => filter.types!.includes(item.type));
    }

    // Apply sort
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sort.column) {
        case 'time':
          cmp = a.timestamp - b.timestamp;
          break;
        case 'duration':
          cmp = (a.duration || 0) - (b.duration || 0);
          break;
        case 'app':
          cmp = (a.appName || '').localeCompare(b.appName || '');
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'project':
          cmp = (a.project?.name || '').localeCompare(b.project?.name || '');
          break;
      }
      return sort.direction === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [data, sort, filter]);
}
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/useListViewData.ts
git commit -m "$(cat <<'EOF'
feat(timeline): add useListViewData hook

Transforms TimelineGridData into flat list with:
- Activities, git, shell events
- Search and filter support
- Sortable by time, duration, app, title, project

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.4: Create List View Component - UI

**Files:**
- Create: `frontend/src/components/timeline/TimelineListView.tsx`

**Step 1: Create the list view component**

```typescript
// frontend/src/components/timeline/TimelineListView.tsx
import { useState, useCallback } from 'react';
import {
  TimelineGridData,
  TimelineListItem,
  ListViewSort,
  ListViewFilter,
} from '@/types/timeline';
import { useListViewData } from './useListViewData';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

interface TimelineListViewProps {
  data?: TimelineGridData;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onItemClick?: (item: TimelineListItem) => void;
  onItemDoubleClick?: (item: TimelineListItem) => void;
}

export function TimelineListView({
  data,
  selectedIds,
  onSelectionChange,
  onItemClick,
  onItemDoubleClick,
}: TimelineListViewProps) {
  const [sort, setSort] = useState<ListViewSort>({ column: 'time', direction: 'asc' });
  const [filter, setFilter] = useState<ListViewFilter>({});

  const items = useListViewData(data, sort, filter);

  const toggleSort = (column: ListViewSort['column']) => {
    setSort(prev => ({
      column,
      direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const toggleSelection = useCallback((id: string, shiftKey: boolean) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  const selectAll = () => {
    onSelectionChange(new Set(items.map(i => i.id)));
  };

  const selectNone = () => {
    onSelectionChange(new Set());
  };

  const SortIcon = ({ column }: { column: ListViewSort['column'] }) => {
    if (sort.column !== column) return null;
    return sort.direction === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={filter.search || ''}
            onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            className="pl-8 h-8"
          />
        </div>
        <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground">
          Select all
        </button>
        <button onClick={selectNone} className="text-xs text-muted-foreground hover:text-foreground">
          Clear
        </button>
        <span className="text-xs text-muted-foreground">
          {selectedIds.size} selected / {items.length} items
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center border-b bg-muted/50 text-xs font-medium">
        <div className="w-10 p-2" />
        <button onClick={() => toggleSort('time')} className="flex items-center gap-1 w-20 p-2 hover:bg-muted">
          Time <SortIcon column="time" />
        </button>
        <button onClick={() => toggleSort('duration')} className="flex items-center gap-1 w-16 p-2 hover:bg-muted">
          Duration <SortIcon column="duration" />
        </button>
        <button onClick={() => toggleSort('app')} className="flex items-center gap-1 w-24 p-2 hover:bg-muted">
          App <SortIcon column="app" />
        </button>
        <button onClick={() => toggleSort('title')} className="flex items-center gap-1 flex-1 p-2 hover:bg-muted">
          Title <SortIcon column="title" />
        </button>
        <button onClick={() => toggleSort('project')} className="flex items-center gap-1 w-32 p-2 hover:bg-muted">
          Project <SortIcon column="project" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={(e) => {
              toggleSelection(item.id, e.shiftKey);
              onItemClick?.(item);
            }}
            onDoubleClick={() => onItemDoubleClick?.(item)}
            className={cn(
              'flex items-center border-b text-sm cursor-pointer',
              selectedIds.has(item.id)
                ? 'bg-primary/10 ring-1 ring-inset ring-primary/30'
                : 'hover:bg-muted/50'
            )}
          >
            <div className="w-10 p-2">
              <Checkbox
                checked={selectedIds.has(item.id)}
                onCheckedChange={() => toggleSelection(item.id, false)}
              />
            </div>
            <div className="w-20 p-2 text-muted-foreground">
              {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="w-16 p-2 text-muted-foreground">
              {item.duration ? formatDuration(item.duration) : '-'}
            </div>
            <div className="w-24 p-2 truncate">{item.appName}</div>
            <div className="flex-1 p-2 truncate">
              <span>{item.title}</span>
              {item.subtitle && (
                <span className="ml-2 text-muted-foreground text-xs">{item.subtitle}</span>
              )}
            </div>
            <div className="w-32 p-2">
              {item.project && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                  style={{ backgroundColor: item.project.color + '20', color: item.project.color }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.project.color }} />
                  {item.project.name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/TimelineListView.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): add TimelineListView component

Table-based list view with:
- Sortable columns (time, duration, app, title, project)
- Checkbox selection
- Search filter
- Select all/none
- Double-click for edit

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3.5: Integrate Split Panel into Timeline Page

**Files:**
- Modify: `frontend/src/pages/TimelinePage.tsx`

**Step 1: Import new components**

```typescript
import { SplitPanel } from '@/components/common/SplitPanel';
import { TimelineListView } from '@/components/timeline/TimelineListView';
```

**Step 2: Add state for view mode and list selection**

```typescript
const [viewMode, setViewMode] = useState<'grid' | 'drops'>('grid');
const [showList, setShowList] = useState(true);
const [listSelectedIds, setListSelectedIds] = useState<Set<string>>(new Set());
```

**Step 3: Wrap existing view in SplitPanel**

```typescript
<SplitPanel
  direction="horizontal"
  defaultSize={70}
  minSize={30}
  maxSize={100}
  storageKey="timeline-split-size"
  left={
    viewMode === 'grid' ? (
      <TimelineGridView data={gridData} ... />
    ) : (
      <EventDropsTimeline data={gridData} ... />
    )
  }
  right={
    showList ? (
      <TimelineListView
        data={gridData}
        selectedIds={listSelectedIds}
        onSelectionChange={setListSelectedIds}
        onItemClick={handleItemClick}
        onItemDoubleClick={handleItemEdit}
      />
    ) : null
  }
/>
```

**Step 4: Add toggle button in header**

```typescript
<button
  onClick={() => setShowList(!showList)}
  className="p-1 rounded hover:bg-muted"
  title={showList ? "Hide list" : "Show list"}
>
  {showList ? <PanelRightClose /> : <PanelRight />}
</button>
```

**Step 5: Build and test**

Run: `cd frontend && npm run build`

**Step 6: Commit**

```bash
git add frontend/src/pages/TimelinePage.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): integrate split panel with list view

Timeline page now shows:
- Grid or Drops view in left panel
- List view in right panel (collapsible)
- Resizable split with localStorage persistence

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4: Unified Selection & Cross-View Linking

### Task 4.1: Create Unified Selection Context

**Files:**
- Create: `frontend/src/components/timeline/SelectionContext.tsx`

**Step 1: Create the selection context**

```typescript
// frontend/src/components/timeline/SelectionContext.tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type EventKey = string; // Format: "${type}:${id}"

interface SelectionState {
  selectedKeys: Set<EventKey>;
  hoveredKey: EventKey | null;
}

interface SelectionContextValue extends SelectionState {
  select: (key: EventKey) => void;
  toggle: (key: EventKey) => void;
  selectRange: (keys: EventKey[]) => void;
  selectMany: (keys: EventKey[]) => void;
  deselect: (key: EventKey) => void;
  clear: () => void;
  isSelected: (key: EventKey) => boolean;
  setHovered: (key: EventKey | null) => void;
  scrollToKey: (key: EventKey) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

interface SelectionProviderProps {
  children: ReactNode;
  onScrollTo?: (key: EventKey) => void;
}

export function SelectionProvider({ children, onScrollTo }: SelectionProviderProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<EventKey>>(new Set());
  const [hoveredKey, setHoveredKey] = useState<EventKey | null>(null);

  const select = useCallback((key: EventKey) => {
    setSelectedKeys(new Set([key]));
  }, []);

  const toggle = useCallback((key: EventKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectMany = useCallback((keys: EventKey[]) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.add(k));
      return next;
    });
  }, []);

  const selectRange = useCallback((keys: EventKey[]) => {
    setSelectedKeys(new Set(keys));
  }, []);

  const deselect = useCallback((key: EventKey) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const isSelected = useCallback((key: EventKey) => {
    return selectedKeys.has(key);
  }, [selectedKeys]);

  const setHovered = useCallback((key: EventKey | null) => {
    setHoveredKey(key);
  }, []);

  const scrollToKey = useCallback((key: EventKey) => {
    onScrollTo?.(key);
  }, [onScrollTo]);

  return (
    <SelectionContext.Provider value={{
      selectedKeys,
      hoveredKey,
      select,
      toggle,
      selectRange,
      selectMany,
      deselect,
      clear,
      isSelected,
      setHovered,
      scrollToKey,
    }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error('useSelection must be used within SelectionProvider');
  return ctx;
}
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/SelectionContext.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): add unified SelectionContext

View-agnostic selection state with:
- select, toggle, selectMany, selectRange
- Hover state tracking
- scrollToKey for cross-view linking
- EventKey format: "type:id"

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.2: Wire Grid View to Selection Context

**Files:**
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`

**Step 1: Import and use selection context**

```typescript
import { useSelection } from './SelectionContext';

export function TimelineGridView({ ... }) {
  const { selectedKeys, hoveredKey, toggle, setHovered, isSelected } = useSelection();

  // Replace local selection state with context
```

**Step 2: Update activity blocks to use context**

In the activity block rendering, use context for selection state:

```typescript
const isBlockSelected = isSelected(`activity:${block.id}`);
const isBlockHovered = hoveredKey === `activity:${block.id}`;

<div
  className={cn(
    'activity-block',
    isBlockSelected && 'ring-2 ring-primary',
    isBlockHovered && 'ring-1 ring-primary/50'
  )}
  onClick={() => toggle(`activity:${block.id}`)}
  onMouseEnter={() => setHovered(`activity:${block.id}`)}
  onMouseLeave={() => setHovered(null)}
>
```

**Step 3: Build and test**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/TimelineGridView.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): wire GridView to SelectionContext

Grid view now reads/writes selection from unified context.
Enables cross-view selection synchronization.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.3: Wire List View to Selection Context

**Files:**
- Modify: `frontend/src/components/timeline/TimelineListView.tsx`

**Step 1: Use selection context instead of props**

```typescript
import { useSelection } from './SelectionContext';

export function TimelineListView({ data, onItemClick, onItemDoubleClick }: Props) {
  const { selectedKeys, toggle, selectMany, clear, isSelected, setHovered } = useSelection();
```

**Step 2: Update list items to use context**

```typescript
<div
  key={item.id}
  onClick={(e) => {
    if (e.ctrlKey || e.metaKey) {
      toggle(item.id);
    } else {
      // Single select
      clear();
      toggle(item.id);
    }
    onItemClick?.(item);
  }}
  onMouseEnter={() => setHovered(item.id)}
  onMouseLeave={() => setHovered(null)}
  className={cn(
    isSelected(item.id) && 'bg-primary/10 ring-1 ring-primary/30'
  )}
>
```

**Step 3: Build and test**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/TimelineListView.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): wire ListView to SelectionContext

List view now shares selection with grid/drops views.
Ctrl+click for multi-select, click for single select.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.4: Wire Drops View to Selection Context

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx`

**Step 1: Use selection context**

```typescript
import { useSelection } from '../SelectionContext';

export function EventDropsTimeline({ ... }) {
  const { selectedKeys, toggle, isSelected, setHovered } = useSelection();
```

**Step 2: Update dot/bar rendering for selection**

In the D3 rendering, add selection visual state:

```typescript
dotsGroup.selectAll('.event-dot')
  .data(dotEvents, (d) => (d as EventDot).id)
  .join('circle')
  // ... existing attributes
  .attr('stroke-width', (d) => isSelected(d.id) ? 3 : 1.5)
  .attr('filter', (d) => isSelected(d.id) ? 'url(#glow)' : null)
```

**Step 3: Add glow filter for selection**

```typescript
// Add to SVG defs
<defs>
  <filter id="glow">
    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
```

**Step 4: Build and test**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): wire DropsView to SelectionContext

Drops view now shows selection state with glow effect.
Selection synced with grid and list views.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4.5: Add Cross-View Scroll-To

**Files:**
- Modify: `frontend/src/pages/TimelinePage.tsx`

**Step 1: Add refs for each view**

```typescript
const gridRef = useRef<{ scrollTo: (key: string) => void }>(null);
const dropsRef = useRef<{ scrollTo: (key: string) => void }>(null);
const listRef = useRef<{ scrollTo: (key: string) => void }>(null);
```

**Step 2: Implement scroll handler**

```typescript
const handleScrollTo = useCallback((key: EventKey) => {
  // Scroll all views to the selected item
  gridRef.current?.scrollTo(key);
  dropsRef.current?.scrollTo(key);
  listRef.current?.scrollTo(key);
}, []);
```

**Step 3: Wrap page in SelectionProvider**

```typescript
<SelectionProvider onScrollTo={handleScrollTo}>
  <SplitPanel ... />
</SelectionProvider>
```

**Step 4: Implement scrollTo in each view component**

For GridView:
```typescript
useImperativeHandle(ref, () => ({
  scrollTo: (key: string) => {
    const element = document.querySelector(`[data-event-key="${key}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}));
```

**Step 5: Build and test**

Run: `cd frontend && npm run build`

**Step 6: Commit**

```bash
git add frontend/src/pages/TimelinePage.tsx frontend/src/components/timeline/TimelineGridView.tsx frontend/src/components/timeline/TimelineListView.tsx frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): add cross-view scroll-to synchronization

When an item is selected in one view, all views scroll to
show it. Uses smooth scrolling with center alignment.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: Multi-Select & Bulk Operations

### Task 5.1: Create Bulk Actions Toolbar

**Files:**
- Create: `frontend/src/components/timeline/BulkActionsToolbar.tsx`

**Step 1: Create the toolbar component**

```typescript
// frontend/src/components/timeline/BulkActionsToolbar.tsx
import { useSelection } from './SelectionContext';
import { Button } from '@/components/ui/button';
import {
  FolderPlus,
  Merge,
  Trash2,
  Check,
  X,
} from 'lucide-react';

interface BulkActionsToolbarProps {
  onAssignProject: (keys: string[]) => void;
  onMerge: (keys: string[]) => void;
  onDelete: (keys: string[]) => void;
  onAcceptDrafts: (keys: string[]) => void;
}

export function BulkActionsToolbar({
  onAssignProject,
  onMerge,
  onDelete,
  onAcceptDrafts,
}: BulkActionsToolbarProps) {
  const { selectedKeys, clear } = useSelection();

  if (selectedKeys.size === 0) return null;

  const keys = Array.from(selectedKeys);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-2 px-4 py-2 bg-background border rounded-lg shadow-lg">
        <span className="text-sm text-muted-foreground mr-2">
          {selectedKeys.size} selected
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onAssignProject(keys)}
        >
          <FolderPlus className="h-4 w-4 mr-1" />
          Assign Project
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onMerge(keys)}
          disabled={selectedKeys.size < 2}
        >
          <Merge className="h-4 w-4 mr-1" />
          Merge
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onAcceptDrafts(keys)}
        >
          <Check className="h-4 w-4 mr-1" />
          Accept Drafts
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(keys)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={clear}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/BulkActionsToolbar.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): add BulkActionsToolbar component

Floating toolbar with bulk actions:
- Assign to project
- Merge selected
- Accept drafts
- Delete
- Clear selection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.2: Add Bulk Assignment API

**Files:**
- Modify: `app.go`
- Modify: `internal/service/project_assignment.go`

**Step 1: Add bulk assignment method to service**

```go
// BulkAssignProject assigns multiple activities to a project
func (s *ProjectAssignmentService) BulkAssignProject(
	activityIDs []int64,
	projectID int64,
	source string,
) error {
	for _, id := range activityIDs {
		if err := s.store.UpdateActivityProject(id, projectID, source, 1.0); err != nil {
			return fmt.Errorf("failed to assign activity %d: %w", id, err)
		}
	}
	return nil
}
```

**Step 2: Add Wails binding in app.go**

```go
func (a *App) BulkAssignActivitiesToProject(activityIDs []int64, projectID int64) error {
	return a.projectAssignmentService.BulkAssignProject(activityIDs, projectID, "user")
}
```

**Step 3: Build backend**

Run: `go build -o /dev/null .`

**Step 4: Regenerate Wails bindings**

Run: `wails generate bindings`

**Step 5: Commit**

```bash
git add app.go internal/service/project_assignment.go
git commit -m "$(cat <<'EOF'
feat(api): add BulkAssignActivitiesToProject endpoint

Allows assigning multiple activities to a project in one call.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.3: Add Project Selection Dialog

**Files:**
- Create: `frontend/src/components/timeline/ProjectAssignDialog.tsx`

**Step 1: Create the dialog component**

```typescript
// frontend/src/components/timeline/ProjectAssignDialog.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProjects, useAssignProjectMutation } from '@/api/hooks';

interface ProjectAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityIds: number[];
  onComplete: () => void;
}

export function ProjectAssignDialog({
  open,
  onOpenChange,
  activityIds,
  onComplete,
}: ProjectAssignDialogProps) {
  const { data: projects } = useProjects();
  const assignMutation = useAssignProjectMutation();
  const [selectedProject, setSelectedProject] = useState<number | null>(null);

  const handleAssign = async () => {
    if (!selectedProject) return;

    await assignMutation.mutateAsync({
      activityIds,
      projectId: selectedProject,
    });

    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign to Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 my-4">
          {projects?.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelectedProject(project.id)}
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded border',
                selectedProject === project.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
              )}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span>{project.name}</span>
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedProject || assignMutation.isPending}
          >
            Assign {activityIds.length} items
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/ProjectAssignDialog.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): add ProjectAssignDialog for bulk assignment

Modal dialog for selecting a project to assign selected
activities to. Shows project colors for visual identification.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5.4: Integrate Bulk Actions into Timeline Page

**Files:**
- Modify: `frontend/src/pages/TimelinePage.tsx`

**Step 1: Import components**

```typescript
import { BulkActionsToolbar } from '@/components/timeline/BulkActionsToolbar';
import { ProjectAssignDialog } from '@/components/timeline/ProjectAssignDialog';
```

**Step 2: Add state and handlers**

```typescript
const [showAssignDialog, setShowAssignDialog] = useState(false);
const [activityIdsToAssign, setActivityIdsToAssign] = useState<number[]>([]);

const handleAssignProject = (keys: string[]) => {
  const activityIds = keys
    .filter(k => k.startsWith('activity:'))
    .map(k => parseInt(k.split(':')[1]));
  setActivityIdsToAssign(activityIds);
  setShowAssignDialog(true);
};

const handleMerge = (keys: string[]) => {
  // TODO: Implement merge
  console.log('Merge:', keys);
};

const handleDelete = (keys: string[]) => {
  // TODO: Implement delete with confirmation
  console.log('Delete:', keys);
};

const handleAcceptDrafts = (keys: string[]) => {
  // TODO: Implement draft acceptance
  console.log('Accept drafts:', keys);
};
```

**Step 3: Add components to render**

```typescript
<BulkActionsToolbar
  onAssignProject={handleAssignProject}
  onMerge={handleMerge}
  onDelete={handleDelete}
  onAcceptDrafts={handleAcceptDrafts}
/>

<ProjectAssignDialog
  open={showAssignDialog}
  onOpenChange={setShowAssignDialog}
  activityIds={activityIdsToAssign}
  onComplete={() => {
    // Refresh data
    queryClient.invalidateQueries(['timeline']);
  }}
/>
```

**Step 4: Build and test**

Run: `cd frontend && npm run build`

**Step 5: Commit**

```bash
git add frontend/src/pages/TimelinePage.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): integrate bulk actions toolbar

Timeline page now shows bulk actions when items selected:
- Assign to project with dialog
- Merge, delete, accept drafts (handlers stubbed)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Display Options & Column Config

### Task 6.1: Add Title Display Config

**Files:**
- Modify: `internal/service/config.go`
- Modify: `frontend/src/types/config.ts`

**Step 1: Add backend config field**

```go
type TimelineConfig struct {
	MinActivityDurationSeconds int    `json:"minActivityDurationSeconds"`
	TitleDisplay               string `json:"titleDisplay"` // "full", "app_only", "minimal"
	AppGrouping                bool   `json:"appGrouping"`
	ContinuityMergeSeconds     int    `json:"continuityMergeSeconds"` // 0, 30, 60, 120
}
```

**Step 2: Add defaults**

```go
func (s *ConfigService) getDefaultTimelineConfig() *TimelineConfig {
	return &TimelineConfig{
		MinActivityDurationSeconds: 0,
		TitleDisplay:               "full",
		AppGrouping:                false,
		ContinuityMergeSeconds:     0,
	}
}
```

**Step 3: Add frontend type**

```typescript
export interface TimelineConfig {
  minActivityDurationSeconds: number;
  titleDisplay: 'full' | 'app_only' | 'minimal';
  appGrouping: boolean;
  continuityMergeSeconds: number;
}
```

**Step 4: Build both**

Run: `go build -o /dev/null . && cd frontend && npm run build`

**Step 5: Commit**

```bash
git add internal/service/config.go frontend/src/types/config.ts
git commit -m "$(cat <<'EOF'
feat(config): add timeline display options

New config fields:
- titleDisplay: full/app_only/minimal
- appGrouping: merge consecutive same-app activities
- continuityMergeSeconds: merge across brief switches

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.2: Add Display Options UI

**Files:**
- Modify: `frontend/src/components/settings/sections/GeneralSettings.tsx`

**Step 1: Add UI controls**

```typescript
<SettingsRow
  label="Activity Detail Level"
  description="How much information to show in activity blocks"
>
  <Select
    value={config.timeline?.titleDisplay || 'full'}
    onValueChange={(value) =>
      updateConfig.mutate({
        timeline: { ...config.timeline, titleDisplay: value },
      })
    }
  >
    <SelectTrigger className="w-36">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="full">Full Detail</SelectItem>
      <SelectItem value="app_only">App Only</SelectItem>
      <SelectItem value="minimal">Minimal</SelectItem>
    </SelectContent>
  </Select>
</SettingsRow>

<SettingsRow
  label="App Grouping"
  description="Merge consecutive activities from the same app"
>
  <Switch
    checked={config.timeline?.appGrouping || false}
    onCheckedChange={(checked) =>
      updateConfig.mutate({
        timeline: { ...config.timeline, appGrouping: checked },
      })
    }
  />
</SettingsRow>

<SettingsRow
  label="Continuity Threshold"
  description="Merge activities separated by brief context switches"
>
  <Select
    value={String(config.timeline?.continuityMergeSeconds || 0)}
    onValueChange={(value) =>
      updateConfig.mutate({
        timeline: { ...config.timeline, continuityMergeSeconds: parseInt(value) },
      })
    }
  >
    <SelectTrigger className="w-24">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="0">Off</SelectItem>
      <SelectItem value="30">30s</SelectItem>
      <SelectItem value="60">60s</SelectItem>
      <SelectItem value="120">2 min</SelectItem>
    </SelectContent>
  </Select>
</SettingsRow>
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add timeline display options UI

Settings for:
- Activity detail level (full/app only/minimal)
- App grouping toggle
- Continuity merge threshold

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.3: Implement App Grouping Logic

**Files:**
- Modify: `internal/service/timeline_grid.go`

**Step 1: Add grouping function**

```go
// groupConsecutiveActivities merges consecutive activities from same app
func groupConsecutiveActivities(blocks []ActivityBlock, gapTolerance int) []ActivityBlock {
	if len(blocks) <= 1 {
		return blocks
	}

	// Sort by start time
	sort.Slice(blocks, func(i, j int) bool {
		return blocks[i].StartTime < blocks[j].StartTime
	})

	grouped := make([]ActivityBlock, 0, len(blocks))
	current := blocks[0]

	for i := 1; i < len(blocks); i++ {
		next := blocks[i]
		gap := next.StartTime - current.EndTime

		if next.AppName == current.AppName && gap <= int64(gapTolerance) {
			// Merge into current
			current.EndTime = next.EndTime
			current.DurationSeconds = int(current.EndTime - current.StartTime)
			current.PixelHeight = calculatePixelHeight(current.DurationSeconds)
		} else {
			grouped = append(grouped, current)
			current = next
		}
	}
	grouped = append(grouped, current)

	return grouped
}
```

**Step 2: Apply in GetTimelineGridDataWithOptions**

```go
func (s *TimelineService) GetTimelineGridDataWithOptions(date string, opts TimelineOptions) (*TimelineGridData, error) {
	// ... existing logic ...

	if opts.AppGrouping {
		for hour, apps := range data.HourlyGrid {
			for app, blocks := range apps {
				data.HourlyGrid[hour][app] = groupConsecutiveActivities(blocks, 60)
			}
		}
	}

	// ... rest of logic ...
}
```

**Step 3: Build and test**

Run: `go build -o /dev/null .`

**Step 4: Commit**

```bash
git add internal/service/timeline_grid.go
git commit -m "$(cat <<'EOF'
feat(timeline): implement app grouping logic

Consecutive activities from same app merge into single blocks
when appGrouping is enabled. 60-second gap tolerance.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.4: Add Column Visibility Config

**Files:**
- Modify: `internal/service/config.go`
- Modify: `frontend/src/types/config.ts`

**Step 1: Add visible columns config**

```go
type TimelineConfig struct {
	// ... existing fields ...
	VisibleColumns []string `json:"visibleColumns"` // ["time", "activities", "summary", "projects", "screenshots", "breaks"]
}
```

Default:
```go
VisibleColumns: []string{"time", "activities", "summary", "projects", "screenshots", "breaks"},
```

**Step 2: Update frontend type**

```typescript
export interface TimelineConfig {
  // ... existing ...
  visibleColumns: string[];
}
```

**Step 3: Build both**

Run: `go build -o /dev/null . && cd frontend && npm run build`

**Step 4: Commit**

```bash
git add internal/service/config.go frontend/src/types/config.ts
git commit -m "$(cat <<'EOF'
feat(config): add visibleColumns configuration

Array of column names to show in timeline views.
Defaults to all columns enabled.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.5: Add Column Visibility UI

**Files:**
- Modify: `frontend/src/components/settings/sections/GeneralSettings.tsx`

**Step 1: Add column checkboxes**

```typescript
const AVAILABLE_COLUMNS = [
  { id: 'time', label: 'Time' },
  { id: 'activities', label: 'Activities' },
  { id: 'summary', label: 'AI Summary' },
  { id: 'projects', label: 'Projects' },
  { id: 'screenshots', label: 'Screenshots' },
  { id: 'breaks', label: 'Breaks' },
  { id: 'git', label: 'Git' },
  { id: 'shell', label: 'Shell' },
  { id: 'files', label: 'Files' },
  { id: 'browser', label: 'Browser' },
];

<SettingsRow
  label="Visible Columns"
  description="Choose which columns to show in the timeline"
>
  <div className="flex flex-wrap gap-2">
    {AVAILABLE_COLUMNS.map((col) => (
      <label key={col.id} className="flex items-center gap-1.5">
        <Checkbox
          checked={config.timeline?.visibleColumns?.includes(col.id) ?? true}
          onCheckedChange={(checked) => {
            const current = config.timeline?.visibleColumns || AVAILABLE_COLUMNS.map(c => c.id);
            const next = checked
              ? [...current, col.id]
              : current.filter(c => c !== col.id);
            updateConfig.mutate({
              timeline: { ...config.timeline, visibleColumns: next },
            });
          }}
        />
        <span className="text-sm">{col.label}</span>
      </label>
    ))}
  </div>
</SettingsRow>
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add column visibility checkboxes

Users can toggle which columns appear in the timeline grid.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6.6: Apply Column Visibility in Grid View

**Files:**
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`

**Step 1: Get visible columns from config**

```typescript
const { data: config } = useConfig();
const visibleColumns = config?.timeline?.visibleColumns || [
  'time', 'activities', 'summary', 'projects', 'screenshots', 'breaks'
];
```

**Step 2: Conditionally render columns**

```typescript
{visibleColumns.includes('time') && <HourColumn hours={hours} hourHeight={hourHeight} />}
{visibleColumns.includes('activities') && topApps.map(app => (
  <AppColumn key={app} app={app} ... />
))}
{visibleColumns.includes('summary') && <AISummaryColumn ... />}
{visibleColumns.includes('projects') && <ProjectsColumn ... />}
{visibleColumns.includes('screenshots') && <ScreenshotColumn ... />}
{visibleColumns.includes('breaks') && <BreaksColumn ... />}
{visibleColumns.includes('git') && <GitColumn ... />}
{visibleColumns.includes('shell') && <ShellColumn ... />}
{visibleColumns.includes('files') && <FilesColumn ... />}
{visibleColumns.includes('browser') && <BrowserColumn ... />}
```

**Step 3: Build and test**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/TimelineGridView.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): apply column visibility config

Grid view now respects visibleColumns setting,
hiding unchecked columns.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7: Draft Behavior System

### Task 7.1: Add Draft Schema Migration

**Files:**
- Modify: `internal/storage/migrations.go`

**Step 1: Add migration for draft fields**

```go
{
	ID:   9,
	Name: "add_draft_fields",
	Up: `
		ALTER TABLE session_summaries ADD COLUMN is_draft INTEGER DEFAULT 0;
		ALTER TABLE session_summaries ADD COLUMN draft_status TEXT DEFAULT 'none';
		ALTER TABLE activity_project_assignments ADD COLUMN is_draft INTEGER DEFAULT 0;
		ALTER TABLE activity_project_assignments ADD COLUMN draft_status TEXT DEFAULT 'none';
		CREATE INDEX idx_session_summaries_draft ON session_summaries(is_draft);
		CREATE INDEX idx_assignments_draft ON activity_project_assignments(is_draft);
	`,
	Down: `
		-- SQLite doesn't support DROP COLUMN easily, would need table recreation
	`,
},
```

**Step 2: Verify migration compiles**

Run: `go build -o /dev/null .`

**Step 3: Commit**

```bash
git add internal/storage/migrations.go
git commit -m "$(cat <<'EOF'
feat(storage): add draft fields to summaries and assignments

Migration adds:
- is_draft flag (0/1)
- draft_status: 'none'|'pending'|'accepted'|'rejected'
- Indexes for efficient draft queries

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.2: Add Draft Mode Config

**Files:**
- Modify: `internal/service/config.go`
- Modify: `frontend/src/types/config.ts`

**Step 1: Add AI config section**

```go
type AIConfig struct {
	SummaryMode         string `json:"summaryMode"`         // "auto_accept", "drafts", "off"
	SummaryChunkMinutes int    `json:"summaryChunkMinutes"` // 15, 30, 60
	AssignmentMode      string `json:"assignmentMode"`      // "auto_accept", "drafts", "off"
}

type Config struct {
	// ... existing ...
	AI AIConfig `json:"ai"`
}
```

**Step 2: Add defaults**

```go
func (s *ConfigService) getDefaultAIConfig() *AIConfig {
	return &AIConfig{
		SummaryMode:         "drafts",
		SummaryChunkMinutes: 15,
		AssignmentMode:      "drafts",
	}
}
```

**Step 3: Add frontend type**

```typescript
export interface AIConfig {
  summaryMode: 'auto_accept' | 'drafts' | 'off';
  summaryChunkMinutes: number;
  assignmentMode: 'auto_accept' | 'drafts' | 'off';
}

export interface Config {
  // ... existing ...
  ai: AIConfig;
}
```

**Step 4: Build both**

Run: `go build -o /dev/null . && cd frontend && npm run build`

**Step 5: Commit**

```bash
git add internal/service/config.go frontend/src/types/config.ts
git commit -m "$(cat <<'EOF'
feat(config): add AI draft mode configuration

New AI config section:
- summaryMode: auto_accept/drafts/off
- summaryChunkMinutes: 15/30/60
- assignmentMode: auto_accept/drafts/off

Defaults to drafts mode for user review.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.3: Add Draft Mode Settings UI

**Files:**
- Modify: `frontend/src/components/settings/sections/AISettings.tsx`

**Step 1: Add draft mode controls**

```typescript
<SettingsRow
  label="AI Summaries"
  description="How AI-generated summaries are handled"
>
  <Select
    value={config.ai?.summaryMode || 'drafts'}
    onValueChange={(value) =>
      updateConfig.mutate({
        ai: { ...config.ai, summaryMode: value },
      })
    }
  >
    <SelectTrigger className="w-36">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="auto_accept">Auto-accept</SelectItem>
      <SelectItem value="drafts">Show as drafts</SelectItem>
      <SelectItem value="off">Off</SelectItem>
    </SelectContent>
  </Select>
</SettingsRow>

<SettingsRow
  label="Summary Chunk Size"
  description="Time period for each AI summary"
>
  <Select
    value={String(config.ai?.summaryChunkMinutes || 15)}
    onValueChange={(value) =>
      updateConfig.mutate({
        ai: { ...config.ai, summaryChunkMinutes: parseInt(value) },
      })
    }
  >
    <SelectTrigger className="w-24">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="15">15 min</SelectItem>
      <SelectItem value="30">30 min</SelectItem>
      <SelectItem value="60">1 hour</SelectItem>
    </SelectContent>
  </Select>
</SettingsRow>

<SettingsRow
  label="Project Assignment"
  description="How auto-assigned projects are handled"
>
  <Select
    value={config.ai?.assignmentMode || 'drafts'}
    onValueChange={(value) =>
      updateConfig.mutate({
        ai: { ...config.ai, assignmentMode: value },
      })
    }
  >
    <SelectTrigger className="w-36">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="auto_accept">Auto-accept</SelectItem>
      <SelectItem value="drafts">Show as drafts</SelectItem>
      <SelectItem value="off">Off</SelectItem>
    </SelectContent>
  </Select>
</SettingsRow>
```

**Step 2: Build frontend**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```bash
git add frontend/src/components/settings/sections/AISettings.tsx
git commit -m "$(cat <<'EOF'
feat(settings): add AI draft mode controls

Settings for:
- Summary mode (auto/drafts/off)
- Summary chunk size (15/30/60 min)
- Assignment mode (auto/drafts/off)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.4: Add Draft Visual Styling

**Files:**
- Create: `frontend/src/components/timeline/DraftBadge.tsx`
- Modify: `frontend/src/components/timeline/AISummaryColumn.tsx`

**Step 1: Create draft badge component**

```typescript
// frontend/src/components/timeline/DraftBadge.tsx
import { cn } from '@/lib/utils';

interface DraftBadgeProps {
  className?: string;
  onClick?: () => void;
}

export function DraftBadge({ className, onClick }: DraftBadgeProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
        'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
        'border border-dashed border-amber-400',
        'hover:bg-amber-200 dark:hover:bg-amber-800',
        className
      )}
    >
      Draft
    </button>
  );
}
```

**Step 2: Apply to AISummaryColumn**

```typescript
import { DraftBadge } from './DraftBadge';

// In summary block rendering:
<div className={cn(
  'summary-block',
  summary.isDraft && 'border-dashed border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/50'
)}>
  {summary.isDraft && (
    <DraftBadge
      onClick={() => handleAcceptDraft(summary.id)}
      className="absolute top-1 right-1"
    />
  )}
  <p>{summary.text}</p>
</div>
```

**Step 3: Build frontend**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/DraftBadge.tsx frontend/src/components/timeline/AISummaryColumn.tsx
git commit -m "$(cat <<'EOF'
feat(timeline): add draft visual styling

Draft items show:
- Dashed border
- Amber/yellow tint
- "Draft" badge with click to accept

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.5: Implement Accept/Reject Draft API

**Files:**
- Modify: `app.go`
- Create: `internal/service/draft_service.go`

**Step 1: Create draft service**

```go
// internal/service/draft_service.go
package service

import "traq/internal/storage"

type DraftService struct {
	store *storage.Store
}

func NewDraftService(store *storage.Store) *DraftService {
	return &DraftService{store: store}
}

// AcceptSummaryDraft marks a summary draft as accepted
func (s *DraftService) AcceptSummaryDraft(summaryID int64) error {
	return s.store.UpdateSummaryDraftStatus(summaryID, false, "accepted")
}

// RejectSummaryDraft marks a summary draft as rejected
func (s *DraftService) RejectSummaryDraft(summaryID int64) error {
	return s.store.UpdateSummaryDraftStatus(summaryID, false, "rejected")
}

// AcceptAssignmentDraft marks a project assignment draft as accepted
func (s *DraftService) AcceptAssignmentDraft(activityID int64) error {
	return s.store.UpdateAssignmentDraftStatus(activityID, false, "accepted")
}

// BulkAcceptDrafts accepts multiple drafts at once
func (s *DraftService) BulkAcceptDrafts(summaryIDs, assignmentIDs []int64) error {
	for _, id := range summaryIDs {
		if err := s.AcceptSummaryDraft(id); err != nil {
			return err
		}
	}
	for _, id := range assignmentIDs {
		if err := s.AcceptAssignmentDraft(id); err != nil {
			return err
		}
	}
	return nil
}
```

**Step 2: Add Wails bindings**

```go
func (a *App) AcceptSummaryDraft(summaryID int64) error {
	return a.draftService.AcceptSummaryDraft(summaryID)
}

func (a *App) RejectSummaryDraft(summaryID int64) error {
	return a.draftService.RejectSummaryDraft(summaryID)
}

func (a *App) BulkAcceptDrafts(summaryIDs, assignmentIDs []int64) error {
	return a.draftService.BulkAcceptDrafts(summaryIDs, assignmentIDs)
}
```

**Step 3: Build and regenerate bindings**

Run: `go build -o /dev/null . && wails generate bindings`

**Step 4: Commit**

```bash
git add internal/service/draft_service.go app.go
git commit -m "$(cat <<'EOF'
feat(api): add draft accept/reject endpoints

DraftService provides:
- AcceptSummaryDraft
- RejectSummaryDraft
- AcceptAssignmentDraft
- BulkAcceptDrafts

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.6: Add Summary Learning Storage

**Files:**
- Modify: `internal/storage/migrations.go`
- Create: `internal/storage/summary_feedback.go`

**Step 1: Add migration for feedback table**

```go
{
	ID:   10,
	Name: "add_summary_feedback",
	Up: `
		CREATE TABLE summary_feedback (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			summary_id INTEGER NOT NULL,
			context_embedding BLOB,
			original_text TEXT,
			edited_text TEXT,
			feedback_type TEXT NOT NULL, -- 'accepted', 'edited', 'rejected', 'manual'
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (summary_id) REFERENCES session_summaries(id)
		);
		CREATE INDEX idx_summary_feedback_type ON summary_feedback(feedback_type);
	`,
	Down: `DROP TABLE summary_feedback;`,
},
```

**Step 2: Create storage methods**

```go
// internal/storage/summary_feedback.go
package storage

import "time"

type SummaryFeedback struct {
	ID               int64     `json:"id"`
	SummaryID        int64     `json:"summaryId"`
	ContextEmbedding []byte    `json:"contextEmbedding"`
	OriginalText     string    `json:"originalText"`
	EditedText       string    `json:"editedText"`
	FeedbackType     string    `json:"feedbackType"` // accepted, edited, rejected, manual
	CreatedAt        time.Time `json:"createdAt"`
}

func (s *Store) SaveSummaryFeedback(fb SummaryFeedback) error {
	_, err := s.db.Exec(`
		INSERT INTO summary_feedback (summary_id, context_embedding, original_text, edited_text, feedback_type)
		VALUES (?, ?, ?, ?, ?)
	`, fb.SummaryID, fb.ContextEmbedding, fb.OriginalText, fb.EditedText, fb.FeedbackType)
	return err
}

func (s *Store) GetRecentFeedback(limit int) ([]SummaryFeedback, error) {
	rows, err := s.db.Query(`
		SELECT id, summary_id, context_embedding, original_text, edited_text, feedback_type, created_at
		FROM summary_feedback
		WHERE feedback_type IN ('accepted', 'edited', 'manual')
		ORDER BY created_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var feedback []SummaryFeedback
	for rows.Next() {
		var fb SummaryFeedback
		if err := rows.Scan(&fb.ID, &fb.SummaryID, &fb.ContextEmbedding, &fb.OriginalText, &fb.EditedText, &fb.FeedbackType, &fb.CreatedAt); err != nil {
			return nil, err
		}
		feedback = append(feedback, fb)
	}
	return feedback, nil
}
```

**Step 3: Build backend**

Run: `go build -o /dev/null .`

**Step 4: Commit**

```bash
git add internal/storage/migrations.go internal/storage/summary_feedback.go
git commit -m "$(cat <<'EOF'
feat(storage): add summary feedback storage

Stores user feedback on AI summaries:
- accepted: AI summary accepted as-is
- edited: AI summary was modified
- rejected: AI summary was discarded
- manual: User wrote summary from scratch

Used for learning and improving future generations.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7.7: Integrate Learning into Summary Generation

**Files:**
- Modify: `internal/service/summary_service.go` (or wherever summaries are generated)

**Step 1: Add feedback retrieval for few-shot examples**

```go
// GetSimilarFeedback finds similar accepted summaries for few-shot learning
func (s *SummaryService) GetSimilarFeedback(ctx *EmbeddingContext, limit int) ([]SummaryFeedback, error) {
	// Get context embedding
	embedding := s.embeddings.GenerateEmbedding(ctx)

	// Find similar feedback entries
	allFeedback, err := s.store.GetRecentFeedback(100) // Get recent good examples
	if err != nil {
		return nil, err
	}

	// Score by similarity
	type scored struct {
		fb    SummaryFeedback
		score float64
	}

	var results []scored
	for _, fb := range allFeedback {
		if len(fb.ContextEmbedding) == 0 {
			continue
		}
		embeddingVec := BytesToFloats(fb.ContextEmbedding)
		sim := CosineSimilarity(embedding, embeddingVec)
		results = append(results, scored{fb, sim})
	}

	// Sort by similarity
	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	// Return top matches
	var feedback []SummaryFeedback
	for i := 0; i < limit && i < len(results); i++ {
		feedback = append(feedback, results[i].fb)
	}

	return feedback, nil
}
```

**Step 2: Use in summary generation prompt**

```go
// When generating summaries, include similar examples
func (s *SummaryService) GenerateSummary(ctx *EmbeddingContext, activities []ActivityBlock) (string, error) {
	// Get similar successful summaries as examples
	examples, _ := s.GetSimilarFeedback(ctx, 3)

	// Build prompt with few-shot examples
	var exampleText string
	for _, ex := range examples {
		text := ex.EditedText
		if text == "" {
			text = ex.OriginalText
		}
		exampleText += fmt.Sprintf("Example: %s\n", text)
	}

	// ... rest of generation logic using examples as context
}
```

**Step 3: Build backend**

Run: `go build -o /dev/null .`

**Step 4: Commit**

```bash
git add internal/service/summary_service.go
git commit -m "$(cat <<'EOF'
feat(ai): integrate learning into summary generation

Summary generation now:
- Retrieves similar accepted/edited summaries
- Uses them as few-shot examples
- Improves over time from user feedback

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Final Integration

### Task 8.1: Run Full Test Suite

**Step 1: Run backend tests**

Run: `go test ./...`
Expected: All tests pass

**Step 2: Run frontend tests**

Run: `cd frontend && npm test`
Expected: All tests pass

**Step 3: Run E2E tests**

Run: `cd frontend && npx playwright test`
Expected: All tests pass (may need updates)

**Step 4: Commit any test fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: fix tests for Timeline V4 changes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8.2: Final Build and Manual Testing

**Step 1: Full build**

Run: `wails build -tags webkit2_41`
Expected: Success

**Step 2: Manual testing checklist**

- [ ] Grid view renders with all columns
- [ ] Drops view shows duration bars
- [ ] List view is functional
- [ ] Split panel resizes correctly
- [ ] Selection syncs across views
- [ ] Bulk actions work
- [ ] Column visibility settings work
- [ ] Draft mode shows drafts correctly
- [ ] Accept/reject drafts work

**Step 3: Commit if any final fixes needed**

---

## Summary

This implementation plan covers all 7 phases of Timeline V4:

1. **Foundation & Critical Fixes** - Duration bars, extended zoom, column cleanup
2. **Real Embeddings** - ONNX integration, tokenizer, backfill
3. **List View & Split Panel** - New list component, resizable layout
4. **Unified Selection** - Cross-view selection sync
5. **Multi-Select & Bulk Operations** - Bulk toolbar, project assignment
6. **Display Options & Column Config** - Title display, app grouping, column visibility
7. **Draft Behavior System** - Draft mode, accept/reject, learning

Each task is broken into ~5 minute steps with exact code and commands.
