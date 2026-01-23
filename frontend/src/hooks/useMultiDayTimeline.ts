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

// Calculate how many days to load based on zoom level
// k=1 is default (24h visible), k<1 is zoomed out
// Uses thresholds with hysteresis to prevent oscillation
function getDaysToLoadCount(zoomLevel: number): number {
  if (zoomLevel >= 0.9) return 3;      // Normal: center ± 1
  if (zoomLevel >= 0.4) return 5;      // ~48h visible: center ± 2
  return 7;                             // ~96h+ visible: center ± 3
}

// Get the "bucket" for zoom level to detect meaningful changes
function getZoomBucket(zoomLevel: number): number {
  if (zoomLevel >= 0.9) return 3;
  if (zoomLevel >= 0.4) return 5;
  return 7;
}

export function useMultiDayTimeline(initialDate: string) {
  const [centerDate, setCenterDate] = useState(initialDate);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Sync centerDate when initialDate changes (e.g., user clicks "Today" button)
  // This is critical - useState only uses initialDate on first mount
  useEffect(() => {
    setCenterDate(initialDate);
  }, [initialDate]);

  // Calculate which dates should be loaded based on center and zoom level
  // Always generate 7 dates (max window) but only use what we need
  const allPossibleDates = useMemo(() => {
    const today = getDateString(new Date());
    return [
      addDays(centerDate, -3),
      addDays(centerDate, -2),
      addDays(centerDate, -1),
      centerDate,
      addDays(centerDate, 1),
      addDays(centerDate, 2),
      addDays(centerDate, 3),
    ].filter(d => d <= today);
  }, [centerDate]);

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
  // Pass empty string for unused slots - the hook handles this gracefully
  const day0 = useTimelineGridData(allPossibleDates[0] || '');
  const day1 = useTimelineGridData(allPossibleDates[1] || '');
  const day2 = useTimelineGridData(allPossibleDates[2] || '');
  const day3 = useTimelineGridData(allPossibleDates[3] || '');
  const day4 = useTimelineGridData(allPossibleDates[4] || '');
  const day5 = useTimelineGridData(allPossibleDates[5] || '');
  const day6 = useTimelineGridData(allPossibleDates[6] || '');

  const screenshots0 = useScreenshotsForDate(allPossibleDates[0] || '');
  const screenshots1 = useScreenshotsForDate(allPossibleDates[1] || '');
  const screenshots2 = useScreenshotsForDate(allPossibleDates[2] || '');
  const screenshots3 = useScreenshotsForDate(allPossibleDates[3] || '');
  const screenshots4 = useScreenshotsForDate(allPossibleDates[4] || '');
  const screenshots5 = useScreenshotsForDate(allPossibleDates[5] || '');
  const screenshots6 = useScreenshotsForDate(allPossibleDates[6] || '');

  // Bundle all day data for easy access
  const allDayData = useMemo(() => [
    { date: allPossibleDates[0], grid: day0, screenshots: screenshots0 },
    { date: allPossibleDates[1], grid: day1, screenshots: screenshots1 },
    { date: allPossibleDates[2], grid: day2, screenshots: screenshots2 },
    { date: allPossibleDates[3], grid: day3, screenshots: screenshots3 },
    { date: allPossibleDates[4], grid: day4, screenshots: screenshots4 },
    { date: allPossibleDates[5], grid: day5, screenshots: screenshots5 },
    { date: allPossibleDates[6], grid: day6, screenshots: screenshots6 },
  ], [allPossibleDates, day0, day1, day2, day3, day4, day5, day6,
      screenshots0, screenshots1, screenshots2, screenshots3, screenshots4, screenshots5, screenshots6]);

  // Helper to normalize screenshots to common shape
  const normalizeScreenshots = (data: ScreenshotsResult): ScreenshotItem[] => {
    if (!data) return [];
    return data.map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      filepath: s.filepath,
      windowTitle: s.windowTitle ?? null,
      appName: s.appName ?? null,
      sessionId: s.sessionId ?? null,
    }));
  };

  // Build loaded days map - only include days we actually need
  const loadedDays = useMemo(() => {
    const map = new Map<string, DayData>();

    for (const dayInfo of allDayData) {
      // Only include if this date is in our "needed" list
      if (dayInfo.date && datesToLoad.includes(dayInfo.date)) {
        map.set(dayInfo.date, {
          gridData: dayInfo.grid.data,
          screenshots: normalizeScreenshots(dayInfo.screenshots.data),
          isLoading: dayInfo.grid.isLoading || dayInfo.screenshots.isLoading,
        });
      }
    }

    return map;
  }, [allDayData, datesToLoad]);

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

  // Track visible time range to load data for edges when zoomed out
  const visibleRangeRef = useRef<{ start: Date; end: Date } | null>(null);

  // Track previous center to detect actual changes
  const prevCenterRef = useRef<string>(centerDate);

  // Update center date and zoom level when playhead/view changes
  // SKIP if navigation is in progress (button click, etc.)
  const updateCenterFromPlayhead = useCallback((
    playheadTimestamp: Date,
    visibleRange?: { start: Date; end: Date },
    newZoomLevel?: number
  ) => {
    // Only update zoom level if it changes the "bucket" (affects days loaded)
    // This prevents oscillation from small zoom changes
    if (newZoomLevel !== undefined) {
      const newBucket = getZoomBucket(newZoomLevel);
      const currentBucket = getZoomBucket(zoomLevel);
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
    // Use longer cooldown (1.5s) after an actual center change to let data settle
    const cooldown = prevCenterRef.current !== centerDate ? 1500 : 500;
    if (now - lastCenterUpdateRef.current < cooldown) {
      return;
    }
    prevCenterRef.current = centerDate;

    // Calculate the center of the current centerDate (noon)
    const [year, month, day] = centerDate.split('-').map(Number);
    const centerNoon = new Date(year, month - 1, day, 12, 0, 0);

    // Calculate hours from center
    const hoursFromCenter = Math.abs(playheadTimestamp.getTime() - centerNoon.getTime()) / (1000 * 60 * 60);

    // Check if visible edges are outside our loaded window
    // This handles the zoomed-out case where edges need data before playhead reaches them
    const currentRange = visibleRange || visibleRangeRef.current;
    const currentDaysNeeded = getDaysToLoadCount(newZoomLevel ?? zoomLevel);
    const halfWindow = Math.floor(currentDaysNeeded / 2);

    let needsEdgeLoad = false;
    let edgeTargetDate: string | null = null;

    if (currentRange) {
      const loadedStart = dateToStartOfDay(addDays(centerDate, -halfWindow));
      const loadedEnd = dateToEndOfDay(addDays(centerDate, halfWindow));

      // If visible start is before loaded start (with 2hr buffer), shift center left
      const bufferMs = 2 * 60 * 60 * 1000; // 2 hours
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

    // Decide whether to update center based on playhead position OR visible edges
    const shouldUpdateFromPlayhead = hoursFromCenter > 12;
    const playheadDateStr = getDateString(playheadTimestamp);

    if (needsEdgeLoad && edgeTargetDate && edgeTargetDate !== centerDate) {
      // Prioritize edge loading when zoomed out
      const today = getDateString(new Date());
      if (edgeTargetDate <= today) {
        lastCenterUpdateRef.current = now;
        setCenterDate(edgeTargetDate);
      }
    } else if (shouldUpdateFromPlayhead && playheadDateStr !== centerDate) {
      lastCenterUpdateRef.current = now;
      setCenterDate(playheadDateStr);
    }
  }, [centerDate, zoomLevel]);

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
    // Mark navigation in progress to prevent updateCenterFromPlayhead interference
    navigationInProgressRef.current = true;

    const dateStr = getDateString(date);
    setCenterDate(dateStr);
    // Set target to noon of that day for a centered view
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0);
    setTargetPlayheadDate(targetDate);
  }, []);

  // Go to today (convenience function)
  const goToToday = useCallback(() => {
    // Mark navigation in progress to prevent updateCenterFromPlayhead interference
    navigationInProgressRef.current = true;

    const now = new Date();
    setCenterDate(getDateString(now));
    // For today, pan to current time (or slightly before to show recent activity)
    setTargetPlayheadDate(now);
  }, []);

  // Clear the target after timeline has navigated to it
  const clearTargetPlayhead = useCallback(() => {
    setTargetPlayheadDate(null);
    // Delay re-enabling updateCenterFromPlayhead to avoid race with final zoom events
    // The D3 zoom handlers may fire slightly after animation 'end' event
    setTimeout(() => {
      navigationInProgressRef.current = false;
    }, 100);
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
    goToToday,
    clearTargetPlayhead,
  };
}

// Export types for consumers
export type { DayData, MultiDayTimelineState, ScreenshotItem };
