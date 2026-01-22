// frontend/src/hooks/useMultiDayTimeline.ts
import { useState, useCallback, useMemo } from 'react';
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

export function useMultiDayTimeline(initialDate: string) {
  const [centerDate, setCenterDate] = useState(initialDate);

  // Calculate which dates should be loaded (center +/- 1 day)
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

  // Build loaded days map
  const loadedDays = useMemo(() => {
    const map = new Map<string, DayData>();

    if (datesToLoad[0]) {
      map.set(datesToLoad[0], {
        gridData: day0.data,
        screenshots: normalizeScreenshots(screenshots0.data),
        isLoading: day0.isLoading || screenshots0.isLoading,
      });
    }
    if (datesToLoad[1]) {
      map.set(datesToLoad[1], {
        gridData: day1.data,
        screenshots: normalizeScreenshots(screenshots1.data),
        isLoading: day1.isLoading || screenshots1.isLoading,
      });
    }
    if (datesToLoad[2]) {
      map.set(datesToLoad[2], {
        gridData: day2.data,
        screenshots: normalizeScreenshots(screenshots2.data),
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
    const merged: ScreenshotItem[] = [];
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
  };
}

// Export types for consumers
export type { DayData, MultiDayTimelineState, ScreenshotItem };
