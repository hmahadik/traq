# Timeline V4 Design

**Status:** Draft
**Created:** 2026-01-20

## Overview

Timeline V4 is a significant evolution of Traq's timeline experience, introducing a flexible workspace with synchronized views, unified selection model, and AI learning improvements.

**Key Changes:**
- Split-panel layout with Grid, Drops, and List views as first-class citizens
- Unified selection and editing across all views
- Real semantic embeddings (replacing pseudo-embeddings)
- Draft behavior system for AI-assisted features
- Learning from user feedback (summaries + assignments)

---

## Architecture

### Layout System

The timeline page becomes a flexible workspace with configurable split panels.

```
+---------------------------------------------+
| Header: Date picker, View toggle, Settings  |
+---------------------------------------------+
|                     |                       |
|   Primary View      |   List Panel          |
|   (Grid OR Drops)   |   (collapsible)       |
|                     |                       |
+---------------------------------------------+
```

**Split Panel Behavior:**
- Direction is **user-configurable** (horizontal or vertical)
- List panel can be resized **0% to 100%** (full-screen list view is valid)
- Panel state persists (collapsed/expanded, size, direction)
- Default: horizontal for Grid, vertical for Drops (but user can override)

### View Components

| View | Description | Scroll |
|------|-------------|--------|
| Grid | Hourly grid with activity blocks | Vertical |
| Drops | D3 swimlane visualization | Horizontal |
| List | Tabular with checkboxes, sortable | Vertical |

All three views are first-class and can be combined via split panels.

---

## Unified Columns/Lanes

Grid columns and Drops lanes are the **same concept** rendered differently. User configures once, applies to both.

| Column/Lane | Grid | Drops | Default |
|-------------|------|-------|---------|
| Time | Hour labels | Time axis | Always on |
| Activities | Activity blocks | App swimlanes | Always on |
| AI Summary | Summary column | Summary lane | On |
| Projects | Project column | Projects lane | On |
| Screenshots | Screenshot column | Screenshot markers | On |
| Breaks | Break indicators | Breaks lane | On |

**Changes from current state:**
- **Remove:** Clusters (never used)
- **Rename:** Entries → Projects (clearer)
- **Consolidate:** AFK + Breaks → just "Breaks"
- **Add to Drops:** Summary lane (for parity with Grid)

**Configuration:** Settings → Timeline → Visible Columns (checkboxes)

---

## List View Component

### Columns

| Column | Description |
|--------|-------------|
| Checkbox | Selection |
| Time | Start time (sortable) |
| Duration | How long (sortable) |
| App | Application name + icon |
| Title | Window title (truncatable) |
| Project | Assigned project (editable) |
| Summary | AI summary if exists |

### Features

- **Sort** by any column (click header)
- **Filter** - text search, app filter, project filter
- **Selection modes:**
  - Click checkbox for single item
  - Shift+click for range
  - Ctrl/Cmd+click for toggle
  - "Select all" / "Select none" buttons
- **Bulk actions toolbar** (appears when items selected):
  - Assign to project
  - Merge selected
  - Delete selected
  - Accept draft summaries

### Filter-to-Selection

When items are selected, option to "Show only selected" hides everything else for focused editing.

---

## Cross-View Linking

### Selection Model

Selection is **view-agnostic** - a central selection state holds activity IDs. All views read from and write to this shared state.

**Interaction Model:**

| Action | Effect |
|--------|--------|
| Click item | Selects it (persistent) |
| Ctrl/Cmd+Click | Toggle selection (add/remove) |
| Shift+Click | Range select |
| Hover | Hover highlight (temporary, visual only) |

### Synchronization

When you select in View A, View B:
1. Scrolls to show the item
2. Displays it as selected (persistent highlight)
3. Optional: brief attention pulse when scrolling from another view

### Visual States

1. **Normal** - no special styling
2. **Hovered** - subtle highlight (temporary)
3. **Selected** - prominent ring/highlight (persistent until deselected)

### Unified Editing

Edit triggers work identically regardless of source:
- Double-click grid block → edit dialog
- Double-click list row → same edit dialog
- Double-click drops event → same edit dialog
- Bulk toolbar appears whenever selection.length > 0

---

## Drops View Improvements

### Duration Rendering

**Current:** All events render as dots regardless of duration.

**V4:** Events render based on duration:
- **< 10 seconds** → Dot (circle, radius R)
- **≥ 10 seconds** → Horizontal bar (pill shape, same radius R on ends)

Bar width scales with zoom level. Same hover/click interactions as dots.

```
Dot (< 10s):     ●      (circle)
Bar (≥ 10s):    ⬤━━━━━━⬤   (pill/capsule, stretched dot)
```

### Extended Zoom Range

| View | Current | V4 Target |
|------|---------|-----------|
| Grid | ~1 hour visible | 15 min → 8 hours visible |
| Drops | ~4 hours visible | 30 min → 24 hours visible |

**Zoom controls:**
- Mouse wheel (with modifier key to avoid scroll conflict)
- Pinch gesture on trackpad
- Zoom buttons (+/−) in toolbar
- Zoom level indicator (e.g., "4 hours")

---

## Display Options

### Title Display Modes

| Mode | Shows |
|------|-------|
| Full | App name + window title |
| App Only | App name only |
| Minimal | Icon + duration badge |

Configurable in Settings, applies to grid view activity blocks.

### App Grouping Toggle

When enabled, consecutive activities from the same app merge into single blocks.
- Example: VS Code (5m) → VS Code (10m) → VS Code (3m) becomes VS Code (18m)
- Gap tolerance: 60 seconds

### Continuity Merging

Merge activities interrupted by brief context switches.
- Example: VS Code (5m) → Slack (10s) → VS Code (10m) → **VS Code (15m)**
- Configurable threshold: Off / 30s / 60s / 120s

These are **independent toggles** that can be combined.

---

## Real Embeddings

### Current State (Problem)

The embeddings service uses hash-based "pseudo-embeddings" that provide no semantic understanding. This is a placeholder that needs replacement.

### V4 Target

Integrate real semantic embeddings via ONNX runtime:
- Model: all-MiniLM-L6-v2 (384 dimensions)
- Benefits: actual semantic similarity, better project suggestions
- Requirement: backfill embeddings for historical data

---

## Draft Behavior System

### Concept

AI-assisted features (summaries, project assignment) produce "drafts" that users can review before accepting.

### Three Modes

| Mode | Behavior |
|------|----------|
| **Auto-accept** | AI results applied automatically |
| **Drafts** | AI results shown as pending, user accepts/rejects |
| **Off** | Feature disabled entirely |

### Applies To

1. **AI Summaries** - time-chunked descriptions
2. **Auto Project Assignment** - hybrid (patterns + embedding similarity)

### Draft UI

- Distinct visual styling (dashed border, muted color, or badge)
- Bulk accept: "Accept all drafts" button
- Individual: click draft → accept/edit/reject
- Drafts persist until actioned

### Time-Chunked Summaries

- Base chunk: 15 minutes (configurable: 15/30/60)
- Long activities span multiples (30m activity → 2 chunks merged)
- Each chunk gets its own summary draft

### Settings UI

```
AI Summaries:        [Auto-accept ▼]  Chunk size: [15 min ▼]
Project Assignment:  [Drafts ▼]
```

---

## Learning System

### Summary Learning

Just like project assignments learn from user corrections, summaries should too:

| User Action | System Learns |
|-------------|---------------|
| Accept AI summary as-is | Positive signal |
| Edit then accept | Learns the correction |
| Reject summary | Negative signal |
| Write manual summary | Strong positive example |

### Storage

- Store accepted/edited summaries with context embeddings
- Use as few-shot examples for future generation
- Build corpus of "good summaries" over time

### Feedback Loop

```
Context → Generate Summary (using similar past summaries)
            ↓
User reviews (accept/edit/reject)
            ↓
Store feedback → Improves future generation
```

---

## Implementation Phases

### Phase 1: Foundation & Critical Fixes
- [ ] Drops view duration bars (pills instead of dots)
- [ ] Extended zoom range (both views)
- [ ] Remove Clusters column
- [ ] Rename Entries → Projects
- [ ] Consolidate AFK → Breaks

### Phase 2: Real Embeddings
- [ ] Integrate ONNX runtime
- [ ] Implement all-MiniLM-L6-v2 model
- [ ] Migrate from pseudo-embeddings
- [ ] Backfill embeddings for historical data

### Phase 3: List View & Split Panel
- [ ] List view component (sortable, filterable, checkboxes)
- [ ] Split panel layout (configurable direction)
- [ ] Panel collapse/expand with persistence
- [ ] 0-100% resize range

### Phase 4: Unified Selection & Cross-View Linking
- [ ] Shared selection state (view-agnostic)
- [ ] Cross-view scroll-to on selection
- [ ] Three visual states (normal/hover/selected)
- [ ] Unified edit workflow (same dialog everywhere)

### Phase 5: Multi-Select & Bulk Operations
- [ ] Checkbox selection in list
- [ ] Lasso selection in grid/drops
- [ ] Filter-to-selection mode
- [ ] Bulk actions toolbar (assign, merge, delete, accept drafts)

### Phase 6: Display Options & Column Config
- [ ] Title display modes (full/app/minimal)
- [ ] App grouping toggle
- [ ] Continuity merging
- [ ] Configurable columns/lanes (applies to both views)
- [ ] Summary lane in Drops view (parity)

### Phase 7: Draft Behavior System
- [ ] Draft visual styling
- [ ] Three modes config (auto-accept/drafts/off)
- [ ] Time-chunked AI summaries
- [ ] Apply draft pattern to project assignment
- [ ] Summary learning from feedback

---

## Notes

- This supersedes the earlier "timely-inspired-timeline-improvements" plans
- Each phase is largely independent and can be developed in parallel where possible
- Phase 2 (Real Embeddings) is foundational for Phase 7 (Draft Behavior System)
