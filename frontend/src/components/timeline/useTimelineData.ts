import { useMemo } from 'react';
import type { TimelineGridData } from '@/types/timeline';
import type { Screenshot } from '@/types/screenshot';
import type { TimelineData, TimelineRow, EventDot } from './timelineTypes';
import {
  EVENT_TYPE_COLORS,
  CATEGORY_HEX_COLORS,
  getAppHexColor,
} from './timelineTypes';
import type { TimelineFilters } from '../FilterControls';
import { makeEventKey } from '@/utils/eventKeys';

// Entry block data from ProjectsColumn
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

interface UseTimelineDataOptions {
  data: TimelineGridData | null | undefined;
  filters: TimelineFilters;
  groupBy?: 'app' | 'eventType';
  screenshots?: Screenshot[];
  entries?: EntryBlockData[];
  collapseActivityRows?: boolean; // Merge all activity events into single "In Focus" row
  hiddenLanes?: Set<string>; // Lanes to hide from the timeline
}

export function useTimelineData({
  data,
  filters,
  groupBy = 'app',
  screenshots,
  entries,
  collapseActivityRows = false,
  hiddenLanes = new Set(),
}: UseTimelineDataOptions): TimelineData | null {
  return useMemo(() => {
    if (!data) return null;

    // Parse the date for time range
    const [year, month, day] = data.date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDayRaw = new Date(year, month - 1, day, 23, 59, 59);

    // Cap end time at "now" if this is today (don't show future)
    const now = new Date();
    const isToday = now.getFullYear() === year && now.getMonth() === month - 1 && now.getDate() === day;
    const endOfDay = isToday ? new Date(Math.min(now.getTime(), endOfDayRaw.getTime())) : endOfDayRaw;
    const nowTimestamp = Math.floor(now.getTime() / 1000); // Unix timestamp in seconds

    // Helper to cap duration at "now" for today's events
    const capDuration = (startTimeSec: number, durationSec: number | undefined): number | undefined => {
      if (!durationSec || !isToday) return durationSec;
      const endTimeSec = startTimeSec + durationSec;
      if (endTimeSec > nowTimestamp) {
        // Cap at now
        return Math.max(0, nowTimestamp - startTimeSec);
      }
      return durationSec;
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

    // Process activity blocks (always shown)
    // When collapseActivityRows is true, merge all into single "In Focus" row
    if (filters.showScreenshots) {
      for (const [, hourApps] of Object.entries(data.hourlyGrid)) {
        for (const [appName, activities] of Object.entries(hourApps)) {
          for (const activity of activities) {
            // When collapsed, all activities go to "In Focus" row
            // When expanded, each app gets its own row (or 'Activities' if groupBy='eventType')
            const rowName = collapseActivityRows
              ? 'In Focus'
              : (groupBy === 'app' ? appName : 'Activities');

            const color = collapseActivityRows
              ? '#22c55e' // green-500 for merged "In Focus"
              : (groupBy === 'app'
                ? getAppHexColor(appName)
                : CATEGORY_HEX_COLORS[activity.category] || CATEGORY_HEX_COLORS.other);

            const event: EventDot = {
              id: makeEventKey('activity', activity.id),
              originalId: activity.id,
              timestamp: new Date(activity.startTime * 1000),
              type: 'activity',
              row: rowName,
              label: activity.windowTitle || appName,
              duration: capDuration(activity.startTime, activity.durationSeconds),
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
          const rowName = groupBy === 'app' ? 'Git' : 'Git';
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
          const rowName = groupBy === 'app' ? 'Shell' : 'Shell';
          const dot: EventDot = {
            id: makeEventKey('shell', event.id),
            originalId: event.id,
            timestamp: new Date(event.timestamp * 1000),
            type: 'shell',
            row: rowName,
            label: event.command,
            duration: capDuration(event.timestamp, event.durationSeconds),
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
          const rowName = groupBy === 'app' ? event.browser || 'Browser' : 'Browser';
          const dot: EventDot = {
            id: makeEventKey('browser', event.id),
            originalId: event.id,
            timestamp: new Date(event.timestamp * 1000),
            type: 'browser',
            row: rowName,
            label: event.title || event.domain,
            duration: capDuration(event.timestamp, event.visitDurationSeconds),
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
          const rowName = groupBy === 'app' ? 'Files' : 'Files';
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

    // Process Activity periods (inverse of AFK blocks) - show when user was active
    if (data.dayStats?.daySpan) {
      const dayStart = data.dayStats.daySpan.startTime;
      const dayEnd = data.dayStats.daySpan.endTime;

      // Collect and sort all AFK blocks
      const allAfkBlocks = Object.values(data.afkBlocks)
        .flat()
        .sort((a, b) => a.startTime - b.startTime);

      // Calculate activity periods as gaps between AFK periods
      let currentStart = dayStart;
      let activityId = 0;

      for (const afk of allAfkBlocks) {
        // If there's a gap before this AFK period, that's an activity period
        if (afk.startTime > currentStart) {
          const activityEnd = afk.startTime;
          const durationSeconds = activityEnd - currentStart;

          // Only include if duration is at least 60 seconds
          if (durationSeconds >= 60) {
            const rowName = 'Activity';
            const dot: EventDot = {
              id: `activity-${activityId}`,
              originalId: activityId,
              timestamp: new Date(currentStart * 1000),
              type: 'activity',
              row: rowName,
              label: `Active (${Math.round(durationSeconds / 60)}m)`,
              duration: durationSeconds,
              color: '#22c55e', // green-500 for activity
              metadata: { startTime: currentStart, endTime: activityEnd, durationSeconds },
            };
            addToRow(rowName, dot);
            activityId++;
          }
        }
        // Move past this AFK period
        currentStart = Math.max(currentStart, afk.endTime);
      }

      // Add final activity period after last AFK
      if (currentStart < dayEnd) {
        const durationSeconds = dayEnd - currentStart;
        if (durationSeconds >= 60) {
          const rowName = 'Activity';
          const dot: EventDot = {
            id: `activity-${activityId}`,
            originalId: activityId,
            timestamp: new Date(currentStart * 1000),
            type: 'activity',
            row: rowName,
            label: `Active (${Math.round(durationSeconds / 60)}m)`,
            duration: durationSeconds,
            color: '#22c55e',
            metadata: { startTime: currentStart, endTime: dayEnd, durationSeconds },
          };
          addToRow(rowName, dot);
        }
      }

      // If no AFK blocks, the entire day span is active
      if (allAfkBlocks.length === 0) {
        const durationSeconds = dayEnd - dayStart;
        const rowName = 'Activity';
        const dot: EventDot = {
          id: 'activity-0',
          originalId: 0,
          timestamp: new Date(dayStart * 1000),
          type: 'activity',
          row: rowName,
          label: `Active (${Math.round(durationSeconds / 60)}m)`,
          duration: durationSeconds,
          color: '#22c55e',
          metadata: { startTime: dayStart, endTime: dayEnd, durationSeconds },
        };
        addToRow(rowName, dot);
      }
    }

    // Process screenshots (if provided)
    if (screenshots && screenshots.length > 0) {
      for (const screenshot of screenshots) {
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

    // Process project-assigned entries (if provided) with continuity grouping
    if (entries && entries.length > 0) {
      // Group entries by projectId for continuity merging
      const entriesByProject = new Map<number, EntryBlockData[]>();
      for (const entry of entries) {
        if (!entriesByProject.has(entry.projectId)) {
          entriesByProject.set(entry.projectId, []);
        }
        entriesByProject.get(entry.projectId)!.push(entry);
      }

      // Merge consecutive entries for each project (within 5 minute gap)
      const GAP_THRESHOLD = 5 * 60; // 5 minutes in seconds

      for (const [projectId, projectEntries] of entriesByProject) {
        // Sort by start time
        projectEntries.sort((a, b) => a.startTime - b.startTime);

        // Merge consecutive entries
        const mergedEntries: {
          startTime: number;
          endTime: number;
          projectName: string;
          projectColor: string;
          apps: Set<string>;
          entryIds: number[];
        }[] = [];

        for (const entry of projectEntries) {
          const lastMerged = mergedEntries[mergedEntries.length - 1];

          // Check if this entry should be merged with the previous one
          if (lastMerged && entry.startTime <= lastMerged.endTime + GAP_THRESHOLD) {
            // Extend the merged entry
            lastMerged.endTime = Math.max(lastMerged.endTime, entry.endTime);
            lastMerged.apps.add(entry.appName);
            lastMerged.entryIds.push(entry.id);
          } else {
            // Start a new merged entry
            mergedEntries.push({
              startTime: entry.startTime,
              endTime: entry.endTime,
              projectName: entry.projectName,
              projectColor: entry.projectColor,
              apps: new Set([entry.appName]),
              entryIds: [entry.id],
            });
          }
        }

        // Create EventDots from merged entries
        for (const merged of mergedEntries) {
          const rowName = 'Projects';
          const rawDuration = merged.endTime - merged.startTime;
          const duration = capDuration(merged.startTime, rawDuration);
          const appList = Array.from(merged.apps).slice(0, 3).join(', ');
          const moreApps = merged.apps.size > 3 ? ` +${merged.apps.size - 3} more` : '';

          const dot: EventDot = {
            id: `project-merged-${projectId}-${merged.startTime}`,
            originalId: merged.entryIds[0], // Use first entry's ID
            timestamp: new Date(merged.startTime * 1000),
            type: 'projects',
            row: rowName,
            label: `${merged.projectName}: ${appList}${moreApps}`,
            duration: duration,
            color: merged.projectColor || EVENT_TYPE_COLORS.projects,
            metadata: {
              projectId: projectId,
              projectName: merged.projectName,
              projectColor: merged.projectColor,
              eventType: 'merged',
              entryIds: merged.entryIds,
              apps: Array.from(merged.apps),
            },
          };
          addToRow(rowName, dot);
        }
      }
    }

    // Process session summaries (AI summaries)
    if (data?.sessionSummaries && data.sessionSummaries.length > 0) {
      for (const session of data.sessionSummaries) {
        const rowName = 'Sessions';
        const topApps = session.topApps || [];
        const appList = topApps.slice(0, 3).map(a => a.appName).join(', ');
        const moreApps = topApps.length > 3 ? ` +${topApps.length - 3}` : '';

        const dot: EventDot = {
          id: makeEventKey('session', session.id),
          originalId: session.id,
          timestamp: new Date(session.startTime * 1000),
          type: 'session',
          row: rowName,
          label: session.summary || `Session: ${appList}${moreApps}`,
          duration: capDuration(session.startTime, session.durationSeconds),
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
      timeRange: {
        start: startOfDay,
        end: endOfDay,
      },
      totalEvents: allEvents.length,
      availableLanes,
    };
  }, [data, filters, groupBy, screenshots, entries, collapseActivityRows, hiddenLanes]);
}
