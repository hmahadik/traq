// frontend/src/hooks/useMultiDayTimeline.ts
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTimelineGridData, useScreenshotsForDate } from '@/api/hooks';

// Use generic types that work with both Wails bindings and local interfaces
// The hooks return union types, so we infer from their return values
type TimelineGridDataResult = ReturnType<typeof useTimelineGridData>['data'];
type ScreenshotsResult = ReturnType<typeof useScreenshotsForDate>['data'];

// Screenshot item - common shape between ScreenshotDisplay and Screenshot
interface ScreenshotItem {
  id: number;
  timestamp: number;
  filepath: string;
  windowTitle: string | null;
  appName: string | null;
  sessionId: number | null;
}

interface DayData {
  gridData: TimelineGridDataResult;
  screenshots: ScreenshotItem[];
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

// Always load 3 days (center ± 1). More days cause freezing from excessive
// D3 rendering and backend calls. The zoom scaleExtent in Timeline.tsx
// prevents zooming out beyond 3 days visible.
function getDaysToLoadCount(_zoomLevel: number): number {
  return 3;
}

// Single bucket since we always load 3 days. Kept as a function for the
// bucket-change detection in updateCenterFromPlayhead.
function getZoomBucket(_zoomLevel: number): number {
  return 3;
}

// Pure function — normalize screenshots to common shape (no closures, safe at module level)
function normalizeScreenshots(data: ScreenshotsResult): ScreenshotItem[] {
  if (!data) return [];
  return data.map(s => ({
    id: s.id,
    timestamp: s.timestamp,
    filepath: s.filepath,
    windowTitle: s.windowTitle ?? null,
    appName: s.appName ?? null,
    sessionId: s.sessionId ?? null,
  }));
}

// Extracts only stable values from a day's queries into a single memoized object.
// gridQuery.data is referentially stable (React Query structuralSharing) so the
// useMemo only fires when actual data changes, not on status/fetchStatus flickers.
function useDaySlot(
  gridQuery: ReturnType<typeof useTimelineGridData>,
  screenshotsQuery: ReturnType<typeof useScreenshotsForDate>,
  date: string | undefined,
  datesToLoad: string[],
) {
  const gridData = gridQuery.data;
  const screenshotsData = screenshotsQuery.data;
  const shouldInclude = !!date && datesToLoad.includes(date);
  const isLoading = shouldInclude && (gridQuery.isLoading || screenshotsQuery.isLoading);

  return useMemo(() => ({
    date,
    gridData: gridData ?? null,
    screenshots: normalizeScreenshots(screenshotsData),
    isLoading,
    shouldInclude,
  }), [date, gridData, screenshotsData, isLoading, shouldInclude]);
}

export function useMultiDayTimeline(initialDate: string) {
  const [centerDate, setCenterDate] = useState(initialDate);
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomLevelRef = useRef(zoomLevel);

  // === REF FOR SYNCHRONOUS CENTER DATE ACCESS ===
  // React state updates are async (batched). When user clicks Prev then Next rapidly,
  // the second handler's closure still sees the OLD centerDate. This ref is updated
  // synchronously in goToDate/goToPrevDay/goToNextDay so rapid clicks always read
  // the latest value.
  const centerDateRef = useRef(centerDate);

  // Sync centerDate when initialDate changes (e.g., user clicks "Today" button)
  // This is critical - useState only uses initialDate on first mount
  useEffect(() => {
    setCenterDate(initialDate);
    centerDateRef.current = initialDate;
  }, [initialDate]);

  // Keep zoomLevel ref in sync for stale-closure-free access (Bug #7 fix)
  useEffect(() => { zoomLevelRef.current = zoomLevel; }, [zoomLevel]);

  // Bug #27 fix: compute today's date string outside the memo.
  // At midnight this value changes (on next render), triggering recalculation.
  // Within the same day it's the same string, so memo won't fire unnecessarily.
  const todayStr = getDateString(new Date());

  // Calculate which dates should be loaded based on center and zoom level
  // Always generate 7 dates (max window) but only use what we need
  const allPossibleDates = useMemo(() => {
    // Bug #26 fix: add lower bound — don't query for dates before 2020
    const minDate = '2020-01-01';
    return [
      addDays(centerDate, -3),
      addDays(centerDate, -2),
      addDays(centerDate, -1),
      centerDate,
      addDays(centerDate, 1),
      addDays(centerDate, 2),
      addDays(centerDate, 3),
    ].filter(d => d >= minDate && d <= todayStr);
  }, [centerDate, todayStr]);

  // Determine how many days we actually need based on zoom
  const daysNeeded = getDaysToLoadCount(zoomLevel);

  // Calculate which dates to actually use (centered around centerDate)
  const datesToLoad = useMemo(() => {
    const centerIndex = allPossibleDates.indexOf(centerDate);
    if (centerIndex === -1) return allPossibleDates.slice(0, daysNeeded);

    const halfWindow = Math.floor(daysNeeded / 2);
    let startIndex = Math.max(0, centerIndex - halfWindow);
    let endIndex = Math.min(allPossibleDates.length, startIndex + daysNeeded);

    // Adjust if we hit the end
    if (endIndex - startIndex < daysNeeded) {
      startIndex = Math.max(0, endIndex - daysNeeded);
    }

    return allPossibleDates.slice(startIndex, endIndex);
  }, [allPossibleDates, centerDate, daysNeeded]);

  // Pre-allocate 7 day hooks (React requires consistent hook calls)
  // Only enable fetches for dates that are actually needed based on zoom level
  const day0 = useTimelineGridData(allPossibleDates[0] || '', { enabled: !!allPossibleDates[0] && datesToLoad.includes(allPossibleDates[0]) });
  const day1 = useTimelineGridData(allPossibleDates[1] || '', { enabled: !!allPossibleDates[1] && datesToLoad.includes(allPossibleDates[1]) });
  const day2 = useTimelineGridData(allPossibleDates[2] || '', { enabled: !!allPossibleDates[2] && datesToLoad.includes(allPossibleDates[2]) });
  const day3 = useTimelineGridData(allPossibleDates[3] || '', { enabled: !!allPossibleDates[3] && datesToLoad.includes(allPossibleDates[3]) });
  const day4 = useTimelineGridData(allPossibleDates[4] || '', { enabled: !!allPossibleDates[4] && datesToLoad.includes(allPossibleDates[4]) });
  const day5 = useTimelineGridData(allPossibleDates[5] || '', { enabled: !!allPossibleDates[5] && datesToLoad.includes(allPossibleDates[5]) });
  const day6 = useTimelineGridData(allPossibleDates[6] || '', { enabled: !!allPossibleDates[6] && datesToLoad.includes(allPossibleDates[6]) });

  const screenshots0 = useScreenshotsForDate(allPossibleDates[0] || '', { enabled: !!allPossibleDates[0] && datesToLoad.includes(allPossibleDates[0]) });
  const screenshots1 = useScreenshotsForDate(allPossibleDates[1] || '', { enabled: !!allPossibleDates[1] && datesToLoad.includes(allPossibleDates[1]) });
  const screenshots2 = useScreenshotsForDate(allPossibleDates[2] || '', { enabled: !!allPossibleDates[2] && datesToLoad.includes(allPossibleDates[2]) });
  const screenshots3 = useScreenshotsForDate(allPossibleDates[3] || '', { enabled: !!allPossibleDates[3] && datesToLoad.includes(allPossibleDates[3]) });
  const screenshots4 = useScreenshotsForDate(allPossibleDates[4] || '', { enabled: !!allPossibleDates[4] && datesToLoad.includes(allPossibleDates[4]) });
  const screenshots5 = useScreenshotsForDate(allPossibleDates[5] || '', { enabled: !!allPossibleDates[5] && datesToLoad.includes(allPossibleDates[5]) });
  const screenshots6 = useScreenshotsForDate(allPossibleDates[6] || '', { enabled: !!allPossibleDates[6] && datesToLoad.includes(allPossibleDates[6]) });

  // Stable per-day slots: each slot only recalculates when its own .data changes.
  // React Query's structuralSharing ensures .data is referentially stable unless
  // actual data changed. This prevents the old allDayData array from recreating
  // a new Map on every status flicker across any of the 14 hooks.
  const slot0 = useDaySlot(day0, screenshots0, allPossibleDates[0], datesToLoad);
  const slot1 = useDaySlot(day1, screenshots1, allPossibleDates[1], datesToLoad);
  const slot2 = useDaySlot(day2, screenshots2, allPossibleDates[2], datesToLoad);
  const slot3 = useDaySlot(day3, screenshots3, allPossibleDates[3], datesToLoad);
  const slot4 = useDaySlot(day4, screenshots4, allPossibleDates[4], datesToLoad);
  const slot5 = useDaySlot(day5, screenshots5, allPossibleDates[5], datesToLoad);
  const slot6 = useDaySlot(day6, screenshots6, allPossibleDates[6], datesToLoad);

  // Build loaded days map from stable slots
  const loadedDays = useMemo(() => {
    const map = new Map<string, DayData>();
    for (const slot of [slot0, slot1, slot2, slot3, slot4, slot5, slot6]) {
      if (slot.date && slot.shouldInclude && slot.gridData) {
        map.set(slot.date, {
          gridData: slot.gridData,
          screenshots: slot.screenshots,
          isLoading: slot.isLoading,
        });
      }
    }
    return map;
  }, [slot0, slot1, slot2, slot3, slot4, slot5, slot6]);

  // Calculate combined time range
  // Cap end time at "now" if today is included to prevent timeline extending into future
  const timeRange = useMemo(() => {
    const sortedDates = Array.from(loadedDays.keys()).sort();
    const now = new Date();
    const todayStr = getDateString(now);

    if (sortedDates.length === 0) {
      return { start: dateToStartOfDay(todayStr), end: now };
    }

    const lastDate = sortedDates[sortedDates.length - 1];
    const rawEnd = dateToEndOfDay(lastDate);
    // If today is included, cap end at current time
    const end = (lastDate === todayStr && rawEnd > now) ? now : rawEnd;

    return {
      start: dateToStartOfDay(sortedDates[0]),
      end,
    };
  }, [loadedDays]);

  // Merge all screenshots
  const allScreenshots = useMemo(() => {
    const merged: ScreenshotItem[] = [];
    for (const dayData of loadedDays.values()) {
      merged.push(...dayData.screenshots);
    }
    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }, [loadedDays]);

  // Track last update time to debounce
  const lastCenterUpdateRef = useRef<number>(0);

  // Track if navigation is in progress (to avoid conflicts with manual panning)
  const navigationInProgressRef = useRef<boolean>(false);

  // Safety timeout ref: auto-resets navigationInProgressRef after 5s.
  // Prevents permanent deadlock if navigation effect bails (Bug #1 fix).
  const navigationSafetyRef = useRef<NodeJS.Timeout | null>(null);

  // Helper: mark navigation in progress with auto-reset safety (Bug #1 fix).
  // If clearTargetPlayhead is never called (e.g., navigation effect bails because
  // target is outside domain and data never arrives), this prevents permanent deadlock.
  const startNavigation = useCallback(() => {
    navigationInProgressRef.current = true;
    if (navigationSafetyRef.current) clearTimeout(navigationSafetyRef.current);
    navigationSafetyRef.current = setTimeout(() => {
      navigationInProgressRef.current = false;
      navigationSafetyRef.current = null;
    }, 5000);
  }, []);

  // Track visible time range to load data for edges when zoomed out
  const visibleRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  // Track previous center to detect actual changes
  const prevCenterRef = useRef<string>(centerDate);

  // Update center date and zoom level when playhead/view changes
  // SKIP if navigation is in progress (button click, etc.)
  // Bug #7 fix: reads from refs (centerDateRef, zoomLevelRef) instead of state
  // to avoid stale closures during the window between render and ref-sync effect.
  const updateCenterFromPlayhead = useCallback((
    playheadTimestamp: Date,
    visibleRange?: { start: Date; end: Date },
    newZoomLevel?: number
  ) => {
    const currentCenterDate = centerDateRef.current;
    const currentZoomLevel = zoomLevelRef.current;

    // Only update zoom level if it changes the "bucket" (affects days loaded)
    // This prevents oscillation from small zoom changes
    if (newZoomLevel !== undefined) {
      const newBucket = getZoomBucket(newZoomLevel);
      const currentBucket = getZoomBucket(currentZoomLevel);
      if (newBucket !== currentBucket) {
        setZoomLevel(newZoomLevel);
      }
    }

    // Skip center updates if we're in the middle of a programmatic navigation
    if (navigationInProgressRef.current) {
      return;
    }

    // Store visible range for edge-based loading
    if (visibleRange) {
      visibleRangeRef.current = visibleRange;
    }

    const now = Date.now();

    // Debounce: don't update more than once per 500ms
    // Use longer cooldown (1s) after an actual center change to let data arrive.
    const cooldown = prevCenterRef.current !== currentCenterDate ? 1000 : 500;
    if (now - lastCenterUpdateRef.current < cooldown) {
      return;
    }
    prevCenterRef.current = currentCenterDate;

    // Calculate the center of the current centerDate (noon)
    const [year, month, day] = currentCenterDate.split('-').map(Number);
    const centerNoon = new Date(year, month - 1, day, 12, 0, 0);

    // Calculate hours from center
    const hoursFromCenter = Math.abs(playheadTimestamp.getTime() - centerNoon.getTime()) / (1000 * 60 * 60);

    // Check if visible edges are outside our loaded window
    // This handles the zoomed-out case where edges need data before playhead reaches them
    const currentRange = visibleRange || visibleRangeRef.current;
    const currentDaysNeeded = getDaysToLoadCount(newZoomLevel ?? currentZoomLevel);
    const halfWindow = Math.floor(currentDaysNeeded / 2);

    let needsEdgeLoad = false;
    let edgeTargetDate: string | null = null;

    if (currentRange) {
      const loadedStart = dateToStartOfDay(addDays(currentCenterDate, -halfWindow));
      const loadedEnd = dateToEndOfDay(addDays(currentCenterDate, halfWindow));
      const loadedSpanMs = loadedEnd.getTime() - loadedStart.getTime();
      const visibleSpanMs = currentRange.end.getTime() - currentRange.start.getTime();

      // Only consider edge-loading when the viewport is narrower than the loaded window.
      // When zoomed out so the viewport is wider than the loaded 3-day window,
      // edge detection would fire on every pan and cause oscillating center shifts.
      const bufferMs = 2 * 60 * 60 * 1000; // 2 hours
      if (visibleSpanMs < loadedSpanMs - 2 * bufferMs) {
        // If visible start is before loaded start (with 2hr buffer), shift center left
        if (currentRange.start.getTime() < loadedStart.getTime() + bufferMs) {
          needsEdgeLoad = true;
          edgeTargetDate = getDateString(currentRange.start);
        }
        // If visible end is after loaded end (with 2hr buffer), shift center right
        else if (currentRange.end.getTime() > loadedEnd.getTime() - bufferMs) {
          needsEdgeLoad = true;
          // For right edge, use the day before the edge to keep it centered
          const edgeDate = new Date(currentRange.end);
          edgeDate.setDate(edgeDate.getDate() - 1);
          edgeTargetDate = getDateString(edgeDate);
        }
      }
    }

    // Decide whether to update center based on playhead position OR visible edges
    const shouldUpdateFromPlayhead = hoursFromCenter > 12;
    const playheadDateStr = getDateString(playheadTimestamp);

    if (needsEdgeLoad && edgeTargetDate && edgeTargetDate !== currentCenterDate) {
      // Prioritize edge loading when zoomed out
      const today = getDateString(new Date());
      if (edgeTargetDate <= today) {
        lastCenterUpdateRef.current = now;
        setCenterDate(edgeTargetDate);
        centerDateRef.current = edgeTargetDate;
      }
    } else if (shouldUpdateFromPlayhead && playheadDateStr !== currentCenterDate) {
      lastCenterUpdateRef.current = now;
      setCenterDate(playheadDateStr);
      centerDateRef.current = playheadDateStr;
    }
  }, []); // No deps — reads from refs for always-current values

  // Check if any day is loading
  const isLoadingAny = useMemo(() => {
    for (const dayData of loadedDays.values()) {
      if (dayData.isLoading) return true;
    }
    return false;
  }, [loadedDays]);

  // Build set of dates that are currently loading (for loading indicators)
  const loadingDays = useMemo(() => {
    const loading = new Set<string>();
    for (const [date, dayData] of loadedDays.entries()) {
      if (dayData.isLoading) {
        loading.add(date);
      }
    }
    return loading;
  }, [loadedDays]);

  // Target date for programmatic navigation (e.g., "Today" button, prev/next)
  // When set, Timeline should pan to this date
  const [targetPlayheadDate, setTargetPlayheadDate] = useState<Date | null>(null);

  // Go to a specific date - used by navigation buttons
  // Sets the center date for data loading AND sets target for timeline panning
  const goToDate = useCallback((date: Date) => {
    startNavigation(); // Bug #1 fix: uses safety timeout

    const now = new Date();
    const dateStr = getDateString(date);
    centerDateRef.current = dateStr; // Sync ref immediately (before React re-render)
    setCenterDate(dateStr);
    // Target noon, but clamp to "now" for today (scale domain is capped at current time)
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0);
    setTargetPlayheadDate(targetDate > now ? now : targetDate);
  }, [startNavigation]);

  // Go to previous day — reads from ref (not stale closure) for rapid click safety
  const goToPrevDay = useCallback(() => {
    startNavigation(); // Bug #1 fix: uses safety timeout

    const prevDateStr = addDays(centerDateRef.current, -1);
    centerDateRef.current = prevDateStr;
    setCenterDate(prevDateStr);
    const [y, m, d] = prevDateStr.split('-').map(Number);
    setTargetPlayheadDate(new Date(y, m - 1, d, 12, 0, 0));
  }, [startNavigation]);

  // Go to next day — reads from ref, won't go past today
  const goToNextDay = useCallback(() => {
    const now = new Date();
    const today = getDateString(now);
    const nextDateStr = addDays(centerDateRef.current, 1);
    if (nextDateStr > today) return; // Can't navigate into the future

    startNavigation(); // Bug #1 fix: uses safety timeout
    centerDateRef.current = nextDateStr;
    setCenterDate(nextDateStr);

    // If next day is today, target current time (not noon) because the scale
    // domain is capped at "now". Targeting noon would be outside the domain
    // if it's before noon, causing the navigation effect to bail.
    if (nextDateStr === today) {
      setTargetPlayheadDate(now);
    } else {
      const [y, m, d] = nextDateStr.split('-').map(Number);
      setTargetPlayheadDate(new Date(y, m - 1, d, 12, 0, 0));
    }
  }, [startNavigation]);

  // Go to today (convenience function)
  const goToToday = useCallback(() => {
    startNavigation(); // Bug #1 fix: uses safety timeout

    const now = new Date();
    const dateStr = getDateString(now);
    centerDateRef.current = dateStr;
    setCenterDate(dateStr);
    // For today, pan to current time (or slightly before to show recent activity)
    setTargetPlayheadDate(now);
  }, [startNavigation]);

  // Ref for the 300ms delay timeout so we can clean it up on unmount (Bug #15 fix)
  const clearNavTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear the target after timeline has navigated to it
  const clearTargetPlayhead = useCallback(() => {
    setTargetPlayheadDate(null);

    // Cancel safety timeout since navigation completed successfully (Bug #1 fix)
    if (navigationSafetyRef.current) {
      clearTimeout(navigationSafetyRef.current);
      navigationSafetyRef.current = null;
    }

    // Delay re-enabling updateCenterFromPlayhead to avoid race with zoom-end debounce.
    // The zoom-end handler has 150ms debounce + triggers updateCenterFromPlayhead.
    // We need to stay in "navigation mode" until that fires, otherwise it reverts
    // centerDate based on stale playhead position. 300ms > 150ms debounce with margin.
    if (clearNavTimeoutRef.current) clearTimeout(clearNavTimeoutRef.current);
    clearNavTimeoutRef.current = setTimeout(() => {
      navigationInProgressRef.current = false;
      clearNavTimeoutRef.current = null;
    }, 300);
  }, []);

  // Cleanup timeouts on unmount (Bug #15 fix)
  useEffect(() => {
    return () => {
      if (navigationSafetyRef.current) clearTimeout(navigationSafetyRef.current);
      if (clearNavTimeoutRef.current) clearTimeout(clearNavTimeoutRef.current);
    };
  }, []);

  return {
    loadedDays,
    timeRange,
    allScreenshots,
    centerDate,
    playheadDate: centerDate,
    isLoadingAny,
    loadingDays,
    updateCenterFromPlayhead,
    setCenterDate,
    zoomLevel,
    // Navigation helpers
    targetPlayheadDate,
    goToDate,
    goToPrevDay,
    goToNextDay,
    goToToday,
    clearTargetPlayhead,
  };
}

// Export types for consumers
export type { DayData, MultiDayTimelineState, ScreenshotItem };
