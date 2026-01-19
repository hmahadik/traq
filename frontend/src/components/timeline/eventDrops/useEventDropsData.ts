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

// Entry block data from EntriesColumn
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

interface UseEventDropsDataOptions {
  data: TimelineGridData | null | undefined;
  filters: TimelineFilters;
  groupBy?: 'app' | 'eventType';
  screenshots?: Screenshot[];
  entries?: EntryBlockData[];
}

export function useEventDropsData({
  data,
  filters,
  groupBy = 'app',
  screenshots,
  entries,
}: UseEventDropsDataOptions): EventDropsData | null {
  return useMemo(() => {
    if (!data) return null;

    // Parse the date for time range
    const [year, month, day] = data.date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

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
    if (filters.showScreenshots) {
      for (const [, hourApps] of Object.entries(data.hourlyGrid)) {
        for (const [appName, activities] of Object.entries(hourApps)) {
          for (const activity of activities) {
            const rowName = groupBy === 'app' ? appName : 'Activities';
            const color =
              groupBy === 'app'
                ? getAppHexColor(appName)
                : CATEGORY_HEX_COLORS[activity.category] || CATEGORY_HEX_COLORS.other;

            const event: EventDot = {
              id: `activity-${activity.id}`,
              originalId: activity.id,
              timestamp: new Date(activity.startTime * 1000),
              type: 'activity',
              row: rowName,
              label: activity.windowTitle || appName,
              duration: activity.durationSeconds,
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
            id: `git-${event.id}`,
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
            id: `shell-${event.id}`,
            originalId: event.id,
            timestamp: new Date(event.timestamp * 1000),
            type: 'shell',
            row: rowName,
            label: event.command,
            duration: event.durationSeconds,
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
            id: `browser-${event.id}`,
            originalId: event.id,
            timestamp: new Date(event.timestamp * 1000),
            type: 'browser',
            row: rowName,
            label: event.title || event.domain,
            duration: event.visitDurationSeconds,
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
            id: `file-${event.id}`,
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

    // Process AFK blocks (shown as events too, but in their own row)
    for (const [, hourBlocks] of Object.entries(data.afkBlocks)) {
      for (const block of hourBlocks) {
        const rowName = 'Breaks';
        const dot: EventDot = {
          id: `afk-${block.id}`,
          originalId: block.id,
          timestamp: new Date(block.startTime * 1000),
          type: 'afk',
          row: rowName,
          label: `Break (${Math.round(block.durationSeconds / 60)}m)`,
          duration: block.durationSeconds,
          color: EVENT_TYPE_COLORS.afk,
          metadata: block,
        };
        addToRow(rowName, dot);
      }
    }

    // Process screenshots (if provided)
    if (screenshots && screenshots.length > 0) {
      for (const screenshot of screenshots) {
        const rowName = 'Screenshots';
        const dot: EventDot = {
          id: `screenshot-${screenshot.id}`,
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

    // Process project-assigned entries (if provided)
    if (entries && entries.length > 0) {
      for (const entry of entries) {
        const rowName = 'Projects';
        const dot: EventDot = {
          id: `project-${entry.eventType}-${entry.id}`,
          originalId: entry.id,
          timestamp: new Date(entry.startTime * 1000),
          type: 'projects',
          row: rowName,
          label: `${entry.projectName}: ${entry.appName}`,
          duration: entry.durationSeconds,
          color: entry.projectColor || EVENT_TYPE_COLORS.projects,
          metadata: {
            projectId: entry.projectId,
            projectName: entry.projectName,
            projectColor: entry.projectColor,
            eventType: entry.eventType,
            eventId: entry.id,
            appName: entry.appName,
            windowTitle: entry.windowTitle,
          },
        };
        addToRow(rowName, dot);
      }
    }

    // Convert row map to sorted array
    const rows: EventDropsRow[] = Array.from(rowMap.entries())
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
      // Sort rows: Projects first, then apps with most events, then special rows (Git, Shell, etc.)
      .sort((a, b) => {
        // Projects lane always first
        if (a.name === 'Projects') return -1;
        if (b.name === 'Projects') return 1;

        const specialRows = ['Screenshots', 'Git', 'Shell', 'Browser', 'Files', 'Breaks'];
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
      timeRange: {
        start: startOfDay,
        end: endOfDay,
      },
      totalEvents: allEvents.length,
    };
  }, [data, filters, groupBy, screenshots, entries]);
}
