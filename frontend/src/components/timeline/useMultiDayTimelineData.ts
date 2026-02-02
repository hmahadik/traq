import { useMemo } from 'react';
import type { TimelineGridData } from '@/types/timeline';
import type { TimelineData, TimelineRow, EventDot } from './timelineTypes';
import {
  EVENT_TYPE_COLORS,
  getAppHexColor,
} from './timelineTypes';
import type { TimelineFilters } from '../FilterControls';
import { makeEventKey } from '@/utils/eventKeys';
import type { DayData } from '@/hooks/useMultiDayTimeline';

interface UseMultiDayTimelineDataOptions {
  loadedDays: Map<string, DayData>;
  timeRange: { start: Date; end: Date };
  filters: TimelineFilters;
  collapseActivityRows?: boolean; // Merge all activity events into single "In Focus" row
  hiddenLanes?: Set<string>; // Lanes to hide from the timeline
}

export function useMultiDayTimelineData({
  loadedDays,
  timeRange,
  filters,
  collapseActivityRows = false,
  hiddenLanes = new Set(),
}: UseMultiDayTimelineDataOptions): TimelineData | null {
  return useMemo(() => {
    // Check if we have any data
    if (loadedDays.size === 0) return null;

    // Check if any day has grid data
    let hasAnyData = false;
    for (const dayData of loadedDays.values()) {
      if (dayData.gridData) {
        hasAnyData = true;
        break;
      }
    }
    if (!hasAnyData) return null;

    // Get current time for capping durations - events shouldn't extend past "now"
    const now = new Date();
    const nowTimestamp = Math.floor(now.getTime() / 1000); // Unix timestamp in seconds
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Helper to cap duration at "now" for today's events
    const capDuration = (dateStr: string, startTimeSec: number, durationSec: number | undefined): number | undefined => {
      if (!durationSec) return durationSec;
      // Only cap for today's events
      if (dateStr !== todayStr) return durationSec;
      const endTimeSec = startTimeSec + durationSec;
      if (endTimeSec > nowTimestamp) {
        // Cap at now
        return Math.max(0, nowTimestamp - startTimeSec);
      }
      return durationSec;
    };

    // Helper to check if an event starts in the future (shouldn't be rendered)
    const isInFuture = (startTimeSec: number): boolean => {
      return startTimeSec > nowTimestamp;
    };

    const allEvents: EventDot[] = [];
    const rowMap = new Map<string, EventDot[]>();
    // Track normalized names to display names mapping
    const normalizedToDisplay = new Map<string, string>();

    // Helper to normalize row names (case-insensitive grouping)
    const normalizeRowName = (name: string): string => {
      return name.toLowerCase().trim();
    };

    // Helper to get display name (prefer capitalized version)
    const getDisplayName = (name: string): string => {
      const normalized = normalizeRowName(name);
      // Prefer existing display name or use title case
      if (normalizedToDisplay.has(normalized)) {
        const existing = normalizedToDisplay.get(normalized)!;
        // Prefer the capitalized version
        if (name[0] === name[0].toUpperCase() && existing[0] !== existing[0].toUpperCase()) {
          normalizedToDisplay.set(normalized, name);
          return name;
        }
        return existing;
      }
      normalizedToDisplay.set(normalized, name);
      return name;
    };

    // Helper to add event to appropriate row
    const addToRow = (rowName: string, event: EventDot) => {
      const displayName = getDisplayName(rowName);
      const normalized = normalizeRowName(rowName);

      // Update event's row to use display name
      event.row = displayName;

      if (!rowMap.has(normalized)) {
        rowMap.set(normalized, []);
      }
      rowMap.get(normalized)!.push(event);
      allEvents.push(event);
    };

    // Process each day's data
    for (const [dateStr, dayData] of loadedDays) {
      const data = dayData.gridData as TimelineGridData | null | undefined;
      if (!data) continue;

      // Process activity blocks (always shown)
      // When collapseActivityRows is true, merge all into single "In Focus" row
      if (filters.showScreenshots) {
        for (const [, hourApps] of Object.entries(data.hourlyGrid)) {
          for (const [appName, activities] of Object.entries(hourApps)) {
            for (const activity of activities) {
              // Skip events that start in the future (shouldn't happen, but defensive)
              if (isInFuture(activity.startTime)) continue;

              // When collapsed, all activities go to "In Focus" row
              // When expanded, each app gets its own row
              const rowName = collapseActivityRows
                ? 'In Focus'
                : appName;

              const color = collapseActivityRows
                ? '#22c55e' // green-500 for merged "In Focus"
                : getAppHexColor(appName);

              const event: EventDot = {
                id: makeEventKey('activity', activity.id),
                originalId: activity.id,
                timestamp: new Date(activity.startTime * 1000),
                type: 'activity',
                row: rowName,
                label: activity.windowTitle || appName,
                duration: capDuration(dateStr, activity.startTime, activity.durationSeconds),
                color,
                metadata: activity,
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
            // Skip events that are in the future
            if (isInFuture(event.timestamp)) continue;

            const rowName = 'Git';
            const dot: EventDot = {
              id: makeEventKey('git', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'git',
              row: rowName,
              label: event.messageSubject || event.message,
              color: EVENT_TYPE_COLORS.git,
              metadata: event,
            };
            addToRow(rowName, dot);
          }
        }
      }

      // Process shell events
      if (filters.showShell) {
        for (const [, hourEvents] of Object.entries(data.shellEvents)) {
          for (const event of hourEvents) {
            // Skip events that start in the future
            if (isInFuture(event.timestamp)) continue;

            const rowName = 'Shell';
            const dot: EventDot = {
              id: makeEventKey('shell', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'shell',
              row: rowName,
              label: event.command,
              duration: capDuration(dateStr, event.timestamp, event.durationSeconds),
              color: EVENT_TYPE_COLORS.shell,
              metadata: event,
            };
            addToRow(rowName, dot);
          }
        }
      }

      // Process browser events
      if (filters.showBrowser) {
        for (const [, hourEvents] of Object.entries(data.browserEvents)) {
          for (const event of hourEvents) {
            // Skip events that start in the future
            if (isInFuture(event.timestamp)) continue;

            const rowName = event.browser || 'Browser';
            const dot: EventDot = {
              id: makeEventKey('browser', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'browser',
              row: rowName,
              label: event.title || event.domain,
              duration: capDuration(dateStr, event.timestamp, event.visitDurationSeconds),
              color: getAppHexColor(event.browser || 'browser'),
              metadata: event,
            };
            addToRow(rowName, dot);
          }
        }
      }

      // Process file events
      if (filters.showFiles) {
        for (const [, hourEvents] of Object.entries(data.fileEvents)) {
          for (const event of hourEvents) {
            // Skip events that start in the future
            if (isInFuture(event.timestamp)) continue;

            const rowName = 'Files';
            const dot: EventDot = {
              id: makeEventKey('file', event.id),
              originalId: event.id,
              timestamp: new Date(event.timestamp * 1000),
              type: 'file',
              row: rowName,
              label: `${event.eventType}: ${event.fileName}`,
              color: EVENT_TYPE_COLORS.file,
              metadata: event,
            };
            addToRow(rowName, dot);
          }
        }
      }

      // Process Activity states from backend (active, break, afk)
      if (data.activityStates && data.activityStates.length > 0) {
        const stateColors: Record<string, string> = {
          active: '#22c55e', // green-500
          break: '#f59e0b',  // amber-500
          afk: '#6b7280',    // gray-500
        };

        const stateLabels: Record<string, string> = {
          active: 'Active',
          break: 'Break',
          afk: 'AFK',
        };

        const formatDuration = (seconds: number): string => {
          if (seconds < 3600) {
            return `${Math.round(seconds / 60)}m`;
          }
          const hours = Math.floor(seconds / 3600);
          const mins = Math.round((seconds % 3600) / 60);
          return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
        };

        for (let i = 0; i < data.activityStates.length; i++) {
          const state = data.activityStates[i];

          // Skip future events on today
          if (dateStr === todayStr && state.startTime >= nowTimestamp) continue;

          // Cap end time at now for today
          const effectiveEnd = (dateStr === todayStr && state.endTime > nowTimestamp)
            ? nowTimestamp
            : state.endTime;
          const effectiveDuration = effectiveEnd - state.startTime;

          if (effectiveDuration < 60) continue; // Skip very short states

          const rowName = 'Activity';
          const label = `${stateLabels[state.state] || state.state} (${formatDuration(effectiveDuration)})`;
          const color = stateColors[state.state] || stateColors.afk;

          const dot: EventDot = {
            id: `activity-state-${dateStr}-${i}`,
            originalId: i,
            timestamp: new Date(state.startTime * 1000),
            type: 'activity',
            row: rowName,
            label,
            duration: effectiveDuration,
            color,
            metadata: {
              startTime: state.startTime,
              endTime: effectiveEnd,
              durationSeconds: effectiveDuration,
              state: state.state,
            },
          };
          addToRow(rowName, dot);
        }
      }

      // Process screenshots from this day's data
      if (dayData.screenshots && dayData.screenshots.length > 0) {
        for (const screenshot of dayData.screenshots) {
          // Skip screenshots in the future (shouldn't happen but defensive)
          if (isInFuture(screenshot.timestamp)) continue;

          const rowName = 'Screenshots';
          const dot: EventDot = {
            id: makeEventKey('screenshot', screenshot.id),
            originalId: screenshot.id,
            timestamp: new Date(screenshot.timestamp * 1000),
            type: 'screenshot',
            row: rowName,
            label: screenshot.windowTitle || screenshot.appName || 'Screenshot',
            color: EVENT_TYPE_COLORS.screenshot,
            metadata: screenshot,
          };
          addToRow(rowName, dot);
        }
      }

      // Process session summaries (AI summaries)
      if (data.sessionSummaries && data.sessionSummaries.length > 0) {
        for (const session of data.sessionSummaries) {
          // Skip sessions that start in the future
          if (isInFuture(session.startTime)) continue;

          const rowName = 'Sessions';
          const topApps = session.topApps || [];
          const appList = topApps.slice(0, 3).join(', ');
          const moreApps = topApps.length > 3 ? ` +${topApps.length - 3}` : '';

          const dot: EventDot = {
            id: makeEventKey('session', session.id),
            originalId: session.id,
            timestamp: new Date(session.startTime * 1000),
            type: 'session',
            row: rowName,
            label: session.summary || `Session: ${appList}${moreApps}`,
            duration: capDuration(dateStr, session.startTime, session.durationSeconds ?? undefined),
            color: EVENT_TYPE_COLORS.session,
            metadata: {
              explanation: session.explanation,
              tags: session.tags,
              topApps: session.topApps,
              isDraft: session.isDraft,
              draftStatus: session.draftStatus,
              confidence: session.confidence,
              category: session.category,
            },
          };
          addToRow(rowName, dot);
        }
      }
    }

    // Convert row map to sorted array
    const allRows: TimelineRow[] = Array.from(rowMap.entries())
      .map(([normalizedName, events]) => {
        // Sort events by timestamp
        events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        // Get primary color from first event or use default
        const primaryColor = events[0]?.color || '#6b7280';

        // Use the display name (properly capitalized) instead of normalized
        const displayName = normalizedToDisplay.get(normalizedName) || normalizedName;

        return {
          name: displayName,
          color: primaryColor,
          dotCount: events.length,
          data: events,
        };
      })
      // Sort rows: Fixed order at top, then app rows by count, then special rows at bottom
      .sort((a, b) => {
        // Fixed order for top rows
        const fixedOrder = ['In Focus', 'Activity', 'Screenshots', 'Projects', 'Sessions'];
        const aFixed = fixedOrder.indexOf(a.name);
        const bFixed = fixedOrder.indexOf(b.name);

        // If both are in fixed order, sort by that order
        if (aFixed !== -1 && bFixed !== -1) return aFixed - bFixed;
        // If only one is in fixed order, it goes first
        if (aFixed !== -1) return -1;
        if (bFixed !== -1) return 1;

        // Special rows go at the bottom
        const specialRows = ['Git', 'Shell', 'Browser', 'Files'];
        const aIsSpecial = specialRows.includes(a.name);
        const bIsSpecial = specialRows.includes(b.name);

        if (aIsSpecial && !bIsSpecial) return 1;
        if (!aIsSpecial && bIsSpecial) return -1;
        if (aIsSpecial && bIsSpecial) {
          return specialRows.indexOf(a.name) - specialRows.indexOf(b.name);
        }

        // App rows sorted by event count
        return b.dotCount - a.dotCount;
      });

    // Collect all available lane names before filtering (for dropdown)
    const availableLanes = allRows.map(row => row.name);

    // Filter out hidden lanes
    const rows = allRows.filter(row => !hiddenLanes.has(row.name));

    return {
      rows,
      timeRange,
      totalEvents: allEvents.length,
      availableLanes,
    };
  }, [loadedDays, timeRange, filters, collapseActivityRows, hiddenLanes]);
}
