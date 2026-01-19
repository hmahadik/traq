// Timeline v3 Grid View Types
// These types match the backend service structures from internal/service/timeline_grid.go

export interface TimelineGridData {
  date: string;
  dayStats: DayStats | null;
  topApps: TopApp[];
  hourlyGrid: Record<number, Record<string, ActivityBlock[]>>; // hour -> app -> blocks
  sessionSummaries: SessionSummaryWithPosition[];
  categories: Record<string, string>; // app -> category
  gitEvents: Record<number, GitEventDisplay[]>; // hour -> git events
  shellEvents: Record<number, ShellEventDisplay[]>; // hour -> shell commands
  fileEvents: Record<number, FileEventDisplay[]>; // hour -> file events
  browserEvents: Record<number, BrowserEventDisplay[]>; // hour -> browser visits
  activityClusters: Record<number, ActivityCluster[]>; // hour -> activity clusters
  afkBlocks: Record<number, AFKBlock[]>; // hour -> AFK blocks
}

export interface DayStats {
  totalSeconds: number;
  totalHours: number;
  breakCount: number;
  breakDuration: number; // Total AFK seconds
  longestFocus: number; // Longest continuous focus seconds
  timeSinceLastBreak: number; // Seconds since last break ended (-1 if no breaks)
  daySpan: DaySpan | null;
  breakdown: Record<string, number>; // category -> seconds
  breakdownPercent: Record<string, number>; // category -> percentage
}

export interface DaySpan {
  startTime: number; // Unix timestamp
  endTime: number; // Unix timestamp
  spanHours: number;
}

export interface TopApp {
  appName: string;
  duration: number; // seconds
  category: string; // 'focus' | 'meetings' | 'comms' | 'other'
}

export interface ActivityBlock {
  id: number;
  windowTitle: string;
  appName: string;
  startTime: number; // Unix timestamp
  endTime: number; // Unix timestamp
  durationSeconds: number;
  category: string; // 'focus' | 'meetings' | 'comms' | 'other'
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels (0-60)
  pixelHeight: number; // Height in pixels
  // Project assignment fields
  projectId?: number;
  projectColor?: string;
  projectSource?: string; // 'manual' | 'rule' | 'ai'
  projectConfidence?: number; // 0-1 confidence score for auto-assignments
}

export interface SessionSummaryWithPosition {
  // From SessionSummary
  id: number;
  startTime: number;
  endTime: number | null;
  durationSeconds: number | null;
  isOngoing: boolean;
  screenshotCount: number;
  summary: string;
  explanation: string;
  confidence: string;
  tags: string[];
  topApps: string[];
  hasShell: boolean;
  hasGit: boolean;
  hasFiles: boolean;
  hasBrowser: boolean;

  // Position data for grid
  hourOffset: number; // Starting hour
  minuteOffset: number; // Starting minute within hour
  pixelPosition: number; // Vertical position in pixels
  pixelHeight: number; // Height in pixels (spans multiple hours if needed)
  category: string; // Dominant category for the session
}

export interface GitEventDisplay {
  id: number;
  timestamp: number;
  message: string;
  messageSubject: string;
  shortHash: string;
  repository: string;
  branch: string;
  insertions: number;
  deletions: number;
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels (0-60)
}

export interface ShellEventDisplay {
  id: number;
  timestamp: number;
  command: string;
  shellType: string;
  workingDirectory: string;
  exitCode: number;
  durationSeconds: number;
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels (0-60)
}

export interface FileEventDisplay {
  id: number;
  timestamp: number;
  eventType: string; // create, modify, delete, rename
  filePath: string;
  fileName: string;
  directory: string;
  fileExtension: string;
  fileSizeBytes: number;
  watchCategory: string; // downloads, projects, documents
  oldPath: string; // For rename events
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels (0-60)
}

export interface BrowserEventDisplay {
  id: number;
  timestamp: number;
  url: string;
  title: string;
  domain: string;
  browser: string; // chrome, firefox, safari, edge
  visitDurationSeconds: number;
  transitionType: string;
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels (0-60)
}

export interface ActivityCluster {
  id: string; // Unique cluster ID
  startTime: number; // Timestamp of earliest event
  endTime: number; // Timestamp of latest event
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels
  pixelHeight: number; // Height in pixels (spans duration)
  eventCount: number; // Total number of events in cluster
  gitEventIds: number[]; // IDs of git commits in this cluster
  shellEventIds: number[]; // IDs of shell commands in this cluster
  fileEventIds: number[]; // IDs of file events in this cluster
  browserEventIds: number[]; // IDs of browser visits in this cluster
  summary: string; // Brief description of the cluster
}

export interface AFKBlock {
  id: number;
  startTime: number; // Unix timestamp
  endTime: number; // Unix timestamp
  durationSeconds: number;
  triggerType: string; // idle_timeout, system_sleep, manual
  hourOffset: number; // Hour of day (0-23)
  minuteOffset: number; // Minute within hour (0-59)
  pixelPosition: number; // Vertical position in pixels (0-60)
  pixelHeight: number; // Height in pixels
}

export interface CategorizationRule {
  id: number;
  appName: string;
  category: string; // 'focus' | 'meetings' | 'comms' | 'other'
  isSystemDefault: boolean;
  createdAt: number; // Unix timestamp
}

// ============================================================================
// Week View Types
// ============================================================================

export interface WeekTimelineData {
  startDate: string; // Monday (YYYY-MM-DD)
  endDate: string; // Sunday (YYYY-MM-DD)
  days: WeekDayData[];
  weekStats: WeekSummaryStats;
}

export interface WeekDayData {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  dayName: string; // "Mon", "Tue", etc.
  isToday: boolean;
  totalHours: number;
  timeBlocks: WeekTimeBlock[];
  hasAiSummary: boolean;
  screenshotCount: number;
  categoryBreakdown: Record<string, number>; // category -> hours
}

export interface WeekTimeBlock {
  blockIndex: number; // 0-47
  startHour: number; // 0-23
  startMinute: number; // 0 or 30
  hasActivity: boolean;
  dominantCategory: string; // "focus", "meetings", "comms", "other", or ""
  activeSeconds: number;
  intensity: number; // 0-4
}

export interface WeekSummaryStats {
  totalHours: number;
  averageDaily: number;
  mostActiveDay: string; // "Monday", "Tuesday", etc.
  categoryBreakdown: Record<string, number>; // category -> hours
}

// Category colors and configuration

export type CategoryType = 'focus' | 'meetings' | 'comms' | 'other' | 'breaks';

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  focus: 'bg-green-500',
  meetings: 'bg-red-500',
  comms: 'bg-purple-500',
  other: 'bg-gray-500',
  breaks: 'bg-orange-500',
};

export const CATEGORY_BORDER_COLORS: Record<CategoryType, string> = {
  focus: 'border-l-green-500',
  meetings: 'border-l-red-500',
  comms: 'border-l-purple-500',
  other: 'border-l-gray-500',
  breaks: 'border-l-orange-500',
};

export const CATEGORY_TEXT_COLORS: Record<CategoryType, string> = {
  focus: 'text-green-600 dark:text-green-400',
  meetings: 'text-red-600 dark:text-red-400',
  comms: 'text-purple-600 dark:text-purple-400',
  other: 'text-gray-600 dark:text-gray-400',
  breaks: 'text-orange-600 dark:text-orange-400',
};

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  focus: 'Focus',
  meetings: 'Meetings',
  comms: 'Communication',
  other: 'Other',
  breaks: 'Breaks',
};

// Grid layout constants (Timely-style)

export const GRID_CONSTANTS = {
  HOUR_HEIGHT_PX: 80, // Spacious Timely look
  HOUR_COLUMN_WIDTH_PX: 56, // Compact time labels
  AI_SUMMARY_COLUMN_WIDTH_PX: 180, // Summary readability
  APP_COLUMN_WIDTH_PX: 120, // Compact app columns
  MIN_BLOCK_HEIGHT_PX: 8, // Increased for better visibility
  MIN_SESSION_HEIGHT_PX: 16, // Increased minimum
  MAX_APP_COLUMNS: 5, // Limit app columns to reduce scrolling
} as const;

// Timely-style pastel colors for activity blocks
// Maps normalized app name patterns to colors (with dark mode support)
// Dark mode uses saturated, solid colors for better visibility against dark backgrounds
const APP_COLOR_PATTERNS: Array<{ pattern: RegExp; colors: { bg: string; icon: string; text: string } }> = [
  // Browsers
  { pattern: /chrome|chromium/i, colors: { bg: 'bg-emerald-100 dark:bg-emerald-900', icon: 'bg-emerald-500', text: 'text-emerald-900 dark:text-emerald-100' } },
  { pattern: /firefox/i, colors: { bg: 'bg-orange-100 dark:bg-orange-900', icon: 'bg-orange-500', text: 'text-orange-900 dark:text-orange-100' } },
  { pattern: /safari/i, colors: { bg: 'bg-sky-100 dark:bg-sky-900', icon: 'bg-sky-500', text: 'text-sky-900 dark:text-sky-100' } },
  { pattern: /arc/i, colors: { bg: 'bg-violet-100 dark:bg-violet-900', icon: 'bg-violet-500', text: 'text-violet-900 dark:text-violet-100' } },
  { pattern: /brave/i, colors: { bg: 'bg-orange-100 dark:bg-orange-900', icon: 'bg-orange-600', text: 'text-orange-900 dark:text-orange-100' } },

  // Development tools
  { pattern: /code|vscode|visual studio/i, colors: { bg: 'bg-blue-100 dark:bg-blue-900', icon: 'bg-blue-500', text: 'text-blue-900 dark:text-blue-100' } },
  { pattern: /terminal|tilix|iterm|warp|konsole|gnome-terminal|alacritty|kitty/i, colors: { bg: 'bg-slate-200 dark:bg-slate-700', icon: 'bg-slate-700 dark:bg-slate-400', text: 'text-slate-900 dark:text-slate-100' } },
  { pattern: /intellij|idea|webstorm|phpstorm|pycharm/i, colors: { bg: 'bg-rose-100 dark:bg-rose-900', icon: 'bg-rose-500', text: 'text-rose-900 dark:text-rose-100' } },
  { pattern: /sublime/i, colors: { bg: 'bg-amber-100 dark:bg-amber-900', icon: 'bg-amber-600', text: 'text-amber-900 dark:text-amber-100' } },
  { pattern: /vim|nvim|neovim/i, colors: { bg: 'bg-green-100 dark:bg-green-900', icon: 'bg-green-600', text: 'text-green-900 dark:text-green-100' } },

  // Communication
  { pattern: /slack/i, colors: { bg: 'bg-purple-100 dark:bg-purple-900', icon: 'bg-purple-600', text: 'text-purple-900 dark:text-purple-100' } },
  { pattern: /discord/i, colors: { bg: 'bg-indigo-100 dark:bg-indigo-900', icon: 'bg-indigo-500', text: 'text-indigo-900 dark:text-indigo-100' } },
  { pattern: /teams/i, colors: { bg: 'bg-violet-100 dark:bg-violet-900', icon: 'bg-violet-600', text: 'text-violet-900 dark:text-violet-100' } },
  { pattern: /zoom/i, colors: { bg: 'bg-blue-100 dark:bg-blue-900', icon: 'bg-blue-600', text: 'text-blue-900 dark:text-blue-100' } },

  // Calendar/Meetings
  { pattern: /calendar|gcal/i, colors: { bg: 'bg-red-100 dark:bg-red-900', icon: 'bg-red-500', text: 'text-red-900 dark:text-red-100' } },
  { pattern: /meet/i, colors: { bg: 'bg-teal-100 dark:bg-teal-900', icon: 'bg-teal-500', text: 'text-teal-900 dark:text-teal-100' } },

  // Productivity
  { pattern: /notion/i, colors: { bg: 'bg-stone-100 dark:bg-stone-700', icon: 'bg-stone-700 dark:bg-stone-400', text: 'text-stone-900 dark:text-stone-100' } },
  { pattern: /figma/i, colors: { bg: 'bg-fuchsia-100 dark:bg-fuchsia-900', icon: 'bg-fuchsia-500', text: 'text-fuchsia-900 dark:text-fuchsia-100' } },
  { pattern: /linear/i, colors: { bg: 'bg-violet-100 dark:bg-violet-900', icon: 'bg-violet-600', text: 'text-violet-900 dark:text-violet-100' } },
  { pattern: /obsidian/i, colors: { bg: 'bg-purple-100 dark:bg-purple-900', icon: 'bg-purple-700 dark:bg-purple-500', text: 'text-purple-900 dark:text-purple-100' } },

  // File managers
  { pattern: /nautilus|files|finder|dolphin|thunar/i, colors: { bg: 'bg-amber-100 dark:bg-amber-900', icon: 'bg-amber-500', text: 'text-amber-900 dark:text-amber-100' } },

  // Image viewers
  { pattern: /eog|image|preview|photos|gwenview/i, colors: { bg: 'bg-pink-100 dark:bg-pink-900', icon: 'bg-pink-500', text: 'text-pink-900 dark:text-pink-100' } },

  // Custom/development apps (like traq itself)
  { pattern: /traq/i, colors: { bg: 'bg-cyan-100 dark:bg-cyan-900', icon: 'bg-cyan-600', text: 'text-cyan-900 dark:text-cyan-100' } },
];

const DEFAULT_COLORS = { bg: 'bg-gray-100 dark:bg-gray-700', icon: 'bg-gray-500 dark:bg-gray-400', text: 'text-gray-900 dark:text-gray-100' };

// Get app color scheme with fuzzy matching
export const getAppColors = (appName: string): { bg: string; icon: string; text: string } => {
  for (const { pattern, colors } of APP_COLOR_PATTERNS) {
    if (pattern.test(appName)) {
      return colors;
    }
  }
  return DEFAULT_COLORS;
};

// ============================================================================
// List View Types
// ============================================================================

export type TimelineEventType = 'activity' | 'session' | 'git' | 'shell' | 'file' | 'browser' | 'afk';

export interface TimelineListEvent {
  id: string; // Unique identifier: `${type}-${originalId}`
  type: TimelineEventType;
  timestamp: number; // Unix timestamp for sorting
  data: ActivityBlock | SessionSummaryWithPosition | GitEventDisplay | ShellEventDisplay | FileEventDisplay | BrowserEventDisplay | AFKBlock;
}
