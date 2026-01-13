/**
 * Get cleaner display name for an app
 * Converts system names like "google-chrome" to "Chrome"
 */
const APP_DISPLAY_NAMES: Record<string, string> = {
  'google-chrome': 'Chrome',
  'chromium': 'Chromium',
  'chromium-browser': 'Chromium',
  'firefox': 'Firefox',
  'firefox-esr': 'Firefox',
  'code': 'VS Code',
  'code-oss': 'VS Code',
  'tilix': 'Tilix',
  'gnome-terminal': 'Terminal',
  'konsole': 'Konsole',
  'alacritty': 'Alacritty',
  'kitty': 'Kitty',
  'org.gnome.nautilus': 'Files',
  'nautilus': 'Files',
  'dolphin': 'Files',
  'thunar': 'Files',
  'eog': 'Image Viewer',
  'gwenview': 'Image Viewer',
  'slack': 'Slack',
  'discord': 'Discord',
  'teams': 'Teams',
  'zoom': 'Zoom',
  'spotify': 'Spotify',
  'notion': 'Notion',
  'obsidian': 'Obsidian',
  'figma-linux': 'Figma',
};

export function getAppDisplayName(appName: string): string {
  const lower = appName.toLowerCase();
  if (APP_DISPLAY_NAMES[lower]) return APP_DISPLAY_NAMES[lower];

  // Remove common prefixes/suffixes
  let display = appName
    .replace(/^org\.gnome\./i, '')
    .replace(/^org\.kde\./i, '')
    .replace(/^com\.[^.]+\./i, '')
    .replace(/-dev-linux-amd64$/i, '')
    .replace(/-linux-amd64$/i, '')
    .replace(/-linux$/i, '')
    .replace(/\.exe$/i, '')
    .replace(/\s*\([^)]+\)$/i, ''); // Remove parenthetical suffixes

  // Capitalize first letter
  return display.charAt(0).toUpperCase() + display.slice(1);
}

/**
 * Format decimal hours to human-readable duration (e.g., 3.75 -> "3h 45m")
 */
export function formatDecimalHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) {
    return `${h}h ${m}m`;
  }
  if (h > 0) {
    return `${h}h`;
  }
  if (m > 0) {
    return `${m}m`;
  }
  return '0m';
}

/**
 * Groups activity blocks that have small gaps between them.
 * This creates a cleaner timeline view like Timely by merging
 * adjacent activities from the same app that are within the gap threshold.
 *
 * @param blocks - Array of activity blocks to group
 * @param maxGapSeconds - Maximum gap in seconds to consider for merging (default: 300 = 5 minutes)
 * @returns Array of grouped activity blocks (merged blocks have combined duration)
 */
export interface ActivityBlockForGrouping {
  id: number;
  windowTitle: string;
  appName: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  category: string;
  hourOffset: number;
  minuteOffset: number;
  pixelPosition: number;
  pixelHeight: number;
}

export interface GroupedActivityBlock extends ActivityBlockForGrouping {
  mergedCount: number; // How many blocks were merged (1 = no merge)
  mergedTitles: string[]; // All window titles in this group
}

export function groupAdjacentActivities(
  blocks: ActivityBlockForGrouping[],
  maxGapSeconds: number = 300 // 5 minutes default
): GroupedActivityBlock[] {
  if (blocks.length === 0) return [];

  // Ensure each block has a valid endTime (calculate from startTime + duration if missing)
  const blocksWithEndTime = blocks.map(block => ({
    ...block,
    endTime: block.endTime > 0 ? block.endTime : block.startTime + block.durationSeconds,
  }));

  // Sort by start time
  const sorted = blocksWithEndTime.sort((a, b) => a.startTime - b.startTime);
  const grouped: GroupedActivityBlock[] = [];

  let currentGroup: GroupedActivityBlock | null = null;

  for (const block of sorted) {
    if (!currentGroup) {
      // Start a new group
      currentGroup = {
        ...block,
        mergedCount: 1,
        mergedTitles: [block.windowTitle],
      };
    } else {
      // Check if this block should be merged with the current group
      // Gap can be negative (overlapping blocks) - that's OK, still merge them
      const gap = block.startTime - currentGroup.endTime;

      if (gap <= maxGapSeconds) {
        // Merge: extend the current group
        const newEndTime = Math.max(currentGroup.endTime, block.endTime);
        currentGroup.endTime = newEndTime;
        currentGroup.durationSeconds = newEndTime - currentGroup.startTime;
        currentGroup.mergedCount++;
        // Collect unique window titles
        if (!currentGroup.mergedTitles.includes(block.windowTitle)) {
          currentGroup.mergedTitles.push(block.windowTitle);
        }
        // Keep the most recent window title as the primary
        currentGroup.windowTitle = block.windowTitle;
      } else {
        // Gap is too large, save current group and start new one
        grouped.push(currentGroup);
        currentGroup = {
          ...block,
          mergedCount: 1,
          mergedTitles: [block.windowTitle],
        };
      }
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    grouped.push(currentGroup);
  }

  return grouped;
}

/**
 * Groups browser events by domain within a time window.
 * Events from the same domain that occur within maxGapSeconds are merged.
 *
 * @param events - Array of browser events to group
 * @param maxGapSeconds - Maximum gap in seconds to consider for merging (default: 900 = 15 minutes)
 * @returns Array of grouped browser events
 */
export interface BrowserEventForGrouping {
  id: number;
  timestamp: number;
  url: string;
  title: string;
  domain: string;
  browser: string;
  visitDurationSeconds: number;
  transitionType: string;
  hourOffset: number;
  minuteOffset: number;
  pixelPosition: number;
}

export interface GroupedBrowserEvent extends BrowserEventForGrouping {
  mergedCount: number;
  totalDurationSeconds: number;
  mergedTitles: string[];
  mergedDomains: string[]; // All domains in this group
  startTimestamp: number;
  endTimestamp: number;
}

/**
 * Groups browser events by time proximity (regardless of domain).
 * Events that occur within maxGapSeconds are merged into a single block.
 * This prevents visual overlap in the timeline.
 */
export function groupBrowserEventsByDomain(
  events: BrowserEventForGrouping[],
  maxGapSeconds: number = 900 // 15 minutes default
): GroupedBrowserEvent[] {
  if (events.length === 0) return [];

  // Sort by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const grouped: GroupedBrowserEvent[] = [];

  let currentGroup: GroupedBrowserEvent | null = null;

  for (const event of sorted) {
    const eventEndTime = event.timestamp + (event.visitDurationSeconds || 60);

    if (!currentGroup) {
      // Start a new group
      currentGroup = {
        ...event,
        mergedCount: 1,
        totalDurationSeconds: event.visitDurationSeconds || 0,
        mergedTitles: [event.title],
        mergedDomains: [event.domain],
        startTimestamp: event.timestamp,
        endTimestamp: eventEndTime,
      };
    } else {
      // Check if this event overlaps or is close to current group
      const gap = event.timestamp - currentGroup.endTimestamp;

      if (gap <= maxGapSeconds) {
        // Merge: extend the current group
        currentGroup.endTimestamp = Math.max(currentGroup.endTimestamp, eventEndTime);
        currentGroup.totalDurationSeconds += event.visitDurationSeconds || 0;
        currentGroup.mergedCount++;

        // Keep unique titles
        if (!currentGroup.mergedTitles.includes(event.title)) {
          currentGroup.mergedTitles.push(event.title);
        }
        // Keep unique domains
        if (!currentGroup.mergedDomains.includes(event.domain)) {
          currentGroup.mergedDomains.push(event.domain);
        }

        // Update to most recent event's info
        currentGroup.title = event.title;
        currentGroup.url = event.url;
        currentGroup.domain = event.domain;
        currentGroup.hourOffset = event.hourOffset;
        currentGroup.minuteOffset = event.minuteOffset;
        currentGroup.pixelPosition = event.pixelPosition;
      } else {
        // Gap too large, save current group and start new one
        grouped.push(currentGroup);
        currentGroup = {
          ...event,
          mergedCount: 1,
          totalDurationSeconds: event.visitDurationSeconds || 0,
          mergedTitles: [event.title],
          mergedDomains: [event.domain],
          startTimestamp: event.timestamp,
          endTimestamp: eventEndTime,
        };
      }
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    grouped.push(currentGroup);
  }

  console.log(`[groupBrowserEvents] ${events.length} events -> ${grouped.length} groups`);
  return grouped;
}

/**
 * Generic interface for any event that can be grouped by time.
 * Events must have at least a timestamp and id.
 */
export interface TimeGroupableEvent {
  id: number;
  timestamp: number;
}

/**
 * Generic grouped event result
 */
export interface GroupedTimeEvent<T extends TimeGroupableEvent> {
  events: T[];
  startTimestamp: number;
  endTimestamp: number;
  mergedCount: number;
}

/**
 * Generic function to group events by time proximity.
 * Events that occur within maxGapSeconds are merged into a single group.
 *
 * @param events - Array of events to group (must have timestamp and id)
 * @param maxGapSeconds - Maximum gap in seconds to consider for merging
 * @param getDuration - Optional function to get duration of an event (for calculating end time)
 * @returns Array of grouped events
 */
export function groupEventsByTime<T extends TimeGroupableEvent>(
  events: T[],
  maxGapSeconds: number,
  getDuration?: (event: T) => number
): GroupedTimeEvent<T>[] {
  if (events.length === 0) return [];

  // Sort by timestamp
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const grouped: GroupedTimeEvent<T>[] = [];

  let currentGroup: GroupedTimeEvent<T> | null = null;

  for (const event of sorted) {
    const eventDuration = getDuration ? getDuration(event) : 0;
    const eventEndTime = event.timestamp + eventDuration;

    if (!currentGroup) {
      // Start a new group
      currentGroup = {
        events: [event],
        startTimestamp: event.timestamp,
        endTimestamp: eventEndTime,
        mergedCount: 1,
      };
    } else {
      // Check if this event overlaps or is close to current group
      const gap = event.timestamp - currentGroup.endTimestamp;

      if (gap <= maxGapSeconds) {
        // Merge: extend the current group
        currentGroup.events.push(event);
        currentGroup.endTimestamp = Math.max(currentGroup.endTimestamp, eventEndTime);
        currentGroup.mergedCount++;
      } else {
        // Gap too large, save current group and start new one
        grouped.push(currentGroup);
        currentGroup = {
          events: [event],
          startTimestamp: event.timestamp,
          endTimestamp: eventEndTime,
          mergedCount: 1,
        };
      }
    }
  }

  // Don't forget the last group
  if (currentGroup) {
    grouped.push(currentGroup);
  }

  return grouped;
}

/**
 * Grouped Git event for display
 */
export interface GroupedGitEvent {
  id: number;
  timestamp: number;
  startTimestamp: number;
  endTimestamp: number;
  mergedCount: number;
  events: Array<{
    id: number;
    timestamp: number;
    message: string;
    messageSubject: string;
    shortHash: string;
    repository: string;
    branch: string;
    insertions: number;
    deletions: number;
  }>;
  // Summary stats
  totalInsertions: number;
  totalDeletions: number;
  repositories: string[];
  branches: string[];
  // Primary event info (first/most recent)
  message: string;
  messageSubject: string;
  shortHash: string;
  repository: string;
  branch: string;
}

/**
 * Groups Git events by time proximity
 */
export function groupGitEvents(
  events: Array<{
    id: number;
    timestamp: number;
    message: string;
    messageSubject: string;
    shortHash: string;
    repository: string;
    branch: string;
    insertions: number;
    deletions: number;
  }>,
  maxGapSeconds: number = 900
): GroupedGitEvent[] {
  const baseGroups = groupEventsByTime(events, maxGapSeconds);

  return baseGroups.map(group => {
    const firstEvent = group.events[0];
    const repos = [...new Set(group.events.map(e => e.repository))];
    const branches = [...new Set(group.events.map(e => e.branch))];

    return {
      id: firstEvent.id,
      timestamp: firstEvent.timestamp,
      startTimestamp: group.startTimestamp,
      endTimestamp: group.endTimestamp,
      mergedCount: group.mergedCount,
      events: group.events,
      totalInsertions: group.events.reduce((sum, e) => sum + e.insertions, 0),
      totalDeletions: group.events.reduce((sum, e) => sum + e.deletions, 0),
      repositories: repos,
      branches: branches,
      message: firstEvent.message,
      messageSubject: firstEvent.messageSubject,
      shortHash: firstEvent.shortHash,
      repository: firstEvent.repository,
      branch: firstEvent.branch,
    };
  });
}

/**
 * Grouped Shell event for display
 */
export interface GroupedShellEvent {
  id: number;
  timestamp: number;
  startTimestamp: number;
  endTimestamp: number;
  mergedCount: number;
  events: Array<{
    id: number;
    timestamp: number;
    command: string;
    shellType: string;
    workingDirectory: string;
    exitCode: number;
    durationSeconds: number;
  }>;
  // Summary stats
  totalDurationSeconds: number;
  successCount: number;
  failureCount: number;
  directories: string[];
  // Primary event info (first)
  command: string;
  shellType: string;
  workingDirectory: string;
  exitCode: number;
}

/**
 * Groups Shell events by time proximity
 */
export function groupShellEvents(
  events: Array<{
    id: number;
    timestamp: number;
    command: string;
    shellType: string;
    workingDirectory: string;
    exitCode: number;
    durationSeconds: number;
  }>,
  maxGapSeconds: number = 600 // 10 minutes for shell
): GroupedShellEvent[] {
  const baseGroups = groupEventsByTime(
    events,
    maxGapSeconds,
    (e) => e.durationSeconds
  );

  return baseGroups.map(group => {
    const firstEvent = group.events[0];
    const dirs = [...new Set(group.events.map(e => e.workingDirectory).filter(Boolean))];

    return {
      id: firstEvent.id,
      timestamp: firstEvent.timestamp,
      startTimestamp: group.startTimestamp,
      endTimestamp: group.endTimestamp,
      mergedCount: group.mergedCount,
      events: group.events,
      totalDurationSeconds: group.events.reduce((sum, e) => sum + e.durationSeconds, 0),
      successCount: group.events.filter(e => e.exitCode === 0).length,
      failureCount: group.events.filter(e => e.exitCode !== 0).length,
      directories: dirs,
      command: firstEvent.command,
      shellType: firstEvent.shellType,
      workingDirectory: firstEvent.workingDirectory,
      exitCode: firstEvent.exitCode,
    };
  });
}

/**
 * Snaps a timestamp to the nearest 15-minute boundary
 * @param timestamp - Unix timestamp in seconds
 * @param snapDirection - 'floor' snaps down, 'ceil' snaps up, 'nearest' snaps to closest
 * @returns Snapped timestamp in seconds
 */
export function snapTo15Minutes(
  timestamp: number,
  snapDirection: 'floor' | 'ceil' | 'nearest' = 'floor'
): number {
  const date = new Date(timestamp * 1000);
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  let snappedMinutes: number;

  if (snapDirection === 'floor') {
    snappedMinutes = Math.floor(minutes / 15) * 15;
  } else if (snapDirection === 'ceil') {
    snappedMinutes = Math.ceil(minutes / 15) * 15;
  } else {
    // nearest
    const remainder = minutes % 15;
    snappedMinutes = remainder < 7.5
      ? Math.floor(minutes / 15) * 15
      : Math.ceil(minutes / 15) * 15;
  }

  date.setMinutes(snappedMinutes);
  date.setSeconds(0);
  date.setMilliseconds(0);

  return Math.floor(date.getTime() / 1000);
}
