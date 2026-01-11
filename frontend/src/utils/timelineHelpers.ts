// Legacy types - keeping for reference but not used in v3 grid
// import { TimelineEvent, getEventDuration } from '@/types/timelineEvent';

// Stub for legacy functions - these aren't used in v3 grid
const getEventDuration = (event: any): number | null => {
  return event?.durationSeconds || event?.duration || null;
};

/**
 * Represents a positioned activity in the timeline (legacy)
 */
export interface PositionedActivity {
  id: number;
  activity: any; // Was TimelineEvent
  top: number; // pixels from top of grid
  left: number; // pixels from left (lane offset)
  height: number; // pixels
}

/**
 * Configuration for layout
 */
interface LayoutConfig {
  startHour: number;
  endHour: number;
  pixelsPerHour?: number;
}

/**
 * Converts a time (hour:minute) to pixel position from day start
 * @param timestamp - Unix timestamp (milliseconds)
 * @param startHour - Start hour (0-24)
 * @param pixelsPerHour - How many pixels = 1 hour (default: 60)
 */
export function timeToPixels(
  timestamp: number,
  startHour: number,
  pixelsPerHour: number = 60
): number {
  const date = new Date(timestamp);
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const pixelsFromMidnight = hours * pixelsPerHour;
  const pixelsFromStart = pixelsFromMidnight - startHour * pixelsPerHour;
  return Math.max(0, pixelsFromStart);
}

/**
 * Converts duration in seconds to pixel height
 * @param seconds - Duration in seconds
 * @param pixelsPerHour - How many pixels = 1 hour (default: 60)
 */
export function durationToPixels(seconds: number, pixelsPerHour: number = 60): number {
  const hours = seconds / 3600;
  return Math.max(4, Math.round(hours * pixelsPerHour)); // Minimum 4px height
}

/**
 * Groups activities by app and calculates positions for app-based column layout
 * Returns activities grouped by app with Y positions calculated
 */
export function layoutActivities(
  activities: TimelineEvent[],
  config: LayoutConfig
): PositionedActivity[] {
  const { startHour, endHour, pixelsPerHour = 60 } = config;

  // Filter and validate activities
  const validActivities = activities
    .filter((a) => {
      const duration = getEventDuration(a);
      return duration && duration > 0;
    })
    .sort((a, b) => a.timestamp - b.timestamp);

  // Calculate positions - left offset is 0 for all (each app gets its own column)
  const positioned: PositionedActivity[] = validActivities.map((activity) => {
    const duration = getEventDuration(activity)!;
    const top = timeToPixels(activity.timestamp, startHour, pixelsPerHour);
    const height = durationToPixels(duration, pixelsPerHour);

    return {
      id: activity.id,
      activity,
      top,
      height,
      left: 0, // App-based: each activity is in its own column, no left offset needed
    };
  });

  return positioned;
}

/**
 * Groups activities by app
 * Used for creating separate columns in the timeline
 */
export function groupActivitiesByApp(
  activities: TimelineEvent[]
): Map<string, TimelineEvent[]> {
  const groups = new Map<string, TimelineEvent[]>();

  activities.forEach((activity) => {
    const appName = activity.appName || 'Unknown';
    if (!groups.has(appName)) {
      groups.set(appName, []);
    }
    groups.get(appName)!.push(activity);
  });

  return groups;
}

/**
 * App color mapping
 */
const APP_COLORS: Record<string, string> = {
  'Visual Studio Code': '#10b981', // green
  VSCode: '#10b981',
  'VS Code': '#10b981',
  Chrome: '#3b82f6', // blue
  'Google Chrome': '#3b82f6',
  Slack: '#611f69', // purple
  'Google Meet': '#00897b', // teal
  Meet: '#00897b',
  Gmail: '#ea4335', // red
  Terminal: '#6b7280', // gray
  'Google Calendar': '#ea4335',
  Calendar: '#ea4335',
  Firefox: '#f97316', // orange
  Safari: '#8b5cf6', // indigo
};

export function getAppColor(appName: string): string {
  return APP_COLORS[appName] || '#6366f1'; // Default indigo
}

/**
 * App icon mapping (initials)
 */
const APP_ICONS: Record<string, string> = {
  'Visual Studio Code': 'VS',
  VSCode: 'VS',
  'VS Code': 'VS',
  Chrome: 'CH',
  'Google Chrome': 'CH',
  Slack: 'S',
  'Google Meet': 'M',
  Meet: 'M',
  Gmail: 'GM',
  Terminal: 'T',
  'Google Calendar': 'C',
  Calendar: 'C',
  Firefox: 'FF',
  Safari: 'S',
};

export function getAppIcon(appName: string): string {
  return APP_ICONS[appName] || appName.substring(0, 2).toUpperCase();
}

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
 * Calculates summary statistics from activities
 */
export interface DailySummary {
  totalSeconds: number;
  earliestTime: number;
  latestTime: number;
  breakCount: number;
  longestFocusSeconds: number;
  categoryBreakdown: Record<string, number>; // category -> seconds
}

export function calculateDailySummary(activities: TimelineEvent[]): DailySummary {
  if (activities.length === 0) {
    return {
      totalSeconds: 0,
      earliestTime: 0,
      latestTime: 0,
      breakCount: 0,
      longestFocusSeconds: 0,
      categoryBreakdown: {},
    };
  }

  const durations = activities
    .map((a) => getEventDuration(a) || 0)
    .filter((d) => d > 0);

  const totalSeconds = durations.reduce((a, b) => a + b, 0);
  const longestFocus = Math.max(...durations, 0);

  // Time span: from first to last activity
  const times = activities
    .map((a) => a.timestamp)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  const earliestTime = times.length > 0 ? times[0] : 0;
  const latestTime = times.length > 0 ? times[times.length - 1] : 0;

  return {
    totalSeconds,
    earliestTime,
    latestTime,
    breakCount: 0, // Will calculate from gaps
    longestFocusSeconds: longestFocus,
    categoryBreakdown: {}, // Will populate from activities
  };
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format time of day
 */
export function formatTimeOfDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    meridiem: 'short',
  });
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

export function groupAdjacentActivities(
  blocks: ActivityBlockForGrouping[],
  maxGapSeconds: number = 300 // 5 minutes default
): ActivityBlockForGrouping[] {
  if (blocks.length === 0) return [];

  // Sort by start time
  const sorted = [...blocks].sort((a, b) => a.startTime - b.startTime);
  const grouped: ActivityBlockForGrouping[] = [];

  let currentGroup: ActivityBlockForGrouping | null = null;

  for (const block of sorted) {
    if (!currentGroup) {
      // Start a new group
      currentGroup = { ...block };
    } else {
      // Check if this block should be merged with the current group
      const gap = block.startTime - currentGroup.endTime;

      if (gap <= maxGapSeconds) {
        // Merge: extend the current group
        currentGroup.endTime = Math.max(currentGroup.endTime, block.endTime);
        currentGroup.durationSeconds = currentGroup.endTime - currentGroup.startTime;
        // Update pixel height to reflect new duration
        // pixelHeight is calculated at render time based on duration, so we just update duration
        // Also keep the most recent window title for the tooltip
        currentGroup.windowTitle = block.windowTitle;
      } else {
        // Gap is too large, save current group and start new one
        grouped.push(currentGroup);
        currentGroup = { ...block };
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
