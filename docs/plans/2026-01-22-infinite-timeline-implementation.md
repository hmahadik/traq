# Infinite Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the timeline into a continuous, infinitely scrollable view where panning left past midnight seamlessly loads previous days.

**Architecture:** Window-based data loading (±1 day prefetch, ±2 days retained), extended D3 time scale spanning multiple days, playhead-driven sidebar context, subtle day boundary markers at midnight.

**Tech Stack:** React, D3.js, TanStack Query, TypeScript

---

## Task 1: Create Multi-Day Timeline Hook

**Files:**
- Create: `frontend/src/hooks/useMultiDayTimeline.ts`
- Modify: `frontend/src/api/hooks.ts` (add export)

**Step 1: Create the hook file with types**

```typescript
// frontend/src/hooks/useMultiDayTimeline.ts
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTimelineGridData, useScreenshotsForDate, queryKeys } from '@/api/hooks';
import type { TimelineGridData } from '@/types/timeline';
import type { Screenshot } from '@/types/screenshot';

interface DayData {
  gridData: TimelineGridData | null;
  screenshots: Screenshot[];
  isLoading: boolean;
}

interface MultiDayTimelineState {
  loadedDays: Map<string, DayData>;
  timeRange: { start: Date; end: Date };
  playheadDate: string;
  isLoadingAny: boolean;
}

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getDateString(date);
}

function dateToStartOfDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0);
}

function dateToEndOfDay(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59);
}

export function useMultiDayTimeline(initialDate: string) {
  const [centerDate, setCenterDate] = useState(initialDate);
  const [loadedDateStrings, setLoadedDateStrings] = useState<string[]>([initialDate]);
  const queryClient = useQueryClient();

  // Calculate which dates should be loaded (center ± 1 day)
  const datesToLoad = useMemo(() => {
    const dates = new Set<string>();
    dates.add(centerDate);
    dates.add(addDays(centerDate, -1)); // Yesterday
    dates.add(addDays(centerDate, 1));  // Tomorrow (capped at today)

    const today = getDateString(new Date());
    return Array.from(dates).filter(d => d <= today).sort();
  }, [centerDate]);

  // Fetch data for each date
  const day0 = useTimelineGridData(datesToLoad[0] || '');
  const day1 = useTimelineGridData(datesToLoad[1] || '');
  const day2 = useTimelineGridData(datesToLoad[2] || '');

  const screenshots0 = useScreenshotsForDate(datesToLoad[0] || '');
  const screenshots1 = useScreenshotsForDate(datesToLoad[1] || '');
  const screenshots2 = useScreenshotsForDate(datesToLoad[2] || '');

  // Build loaded days map
  const loadedDays = useMemo(() => {
    const map = new Map<string, DayData>();

    if (datesToLoad[0]) {
      map.set(datesToLoad[0], {
        gridData: day0.data ?? null,
        screenshots: screenshots0.data ?? [],
        isLoading: day0.isLoading || screenshots0.isLoading,
      });
    }
    if (datesToLoad[1]) {
      map.set(datesToLoad[1], {
        gridData: day1.data ?? null,
        screenshots: screenshots1.data ?? [],
        isLoading: day1.isLoading || screenshots1.isLoading,
      });
    }
    if (datesToLoad[2]) {
      map.set(datesToLoad[2], {
        gridData: day2.data ?? null,
        screenshots: screenshots2.data ?? [],
        isLoading: day2.isLoading || screenshots2.isLoading,
      });
    }

    return map;
  }, [datesToLoad, day0, day1, day2, screenshots0, screenshots1, screenshots2]);

  // Calculate combined time range
  const timeRange = useMemo(() => {
    const sortedDates = Array.from(loadedDays.keys()).sort();
    if (sortedDates.length === 0) {
      const today = new Date();
      return { start: dateToStartOfDay(getDateString(today)), end: dateToEndOfDay(getDateString(today)) };
    }
    return {
      start: dateToStartOfDay(sortedDates[0]),
      end: dateToEndOfDay(sortedDates[sortedDates.length - 1]),
    };
  }, [loadedDays]);

  // Merge all screenshots
  const allScreenshots = useMemo(() => {
    const merged: Screenshot[] = [];
    for (const dayData of loadedDays.values()) {
      merged.push(...dayData.screenshots);
    }
    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }, [loadedDays]);

  // Update center date when playhead moves significantly
  const updateCenterFromPlayhead = useCallback((playheadTimestamp: Date) => {
    const playheadDateStr = getDateString(playheadTimestamp);
    if (playheadDateStr !== centerDate) {
      setCenterDate(playheadDateStr);
    }
  }, [centerDate]);

  // Check if any day is loading
  const isLoadingAny = useMemo(() => {
    for (const dayData of loadedDays.values()) {
      if (dayData.isLoading) return true;
    }
    return false;
  }, [loadedDays]);

  return {
    loadedDays,
    timeRange,
    allScreenshots,
    centerDate,
    playheadDate: centerDate,
    isLoadingAny,
    updateCenterFromPlayhead,
    setCenterDate,
  };
}
```

**Step 2: Export from hooks index**

Add to `frontend/src/api/hooks.ts` at the end:

```typescript
// Re-export multi-day timeline hook
export { useMultiDayTimeline } from '@/hooks/useMultiDayTimeline';
```

**Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -i "useMultiDayTimeline" || echo "No errors in new hook"`

**Step 4: Commit**

```bash
git add frontend/src/hooks/useMultiDayTimeline.ts frontend/src/api/hooks.ts
git commit -m "feat(timeline): add useMultiDayTimeline hook for window-based loading"
```

---

## Task 2: Create Multi-Day Event Drops Data Hook

**Files:**
- Create: `frontend/src/components/timeline/eventDrops/useMultiDayEventDropsData.ts`

**Step 1: Create the hook that merges multiple days**

```typescript
// frontend/src/components/timeline/eventDrops/useMultiDayEventDropsData.ts
import { useMemo } from 'react';
import type { TimelineGridData } from '@/types/timeline';
import type { Screenshot } from '@/types/screenshot';
import type { EventDropsData, EventDropsRow, EventDot } from './eventDropsTypes';
import {
  EVENT_TYPE_COLORS,
  CATEGORY_HEX_COLORS,
  getAppHexColor,
} from './eventDropsTypes';
import type { TimelineFilters } from '../FilterControls';
import { makeEventKey } from '@/utils/eventKeys';

interface DayData {
  gridData: TimelineGridData | null;
  screenshots: Screenshot[];
  isLoading: boolean;
}

interface UseMultiDayEventDropsDataOptions {
  loadedDays: Map<string, DayData>;
  timeRange: { start: Date; end: Date };
  filters: TimelineFilters;
  collapseActivityRows?: boolean;
}

export function useMultiDayEventDropsData({
  loadedDays,
  timeRange,
  filters,
  collapseActivityRows = false,
}: UseMultiDayEventDropsDataOptions): EventDropsData | null {
  return useMemo(() => {
    if (loadedDays.size === 0) return null;

    const allEvents: EventDot[] = [];
    const rowMap = new Map<string, EventDot[]>();
    const normalizedToDisplay = new Map<string, string>();

    const normalizeRowName = (name: string): string => name.toLowerCase().trim();

    const getDisplayName = (name: string): string => {
      const normalized = normalizeRowName(name);
      if (normalizedToDisplay.has(normalized)) {
        const existing = normalizedToDisplay.get(normalized)!;
        if (name[0] === name[0].toUpperCase() && existing[0] !== existing[0].toUpperCase()) {
          normalizedToDisplay.set(normalized, name);
          return name;
        }
        return existing;
      }
      normalizedToDisplay.set(normalized, name);
      return name;
    };

    const addToRow = (rowName: string, event: EventDot) => {
      const displayName = getDisplayName(rowName);
      const normalized = normalizeRowName(rowName);
      event.row = displayName;
      if (!rowMap.has(normalized)) {
        rowMap.set(normalized, []);
      }
      rowMap.get(normalized)!.push(event);
      allEvents.push(event);
    };

    // Process each loaded day
    for (const [dateStr, dayData] of loadedDays) {
      if (!dayData.gridData) continue;
      const data = dayData.gridData;

      // Process activity blocks
      if (filters.showScreenshots) {
        for (const [, hourApps] of Object.entries(data.hourlyGrid)) {
          for (const [appName, activities] of Object.entries(hourApps)) {
            for (const activity of activities) {
              const rowName = collapseActivityRows
                ? 'In Focus'
                : appName;
              const color = collapseActivityRows
                ? '#22c55e'
                : getAppHexColor(appName);

              const event: EventDot = {
                id: makeEventKey('activity', activity.id),
                originalId: activity.id,
                timestamp: new Date(activity.startTime * 1000),
                type: 'activity',
                row: rowName,
                label: activity.windowTitle || appName,
                duration: activity.durationSeconds,
                color,
                metadata: { ...activity, dateStr },
              };
              addToRow(rowName, event);
            }
          }
        }
      }

      // Process git events
      if (filters.showGit) {
        for (const [, hourEvents] of Object.entries(data.gitEvents)) {
          for (const event of hourEvents) {
            const dot: EventDot = {
              id: makeEventKey('git', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'git',
              row: 'Git',
              label: event.messageSubject || event.message,
              color: EVENT_TYPE_COLORS.git,
              metadata: { ...event, dateStr },
            };
            addToRow('Git', dot);
          }
        }
      }

      // Process shell events
      if (filters.showShell) {
        for (const [, hourEvents] of Object.entries(data.shellEvents)) {
          for (const event of hourEvents) {
            const dot: EventDot = {
              id: makeEventKey('shell', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'shell',
              row: 'Shell',
              label: event.command,
              duration: event.durationSeconds,
              color: EVENT_TYPE_COLORS.shell,
              metadata: { ...event, dateStr },
            };
            addToRow('Shell', dot);
          }
        }
      }

      // Process browser events
      if (filters.showBrowser) {
        for (const [, hourEvents] of Object.entries(data.browserEvents)) {
          for (const event of hourEvents) {
            const rowName = event.browser || 'Browser';
            const dot: EventDot = {
              id: makeEventKey('browser', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'browser',
              row: rowName,
              label: event.title || event.domain,
              duration: event.visitDurationSeconds,
              color: getAppHexColor(event.browser || 'browser'),
              metadata: { ...event, dateStr },
            };
            addToRow(rowName, dot);
          }
        }
      }

      // Process file events
      if (filters.showFiles) {
        for (const [, hourEvents] of Object.entries(data.fileEvents)) {
          for (const event of hourEvents) {
            const dot: EventDot = {
              id: makeEventKey('file', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'file',
              row: 'Files',
              label: `${event.eventType}: ${event.fileName}`,
              color: EVENT_TYPE_COLORS.file,
              metadata: { ...event, dateStr },
            };
            addToRow('Files', dot);
          }
        }
      }

      // Process screenshots
      for (const screenshot of dayData.screenshots) {
        const dot: EventDot = {
          id: makeEventKey('screenshot', screenshot.id),
          originalId: screenshot.id,
          timestamp: new Date(screenshot.timestamp * 1000),
          type: 'screenshot',
          row: 'Screenshots',
          label: screenshot.windowTitle || screenshot.appName || 'Screenshot',
          color: EVENT_TYPE_COLORS.screenshot,
          metadata: { ...screenshot, dateStr },
        };
        addToRow('Screenshots', dot);
      }
    }

    // Convert row map to sorted array
    const rows: EventDropsRow[] = Array.from(rowMap.entries())
      .map(([normalizedName, events]) => {
        events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        const primaryColor = events[0]?.color || '#6b7280';
        const displayName = normalizedToDisplay.get(normalizedName) || normalizedName;
        return {
          name: displayName,
          color: primaryColor,
          dotCount: events.length,
          data: events,
        };
      })
      .sort((a, b) => {
        if (a.name === 'Projects') return -1;
        if (b.name === 'Projects') return 1;
        if (a.name === 'In Focus') return -1;
        if (b.name === 'In Focus') return 1;
        const specialRows = ['Screenshots', 'Git', 'Shell', 'Browser', 'Files', 'Activity'];
        const aIsSpecial = specialRows.includes(a.name);
        const bIsSpecial = specialRows.includes(b.name);
        if (aIsSpecial && !bIsSpecial) return 1;
        if (!aIsSpecial && bIsSpecial) return -1;
        if (aIsSpecial && bIsSpecial) {
          return specialRows.indexOf(a.name) - specialRows.indexOf(b.name);
        }
        return b.dotCount - a.dotCount;
      });

    return {
      rows,
      timeRange,
      totalEvents: allEvents.length,
    };
  }, [loadedDays, timeRange, filters, collapseActivityRows]);
}
```

**Step 2: Export from index**

Add to `frontend/src/components/timeline/eventDrops/index.ts`:

```typescript
export { useMultiDayEventDropsData } from './useMultiDayEventDropsData';
```

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/useMultiDayEventDropsData.ts frontend/src/components/timeline/eventDrops/index.ts
git commit -m "feat(timeline): add useMultiDayEventDropsData for merging multi-day events"
```

---

## Task 3: Add Day Boundary Markers to EventDropsTimeline

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx`

**Step 1: Add day boundary rendering after grid lines (around line 500)**

Find the grid lines section and add after it:

```typescript
// Add day boundary markers at midnight
const dayBoundaries = d3.timeDay.range(timeRange.start, timeRange.end);
chartGroup.append('g')
  .attr('class', 'day-boundaries')
  .selectAll('g')
  .data(dayBoundaries.slice(1)) // Skip first day's start
  .join('g')
  .attr('class', 'day-boundary')
  .each(function(d) {
    const g = d3.select(this);
    const x = xScale(d);

    // Vertical line at midnight
    g.append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', MARGIN.top - 20)
      .attr('y2', height - MARGIN.bottom)
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.6);

    // Date label above
    const dateLabel = d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

    g.append('rect')
      .attr('x', x - 45)
      .attr('y', MARGIN.top - 35)
      .attr('width', 90)
      .attr('height', 18)
      .attr('rx', 4)
      .attr('fill', '#3b82f6')
      .attr('opacity', 0.9);

    g.append('text')
      .attr('x', x)
      .attr('y', MARGIN.top - 23)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(dateLabel);
  });
```

**Step 2: Update day boundaries on zoom (in zoom handler)**

Add this after updating grid lines in the zoom handler:

```typescript
// Update day boundary positions
svg.select('.day-boundaries')
  .selectAll<SVGGElement, Date>('.day-boundary')
  .each(function(d) {
    const g = d3.select(this);
    const x = newXScale(d);
    g.select('line')
      .attr('x1', x)
      .attr('x2', x);
    g.select('rect')
      .attr('x', x - 45);
    g.select('text')
      .attr('x', x);
  });
```

**Step 3: Remove left pan constraint**

Find the zoom behavior setup and modify translateExtent:

```typescript
const zoom = d3.zoom<SVGSVGElement, unknown>()
  .scaleExtent([0.5, 48])
  // Remove left constraint - allow infinite pan into past
  .translateExtent([[-Infinity, 0], [width - MARGIN.right, height]])
  .extent([[MARGIN.left, 0], [width - MARGIN.right, height]])
  // ... rest of zoom config
```

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "feat(timeline): add day boundary markers and remove left pan constraint"
```

---

## Task 4: Wire Up TimelinePage to Multi-Day Hook

**Files:**
- Modify: `frontend/src/pages/TimelinePage.tsx`

**Step 1: Replace single-day hooks with multi-day hook**

Replace the imports and hook calls:

```typescript
// Add import
import { useMultiDayTimeline } from '@/hooks/useMultiDayTimeline';
import { useMultiDayEventDropsData } from '@/components/timeline/eventDrops';

// In TimelinePage component, replace:
// const { data: gridData, isLoading } = useTimelineGridData(dateStr);
// const { data: screenshotsData } = useScreenshotsForDate(dateStr);

// With:
const {
  loadedDays,
  timeRange,
  allScreenshots,
  centerDate,
  isLoadingAny,
  updateCenterFromPlayhead,
  setCenterDate,
} = useMultiDayTimeline(dateStr);

// Get the center day's grid data for sidebar stats
const centerDayData = loadedDays.get(centerDate);
const gridData = centerDayData?.gridData ?? null;
const isLoading = isLoadingAny && !gridData;
```

**Step 2: Pass multi-day data to EventDropsTimeline**

Add new props to EventDropsTimeline:

```typescript
<EventDropsTimeline
  loadedDays={loadedDays}
  multiDayTimeRange={timeRange}
  filters={filters}
  screenshots={allScreenshots}
  entries={entriesData}
  hideEmbeddedList={true}
  selectedEventKeys={selectedEventKeys}
  onSelectionChange={handleDropsSelectionChange}
  onEventDelete={handleEventDropDelete}
  onEventEdit={handleEventDropEdit}
  onViewScreenshot={handleEventDropViewScreenshot}
  onPlayheadChange={updateCenterFromPlayhead}
/>
```

**Step 3: Update header to show playhead date**

Replace static date display with dynamic:

```typescript
// Update formattedDate to use centerDate
const formattedDate = useMemo(() => {
  const [year, month, day] = centerDate.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}, [centerDate]);
```

**Step 4: Commit**

```bash
git add frontend/src/pages/TimelinePage.tsx
git commit -m "feat(timeline): wire up multi-day timeline to TimelinePage"
```

---

## Task 5: Update EventDropsTimeline Props and Internal Logic

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx`

**Step 1: Update props interface**

```typescript
interface EventDropsTimelineProps {
  // New multi-day props
  loadedDays?: Map<string, { gridData: TimelineGridData | null; screenshots: Screenshot[]; isLoading: boolean }>;
  multiDayTimeRange?: { start: Date; end: Date };
  onPlayheadChange?: (timestamp: Date) => void;

  // Keep existing for backward compatibility
  data?: TimelineGridData | null | undefined;
  filters: TimelineFilters;
  screenshots?: ScreenshotType[];
  entries?: EntryBlockData[];
  rowHeight?: number;
  hideEmbeddedList?: boolean;
  selectedEventKeys?: Set<EventKey>;
  onSelectionChange?: (keys: Set<EventKey>) => void;
  onEventClick?: (event: EventDot) => void;
  onEventDelete?: (event: EventDot) => void;
  onEventEdit?: (event: EventDot) => void;
  onViewScreenshot?: (event: EventDot) => void;
}
```

**Step 2: Use multi-day data when available**

At the start of the component:

```typescript
// Use multi-day data if provided, fall back to single-day
const eventDropsData = loadedDays && multiDayTimeRange
  ? useMultiDayEventDropsData({
      loadedDays,
      timeRange: multiDayTimeRange,
      filters,
      collapseActivityRows,
    })
  : useEventDropsData({ data, filters, screenshots, entries, collapseActivityRows });
```

**Step 3: Call onPlayheadChange when playhead updates**

In the setPlayheadTimestamp callback, add:

```typescript
// After setPlayheadTimestamp(centerTimestamp);
onPlayheadChange?.(centerTimestamp);
```

**Step 4: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "feat(timeline): support multi-day data in EventDropsTimeline"
```

---

## Task 6: Add Loading Indicators at Day Boundaries

**Files:**
- Modify: `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx`

**Step 1: Add loading indicator component**

At the boundary of loaded data, show a pulsing indicator:

```typescript
// After day boundaries rendering, add loading zones
if (loadedDays) {
  const sortedDates = Array.from(loadedDays.keys()).sort();
  const earliestDate = sortedDates[0];
  const earliestLoading = loadedDays.get(earliestDate)?.isLoading;

  if (earliestLoading) {
    const loadingX = xScale(dateToStartOfDay(earliestDate));
    chartGroup.append('rect')
      .attr('class', 'loading-zone')
      .attr('x', MARGIN.left)
      .attr('y', MARGIN.top)
      .attr('width', Math.max(0, loadingX - MARGIN.left))
      .attr('height', height - MARGIN.top - MARGIN.bottom)
      .attr('fill', 'url(#loading-gradient)')
      .attr('opacity', 0.3);
  }
}
```

**Step 2: Add gradient definition for loading zone**

In the defs section:

```typescript
// Add loading gradient
const gradient = svg.select('defs')
  .append('linearGradient')
  .attr('id', 'loading-gradient')
  .attr('x1', '0%')
  .attr('x2', '100%');

gradient.append('stop')
  .attr('offset', '0%')
  .attr('stop-color', '#3b82f6')
  .attr('stop-opacity', 0);

gradient.append('stop')
  .attr('offset', '100%')
  .attr('stop-color', '#3b82f6')
  .attr('stop-opacity', 0.3);
```

**Step 3: Commit**

```bash
git add frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx
git commit -m "feat(timeline): add loading indicators at day boundaries"
```

---

## Task 7: Integration Testing

**Step 1: Manual testing checklist**

Run the app: `cd /home/harshad/projects/traq && wails dev -tags webkit2_41`

Test:
- [ ] Pan left past midnight - previous day loads
- [ ] Sidebar stats update when crossing day boundary
- [ ] Day boundary markers visible at midnight
- [ ] Zoom level persists across day boundaries
- [ ] Filmstrip shows screenshots from visible range
- [ ] Cannot pan into future (blocked at "now")
- [ ] Loading indicator shows when fetching previous day

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat(timeline): complete infinite scroll implementation

- Window-based data loading (±1 day prefetch, ±2 retained)
- Continuous pan through multiple days
- Day boundary markers at midnight
- Playhead-driven sidebar updates
- Loading indicators at boundaries"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Multi-day timeline hook | `useMultiDayTimeline.ts` |
| 2 | Multi-day event drops data | `useMultiDayEventDropsData.ts` |
| 3 | Day boundary markers | `EventDropsTimeline.tsx` |
| 4 | Wire up TimelinePage | `TimelinePage.tsx` |
| 5 | Update EventDrops props | `EventDropsTimeline.tsx` |
| 6 | Loading indicators | `EventDropsTimeline.tsx` |
| 7 | Integration testing | Manual |
