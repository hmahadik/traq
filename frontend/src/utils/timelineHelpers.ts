import { TimelineEvent, getEventDuration } from '@/types/timelineEvent';

/**
 * Represents a positioned activity in the timeline
 */
export interface PositionedActivity {
  id: number;
  activity: TimelineEvent;
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
