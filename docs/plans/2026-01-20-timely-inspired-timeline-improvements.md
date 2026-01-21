# Timely-Inspired Timeline Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance Traq's timeline UX with Timely-inspired features: summary views, activity grouping, continuity merging, display options, and improved entries lane interactions.

**Architecture:** Progressive enhancement approach - each feature adds new config options, backend filtering/aggregation logic, and frontend UI controls. Features are independent and can be implemented in any order.

**Tech Stack:** Go (backend filtering), React + TypeScript (UI), TailwindCSS (styling), Wails (IPC), SQLite (storage)

**Status:** ✅ Noise cancellation already implemented (minActivityDurationSeconds config)

---

## Phase 1: Title Display Options (Quick Win)

### Task 1: Add Title Display Config

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
Expected: Success (no errors)

**Step 4: Add frontend config type**

Edit `frontend/src/types/config.ts`, update TimelineConfig:

```typescript
export interface TimelineConfig {
  minActivityDurationSeconds: number;
  titleDisplay: 'full' | 'app_only' | 'minimal';
}
```

**Step 5: Add UI control in Settings**

Edit `frontend/src/components/settings/sections/GeneralSettings.tsx`, add after noise cancellation row (after line 120):

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

Add backend config field and frontend UI for controlling activity
block detail level (full/app_only/minimal).

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Apply Title Display Filter to Activity Blocks

**Files:**
- Modify: `frontend/src/components/timeline/ActivityBlock.tsx`
- Modify: `frontend/src/api/hooks.ts` (add useConfig import if needed)

**Step 1: Read current ActivityBlock component**

Run: Read the ActivityBlock component to understand its structure
File: `frontend/src/components/timeline/ActivityBlock.tsx`

**Step 2: Add config-aware rendering logic**

At the top of ActivityBlock component, fetch config:

```typescript
import { useConfig } from '@/api/hooks';

export function ActivityBlock({ activity, ...props }: ActivityBlockProps) {
  const { data: config } = useConfig();
  const titleDisplay = config?.timeline?.titleDisplay || 'full';

  // Determine what to show based on setting
  const showWindowTitle = titleDisplay === 'full';
  const showAppName = titleDisplay !== 'minimal';
  const showIcon = true; // Always show icon
```

**Step 3: Conditional rendering**

Modify the content rendering:

```typescript
<div className="truncate">
  {showAppName && (
    <div className="text-xs font-medium">{activity.appName}</div>
  )}
  {showWindowTitle && activity.windowTitle && (
    <div className="text-[10px] text-muted-foreground truncate">
      {activity.windowTitle}
    </div>
  )}
  {titleDisplay === 'minimal' && (
    // Just show app icon, maybe duration badge
    <div className="text-[9px] text-muted-foreground">
      {formatDuration(activity.durationSeconds)}
    </div>
  )}
</div>
```

**Step 4: Test visually**

Run: `wails dev -tags webkit2_41`
Test:
1. Go to Settings → General → Timeline
2. Change "Activity Detail Level" to "App Only"
3. Navigate to Timeline page
4. Verify activity blocks show only app names, no window titles
5. Change to "Minimal" - should show icon + duration only

**Step 5: Commit**

```bash
git add frontend/src/components/timeline/ActivityBlock.tsx
git commit -m "feat(timeline): apply title display filter to activity blocks

Render activity blocks based on titleDisplay config:
- full: app name + window title
- app_only: app name only
- minimal: icon + duration badge

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: App Grouping Toggle

### Task 3: Add App Grouping Backend Logic

**Files:**
- Modify: `internal/service/config.go:78-80`
- Modify: `internal/service/timeline_grid.go:220-300`
- Create: `internal/service/timeline_grid_grouping.go`

**Step 1: Add config field**

Edit `internal/service/config.go`, add to TimelineConfig:

```go
type TimelineConfig struct {
	MinActivityDurationSeconds int    `json:"minActivityDurationSeconds"`
	TitleDisplay               string `json:"titleDisplay"`
	GroupByApp                 bool   `json:"groupByApp"` // Default: false (ungrouped)
}
```

Update default:
```go
func (s *ConfigService) getDefaultTimelineConfig() *TimelineConfig {
	return &TimelineConfig{
		MinActivityDurationSeconds: 0,
		TitleDisplay:              "full",
		GroupByApp:                false, // Default: show individual activities
	}
}
```

**Step 2: Add config persistence**

In `GetConfig()` after titleDisplay:
```go
if val, err := s.store.GetConfig("timeline.groupByApp"); err == nil {
	config.Timeline.GroupByApp = val == "true"
}
```

In `mapToStorageKey()`:
```go
"timeline.groupByApp": "timeline.groupByApp",
```

**Step 3: Create grouping logic file**

Create `internal/service/timeline_grid_grouping.go`:

```go
package service

import (
	"sort"
	"traq/internal/storage"
)

// GroupActivitiesByApp merges consecutive activities from the same app into single blocks.
// Input: sorted list of focus events (by start time)
// Output: grouped events with merged durations
func GroupActivitiesByApp(events []*storage.WindowFocusEvent) []*storage.WindowFocusEvent {
	if len(events) == 0 {
		return events
	}

	var grouped []*storage.WindowFocusEvent
	currentGroup := events[0]

	for i := 1; i < len(events); i++ {
		event := events[i]

		// Check if this event can be merged with current group
		if event.AppName == currentGroup.AppName &&
			event.StartTime <= currentGroup.EndTime+60 { // Allow 60s gap
			// Extend the group
			if event.EndTime > currentGroup.EndTime {
				currentGroup.EndTime = event.EndTime
				currentGroup.DurationSeconds = float64(currentGroup.EndTime - currentGroup.StartTime)
			}
		} else {
			// Start new group
			grouped = append(grouped, currentGroup)
			currentGroup = event
		}
	}

	// Add final group
	grouped = append(grouped, currentGroup)
	return grouped
}
```

**Step 4: Integrate grouping into GetTimelineGridDataWithOptions**

Edit `internal/service/timeline_grid.go`, after line 258 (after noise cancellation filter):

```go
// Get grouping setting from config (passed as parameter later)
// For now, we'll add it as a parameter to the function

// Apply app grouping if enabled
// if groupByApp {
//   focusEvents = GroupActivitiesByApp(focusEvents)
// }
```

Note: We'll need to modify the function signature to accept groupByApp parameter.

**Step 5: Update function signature**

Change GetTimelineGridDataWithOptions signature:

```go
func (s *TimelineService) GetTimelineGridDataWithOptions(date string, minDurationSeconds int, groupByApp bool) (*TimelineGridData, error) {
```

Add grouping call after noise filter:

```go
// Apply app grouping if enabled
if groupByApp {
	focusEvents = GroupActivitiesByApp(focusEvents)
}
```

**Step 6: Update app.go to pass groupByApp**

Edit `app.go`, modify GetTimelineGridData:

```go
// Get timeline settings from config
minDuration := 0
groupByApp := false
if a.Config != nil {
	if config, err := a.Config.GetConfig(); err == nil && config.Timeline != nil {
		minDuration = config.Timeline.MinActivityDurationSeconds
		groupByApp = config.Timeline.GroupByApp
	}
}

return a.Timeline.GetTimelineGridDataWithOptions(date, minDuration, groupByApp)
```

Also update the deprecated GetTimelineGridData wrapper:

```go
func (s *TimelineService) GetTimelineGridData(date string) (*TimelineGridData, error) {
	return s.GetTimelineGridDataWithOptions(date, 0, false)
}
```

**Step 7: Build and verify**

Run: `go build -o /dev/null .`
Expected: Success

**Step 8: Commit**

```bash
git add internal/service/config.go internal/service/timeline_grid_grouping.go internal/service/timeline_grid.go app.go
git commit -m "feat(timeline): add app grouping backend logic

Merge consecutive activities from same app into single blocks when
groupByApp config is enabled. Allows 60s gap between activities.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add App Grouping Frontend Toggle

**Files:**
- Modify: `frontend/src/types/config.ts:12-15`
- Modify: `frontend/src/components/settings/sections/GeneralSettings.tsx:92-150`

**Step 1: Add TypeScript type**

Edit `frontend/src/types/config.ts`:

```typescript
export interface TimelineConfig {
  minActivityDurationSeconds: number;
  titleDisplay: 'full' | 'app_only' | 'minimal';
  groupByApp: boolean;
}
```

**Step 2: Add UI toggle**

Edit `frontend/src/components/settings/sections/GeneralSettings.tsx`, add after title display:

```tsx
<SettingsRow
  label="Group by App"
  description="Merge consecutive activities from the same app into single blocks"
>
  <Switch
    checked={config.timeline?.groupByApp ?? false}
    onCheckedChange={(groupByApp) =>
      updateConfig.mutate({
        timeline: {
          ...config.timeline,
          groupByApp,
        },
      })
    }
  />
</SettingsRow>
```

**Step 3: Build frontend**

Run: `cd frontend && npm run build`
Expected: Success

**Step 4: Test end-to-end**

Run: `wails dev -tags webkit2_41`
Test:
1. Open app, go to Timeline
2. Note current timeline layout
3. Go to Settings → General → Timeline
4. Enable "Group by App"
5. Return to Timeline
6. Verify activities from same app are merged into longer blocks

**Step 5: Commit**

```bash
git add frontend/src/types/config.ts frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "feat(timeline): add app grouping UI toggle

Add switch in settings to enable/disable app grouping. When enabled,
consecutive activities from same app merge into single blocks.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3: Activity Continuity Merging

### Task 5: Add Continuity Merging Config

**Files:**
- Modify: `internal/service/config.go:78-81`
- Modify: `frontend/src/types/config.ts:12-16`

**Step 1: Add backend config**

Edit `internal/service/config.go`, add to TimelineConfig:

```go
type TimelineConfig struct {
	MinActivityDurationSeconds int    `json:"minActivityDurationSeconds"`
	TitleDisplay               string `json:"titleDisplay"`
	GroupByApp                 bool   `json:"groupByApp"`
	ContinuityMergeSeconds     int    `json:"continuityMergeSeconds"` // 0=off, 30=short, 60=regular, 120=extended
}
```

Update default:
```go
func (s *ConfigService) getDefaultTimelineConfig() *TimelineConfig {
	return &TimelineConfig{
		MinActivityDurationSeconds: 0,
		TitleDisplay:              "full",
		GroupByApp:                false,
		ContinuityMergeSeconds:    0, // Default: off
	}
}
```

**Step 2: Add persistence**

In `GetConfig()`:
```go
if val, err := s.store.GetConfig("timeline.continuityMergeSeconds"); err == nil {
	if v, e := strconv.Atoi(val); e == nil {
		config.Timeline.ContinuityMergeSeconds = v
	}
}
```

In `mapToStorageKey()`:
```go
"timeline.continuityMergeSeconds": "timeline.continuityMergeSeconds",
```

**Step 3: Add frontend type**

Edit `frontend/src/types/config.ts`:

```typescript
export interface TimelineConfig {
  minActivityDurationSeconds: number;
  titleDisplay: 'full' | 'app_only' | 'minimal';
  groupByApp: boolean;
  continuityMergeSeconds: number; // 0=off, 30/60/120 for thresholds
}
```

**Step 4: Verify builds**

Run: `go build -o /dev/null . && cd frontend && npm run build`
Expected: Both succeed

**Step 5: Commit**

```bash
git add internal/service/config.go frontend/src/types/config.ts
git commit -m "feat(timeline): add continuity merge config field

Add config for merging activities interrupted by brief switches.
Allows configuring gap threshold (0/30/60/120 seconds).

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Implement Continuity Merging Logic

**Files:**
- Modify: `internal/service/timeline_grid_grouping.go`
- Modify: `internal/service/timeline_grid.go:220-270`
- Modify: `app.go:563-580`

**Step 1: Add merge function**

Edit `internal/service/timeline_grid_grouping.go`, add new function:

```go
// MergeActivityContinuity merges activities from the same app that are interrupted
// by brief switches to other apps (under gapThreshold seconds).
// Example: VS Code (5m) → Slack (10s) → VS Code (10m) becomes VS Code (15m)
func MergeActivityContinuity(events []*storage.WindowFocusEvent, gapThreshold int) []*storage.WindowFocusEvent {
	if len(events) == 0 || gapThreshold == 0 {
		return events
	}

	merged := make([]*storage.WindowFocusEvent, 0, len(events))
	skipNext := make(map[int]bool)

	for i := 0; i < len(events); i++ {
		if skipNext[i] {
			continue
		}

		current := events[i]

		// Look ahead for continuity: same app within gapThreshold
		for j := i + 1; j < len(events); j++ {
			if events[j].AppName == current.AppName {
				// Calculate gap between current end and future start
				gap := events[j].StartTime - current.EndTime

				if gap <= int64(gapThreshold) {
					// Merge: extend current to include future event
					current.EndTime = events[j].EndTime
					current.DurationSeconds = float64(current.EndTime - current.StartTime)
					skipNext[j] = true

					// Mark intervening events as skipped (they're "absorbed")
					for k := i + 1; k < j; k++ {
						skipNext[k] = true
					}
				} else {
					break // Gap too large, stop looking
				}
			}
		}

		merged = append(merged, current)
	}

	return merged
}
```

**Step 2: Integrate into timeline grid**

Edit `internal/service/timeline_grid.go`, update GetTimelineGridDataWithOptions signature:

```go
func (s *TimelineService) GetTimelineGridDataWithOptions(date string, minDurationSeconds int, groupByApp bool, continuityMergeSeconds int) (*TimelineGridData, error) {
```

Add call after noise filter, before grouping:

```go
// Apply continuity merging if enabled (must happen BEFORE grouping)
if continuityMergeSeconds > 0 {
	focusEvents = MergeActivityContinuity(focusEvents, continuityMergeSeconds)
}

// Apply app grouping if enabled
if groupByApp {
	focusEvents = GroupActivitiesByApp(focusEvents)
}
```

**Step 3: Update app.go**

Edit `app.go`, update to pass continuityMergeSeconds:

```go
// Get timeline settings from config
minDuration := 0
groupByApp := false
continuityMerge := 0
if a.Config != nil {
	if config, err := a.Config.GetConfig(); err == nil && config.Timeline != nil {
		minDuration = config.Timeline.MinActivityDurationSeconds
		groupByApp = config.Timeline.GroupByApp
		continuityMerge = config.Timeline.ContinuityMergeSeconds
	}
}

return a.Timeline.GetTimelineGridDataWithOptions(date, minDuration, groupByApp, continuityMerge)
```

Update deprecated wrapper:

```go
func (s *TimelineService) GetTimelineGridData(date string) (*TimelineGridData, error) {
	return s.GetTimelineGridDataWithOptions(date, 0, false, 0)
}
```

**Step 4: Build and test**

Run: `go build -o /dev/null .`
Expected: Success

**Step 5: Commit**

```bash
git add internal/service/timeline_grid_grouping.go internal/service/timeline_grid.go app.go
git commit -m "feat(timeline): implement activity continuity merging

Merge activities interrupted by brief switches. Example:
VS Code (5m) → Slack (10s) → VS Code (10m) = VS Code (15m)

Applied before app grouping to preserve logical continuity.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add Continuity Merging UI Control

**Files:**
- Modify: `frontend/src/components/settings/sections/GeneralSettings.tsx:92-180`

**Step 1: Add UI control**

Edit `frontend/src/components/settings/sections/GeneralSettings.tsx`, add after groupByApp toggle:

```tsx
<SettingsRow
  label="Activity Continuity"
  description="Merge activities interrupted by brief context switches"
>
  <Select
    value={String(config.timeline?.continuityMergeSeconds || 0)}
    onValueChange={(value) =>
      updateConfig.mutate({
        timeline: {
          ...config.timeline,
          continuityMergeSeconds: parseInt(value, 10),
        },
      })
    }
  >
    <SelectTrigger className="w-32">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="0">Off</SelectItem>
      <SelectItem value="30">30 seconds</SelectItem>
      <SelectItem value="60">1 minute</SelectItem>
      <SelectItem value="120">2 minutes</SelectItem>
    </SelectContent>
  </Select>
</SettingsRow>
```

**Step 2: Add helper text**

After the select, add explanation:

```tsx
<div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
  <Clock className="h-4 w-4 mt-0.5 text-muted-foreground" />
  <p className="text-xs text-muted-foreground">
    When enabled, brief switches between apps are ignored and activities are merged.
    Example: VS Code (5m) → Slack (10s) → VS Code (10m) becomes VS Code (15m).
  </p>
</div>
```

**Step 3: Build frontend**

Run: `cd frontend && npm run build`
Expected: Success

**Step 4: Test end-to-end**

Run: `wails dev -tags webkit2_41`
Test scenario:
1. Go to Settings → Timeline
2. Set "Activity Continuity" to "1 minute"
3. Go to Timeline page
4. Look for patterns like: App A → Brief Switch → App A
5. Verify they're merged into single blocks

**Step 5: Commit**

```bash
git add frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "feat(timeline): add continuity merging UI control

Add dropdown to configure activity continuity threshold.
Helps reduce visual clutter from brief context switches.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4: Summary Lane

### Task 8: Add Summary Lane Config and Backend

**Files:**
- Modify: `internal/service/config.go:78-82`
- Create: `internal/service/timeline_summary_lane.go`
- Modify: `internal/service/timeline_grid.go:220-270`

**Step 1: Add config fields**

Edit `internal/service/config.go`:

```go
type TimelineConfig struct {
	MinActivityDurationSeconds int    `json:"minActivityDurationSeconds"`
	TitleDisplay               string `json:"titleDisplay"`
	GroupByApp                 bool   `json:"groupByApp"`
	ContinuityMergeSeconds     int    `json:"continuityMergeSeconds"`
	ShowSummaryLane            bool   `json:"showSummaryLane"`      // Show/hide summary lane
	SummaryChunkMinutes        int    `json:"summaryChunkMinutes"`  // 15, 30, 60
}
```

Update default:
```go
func (s *ConfigService) getDefaultTimelineConfig() *TimelineConfig {
	return &TimelineConfig{
		MinActivityDurationSeconds: 0,
		TitleDisplay:              "full",
		GroupByApp:                false,
		ContinuityMergeSeconds:    0,
		ShowSummaryLane:           false, // Default: off
		SummaryChunkMinutes:       15,
	}
}
```

**Step 2: Add persistence**

In `GetConfig()`:
```go
if val, err := s.store.GetConfig("timeline.showSummaryLane"); err == nil {
	config.Timeline.ShowSummaryLane = val == "true"
}
if val, err := s.store.GetConfig("timeline.summaryChunkMinutes"); err == nil {
	if v, e := strconv.Atoi(val); e == nil {
		config.Timeline.SummaryChunkMinutes = v
	}
}
```

In `mapToStorageKey()`:
```go
"timeline.showSummaryLane":     "timeline.showSummaryLane",
"timeline.summaryChunkMinutes": "timeline.summaryChunkMinutes",
```

**Step 3: Create summary lane logic**

Create `internal/service/timeline_summary_lane.go`:

```go
package service

import (
	"sort"
	"time"
	"traq/internal/storage"
)

// SummaryBlock represents a time chunk with its dominant activity.
type SummaryBlock struct {
	StartTime         int64   `json:"startTime"`
	EndTime           int64   `json:"endTime"`
	DominantApp       string  `json:"dominantApp"`
	DominantDuration  float64 `json:"dominantDuration"` // seconds in this app
	TotalDuration     float64 `json:"totalDuration"`    // total seconds in chunk
	ActivityCount     int     `json:"activityCount"`    // number of activities in chunk
	HourOffset        int     `json:"hourOffset"`
	MinuteOffset      int     `json:"minuteOffset"`
	PixelPosition     float64 `json:"pixelPosition"`
	PixelHeight       float64 `json:"pixelHeight"`
}

// GenerateSummaryLane creates time-chunked summary blocks showing dominant activity.
// chunkMinutes: 15, 30, or 60
func GenerateSummaryLane(events []*storage.WindowFocusEvent, date string, chunkMinutes int) []SummaryBlock {
	if len(events) == 0 {
		return nil
	}

	// Parse date to get day boundaries
	t, _ := time.ParseInLocation("2006-01-02", date, time.Local)
	dayStart := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.Local)
	dayEnd := dayStart.AddDate(0, 0, 1)

	chunkDuration := time.Duration(chunkMinutes) * time.Minute
	var summaries []SummaryBlock

	// Iterate through day in chunks
	for chunkStart := dayStart; chunkStart.Before(dayEnd); chunkStart = chunkStart.Add(chunkDuration) {
		chunkEnd := chunkStart.Add(chunkDuration)
		if chunkEnd.After(dayEnd) {
			chunkEnd = dayEnd
		}

		// Find activities in this chunk
		appDurations := make(map[string]float64)
		var totalDuration float64
		var activityCount int

		for _, event := range events {
			eventStart := time.Unix(event.StartTime, 0)
			eventEnd := time.Unix(event.EndTime, 0)

			// Calculate overlap with chunk
			overlapStart := maxTime(eventStart, chunkStart)
			overlapEnd := minTime(eventEnd, chunkEnd)

			if overlapStart.Before(overlapEnd) {
				overlap := overlapEnd.Sub(overlapStart).Seconds()
				appDurations[event.AppName] += overlap
				totalDuration += overlap
				activityCount++
			}
		}

		// Find dominant app
		var dominantApp string
		var dominantDuration float64
		for app, duration := range appDurations {
			if duration > dominantDuration {
				dominantApp = app
				dominantDuration = duration
			}
		}

		// Skip empty chunks
		if dominantApp == "" {
			continue
		}

		// Calculate positioning
		hour := chunkStart.Hour()
		minute := chunkStart.Minute()
		pixelPosition := (float64(minute) / 60.0) * 60.0
		pixelHeight := (float64(chunkMinutes) / 60.0) * 60.0

		summaries = append(summaries, SummaryBlock{
			StartTime:        chunkStart.Unix(),
			EndTime:          chunkEnd.Unix(),
			DominantApp:      dominantApp,
			DominantDuration: dominantDuration,
			TotalDuration:    totalDuration,
			ActivityCount:    activityCount,
			HourOffset:       hour,
			MinuteOffset:     minute,
			PixelPosition:    pixelPosition,
			PixelHeight:      pixelHeight,
		})
	}

	return summaries
}

func maxTime(a, b time.Time) time.Time {
	if a.After(b) {
		return a
	}
	return b
}

func minTime(a, b time.Time) time.Time {
	if a.Before(b) {
		return a
	}
	return b
}
```

**Step 4: Integrate into TimelineGridData**

Edit `internal/service/timeline_grid.go`, add to TimelineGridData struct:

```go
type TimelineGridData struct {
	// ... existing fields
	SummaryLane []SummaryBlock `json:"summaryLane"` // Time-chunked dominant activities
}
```

**Step 5: Generate summary lane in GetTimelineGridDataWithOptions**

After building the hourly grid (around line 400), add:

```go
// Generate summary lane if enabled
var summaryLane []SummaryBlock
// This will be controlled by config passed from app.go
// For now, leave empty - we'll wire it up next
```

**Step 6: Build**

Run: `go build -o /dev/null .`
Expected: Success

**Step 7: Commit**

```bash
git add internal/service/config.go internal/service/timeline_summary_lane.go internal/service/timeline_grid.go
git commit -m "feat(timeline): add summary lane backend logic

Generate time-chunked summary blocks showing dominant activity
per configurable chunk (15/30/60 minutes).

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Wire Summary Lane to API and Add UI

**Files:**
- Modify: `internal/service/timeline_grid.go:220-280`
- Modify: `app.go:563-585`
- Modify: `frontend/src/types/timeline.ts`
- Modify: `frontend/src/types/config.ts:12-18`
- Create: `frontend/src/components/timeline/SummaryLane.tsx`
- Modify: `frontend/src/components/timeline/TimelineGridView.tsx`

**Step 1: Update GetTimelineGridDataWithOptions signature**

Edit `internal/service/timeline_grid.go`:

```go
func (s *TimelineService) GetTimelineGridDataWithOptions(
	date string,
	minDurationSeconds int,
	groupByApp bool,
	continuityMergeSeconds int,
	showSummaryLane bool,
	summaryChunkMinutes int,
) (*TimelineGridData, error) {
```

Add summary generation before return:

```go
// Generate summary lane if enabled
var summaryLane []SummaryBlock
if showSummaryLane {
	summaryLane = GenerateSummaryLane(focusEvents, date, summaryChunkMinutes)
}

return &TimelineGridData{
	// ... existing fields
	SummaryLane: summaryLane,
}, nil
```

**Step 2: Update app.go**

Edit `app.go`:

```go
// Get timeline settings from config
minDuration := 0
groupByApp := false
continuityMerge := 0
showSummary := false
summaryChunk := 15
if a.Config != nil {
	if config, err := a.Config.GetConfig(); err == nil && config.Timeline != nil {
		minDuration = config.Timeline.MinActivityDurationSeconds
		groupByApp = config.Timeline.GroupByApp
		continuityMerge = config.Timeline.ContinuityMergeSeconds
		showSummary = config.Timeline.ShowSummaryLane
		summaryChunk = config.Timeline.SummaryChunkMinutes
	}
}

return a.Timeline.GetTimelineGridDataWithOptions(date, minDuration, groupByApp, continuityMerge, showSummary, summaryChunk)
```

Update wrapper:

```go
func (s *TimelineService) GetTimelineGridData(date string) (*TimelineGridData, error) {
	return s.GetTimelineGridDataWithOptions(date, 0, false, 0, false, 15)
}
```

**Step 3: Add frontend types**

Edit `frontend/src/types/config.ts`:

```typescript
export interface TimelineConfig {
  minActivityDurationSeconds: number;
  titleDisplay: 'full' | 'app_only' | 'minimal';
  groupByApp: boolean;
  continuityMergeSeconds: number;
  showSummaryLane: boolean;
  summaryChunkMinutes: number; // 15, 30, 60
}
```

Edit `frontend/src/types/timeline.ts`, add to TimelineGridData:

```typescript
export interface TimelineGridData {
  // ... existing fields
  summaryLane?: SummaryBlock[];
}

export interface SummaryBlock {
  startTime: number;
  endTime: number;
  dominantApp: string;
  dominantDuration: number;
  totalDuration: number;
  activityCount: number;
  hourOffset: number;
  minuteOffset: number;
  pixelPosition: number;
  pixelHeight: number;
}
```

**Step 4: Create SummaryLane component**

Create `frontend/src/components/timeline/SummaryLane.tsx`:

```typescript
import React from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GRID_CONSTANTS, SummaryBlock } from '@/types/timeline';

interface SummaryLaneProps {
  summaries: SummaryBlock[];
  hours: number[];
  hourHeight: number;
}

export const SummaryLane: React.FC<SummaryLaneProps> = ({
  summaries,
  hours,
  hourHeight,
}) => {
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-blue-500 flex items-center justify-center flex-shrink-0">
            <Clock className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground">Summary</span>
        </div>
      </div>

      {/* Hour grid background */}
      <div className="relative bg-card">
        {hours.map((hour, index) => (
          <div
            key={hour}
            className={`relative border-b border-border ${
              index % 2 === 0 ? 'bg-card' : 'bg-muted/30'
            }`}
            style={{ height: `${hourHeight}px` }}
          />
        ))}

        {/* Summary blocks */}
        <div className="absolute inset-0">
          {summaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-2">
              <Clock className="w-6 h-6 mb-2 opacity-30" />
              <span className="text-[10px] text-center">
                No activity to summarize
              </span>
            </div>
          ) : (
            summaries.map((summary, index) => (
              <div
                key={`${summary.startTime}-${index}`}
                className="absolute inset-x-0 px-1 cursor-pointer hover:bg-muted/20 transition-colors"
                style={{
                  top: `${summary.pixelPosition + summary.hourOffset * hourHeight}px`,
                  height: `${summary.pixelHeight}px`,
                }}
              >
                <div className="h-full border-l-2 border-blue-500 bg-blue-500/10 rounded-sm px-2 py-1 flex flex-col justify-center">
                  <div className="text-xs font-medium text-foreground truncate">
                    {summary.dominantApp}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{formatDuration(summary.dominantDuration)}</span>
                    {summary.activityCount > 1 && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1">
                        {summary.activityCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
```

**Step 5: Integrate into TimelineGridView**

Edit `frontend/src/components/timeline/TimelineGridView.tsx`, import and add summary lane:

```typescript
import { SummaryLane } from './SummaryLane';

// In the render, after time column, conditionally render summary lane:
{data.summaryLane && data.summaryLane.length > 0 && (
  <SummaryLane
    summaries={data.summaryLane}
    hours={hours}
    hourHeight={hourHeight}
  />
)}
```

**Step 6: Add settings UI**

Edit `frontend/src/components/settings/sections/GeneralSettings.tsx`:

```tsx
<SettingsRow
  label="Summary Lane"
  description="Show a condensed view with dominant activity per time chunk"
>
  <Switch
    checked={config.timeline?.showSummaryLane ?? false}
    onCheckedChange={(showSummaryLane) =>
      updateConfig.mutate({
        timeline: {
          ...config.timeline,
          showSummaryLane,
        },
      })
    }
  />
</SettingsRow>

{config.timeline?.showSummaryLane && (
  <SettingsRow
    label="Summary Chunk Size"
    description="Time period for each summary block"
  >
    <Select
      value={String(config.timeline?.summaryChunkMinutes || 15)}
      onValueChange={(value) =>
        updateConfig.mutate({
          timeline: {
            ...config.timeline,
            summaryChunkMinutes: parseInt(value, 10),
          },
        })
      }
    >
      <SelectTrigger className="w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="15">15 minutes</SelectItem>
        <SelectItem value="30">30 minutes</SelectItem>
        <SelectItem value="60">1 hour</SelectItem>
      </SelectContent>
    </Select>
  </SettingsRow>
)}
```

**Step 7: Build and test**

Run: `go build . && cd frontend && npm run build`
Expected: Both succeed

Run: `wails dev -tags webkit2_41`
Test:
1. Go to Settings → Timeline
2. Enable "Summary Lane"
3. Set chunk size to "30 minutes"
4. Navigate to Timeline
5. Verify new Summary column appears showing dominant app per 30min chunk

**Step 8: Commit**

```bash
git add internal/service/timeline_grid.go app.go frontend/src/types/config.ts frontend/src/types/timeline.ts frontend/src/components/timeline/SummaryLane.tsx frontend/src/components/timeline/TimelineGridView.tsx frontend/src/components/settings/sections/GeneralSettings.tsx
git commit -m "feat(timeline): add summary lane feature

Add configurable summary lane showing dominant activity per time
chunk (15/30/60 min). Reduces cognitive load for quick daily review.

Inspired by Timely's summary lane feature.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5: Entries Lane Improvements

### Task 10: Add Drag-to-Assign for Project Assignment

**Files:**
- Create: `frontend/src/hooks/useDragToAssign.ts`
- Modify: `frontend/src/components/timeline/ActivityBlock.tsx`
- Modify: `frontend/src/components/timeline/EntriesColumn.tsx`
- Modify: `frontend/src/api/hooks.ts` (add mutation for assigning activities)

**Step 1: Check if project assignment mutations exist**

Run: `grep -n "AssignActivity\|SetActivityProject" frontend/src/api/hooks.ts`
Expected: Check if these mutations already exist

If not found, we'll need to create them first. This requires backend support which may already exist from the projects feature.

**Step 2: Add drag-to-assign hook**

Create `frontend/src/hooks/useDragToAssign.ts`:

```typescript
import { useState, useCallback } from 'react';

export interface DragItem {
  type: 'activity' | 'entry';
  id: number;
  appName: string;
}

export function useDragToAssign() {
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null); // projectId

  const handleDragStart = useCallback((item: DragItem) => {
    setDraggedItem(item);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((projectId: number) => {
    setDropTarget(projectId);
  }, []);

  const handleDrop = useCallback(
    (projectId: number): DragItem | null => {
      const item = draggedItem;
      setDraggedItem(null);
      setDropTarget(null);
      return item;
    },
    [draggedItem]
  );

  return {
    draggedItem,
    dropTarget,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
  };
}
```

**Step 3: Make ActivityBlock draggable**

Edit `frontend/src/components/timeline/ActivityBlock.tsx`:

Add to component props:
```typescript
interface ActivityBlockProps {
  // ... existing props
  onDragStart?: (item: DragItem) => void;
  isDragging?: boolean;
}
```

Add draggable attributes:
```typescript
<div
  draggable={!!onDragStart}
  onDragStart={() => {
    if (onDragStart) {
      onDragStart({
        type: 'activity',
        id: activity.id,
        appName: activity.appName,
      });
    }
  }}
  className={cn(
    "absolute inset-x-0 px-1 cursor-pointer",
    isDragging && "opacity-50"
  )}
  // ... rest of attributes
>
```

**Step 4: Make EntriesColumn a drop target**

Edit `frontend/src/components/timeline/EntriesColumn.tsx`:

Add to props:
```typescript
interface EntriesColumnProps {
  // ... existing props
  onDrop?: (item: DragItem, projectId: number) => void;
  isDropTarget?: boolean;
}
```

Add drop zone overlay:
```typescript
{isDropTarget && (
  <div className="absolute inset-0 bg-emerald-500/20 border-2 border-emerald-500 pointer-events-none z-20 rounded" />
)}
```

Add drag event handlers to column div:
```typescript
<div
  onDragOver={(e) => {
    e.preventDefault();
    // Signal this is a valid drop target
  }}
  onDrop={(e) => {
    e.preventDefault();
    if (onDrop) {
      // For now, we'll need a way to determine which project
      // This might require showing project selection on drop
    }
  }}
>
```

**Step 5: Wire up in TimelineGridView**

Edit `frontend/src/components/timeline/TimelineGridView.tsx`:

```typescript
import { useDragToAssign } from '@/hooks/useDragToAssign';

// In component:
const dragToAssign = useDragToAssign();

// Pass to ActivityBlock:
<ActivityBlock
  onDragStart={dragToAssign.handleDragStart}
  isDragging={draggedItem?.id === activity.id}
/>

// Pass to EntriesColumn:
<EntriesColumn
  onDrop={(item) => {
    // Show project picker dialog
    // Then assign item.id to selected project
  }}
  isDropTarget={!!dragToAssign.draggedItem}
/>
```

**Step 6: Note - incomplete**

This task requires project selection UI and backend mutation. Document what's needed:

```markdown
### TODO: Complete Drag-to-Assign
- [ ] Add project selection dialog on drop
- [ ] Create `useAssignActivityToProject` mutation hook
- [ ] Wire up actual assignment API call
- [ ] Add success/error toasts
- [ ] Refresh timeline data after assignment
```

**Step 7: Commit partial work**

```bash
git add frontend/src/hooks/useDragToAssign.ts frontend/src/components/timeline/ActivityBlock.tsx frontend/src/components/timeline/EntriesColumn.tsx
git commit -m "feat(entries): add drag-to-assign foundation

Add drag-and-drop infrastructure for assigning activities to projects.
Requires project picker dialog and API integration to complete.

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## Implementation Notes

### Testing Strategy

For each completed phase:
1. Manual testing in `wails dev` environment
2. Verify config persistence (set value, restart app, check it's still set)
3. Test edge cases (empty timeline, all day in one app, etc.)
4. Check for visual regressions in existing features

### Performance Considerations

- Summary lane generation is O(n) where n = events
- Continuity merging is O(n²) worst case but typically O(n)
- App grouping is O(n)
- All operations happen server-side, minimal frontend impact

### Future Enhancements

**Not in this plan:**
- AI Draft Lane (requires significant ML infrastructure)
- Advanced filtering UI (multiple filters combined)
- Export timeline views as images
- Timeline templates/presets

These can be separate plans once core features are stable.

---

## Execution Strategy

**Recommended approach:** Subagent-driven development

Each task is independent enough to be delegated to a fresh subagent:
- Task 1-2: Title Display (30 min)
- Task 3-4: App Grouping (45 min)
- Task 5-7: Continuity Merging (1 hour)
- Task 8-9: Summary Lane (1.5 hours)
- Task 10: Drag-to-Assign foundation (30 min)

Total estimated time: ~4.5 hours

Between each task, review the implementation and commit before proceeding.
