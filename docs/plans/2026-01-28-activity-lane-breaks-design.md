# Activity Lane: Breaks & AFK Visualization

**Date:** 2026-01-28
**Status:** Approved

## Problem

The Activity lane currently only shows green "Active" blocks (inverse of AFK periods). This misses an important distinction:

- **AFK** = system-detected idle (idle timeout, sleep, manual trigger)
- **Breaks** = short gaps between focus events (already calculated for daily summary)

Users see a "Breaks" stat in the daily summary but can't visualize when those breaks occurred.

## Solution

Show three distinct states in the Activity lane as contiguous colored blocks:

| State | Color | Source |
|-------|-------|--------|
| Active | Green (#22c55e) | Focus events (window activity) |
| Break | Amber (#f59e0b) | AFK events ≤ 2 hours |
| AFK | Gray (#6b7280) | AFK events > 2 hours |

**Key insight:** Breaks are simply short AFK periods. The system already detects AFK events (idle timeout, sleep, manual trigger), so we just classify them by duration:
- Short AFK (≤2hr) = break (amber) - user stepped away briefly
- Long AFK (>2hr) = afk (gray) - user was away for extended period

Unexplained gaps (power outage, app not running) remain as empty space.

## Data Model

### New Type: ActivityState

```go
type ActivityState struct {
    StartTime       int64   `json:"startTime"`
    EndTime         int64   `json:"endTime"`
    DurationSeconds int     `json:"durationSeconds"`
    State           string  `json:"state"` // "active", "break", "afk"

    // Positioning
    HourOffset    int     `json:"hourOffset"`
    MinuteOffset  int     `json:"minuteOffset"`
    PixelPosition float64 `json:"pixelPosition"`
    PixelHeight   float64 `json:"pixelHeight"`
}
```

Added to `TimelineGridData` as `ActivityStates []ActivityState`.

## Backend Algorithm

```
calculateActivityStates(focusEvents, afkBlocks, dayStart, dayEnd):
    1. Merge adjacent focus events → continuous "active" periods
    2. Classify AFK events by duration:
       - AFK ≤ 2 hours → "break"
       - AFK > 2 hours → "afk"
    3. Calculate pixel positioning for all states
    4. Sort by start time
    5. Return unified timeline
```

### Edge Cases

| Scenario | Result |
|----------|--------|
| 30min AFK event | `break` (≤2hr) |
| 3hr AFK event | `afk` (>2hr) |
| Gap with no AFK event | Empty (no data) |
| Power outage overnight | Empty (no AFK event recorded) |

## Frontend Changes

Replace AFK inversion logic in `useTimelineData.ts` with direct mapping:

```typescript
if (data.activityStates) {
  for (const state of data.activityStates) {
    events.push({
      id: `activity-${state.startTime}`,
      type: 'activity',
      row: 'Activity',
      startTime: state.startTime,
      endTime: state.endTime,
      duration: state.durationSeconds,
      label: formatActivityLabel(state),
      color: getActivityColor(state.state),
      pixelPosition: state.pixelPosition,
      pixelHeight: state.pixelHeight,
    });
  }
}

function getActivityColor(state: string): string {
  switch (state) {
    case 'active': return '#22c55e';
    case 'break':  return '#f59e0b';
    case 'afk':    return '#6b7280';
    default:       return '#6b7280';
  }
}
```

## Daily Summary Alignment

Break stats in `calculateDayStats()` should derive from `ActivityStates` for single source of truth:

```go
func deriveBreakStats(states []ActivityState) (count int, totalSeconds int) {
    for _, s := range states {
        if s.State == "break" {
            count++
            totalSeconds += s.DurationSeconds
        }
    }
    return
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `internal/service/timeline_grid.go` | Add ActivityState type, calculateActivityStates(), integrate into GetTimelineGridDataWithOptions() |
| `frontend/src/components/timeline/useTimelineData.ts` | Replace AFK inversion with ActivityStates mapping |
| `frontend/wailsjs/go/models.ts` | Auto-generated from Go types |

## Testing

- Backend: Unit test `calculateActivityStates()` with various gap scenarios
- Frontend: Visual verification that active/break/afk render with correct colors
- Integration: Verify daily summary break stats match activity lane break blocks
