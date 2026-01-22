# Infinite Timeline Design

## Overview

Transform the timeline from a single-day view into a continuous, infinitely scrollable timeline that allows users to pan seamlessly through previous days without discrete page transitions.

## User Experience

- **Continuous panning**: Pan left past midnight and yesterday's data seamlessly appears, like scrolling through Google Maps
- **Window-based loading**: ±1 day pre-fetched, ±2 days kept in memory, older days unloaded
- **Subtle day boundaries**: Vertical line at midnight with floating date label
- **Playhead-driven context**: Sidebar stats, filmstrip, and header date all follow the blue playhead position

## Architecture

### Data Management

#### New Hook: `useMultiDayTimeline`

```typescript
interface MultiDayTimelineState {
  // Map of loaded day data keyed by date string
  loadedDays: Map<string, TimelineGridData>;

  // Combined time range spanning all loaded days
  timeRange: { start: Date; end: Date };

  // Merged events from all loaded days
  allEvents: EventDot[];

  // Loading states per day
  loadingDays: Set<string>;

  // The date the playhead is currently on
  playheadDate: string;
}
```

#### Loading Strategy

1. **Initial load**: Fetch today's data
2. **Boundary approach**: When visible range comes within 2 hours of a day boundary, trigger fetch for adjacent day
3. **Unload trigger**: After pan/zoom settles (500ms debounce), unload days >2 days from playhead
4. **Cache preservation**: React Query cache retains unloaded days for quick re-fetch

### D3 Visualization Changes

#### Extended Time Scale

- Domain: `[earliestLoadedDay 00:00, latestLoadedDay 24:00]`
- Domain updates dynamically as days load/unload
- Zoom transform (`k` scale factor) preserved across domain changes

#### Day Boundary Markers

At each midnight:
- Vertical dashed line (more prominent than hour lines)
- Floating date label above axis: "Mon, Jan 20"
- Subtle alternating background tint between days

#### Pan Constraints

- **Left**: Unconstrained (infinite scroll into past)
- **Right**: Capped at "now" (cannot scroll into future)
- **Loading indicator**: Shown at edge when panning faster than data loads

### Filmstrip & Screenshots

Screenshots follow the same window-based loading:
- Fetch screenshots for each day in loaded window
- Merge into single sorted array
- Filmstrip filters by `visibleTimeRange` (existing logic works unchanged)

### Sidebar & Header

#### Dynamic Sidebar

Props change from static date to playhead-derived:
```typescript
interface SidebarProps {
  focusedDate: string;  // Derived from playhead position
}
```

Stats re-fetch/display when `focusedDate` changes (debounced).

#### Header Updates

- Date display follows playhead: "Wed, Jan 22" → "Tue, Jan 21"
- "Today" / "Yesterday" badges when applicable
- Arrow buttons jump playhead to noon of adjacent day

## Edge Cases

1. **Empty days**: Show 24h of timeline space with subtle "No activity" label
2. **First recorded day**: Soft boundary with "Beginning of tracked history" message
3. **Loading states**: Skeleton dots/bars in unloaded regions while fetching
4. **Zoom reset**: Centers on current playhead day, maintains reasonable zoom level
5. **URL state**: Sync playhead timestamp to URL for deep-linking (`#/timeline?t=1705948800`)

## Implementation Order

1. Create `useMultiDayTimeline` hook with window management
2. Modify `EventDropsTimeline` to accept multi-day data range
3. Update D3 scale/zoom to handle extended domain
4. Add day boundary markers
5. Wire sidebar to playhead-based date
6. Add loading indicators at boundaries
7. Polish edge cases

## Out of Scope (YAGNI)

- Future scrolling (always capped at "now")
- Collapsing empty days
- Per-day zoom levels
- Caching weeks of data upfront
- Vertical day stacking mode

## Files to Modify

- `frontend/src/pages/TimelinePage.tsx` - Wire up multi-day hook, pass playhead date to sidebar
- `frontend/src/components/timeline/eventDrops/EventDropsTimeline.tsx` - Extended scale, day markers, pan constraints
- `frontend/src/components/timeline/eventDrops/useEventDropsData.ts` - Handle multi-day event merging
- `frontend/src/api/hooks.ts` - New `useMultiDayTimeline` hook

## New Files

- `frontend/src/hooks/useMultiDayTimeline.ts` - Core multi-day data management
