# Activity-to-Project Assignment Redesign

## Overview

Redesign the activity-to-project assignment workflow to improve report accuracy through embedding-based auto-assignment, intuitive bulk editing UI, and proper feedback loops.

## Problem Statement

The current pattern-based assignment system has fundamental flaws:

1. **Temporal project conflicts** - Patterns learned for Project A persist after the project ends, conflicting with new Project B patterns using the same apps
2. **Weak differentiation** - When multiple projects use the same toolchain (VS Code + Chrome + Terminal), pattern matching can't distinguish between them
3. **No pattern decay** - Old patterns never expire, leading to "exhaustive-shot examples" that contradict each other
4. **Reports ignore assignments** - Generated reports don't filter by project, making them useless for client billing or project-specific standups
5. **Poor correction UX** - No efficient way to fix misassignments in bulk

## Design Goals

1. **Accept-unless-wrong workflow** - System auto-assigns with high accuracy; user only intervenes for mistakes
2. **Improvement over time** - Corrections genuinely improve future accuracy (measurable, not handwavy)
3. **Easy bulk assignment** - Timeline UI for rapid activity-to-project assignment
4. **Accurate reports** - Filter reports by project for billing, standups, and analysis

## Solution: Embedding-Based Assignment

Replace brittle keyword patterns with semantic embeddings that capture context similarity.

### How It Works

```
Activity captured
    ↓
Extract context (app, window title, git repo, time)
    ↓
Generate embedding (384-512 dim vector)
    ↓
Find k-nearest neighbors from labeled activities
    ↓
If majority agree with high confidence → auto-assign
If uncertain → leave unassigned for user review
    ↓
User corrections update embedding store
    ↓
Future similar activities benefit from correction
```

### Why Embeddings Beat Patterns

| Aspect | Patterns | Embeddings |
|--------|----------|------------|
| "VS Code" signal | Exact match, applies to all projects | Contextual - "VS Code + billing.go + client-a" clusters separately from "VS Code + dashboard.tsx + traq" |
| Temporal projects | Old patterns persist forever | Recent examples naturally weighted by similarity to recent work |
| Context switching | Can't distinguish same-app different-project | Semantic similarity captures subtle context differences |
| Corrections | Create conflicting patterns | Update embedding space, similar activities auto-correct |

### Confidence Thresholds

| Confidence | Action |
|------------|--------|
| >80% | Auto-assign silently |
| 50-80% | Auto-assign, flag for review |
| <50% | Leave unassigned |

User can adjust thresholds in settings.

## UI Changes

### 1. Timeline Grid View - Assignment Editing

The existing grid view gains assignment capabilities:

- **Entries column** (already exists) shows project assignments
- **Click** on an activity block → assign to project via dropdown
- **Drag** to select multiple blocks → bulk assign
- **Shift+click** for range selection
- **Color coding** by project (unassigned = gray)

```
┌────────┬────────────────────────────────────────┐
│ Hour   │ 9am    10am    11am    12pm    1pm    │
├────────┼────────────────────────────────────────┤
│Entries │ [Traq] [Client A    ] [???] [Traq  ]  │ ← Click to edit
├────────┼────────────────────────────────────────┤
│VS Code │ ████   ████████████   ████  ████████  │
│Chrome  │    ██       ████           ██████     │
│Terminal│  ███         ██       ███     ███     │
└────────┴────────────────────────────────────────┘
```

### 2. Timeline Drops View - Projects Lane

Add a "Projects" lane at the top of drops view (matching grid's Entries column):

```
┌─────────────────────────────────────────────────┐
│ Projects: [■ Traq ■][■ Client A ■][░ ??? ░]     │ ← NEW: Top lane
├─────────────────────────────────────────────────┤
│ VS Code   ●━━━━━●      ●━━━━━━━●                │
│ Chrome         ●━━●         ●━━━━●              │
│ Terminal            ●━●              ●━━●       │
└─────────────────────────────────────────────────┘
```

- Click segment → edit assignment
- Drag to create/resize segments
- Same interaction model as grid view

### 3. Project Page - Activity Browser

Enhance the existing ProjectsPage to show activities within a project:

```
Project: Client A
──────────────────────────────────────────────────
Stats: 45 hours this month | 312 activities

[Activities] [Patterns] [Settings]

Filter: [This week ▼] [All apps ▼]

┌──────────────────────────────────────────────────┐
│ Jan 19  VS Code - api/billing.go        2.3h [✎]│
│ Jan 19  Chrome - jira.client-a.com      0.5h [✎]│
│ Jan 18  Terminal - npm test             0.8h [✎]│
│ Jan 18  Zoom - Client A Weekly          1.0h [✎]│
│ ...                                              │
└──────────────────────────────────────────────────┘

[✎] = Reassign to different project (opens dropdown)
```

Benefits:
- See what's actually in the project
- Find misassignments by browsing
- Reassign without leaving project context

### 4. Report Generation - Project Filtering

Add project filter to report generation:

```
Generate Report
──────────────────────────────────────────────────
Time Range: [This week ▼]
Report Type: [Summary ▼]

Project Filter:
  ○ All projects (combined)
  ○ Single project: [Client A ▼]
  ○ Comparison: [✓ Client A] [✓ Traq] [□ Internal]

Include unassigned activities: [✓]

[Generate Report]
```

Report output includes project attribution:

```
# Weekly Report: Client A

## Time Summary
- Total tracked: 18.5 hours
- VS Code: 12.3h
- Chrome: 4.2h
- Meetings: 2.0h

## Activity Breakdown
...
```

## Data Model Changes

### New Table: activity_embeddings

```sql
CREATE TABLE activity_embeddings (
    id INTEGER PRIMARY KEY,
    event_type TEXT NOT NULL,        -- 'screenshot', 'focus', 'git'
    event_id INTEGER NOT NULL,
    embedding BLOB NOT NULL,          -- 384-dim float vector
    context_hash TEXT NOT NULL,       -- For dedup/update detection
    created_at INTEGER NOT NULL,

    UNIQUE(event_type, event_id)
);

CREATE INDEX idx_embeddings_event ON activity_embeddings(event_type, event_id);
```

### Embedding Storage Options

**Option A: SQLite with sqlite-vec extension**
- Pros: Single file, no external dependencies
- Cons: Requires compiling extension, ~10ms query time for 10k vectors

**Option B: In-memory with periodic persistence**
- Pros: Fast queries, simple
- Cons: Memory usage scales with history

**Recommendation:** Start with Option B for simplicity. 10k embeddings @ 384 dims @ 4 bytes = ~15MB. Acceptable for desktop app.

### Modified Tables

```sql
-- Add embedding reference to existing tables (optional, for faster lookups)
ALTER TABLE screenshots ADD COLUMN embedding_id INTEGER REFERENCES activity_embeddings(id);
ALTER TABLE window_focus_events ADD COLUMN embedding_id INTEGER REFERENCES activity_embeddings(id);
```

## Embedding Pipeline

### Context Extraction

For each activity, extract:

```go
type EmbeddingContext struct {
    AppName      string   // "code", "chrome", etc.
    WindowTitle  string   // Full window title
    GitRepo      string   // If available
    GitBranch    string   // If available
    FilePath     string   // Extracted from window title if IDE
    Domain       string   // If browser
    TimeOfDay    string   // "morning", "afternoon", "evening"
    DayOfWeek    string   // "monday", "tuesday", etc.
}
```

### Text Representation

Convert context to text for embedding:

```
"app:vscode title:api/billing.go - client-a (Workspace) - Visual Studio Code repo:client-a-monorepo branch:feature/billing time:afternoon day:monday"
```

### Embedding Model

**Option A: Local model (recommended for privacy)**
- Model: all-MiniLM-L6-v2 (384 dims, ~80MB)
- Runtime: ONNX via Go bindings
- Latency: ~5ms per embedding

**Option B: API-based**
- OpenAI text-embedding-3-small or similar
- Pros: Better quality
- Cons: Privacy concern, cost, latency

**Recommendation:** Local model. Privacy-first aligns with Traq's values.

### Similarity Search

```go
func (s *EmbeddingService) FindSimilar(embedding []float32, k int) []SimilarActivity {
    // Cosine similarity against all labeled embeddings
    // Return top-k with similarity scores
}

func (s *EmbeddingService) SuggestProject(ctx *EmbeddingContext) *ProjectSuggestion {
    embedding := s.generateEmbedding(ctx)
    similar := s.FindSimilar(embedding, 5)

    // Vote by project
    votes := make(map[int64]float64)
    for _, s := range similar {
        votes[s.ProjectID] += s.Similarity
    }

    // Return highest voted if confidence threshold met
    ...
}
```

## Migration Path

### Phase 1: Embedding Infrastructure
1. Add embedding storage (in-memory + persistence)
2. Integrate local embedding model
3. Generate embeddings for existing labeled activities
4. Wire up similarity-based suggestions (alongside existing patterns)

### Phase 2: Timeline Assignment UI
1. Add click-to-assign in grid view Entries column
2. Add drag-select for bulk assignment
3. Add Projects lane to drops view
4. Keyboard shortcuts (P = assign to project)

### Phase 3: Project Page Enhancement
1. Add Activities tab to project detail view
2. Filterable activity list with date/app filters
3. Inline reassignment capability

### Phase 4: Report Filtering
1. Add project filter parameter to GenerateReport API
2. Update report UI with project selection
3. Add "comparison" report type for multi-project breakdown

### Phase 5: Deprecate Pattern System
1. Stop learning new patterns
2. Keep existing patterns as fallback for unembedded activities
3. Eventually remove pattern matching code

## Accuracy Tracking

Build in measurement from day one:

```go
type AccuracyStats struct {
    Period           string  // "2026-01-13 to 2026-01-19"
    TotalActivities  int
    AutoAssigned     int
    UserAssigned     int     // Manual assignments
    Corrections      int     // User changed auto-assignment
    AccuracyRate     float64 // (AutoAssigned - Corrections) / AutoAssigned
}
```

Surface in UI:

```
Assignment Accuracy (This Week)
───────────────────────────────
Auto-assigned: 234 activities
Corrections needed: 12 (5%)
Accuracy: 95% ↑ 3% from last week
```

## Out of Scope (Phase 2+)

- Report → Timeline deep links (click in report to jump to timeline)
- LLM-based classification for ambiguous cases
- Slack/calendar integration for meeting project detection
- Mobile app support

## Open Questions

1. **Embedding model choice** - MiniLM vs. larger model? Need to benchmark accuracy vs. size tradeoff.

2. **Cold start UX** - How do we guide users through initial labeling? Wizard? Prompt after N unlabeled activities?

3. **Project archival** - When a project ends, should its embeddings be:
   - Kept (for reference)?
   - Archived (excluded from matching)?
   - Deleted?

4. **Cross-device sync** - Embeddings are large. If Traq ever supports sync, how do we handle this?

## Success Criteria

1. **Week 1 accuracy:** >70% (after initial labeling session)
2. **Week 4 accuracy:** >85%
3. **Steady state accuracy:** >90%
4. **Assignment UX:** <2 min daily review time
5. **Report usefulness:** Can generate project-specific reports for billing

## Appendix: Why Not LLM Classification?

We considered using LLM (Claude/GPT) for activity classification:

**Pros:**
- Handles nuance well
- Can reason about ambiguous cases
- No training data needed

**Cons:**
- Cost: ~$0.01 per activity × 100 activities/day = $30/month
- Latency: 500ms+ per classification
- Privacy: Sending activity data to cloud
- Reliability: API availability

**Verdict:** Embeddings provide 80% of the benefit at 0% of the cost and with full privacy. LLM classification could be a future "turbo mode" for users who opt in.
