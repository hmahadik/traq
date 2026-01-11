import { TimelineEvent, getEventDuration } from '@/types/timelineEvent';
import { StatRow } from '@/components/timeline/SummaryStatsRow';
import { BreakdownData } from '@/components/timeline/BreakdownBar';
import { TopApp } from '@/components/timeline/TopAppsSection';

/**
 * Calculate daily summary statistics from timeline events
 */
export function calculateDailySummary(activities: TimelineEvent[]) {
  if (activities.length === 0) {
    return {
      totalSeconds: 0,
      earliestTime: new Date(),
      latestTime: new Date(),
      stats: [] as StatRow[],
      breakdown: { focus: 0, meetings: 0, communication: 0, other: 0 } as BreakdownData,
      topApps: [] as TopApp[],
    };
  }

  // Calculate total seconds
  const durations = activities
    .map((a) => getEventDuration(a) || 0)
    .filter((d) => d > 0);

  const totalSeconds = durations.reduce((a, b) => a + b, 0);

  // Get time span
  const timestamps = activities
    .map((a) => a.timestamp)
    .filter((t) => t > 0)
    .sort((a, b) => a - b);

  const earliestTime = timestamps.length > 0 ? new Date(timestamps[0]) : new Date();
  const latestTime =
    timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]) : new Date();

  // Calculate day span
  const daySpanMs = latestTime.getTime() - earliestTime.getTime();
  const daySpanHours = Math.round(daySpanMs / (1000 * 60 * 60) * 10) / 10;

  // Calculate longest focus session
  const longestFocus = Math.max(...durations, 0);

  // Format stats rows
  const stats: StatRow[] = [
    {
      label: 'Day Span',
      value: formatTimeRange(earliestTime, latestTime),
    },
    {
      label: 'Breaks',
      value: calculateBreakCount(activities),
    },
    {
      label: 'Longest Focus',
      value: formatDurationShort(longestFocus),
    },
  ];

  // Calculate breakdown by category
  const breakdown = calculateBreakdown(activities);

  // Get top apps
  const topApps = calculateTopApps(activities);

  return {
    totalSeconds,
    earliestTime,
    latestTime,
    stats,
    breakdown,
    topApps,
  };
}

/**
 * Format time range (e.g., "8:00 AM - 10:00 PM")
 */
function formatTimeRange(start: Date, end: Date): string {
  const startStr = start.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    meridiem: 'short',
  });
  const endStr = end.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    meridiem: 'short',
  });
  return `${startStr} - ${endStr}`;
}

/**
 * Format duration in short form (e.g., "2h 20m")
 */
function formatDurationShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculate number of breaks (gaps between activities > 5 minutes)
 */
function calculateBreakCount(activities: TimelineEvent[]): string {
  const sorted = [...activities].sort((a, b) => a.timestamp - b.timestamp);

  let breaks = 0;
  const BREAK_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].timestamp + (getEventDuration(sorted[i - 1]) || 0) * 1000;
    const currStart = sorted[i].timestamp;
    const gap = currStart - prevEnd;

    if (gap > BREAK_THRESHOLD) {
      breaks++;
    }
  }

  return breaks > 0 ? `${breaks}x` : '0x';
}

/**
 * Calculate time breakdown by category
 */
function calculateBreakdown(activities: TimelineEvent[]): BreakdownData {
  const breakdown: BreakdownData = {
    focus: 0,
    meetings: 0,
    communication: 0,
    other: 0,
  };

  activities.forEach((activity) => {
    const duration = getEventDuration(activity) || 0;
    const category = categorizeActivity(activity);

    switch (category) {
      case 'focus':
        breakdown.focus += duration;
        break;
      case 'meetings':
        breakdown.meetings += duration;
        break;
      case 'communication':
        breakdown.communication += duration;
        break;
      case 'other':
      default:
        breakdown.other += duration;
        break;
    }
  });

  return breakdown;
}

/**
 * Categorize an activity by type
 */
function categorizeActivity(
  activity: TimelineEvent
): 'focus' | 'meetings' | 'communication' | 'other' {
  const appName = activity.appName?.toLowerCase() || '';

  // Meetings
  if (
    appName.includes('meet') ||
    appName.includes('zoom') ||
    appName.includes('teams') ||
    activity.type === 'browser_visit'
  ) {
    const url = activity.browserVisit?.url?.toLowerCase() || '';
    if (url.includes('meet.google') || url.includes('zoom.us') || url.includes('teams.microsoft')) {
      return 'meetings';
    }
  }

  // Communication
  if (
    appName.includes('slack') ||
    appName.includes('discord') ||
    appName.includes('telegram') ||
    appName.includes('whatsapp') ||
    appName.includes('mail') ||
    appName.includes('email')
  ) {
    return 'communication';
  }

  // Focus
  if (
    appName.includes('code') ||
    appName.includes('studio') ||
    appName.includes('vim') ||
    appName.includes('emacs') ||
    appName.includes('idea') ||
    appName.includes('xcode')
  ) {
    return 'focus';
  }

  // Default
  return 'other';
}

/**
 * Get top apps by time spent
 */
function calculateTopApps(activities: TimelineEvent[]): TopApp[] {
  const appDurations = new Map<string, number>();

  activities.forEach((activity) => {
    const appName = activity.appName || 'Unknown';
    const duration = getEventDuration(activity) || 0;
    appDurations.set(appName, (appDurations.get(appName) || 0) + duration);
  });

  // Sort and get top 5
  const sorted = Array.from(appDurations.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const totalSeconds = Array.from(appDurations.values()).reduce((a, b) => a + b, 0);

  return sorted.map(([appName, seconds]) => ({
    appName,
    seconds,
    icon: getAppIcon(appName),
    color: getAppColor(appName),
  }));
}

/**
 * Get app icon (initials)
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

function getAppIcon(appName: string): string {
  return APP_ICONS[appName] || appName.substring(0, 2).toUpperCase();
}

/**
 * Get app color
 */
const APP_COLORS: Record<string, string> = {
  'Visual Studio Code': '#10b981',
  VSCode: '#10b981',
  'VS Code': '#10b981',
  Chrome: '#3b82f6',
  'Google Chrome': '#3b82f6',
  Slack: '#611f69',
  'Google Meet': '#00897b',
  Meet: '#00897b',
  Gmail: '#ea4335',
  Terminal: '#6b7280',
  'Google Calendar': '#ea4335',
  Calendar: '#ea4335',
  Firefox: '#f97316',
  Safari: '#8b5cf6',
};

function getAppColor(appName: string): string {
  return APP_COLORS[appName] || '#6366f1';
}
