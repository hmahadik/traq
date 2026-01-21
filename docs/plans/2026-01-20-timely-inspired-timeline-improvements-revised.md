# Timely-Inspired Timeline Improvements Implementation Plan (REVISED)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Traq's timeline UX with Timely-inspired features that complement existing functionality: title display options, activity grouping, continuity merging, and duration-aware drops view.

**Architecture:** Progressive enhancement approach - each feature adds new config options, backend filtering/aggregation logic, and frontend UI controls. Features are independent and can be implemented in any order.

**Tech Stack:** Go (backend filtering), React + TypeScript (UI), D3.js (drops view), TailwindCSS (styling), Wails (IPC), SQLite (storage)

**Status:**
- ✅ Noise cancellation already implemented
- ✅ AI Summary column exists (per-session summaries)
- ✅ Entries column exists (project assignments)
- ⚠️ Drops view shows all events as dots (needs duration bars)

---

## Audit: What Already Exists vs What's Missing

### Already Implemented ✅

**AI Summary Column:**
- Shows AI-generated session summaries in time-aligned blocks
- Different from Timely's "summary lane" (which shows dominant app per time chunk)
- Kept as-is - serves a different purpose (narrative summaries vs activity summaries)

**Entries Column:**
- Shows project-assigned activities
- Already has visual project color coding
- Needs: Drag-to-assign UI (planned in Phase 5)

**Drops View:**
- D3-based swimlane visualization
- Projects lane integration (already wired up if entries exist)
- **Issue:** Shows all events as dots, even activities with duration
- **Need:** Render activities with duration as horizontal bars

### Gaps Identified 🔧

1. **Drops view doesn't show duration** - Activities spanning minutes/hours shown as dots
2. **No title display options** - Always shows full detail (app + window title)
3. **No app grouping** - Activities always shown individually
4. **No continuity merging** - Brief switches always visible
5. **Drag-to-assign not implemented** - Can't drag activities to projects lane

---

## REVISED PLAN

## Phase 1: Fix Drops View Duration Display (CRITICAL)

**Rationale:** This is a fundamental UX issue that should be fixed before adding other features. Activities that span 30 minutes shouldn't look identical to 5-second events.

### Task 1: Add Duration-Aware Rendering to Drops View

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx:360-411`
- Modify: `frontend/src/components/timeline/eventDrops/eventDropsTypes.ts` (if needed)

**Step 1: Analyze current event rendering**

Current code (line 366-411) renders all events as circles:
```typescript
dotsGroup.selectAll('.event-dot')
  .data(allEvents)
  .join('circle')  // <-- Always circles
  .attr('r', DOT_RADIUS)
```

**Step 2: Implement hybrid rendering strategy**

Events should render based on duration:
- **< 10 seconds**: Dot (circle)
- **≥ 10 seconds**: Horizontal bar (rect)

Add helper to determine shape:
```typescript
// At top of component (after constants)
const shouldRenderAsBar = (event: EventDot, xScale: d3.ScaleTime<number, number>): boolean => {
  if (!event.duration) return false;

  // Calculate pixel width for this duration
  const startTime = event.timestamp.getTime();
  const endTime = startTime + (event.duration * 1000);
  const pixelWidth = xScale(new Date(endTime)) - xScale(event.timestamp);

  // Render as bar if duration > 10s AND pixel width > 3px
  return event.duration >= 10 && pixelWidth > 3;
};
```

**Step 3: Replace single .join() with conditional rendering**

Replace the dots rendering section (lines 365-411) with:

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
    // ... existing hover logic
  })
  .on('mouseleave', function () {
    // ... existing hover logic
  })
  .on('click', function (_, d) {
    onEventClick?.(d);
  });

// Render bars (for duration events)
const BAR_HEIGHT = 16; // Height of duration bars
dotsGroup.selectAll('.event-bar')
  .data(barEvents, (d) => (d as EventDot).id)
  .join('rect')
  .attr('class', 'event-bar')
  .attr('x', (d) => xScale(d.timestamp))
  .attr('y', (d) => (yScale(d.row) || 0) + (yScale.bandwidth() - BAR_HEIGHT) / 2)
  .attr('width', (d) => {
    const startTime = d.timestamp.getTime();
    const endTime = startTime + ((d.duration || 0) * 1000);
    return Math.max(2, xScale(new Date(endTime)) - xScale(d.timestamp));
  })
  .attr('height', BAR_HEIGHT)
  .attr('rx', 2) // Rounded corners
  .attr('fill', (d) => d.color)
  .attr('fill-opacity', 0.7)
  .attr('stroke', (d) => d.color)
  .attr('stroke-width', 1.5)
  .style('cursor', 'pointer')
  .on('mouseenter', function (event, d) {
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

**Step 4: Update zoom handler to recompute bar widths**

In the zoom handler (line 283-293), add bar width updates:

```typescript
// After updating dots (line 284):
svg.selectAll<SVGCircleElement, EventDot>('.event-dot')
  .attr('cx', (d) => newXScale(d.timestamp));

// Add bar updates:
svg.selectAll<SVGRectElement, EventDot>('.event-bar')
  .attr('x', (d) => newXScale(d.timestamp))
  .attr('width', (d) => {
    const startTime = d.timestamp.getTime();
    const endTime = startTime + ((d.duration || 0) * 1000);
    return Math.max(2, newXScale(new Date(endTime)) - newXScale(d.timestamp));
  });
```

**Step 5: Test the changes**

Run: `cd frontend && npm run build`
Expected: Success

Run: `wails dev -tags webkit2_41`
Test:
1. Navigate to Timeline page
2. Switch to Drops view
3. Verify:
   - Brief events (< 10s) appear as dots
   - Activities with duration (focus events, shell commands) appear as horizontal bars
   - Bars scale correctly when zooming in/out
   - Hover and click work on both dots and bars

**Step 6: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "feat(drops): render duration events as horizontal bars

Activities with duration >= 10s now render as bars instead of dots,
providing visual indication of time span. Brief events remain as dots.

Bars scale correctly with zoom and support same interactions as dots.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Title Display Options (Quick Win)

### Task 2: Add Title Display Config

**Files:**
- Modify: `internal/service/config.go:78-80`
- Modify: `frontend/src/types/config.ts:12-14`
- Modify: `frontend/src/components/settings/sections/GeneralSettings.tsx:92-128`

**Step 1: Add backend config field**

Edit `internal/service/config.go`, add to TimelineConfig struct:

```go
type TimelineConfig struct {
	MinActivityDurationSeconds int    `json:"minActivityDurationSeconds"`
	TitleDisplay               string `json:"titleDisplay"` // "full", "app_only", "minimal"
}
```

**Step 2: Add config loading/saving**

In `getDefaultTimelineConfig()`:
```go
func (s *ConfigService) getDefaultTimelineConfig() *TimelineConfig {
	return &TimelineConfig{
		MinActivityDurationSeconds: 0,
		TitleDisplay:              "full", // Default: show full details
	}
}
```

In `GetConfig()` after line 336:
```go
if val, err := s.store.GetConfig("timeline.titleDisplay"); err == nil && val != "" {
	config.Timeline.TitleDisplay = val
}
```

In `mapToStorageKey()` after line 475:
```go
"timeline.titleDisplay": "timeline.titleDisplay",
```

**Step 3: Verify backend builds**

Run: `go build -o /dev/null .`
Expected: Success

**Step 4: Add frontend config type**

Edit `frontend/src/types/config.ts`:

```typescript
export interface TimelineConfig {
  minActivityDurationSeconds: number;
  titleDisplay: 'full' | 'app_only' | 'minimal';
}
```

**Step 5: Add UI control in Settings**

Edit `frontend/src/components/settings/sections/GeneralSettings.tsx`, add after noise cancellation row:

```tsx
<SettingsRow
  label="Activity Detail Level"
  description="Control how much information is shown in activity blocks"
>
  <Select
    value={config.timeline?.titleDisplay || 'full'}
    onValueChange={(value: 'full' | 'app_only' | 'minimal') =>
      updateConfig.mutate({
        timeline: {
          ...config.timeline,
          titleDisplay: value,
        },
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
```

**Step 6: Build frontend**

Run: `cd frontend && npm run build`
Expected: Success

**Step 7: Commit**

```bash
git add internal/service/config.go frontend/src/types/config.ts frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "feat(timeline): add title display config option

Add config field and UI for controlling activity block detail level:
- full: app name + window title
- app_only: app name only
- minimal: icon only

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Apply Title Display Filter to Activity Blocks

**Files:**
- Modify: `frontend/src/components/timeline/ActivityBlock.tsx`

**Step 1: Add config fetching to component**

```typescript
import { useConfig } from '@/api/hooks';

export function ActivityBlock({ activity, ...props }: ActivityBlockProps) {
  const { data: config } = useConfig();
  const titleDisplay = config?.timeline?.titleDisplay || 'full';

  const showWindowTitle = titleDisplay === 'full';
  const showAppName = titleDisplay !== 'minimal';
```

**Step 2: Apply conditional rendering**

Modify the content section to respect titleDisplay:

```typescript
{showAppName && (
  <div className="text-xs font-medium truncate">{activity.appName}</div>
)}
{showWindowTitle && activity.windowTitle && (
  <div className="text-[10px] text-muted-foreground truncate">
    {activity.windowTitle}
  </div>
)}
{titleDisplay === 'minimal' && (
  <div className="text-[9px] text-muted-foreground">
    {formatDuration(activity.durationSeconds)}
  </div>
)}
```

**Step 3: Test**

Run: `wails dev -tags webkit2_41`
Test all three modes visually

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/ActivityBlock.tsx
git commit -m "feat(timeline): apply title display filter to blocks

Render activity blocks based on titleDisplay config setting.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: App Grouping Toggle

**Status:** Same as original plan (Task 3-4), no changes needed.

Refer to original plan for Tasks 3-4.

---

## Phase 4: Activity Continuity Merging

**Status:** Same as original plan (Task 5-7), no changes needed.

Refer to original plan for Tasks 5-7.

---

## Phase 5: Entries Lane Drag-to-Assign (Simplified)

**Note:** Original Task 10 attempted drag-to-assign but noted it was incomplete. This version provides a simpler approach.

### Task 4: Add Visual Drag Affordance to Activity Blocks

**Files:**
- Modify: `frontend/src/components/timeline/ActivityBlock.tsx`

**Step 1: Add drag cursor visual**

Add a subtle grab cursor indicator when hovering:

```typescript
<div
  className={cn(
    "absolute inset-x-0 px-1 cursor-grab active:cursor-grabbing",
    // ... existing classes
  )}
>
```

**Step 2: Add draggable attribute**

```typescript
<div
  draggable={true}
  onDragStart={(e) => {
    // Store activity data in drag event
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'activity',
      id: activity.id,
      appName: activity.appName,
      windowTitle: activity.windowTitle,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }}
  // ... rest
>
```

**Step 3: Document what's needed**

Add comment block:

```typescript
// TODO: Complete drag-to-assign implementation
// 1. Make EntriesColumn/project areas drop zones
// 2. Show project selection dialog on drop
// 3. Create API mutation: AssignActivityToProject(activityId, projectId)
// 4. Refresh timeline after assignment
// 5. Show toast notification
```

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/ActivityBlock.tsx
git commit -m "feat(entries): add visual drag affordance to activities

Activities now show grab cursor and are draggable. Drag data includes
activity metadata for future drop handler integration.

Requires: Drop zone UI + project selection dialog + API integration.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Summary of Changes from Original Plan

### ❌ Removed

**Summary Lane (Phase 4 in original):**
- **Why removed:** Redundant with existing AI Summary column
- AI summaries serve a different purpose (narrative descriptions of sessions)
- Time-chunked "dominant activity" summaries would clutter the UI
- Timely's AI feature: Shows AI summaries as *drafts* users can accept/reject
- Traq could adopt this pattern for AI summaries, but that's a separate feature

### ✅ Added

**Duration-Aware Drops View (NEW Phase 1):**
- **Why critical:** Fundamental UX issue in drops view
- Activities spanning 30 minutes look identical to 5-second events
- Render as horizontal bars when duration ≥ 10 seconds
- Must be fixed before claiming "feature parity with grid view"

### ↔️ Kept

- Title Display Options (Phase 2)
- App Grouping Toggle (Phase 3)
- Activity Continuity Merging (Phase 4)
- Entries Lane improvements (Phase 5, simplified)

---

## Implementation Priority

**Recommended order:**

1. **Phase 1 (Task 1)** - Fix drops view duration display - 45 minutes
2. **Phase 2 (Tasks 2-3)** - Title display options - 30 minutes
3. **Phase 3** - App grouping (reference original plan) - 45 minutes
4. **Phase 4** - Continuity merging (reference original plan) - 1 hour
5. **Phase 5 (Task 4)** - Drag affordance foundation - 20 minutes

**Total:** ~3.5 hours

---

## Execution Strategy

**Recommended:** Subagent-driven development in this session

Each phase is independent:
- Fresh subagent per task
- Review between tasks
- Commit after each task

This allows catch regressions early and ensure features complement existing UI.
