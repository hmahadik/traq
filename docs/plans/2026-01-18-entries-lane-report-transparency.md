# Entries Lane + Report Transparency Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated "Entries" lane to the timeline showing project-assigned activities, with visual distinction between assigned/unassigned, and configurable report filtering.

**Architecture:** Leverage existing project assignment infrastructure (migration 9). Add memory_status for ignore functionality. Create EntriesColumn following existing column patterns (AppColumn, GitColumn). Backfill service applies patterns to historical data.

**Tech Stack:** Go backend with SQLite, React + TypeScript frontend with React Query, Wails bindings.

---

## Phase 1: Database Migration

### Task 1: Add Migration 10 for Memory Status

**Files:**
- Modify: `/internal/storage/migrations.go` (add migration 10 to migrations slice)

**Step 1: Write the failing test**

No separate test file needed - migration tests run via schema version check.

**Step 2: Add migration 10 to migrations slice**

```go
// Add to migrations slice after migration 9
{
    ID:   10,
    Name: "add_memory_status_and_report_config",
    Up: `
        ALTER TABLE window_focus_events ADD COLUMN memory_status TEXT NOT NULL DEFAULT 'active';
        CREATE INDEX idx_focus_memory_status ON window_focus_events(memory_status);

        ALTER TABLE screenshots ADD COLUMN memory_status TEXT NOT NULL DEFAULT 'active';
        CREATE INDEX idx_screenshot_memory_status ON screenshots(memory_status);

        INSERT OR IGNORE INTO config (key, value) VALUES ('reports.include_unassigned', 'true');
    `,
    Down: `
        -- SQLite doesn't support DROP COLUMN easily, would need table recreation
        DELETE FROM config WHERE key = 'reports.include_unassigned';
    `,
},
```

**Step 3: Verify migration runs**

Run: `wails dev -tags webkit2_41`
Expected: App starts, check logs for "Migrating to version 10"

**Step 4: Verify schema**

Run: `sqlite3 ~/.local/share/traq/traq.db ".schema window_focus_events" | grep memory_status`
Expected: `memory_status TEXT NOT NULL DEFAULT 'active'`

**Step 5: Commit**

```bash
git add internal/storage/migrations.go
git commit -m "feat(db): add migration 10 for memory_status and report config"
```

---

## Phase 2: Storage Layer - Memory Status Methods

### Task 2: Add Memory Status Storage Methods

**Files:**
- Modify: `/internal/storage/focus.go` (add status methods)

**Step 2.1: Add SetFocusEventStatus method**

Add after existing `DeleteFocusEvents` method:

```go
// SetFocusEventStatus updates the memory status of a focus event
// Valid statuses: 'active', 'ignored'
func (s *Store) SetFocusEventStatus(id int64, status string) error {
    if status != "active" && status != "ignored" {
        return fmt.Errorf("invalid status: %s", status)
    }
    _, err := s.db.Exec(
        "UPDATE window_focus_events SET memory_status = ? WHERE id = ?",
        status, id,
    )
    return err
}

// SetFocusEventsStatus updates status for multiple focus events
func (s *Store) SetFocusEventsStatus(ids []int64, status string) error {
    if status != "active" && status != "ignored" {
        return fmt.Errorf("invalid status: %s", status)
    }
    if len(ids) == 0 {
        return nil
    }

    placeholders := make([]string, len(ids))
    args := make([]interface{}, len(ids)+1)
    args[0] = status
    for i, id := range ids {
        placeholders[i] = "?"
        args[i+1] = id
    }

    query := fmt.Sprintf(
        "UPDATE window_focus_events SET memory_status = ? WHERE id IN (%s)",
        strings.Join(placeholders, ","),
    )
    _, err := s.db.Exec(query, args...)
    return err
}
```

**Step 2.2: Add GetActiveFocusEvents method**

```go
// GetActiveFocusEventsByTimeRange returns focus events excluding ignored ones
func (s *Store) GetActiveFocusEventsByTimeRange(startTime, endTime int64) ([]WindowFocusEvent, error) {
    rows, err := s.db.Query(`
        SELECT id, window_title, app_name, window_class, start_time, end_time,
               duration_seconds, session_id, project_id, project_confidence, project_source
        FROM window_focus_events
        WHERE start_time < ? AND end_time > ?
          AND memory_status = 'active'
        ORDER BY start_time
    `, endTime, startTime)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    var events []WindowFocusEvent
    for rows.Next() {
        var e WindowFocusEvent
        err := rows.Scan(
            &e.ID, &e.WindowTitle, &e.AppName, &e.WindowClass,
            &e.StartTime, &e.EndTime, &e.DurationSeconds, &e.SessionID,
            &e.ProjectID, &e.ProjectConfidence, &e.ProjectSource,
        )
        if err != nil {
            return nil, err
        }
        events = append(events, e)
    }
    return events, rows.Err()
}
```

**Step 2.3: Verify compilation**

Run: `cd /home/harshad/projects/traq && go build ./...`
Expected: Build succeeds

**Step 2.4: Commit**

```bash
git add internal/storage/focus.go
git commit -m "feat(storage): add memory status methods for focus events"
```

---

### Task 3: Add Screenshot Memory Status Methods

**Files:**
- Modify: `/internal/storage/screenshots.go`

**Step 3.1: Add status methods**

```go
// SetScreenshotStatus updates the memory status of a screenshot
func (s *Store) SetScreenshotStatus(id int64, status string) error {
    if status != "active" && status != "ignored" {
        return fmt.Errorf("invalid status: %s", status)
    }
    _, err := s.db.Exec(
        "UPDATE screenshots SET memory_status = ? WHERE id = ?",
        status, id,
    )
    return err
}

// SetScreenshotsStatus updates status for multiple screenshots
func (s *Store) SetScreenshotsStatus(ids []int64, status string) error {
    if status != "active" && status != "ignored" {
        return fmt.Errorf("invalid status: %s", status)
    }
    if len(ids) == 0 {
        return nil
    }

    placeholders := make([]string, len(ids))
    args := make([]interface{}, len(ids)+1)
    args[0] = status
    for i, id := range ids {
        placeholders[i] = "?"
        args[i+1] = id
    }

    query := fmt.Sprintf(
        "UPDATE screenshots SET memory_status = ? WHERE id IN (%s)",
        strings.Join(placeholders, ","),
    )
    _, err := s.db.Exec(query, args...)
    return err
}
```

**Step 3.2: Verify compilation**

Run: `go build ./...`
Expected: Build succeeds

**Step 3.3: Commit**

```bash
git add internal/storage/screenshots.go
git commit -m "feat(storage): add memory status methods for screenshots"
```

---

## Phase 3: Service Layer - Entries Data

### Task 4: Create Entry Block Type and Service Method

**Files:**
- Modify: `/internal/service/timeline.go` (add EntryBlock type and GetEntriesForDate)

**Step 4.1: Add EntryBlock type**

Add after existing types (around line 30):

```go
// EntryBlock represents an activity with project assignment for the Entries lane
type EntryBlock struct {
    ID              int64   `json:"id"`
    EventType       string  `json:"eventType"` // 'focus' or 'screenshot'
    ProjectID       int64   `json:"projectId"`
    ProjectName     string  `json:"projectName"`
    ProjectColor    string  `json:"projectColor"`
    AppName         string  `json:"appName"`
    WindowTitle     string  `json:"windowTitle"`
    StartTime       int64   `json:"startTime"`
    EndTime         int64   `json:"endTime"`
    DurationSeconds float64 `json:"durationSeconds"`
    Confidence      float64 `json:"confidence"`
    Source          string  `json:"source"` // 'user', 'rule', 'ai'
}
```

**Step 4.2: Add GetEntriesForDate method**

```go
// GetEntriesForDate returns project-assigned activities for the Entries lane
func (s *TimelineService) GetEntriesForDate(date string) ([]EntryBlock, error) {
    // Parse date to get time range
    loc := time.Local
    t, err := time.ParseInLocation("2006-01-02", date, loc)
    if err != nil {
        return nil, err
    }
    startOfDay := t.Unix()
    endOfDay := t.Add(24 * time.Hour).Unix()

    // Get all projects for name/color lookup
    projects, err := s.store.GetProjects()
    if err != nil {
        return nil, err
    }
    projectMap := make(map[int64]*storage.Project)
    for i := range projects {
        projectMap[projects[i].ID] = &projects[i]
    }

    // Get focus events with projects
    focusEvents, err := s.store.GetActiveFocusEventsByTimeRange(startOfDay, endOfDay)
    if err != nil {
        return nil, err
    }

    var entries []EntryBlock
    for _, fe := range focusEvents {
        if !fe.ProjectID.Valid || fe.ProjectID.Int64 == 0 {
            continue // Skip unassigned
        }

        proj := projectMap[fe.ProjectID.Int64]
        projectName := "Unknown"
        projectColor := "#888888"
        if proj != nil {
            projectName = proj.Name
            projectColor = proj.Color.String
        }

        confidence := 0.0
        if fe.ProjectConfidence.Valid {
            confidence = fe.ProjectConfidence.Float64
        }
        source := "user"
        if fe.ProjectSource.Valid {
            source = fe.ProjectSource.String
        }

        entries = append(entries, EntryBlock{
            ID:              fe.ID,
            EventType:       "focus",
            ProjectID:       fe.ProjectID.Int64,
            ProjectName:     projectName,
            ProjectColor:    projectColor,
            AppName:         GetFriendlyAppName(fe.AppName.String),
            WindowTitle:     fe.WindowTitle.String,
            StartTime:       fe.StartTime,
            EndTime:         fe.EndTime,
            DurationSeconds: fe.DurationSeconds,
            Confidence:      confidence,
            Source:          source,
        })
    }

    // Sort by start time
    sort.Slice(entries, func(i, j int) bool {
        return entries[i].StartTime < entries[j].StartTime
    })

    return entries, nil
}
```

**Step 4.3: Verify compilation**

Run: `go build ./...`
Expected: Build succeeds

**Step 4.4: Commit**

```bash
git add internal/service/timeline.go
git commit -m "feat(service): add EntryBlock type and GetEntriesForDate method"
```

---

## Phase 4: Backfill Service

### Task 5: Create Backfill Service

**Files:**
- Create: `/internal/service/backfill.go`

**Step 5.1: Create backfill service file**

```go
package service

import (
    "time"
    "traq/internal/storage"
)

// BackfillService handles applying project patterns to historical data
type BackfillService struct {
    store    *storage.Store
    projects *ProjectAssignmentService
}

// NewBackfillService creates a new BackfillService
func NewBackfillService(store *storage.Store, projects *ProjectAssignmentService) *BackfillService {
    return &BackfillService{
        store:    store,
        projects: projects,
    }
}

// BackfillResult contains statistics from a backfill operation
type BackfillResult struct {
    TotalProcessed   int `json:"totalProcessed"`
    AutoAssigned     int `json:"autoAssigned"`
    AlreadyAssigned  int `json:"alreadyAssigned"`
    NoMatch          int `json:"noMatch"`
}

// BackfillProjects applies project patterns to unassigned activities in date range
func (s *BackfillService) BackfillProjects(startDate, endDate string, minConfidence float64) (*BackfillResult, error) {
    return s.processBackfill(startDate, endDate, minConfidence, true)
}

// PreviewBackfill shows what would be assigned without committing
func (s *BackfillService) PreviewBackfill(startDate, endDate string, minConfidence float64) (*BackfillResult, error) {
    return s.processBackfill(startDate, endDate, minConfidence, false)
}

func (s *BackfillService) processBackfill(startDate, endDate string, minConfidence float64, commit bool) (*BackfillResult, error) {
    loc := time.Local

    start, err := time.ParseInLocation("2006-01-02", startDate, loc)
    if err != nil {
        return nil, err
    }
    end, err := time.ParseInLocation("2006-01-02", endDate, loc)
    if err != nil {
        return nil, err
    }
    // Include the entire end date
    end = end.Add(24 * time.Hour)

    startUnix := start.Unix()
    endUnix := end.Unix()

    // Get all focus events in range
    events, err := s.store.GetFocusEventsByTimeRange(startUnix, endUnix)
    if err != nil {
        return nil, err
    }

    result := &BackfillResult{
        TotalProcessed: len(events),
    }

    for _, event := range events {
        // Skip already assigned
        if event.ProjectID.Valid && event.ProjectID.Int64 != 0 {
            result.AlreadyAssigned++
            continue
        }

        // Build context for pattern matching
        ctx := AssignmentContext{
            AppName:     event.AppName.String,
            WindowTitle: event.WindowTitle.String,
        }

        // Try to match patterns
        match := s.projects.SuggestProjectFromContext(ctx)
        if match == nil || match.Confidence < minConfidence {
            result.NoMatch++
            continue
        }

        // Assign if committing
        if commit {
            err := s.store.SetEventProject("focus", event.ID, match.ProjectID, match.Confidence, "rule")
            if err != nil {
                // Log but continue
                continue
            }
        }
        result.AutoAssigned++
    }

    return result, nil
}
```

**Step 5.2: Add import for fmt if needed and verify compilation**

Run: `go build ./...`
Expected: Build succeeds

**Step 5.3: Commit**

```bash
git add internal/service/backfill.go
git commit -m "feat(service): add backfill service for historical project assignment"
```

---

## Phase 5: API Bindings

### Task 6: Add Wails Bindings for Entries and Backfill

**Files:**
- Modify: `/app.go`

**Step 6.1: Add BackfillService field to App struct**

Find the App struct and add:

```go
backfillService *service.BackfillService
```

**Step 6.2: Initialize BackfillService in NewApp or startup**

Find where services are initialized (likely in `startup` method) and add:

```go
a.backfillService = service.NewBackfillService(a.store, a.projectService)
```

**Step 6.3: Add API binding methods**

Add these methods to the App struct (near other project-related bindings):

```go
// GetEntriesForDate returns project-assigned activities for the Entries lane
func (a *App) GetEntriesForDate(date string) ([]service.EntryBlock, error) {
    return a.timelineService.GetEntriesForDate(date)
}

// BackfillProjects applies project patterns to historical unassigned activities
func (a *App) BackfillProjects(startDate, endDate string, minConfidence float64) (*service.BackfillResult, error) {
    return a.backfillService.BackfillProjects(startDate, endDate, minConfidence)
}

// PreviewBackfill shows what would be assigned without committing
func (a *App) PreviewBackfill(startDate, endDate string, minConfidence float64) (*service.BackfillResult, error) {
    return a.backfillService.PreviewBackfill(startDate, endDate, minConfidence)
}

// IgnoreActivities marks activities as ignored (hidden from view)
func (a *App) IgnoreActivities(eventType string, ids []int64) error {
    if eventType == "focus" {
        return a.store.SetFocusEventsStatus(ids, "ignored")
    } else if eventType == "screenshot" {
        return a.store.SetScreenshotsStatus(ids, "ignored")
    }
    return fmt.Errorf("unknown event type: %s", eventType)
}

// UnignoreActivities restores ignored activities to active
func (a *App) UnignoreActivities(eventType string, ids []int64) error {
    if eventType == "focus" {
        return a.store.SetFocusEventsStatus(ids, "active")
    } else if eventType == "screenshot" {
        return a.store.SetScreenshotsStatus(ids, "active")
    }
    return fmt.Errorf("unknown event type: %s", eventType)
}

// GetReportIncludeUnassigned returns the report config setting
func (a *App) GetReportIncludeUnassigned() (bool, error) {
    val, err := a.store.GetConfig("reports.include_unassigned")
    if err != nil {
        return true, nil // Default to true
    }
    return val == "true", nil
}

// SetReportIncludeUnassigned updates the report config setting
func (a *App) SetReportIncludeUnassigned(include bool) error {
    val := "false"
    if include {
        val = "true"
    }
    return a.store.SetConfig("reports.include_unassigned", val)
}
```

**Step 6.4: Verify compilation**

Run: `go build ./...`
Expected: Build succeeds

**Step 6.5: Regenerate Wails bindings**

Run: `wails generate bindings`
Expected: TypeScript bindings generated in frontend/wailsjs/

**Step 6.6: Commit**

```bash
git add app.go frontend/wailsjs/
git commit -m "feat(api): add entries, backfill, and memory status bindings"
```

---

## Phase 6: Frontend API Client

### Task 7: Add Frontend API Methods

**Files:**
- Modify: `/frontend/src/api/client.ts`

**Step 7.1: Add entries and backfill methods**

Find the `api` object and add these sections:

```typescript
entries: {
  getForDate: (date: string) => GetEntriesForDate(date),
},
backfill: {
  preview: (startDate: string, endDate: string, minConfidence: number) =>
    PreviewBackfill(startDate, endDate, minConfidence),
  run: (startDate: string, endDate: string, minConfidence: number) =>
    BackfillProjects(startDate, endDate, minConfidence),
},
activities: {
  // Add to existing activities section or create if doesn't exist
  ignore: (eventType: string, ids: number[]) => IgnoreActivities(eventType, ids),
  unignore: (eventType: string, ids: number[]) => UnignoreActivities(eventType, ids),
},
reportConfig: {
  getIncludeUnassigned: () => GetReportIncludeUnassigned(),
  setIncludeUnassigned: (include: boolean) => SetReportIncludeUnassigned(include),
},
```

**Step 7.2: Add imports for new Wails bindings**

Add to imports at top of file:

```typescript
import {
  GetEntriesForDate,
  PreviewBackfill,
  BackfillProjects,
  IgnoreActivities,
  UnignoreActivities,
  GetReportIncludeUnassigned,
  SetReportIncludeUnassigned,
} from '@wailsjs/go/main/App';
```

**Step 7.3: Verify TypeScript compilation**

Run: `cd frontend && npm run build`
Expected: Build succeeds (may have type errors from missing hooks, that's OK for now)

**Step 7.4: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat(frontend): add API client methods for entries and backfill"
```

---

### Task 8: Add React Query Hooks

**Files:**
- Modify: `/frontend/src/api/hooks.ts`

**Step 8.1: Add query keys**

Find the `queryKeys` object and add:

```typescript
entries: {
  all: ['entries'] as const,
  forDate: (date: string) => [...queryKeys.entries.all, date] as const,
},
backfill: {
  all: ['backfill'] as const,
},
reportConfig: {
  all: ['reportConfig'] as const,
  includeUnassigned: () => [...queryKeys.reportConfig.all, 'includeUnassigned'] as const,
},
```

**Step 8.2: Add hooks**

```typescript
// Entries hooks
export function useEntriesForDate(date: string) {
  return useQuery({
    queryKey: queryKeys.entries.forDate(date),
    queryFn: () => api.entries.getForDate(date),
    enabled: !!date,
  });
}

// Backfill hooks
export function useBackfillPreview() {
  return useMutation({
    mutationFn: ({ startDate, endDate, minConfidence }: {
      startDate: string;
      endDate: string;
      minConfidence: number
    }) => api.backfill.preview(startDate, endDate, minConfidence),
  });
}

export function useBackfillRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ startDate, endDate, minConfidence }: {
      startDate: string;
      endDate: string;
      minConfidence: number
    }) => api.backfill.run(startDate, endDate, minConfidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline.all });
    },
  });
}

// Activity ignore/unignore hooks
export function useIgnoreActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventType, ids }: { eventType: string; ids: number[] }) =>
      api.activities.ignore(eventType, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline.all });
    },
  });
}

export function useUnignoreActivities() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventType, ids }: { eventType: string; ids: number[] }) =>
      api.activities.unignore(eventType, ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entries.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline.all });
    },
  });
}

// Report config hooks
export function useReportIncludeUnassigned() {
  return useQuery({
    queryKey: queryKeys.reportConfig.includeUnassigned(),
    queryFn: () => api.reportConfig.getIncludeUnassigned(),
  });
}

export function useSetReportIncludeUnassigned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (include: boolean) => api.reportConfig.setIncludeUnassigned(include),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reportConfig.all });
    },
  });
}
```

**Step 8.3: Verify TypeScript compilation**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 8.4: Commit**

```bash
git add frontend/src/api/hooks.ts
git commit -m "feat(frontend): add React Query hooks for entries and backfill"
```

---

## Phase 7: Frontend UI - Entries Column

### Task 9: Create EntryBlock Component

**Files:**
- Create: `/frontend/src/components/timeline/EntryBlock.tsx`

**Step 9.1: Create EntryBlock component**

```typescript
import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle } from 'lucide-react';
import { GRID_CONSTANTS } from '@/types/timeline';

interface EntryBlockData {
  id: number;
  eventType: string;
  projectId: number;
  projectName: string;
  projectColor: string;
  appName: string;
  windowTitle: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  confidence: number;
  source: string;
}

interface EntryBlockProps {
  entry: EntryBlockData;
  hourHeight: number;
  onClick?: (entry: EntryBlockData) => void;
  onContextMenu?: (entry: EntryBlockData, e: React.MouseEvent) => void;
}

export const EntryBlock: React.FC<EntryBlockProps> = ({
  entry,
  hourHeight,
  onClick,
  onContextMenu,
}) => {
  // Calculate position based on time
  const startDate = new Date(entry.startTime * 1000);
  const startHour = startDate.getHours();
  const startMinute = startDate.getMinutes();

  // Position from top of grid (after 44px header)
  const headerHeight = 44;
  const topPosition = headerHeight + (startHour * hourHeight) + (startMinute / 60 * hourHeight);

  // Height based on duration
  const heightPx = Math.max(
    GRID_CONSTANTS.MIN_BLOCK_HEIGHT_PX,
    (entry.durationSeconds / 3600) * hourHeight
  );

  // Format duration
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const isAutoAssigned = entry.source === 'rule' || entry.source === 'ai';
  const isLowConfidence = isAutoAssigned && entry.confidence < 0.8;

  return (
    <div
      className={cn(
        'absolute left-1 right-1 rounded px-1.5 py-0.5 cursor-pointer',
        'border-l-4 hover:ring-2 hover:ring-primary/50',
        'overflow-hidden text-xs'
      )}
      style={{
        top: `${topPosition}px`,
        height: `${heightPx}px`,
        backgroundColor: `${entry.projectColor}20`,
        borderLeftColor: entry.projectColor,
      }}
      onClick={() => onClick?.(entry)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(entry, e);
      }}
      data-entry-id={entry.id}
      data-event-type={entry.eventType}
    >
      <div className="flex items-center gap-1 min-w-0">
        {isLowConfidence && (
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent>
              Auto-assigned ({Math.round(entry.confidence * 100)}% confidence)
            </TooltipContent>
          </Tooltip>
        )}
        <span className="font-medium truncate" style={{ color: entry.projectColor }}>
          {entry.projectName}
        </span>
      </div>
      {heightPx > 24 && (
        <div className="text-muted-foreground truncate">
          {entry.appName}
        </div>
      )}
      {heightPx > 36 && (
        <div className="text-muted-foreground/70 truncate text-[10px]">
          {formatDuration(entry.durationSeconds)}
        </div>
      )}
    </div>
  );
};
```

**Step 9.2: Verify TypeScript compilation**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 9.3: Commit**

```bash
git add frontend/src/components/timeline/EntryBlock.tsx
git commit -m "feat(ui): add EntryBlock component for entries lane"
```

---

### Task 10: Create EntriesColumn Component

**Files:**
- Create: `/frontend/src/components/timeline/EntriesColumn.tsx`

**Step 10.1: Create EntriesColumn component**

```typescript
import React from 'react';
import { FolderKanban } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GRID_CONSTANTS } from '@/types/timeline';
import { EntryBlock } from './EntryBlock';

interface EntryBlockData {
  id: number;
  eventType: string;
  projectId: number;
  projectName: string;
  projectColor: string;
  appName: string;
  windowTitle: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  confidence: number;
  source: string;
}

interface EntriesColumnProps {
  entries: EntryBlockData[];
  hours: number[];
  hourHeight: number;
  onEntryClick?: (entry: EntryBlockData) => void;
  onEntryContextMenu?: (entry: EntryBlockData, e: React.MouseEvent) => void;
}

export const EntriesColumn: React.FC<EntriesColumnProps> = ({
  entries,
  hours,
  hourHeight,
  onEntryClick,
  onEntryContextMenu,
}) => {
  // Calculate total time
  const totalSeconds = entries.reduce((sum, e) => sum + e.durationSeconds, 0);
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div
      className="flex-shrink-0 border-r border-border"
      style={{ width: `${GRID_CONSTANTS.APP_COLUMN_WIDTH_PX}px` }}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-2 h-11 flex items-center">
        <div className="flex items-center gap-1.5 w-full min-w-0">
          <div className="w-5 h-5 rounded bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <FolderKanban className="w-3 h-3 text-white" />
          </div>
          <span className="text-xs font-medium text-foreground">Entries</span>
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {formatDuration(totalSeconds)}
          </Badge>
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

        {/* Entry blocks (absolutely positioned) */}
        <div className="absolute inset-0">
          {entries.map((entry) => (
            <EntryBlock
              key={`${entry.eventType}-${entry.id}`}
              entry={entry}
              hourHeight={hourHeight}
              onClick={onEntryClick}
              onContextMenu={onEntryContextMenu}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
```

**Step 10.2: Add to component index**

Modify `/frontend/src/components/timeline/index.ts` (if it exists) or create exports.

**Step 10.3: Verify TypeScript compilation**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 10.4: Commit**

```bash
git add frontend/src/components/timeline/EntriesColumn.tsx frontend/src/components/timeline/index.ts
git commit -m "feat(ui): add EntriesColumn component for timeline"
```

---

### Task 11: Integrate EntriesColumn into TimelineGridView

**Files:**
- Modify: `/frontend/src/components/timeline/TimelineGridView.tsx`

**Step 11.1: Add imports**

```typescript
import { EntriesColumn } from './EntriesColumn';
import { useEntriesForDate } from '@/api/hooks';
```

**Step 11.2: Add entries data fetch**

Inside the component, add after other hooks:

```typescript
// Fetch entries for the Entries lane
const { data: entries } = useEntriesForDate(data.date);
```

**Step 11.3: Add EntriesColumn to grid layout**

Find where columns are rendered (after AISummaryColumn, before AFKColumn) and add:

```typescript
{/* Entries Column - Shows project-assigned activities */}
{entries && entries.length > 0 && (
  <EntriesColumn
    entries={entries}
    hours={activeHours}
    hourHeight={effectiveHourHeight}
    onEntryClick={(entry) => {
      // Could open a detail view or similar
      console.log('Entry clicked:', entry);
    }}
  />
)}
```

**Step 11.4: Verify app runs**

Run: `wails dev -tags webkit2_41`
Expected: App launches, Timeline shows Entries column if there are assigned activities

**Step 11.5: Commit**

```bash
git add frontend/src/components/timeline/TimelineGridView.tsx
git commit -m "feat(ui): integrate EntriesColumn into timeline grid"
```

---

## Phase 8: Visual Distinction for Unassigned Activities

### Task 12: Add Project Assignment Indicator to ActivityBlock

**Files:**
- Modify: `/frontend/src/components/timeline/ActivityBlock.tsx`

**Step 12.1: Check current ActivityBlock props and add projectId/projectColor**

The ActivityBlock component needs to show visual distinction for assigned vs unassigned activities.

First, update the `ActivityBlock` type in `/frontend/src/types/timeline.ts` if it doesn't have project fields:

```typescript
export interface ActivityBlock {
  // ... existing fields
  projectId?: number;
  projectColor?: string;
  projectSource?: string;
  projectConfidence?: number;
}
```

**Step 12.2: Update ActivityBlock component styling**

In `ActivityBlock.tsx`, modify the className logic:

```typescript
// Add to component
const isAssigned = block.projectId != null && block.projectId > 0;
const isAutoAssigned = block.projectSource === 'rule' || block.projectSource === 'ai';
const isLowConfidence = isAutoAssigned && (block.projectConfidence || 0) < 0.8;

// Modify the outer div className
className={cn(
  'absolute rounded cursor-pointer transition-all',
  'hover:ring-2 hover:ring-primary/50',
  isAssigned
    ? 'border-l-4'  // Solid left border for assigned
    : 'opacity-70 border border-dashed',  // Faded + dashed for unassigned
  isSelected && 'ring-2 ring-primary',
  isLassoPreview && 'ring-2 ring-blue-400',
)}
style={{
  ...existingStyles,
  borderLeftColor: isAssigned ? block.projectColor : undefined,
}}
```

**Step 12.3: Add low-confidence indicator**

Add inside the block content:

```typescript
{isLowConfidence && (
  <Tooltip>
    <TooltipTrigger asChild>
      <AlertCircle className="h-3 w-3 text-amber-500 absolute top-0.5 right-0.5" />
    </TooltipTrigger>
    <TooltipContent>
      Auto-assigned ({Math.round((block.projectConfidence || 0) * 100)}% confidence)
    </TooltipContent>
  </Tooltip>
)}
```

**Step 12.4: Verify app runs**

Run: `wails dev -tags webkit2_41`
Expected: Unassigned activities appear faded with dashed borders

**Step 12.5: Commit**

```bash
git add frontend/src/components/timeline/ActivityBlock.tsx frontend/src/types/timeline.ts
git commit -m "feat(ui): add visual distinction for assigned vs unassigned activities"
```

---

## Phase 9: Backfill Settings UI

### Task 13: Create Backfill Settings Section

**Files:**
- Create: `/frontend/src/components/settings/sections/BackfillSettings.tsx`

**Step 13.1: Create the component**

```typescript
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Play, Eye } from 'lucide-react';
import {
  useReportIncludeUnassigned,
  useSetReportIncludeUnassigned,
  useBackfillPreview,
  useBackfillRun,
} from '@/api/hooks';

export function BackfillSettings() {
  const { data: includeUnassigned = true } = useReportIncludeUnassigned();
  const setIncludeUnassigned = useSetReportIncludeUnassigned();

  const backfillPreview = useBackfillPreview();
  const backfillRun = useBackfillRun();

  // Date range for backfill (default to last 7 days)
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [previewResult, setPreviewResult] = useState<{
    totalProcessed: number;
    autoAssigned: number;
    alreadyAssigned: number;
    noMatch: number;
  } | null>(null);

  const handlePreview = async () => {
    const result = await backfillPreview.mutateAsync({
      startDate,
      endDate,
      minConfidence,
    });
    setPreviewResult(result);
  };

  const handleRun = async () => {
    await backfillRun.mutateAsync({
      startDate,
      endDate,
      minConfidence,
    });
    setPreviewResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Report Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report Settings</CardTitle>
          <CardDescription>
            Configure how activities appear in generated reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="include-unassigned">Include unassigned activities</Label>
              <p className="text-sm text-muted-foreground">
                When disabled, only project-assigned activities appear in reports
              </p>
            </div>
            <Switch
              id="include-unassigned"
              checked={includeUnassigned}
              onCheckedChange={(checked) => setIncludeUnassigned.mutate(checked)}
              disabled={setIncludeUnassigned.isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Backfill */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Backfill Projects</CardTitle>
          <CardDescription>
            Apply project patterns to historical activities that haven't been assigned yet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="min-confidence">
              Minimum Confidence: {Math.round(minConfidence * 100)}%
            </Label>
            <Input
              id="min-confidence"
              type="range"
              min="0.5"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {previewResult && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <div className="font-medium">Preview Results:</div>
              <div>Total activities: {previewResult.totalProcessed}</div>
              <div className="text-green-600">Would assign: {previewResult.autoAssigned}</div>
              <div className="text-muted-foreground">Already assigned: {previewResult.alreadyAssigned}</div>
              <div className="text-muted-foreground">No pattern match: {previewResult.noMatch}</div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={backfillPreview.isPending}
            >
              {backfillPreview.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Preview
            </Button>
            <Button
              onClick={handleRun}
              disabled={backfillRun.isPending || !previewResult || previewResult.autoAssigned === 0}
            >
              {backfillRun.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Run Backfill
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 13.2: Add to settings sections index**

Modify `/frontend/src/components/settings/sections/index.ts`:

```typescript
export { BackfillSettings } from './BackfillSettings';
```

**Step 13.3: Verify TypeScript compilation**

Run: `cd frontend && npm run build`
Expected: Build succeeds

**Step 13.4: Commit**

```bash
git add frontend/src/components/settings/sections/BackfillSettings.tsx frontend/src/components/settings/sections/index.ts
git commit -m "feat(ui): add backfill settings section"
```

---

### Task 14: Integrate Backfill Settings into Settings Page

**Files:**
- Modify: `/frontend/src/pages/SettingsPage.tsx`

**Step 14.1: Import BackfillSettings**

```typescript
import { BackfillSettings } from '@/components/settings/sections/BackfillSettings';
```

**Step 14.2: Add to settings tabs/sections**

Find where settings sections are rendered and add a new section for "Projects" or "Backfill":

```typescript
// Add a new tab or section
<TabsContent value="projects">
  <BackfillSettings />
</TabsContent>

// Or if using a different structure, add appropriately
```

**Step 14.3: Verify app runs**

Run: `wails dev -tags webkit2_41`
Expected: Settings page shows Backfill section with working preview/run

**Step 14.4: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat(ui): integrate backfill settings into settings page"
```

---

## Phase 10: Backend Integration for Timeline Grid Data

### Task 15: Include Project Fields in Timeline Grid Data

**Files:**
- Modify: `/internal/service/timeline_grid.go`

**Step 15.1: Ensure ActivityBlock includes project fields**

Check/update the `ActivityBlock` struct in the grid service to include:

```go
type ActivityBlock struct {
    // ... existing fields
    ProjectID         int64   `json:"projectId,omitempty"`
    ProjectColor      string  `json:"projectColor,omitempty"`
    ProjectSource     string  `json:"projectSource,omitempty"`
    ProjectConfidence float64 `json:"projectConfidence,omitempty"`
}
```

**Step 15.2: Populate project fields when building activity blocks**

In the function that creates activity blocks from focus events, add:

```go
if event.ProjectID.Valid && event.ProjectID.Int64 > 0 {
    block.ProjectID = event.ProjectID.Int64
    if proj, ok := projectMap[event.ProjectID.Int64]; ok {
        block.ProjectColor = proj.Color.String
    }
    if event.ProjectSource.Valid {
        block.ProjectSource = event.ProjectSource.String
    }
    if event.ProjectConfidence.Valid {
        block.ProjectConfidence = event.ProjectConfidence.Float64
    }
}
```

**Step 15.3: Verify compilation and test**

Run: `go build ./... && wails dev -tags webkit2_41`
Expected: Activity blocks in timeline show project colors when assigned

**Step 15.4: Commit**

```bash
git add internal/service/timeline_grid.go
git commit -m "feat(service): include project fields in timeline grid activity blocks"
```

---

## Phase 11: Final Integration Testing

### Task 16: Manual End-to-End Test

**No files to modify - verification steps only**

**Step 16.1: Test Entries Lane**

1. Navigate to Timeline page
2. Verify Entries column appears (if there are assigned activities)
3. Verify entry blocks show project name and color

**Step 16.2: Test Visual Distinction**

1. Look at Activity columns
2. Verify unassigned activities appear faded with dashed borders
3. Verify assigned activities have solid colored left border

**Step 16.3: Test Backfill**

1. Go to Settings page
2. Find Backfill section
3. Set date range and click Preview
4. Verify preview shows counts
5. Click Run Backfill
6. Return to Timeline and verify more activities are now assigned

**Step 16.4: Test Report Config**

1. In Settings, toggle "Include unassigned" off
2. Generate a report
3. Verify only project-assigned activities appear

**Step 16.5: Final Commit**

```bash
git add -A
git commit -m "feat: entries lane and report transparency implementation complete"
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `/internal/storage/migrations.go` | Modify | Add migration 10 |
| `/internal/storage/focus.go` | Modify | Add memory status methods |
| `/internal/storage/screenshots.go` | Modify | Add memory status methods |
| `/internal/service/timeline.go` | Modify | Add EntryBlock and GetEntriesForDate |
| `/internal/service/backfill.go` | Create | Backfill service |
| `/app.go` | Modify | Add API bindings |
| `/frontend/src/api/client.ts` | Modify | Add API methods |
| `/frontend/src/api/hooks.ts` | Modify | Add React Query hooks |
| `/frontend/src/types/timeline.ts` | Modify | Add project fields to ActivityBlock |
| `/frontend/src/components/timeline/EntryBlock.tsx` | Create | Entry block component |
| `/frontend/src/components/timeline/EntriesColumn.tsx` | Create | Entries column |
| `/frontend/src/components/timeline/TimelineGridView.tsx` | Modify | Add Entries column |
| `/frontend/src/components/timeline/ActivityBlock.tsx` | Modify | Visual distinction |
| `/frontend/src/components/settings/sections/BackfillSettings.tsx` | Create | Backfill UI |
| `/frontend/src/pages/SettingsPage.tsx` | Modify | Add backfill section |
| `/internal/service/timeline_grid.go` | Modify | Include project fields |
