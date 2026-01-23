// Timeline Types
// Based on marmelab/EventDrops pattern but adapted for Traq's data structures

export type EventDropType = 'activity' | 'git' | 'shell' | 'browser' | 'file' | 'afk' | 'screenshot' | 'projects' | 'session';

export interface EventDot {
  id: string; // Unique ID: `${type}-${originalId}`
  originalId: number;
  timestamp: Date;
  type: EventDropType;
  row: string; // Row name (app name or event type)
  label: string; // For tooltip
  duration?: number; // Optional duration in seconds
  color: string; // Dot fill color
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any; // Original event data - can be ActivityBlock, GitEventDisplay, etc.
}

export interface TimelineRow {
  name: string; // "VS Code", "Git", "Shell", etc.
  color: string; // Primary dot color for this row
  dotCount: number; // Number of events in this row
  data: EventDot[]; // Individual events
}

export interface TimelineData {
  rows: TimelineRow[];
  timeRange: {
    start: Date;
    end: Date;
  };
  totalEvents: number;
  availableLanes: string[]; // All lane names before filtering (for dropdown)
}

// Color constants for event types (hex values for D3)
export const EVENT_TYPE_COLORS: Record<EventDropType, string> = {
  activity: '#3b82f6', // blue-500
  git: '#22c55e', // green-500
  shell: '#64748b', // slate-500
  browser: '#10b981', // emerald-500
  file: '#f59e0b', // amber-500
  afk: '#f97316', // orange-500
  screenshot: '#ec4899', // pink-500
  projects: '#6366f1', // indigo-500
  session: '#f59e0b', // amber-500
};

// Category colors for activities (hex values for D3)
export const CATEGORY_HEX_COLORS: Record<string, string> = {
  focus: '#22c55e', // green-500
  meetings: '#ef4444', // red-500
  comms: '#a855f7', // purple-500
  other: '#6b7280', // gray-500
  breaks: '#f97316', // orange-500
};

// App-specific colors (hex values for D3)
// Based on the existing APP_COLOR_PATTERNS
export const APP_HEX_COLORS: Record<string, string> = {
  // Browsers
  chrome: '#10b981', // emerald-500
  firefox: '#f97316', // orange-500
  safari: '#0ea5e9', // sky-500
  arc: '#8b5cf6', // violet-500
  brave: '#ea580c', // orange-600

  // Development tools
  code: '#3b82f6', // blue-500
  vscode: '#3b82f6', // blue-500
  terminal: '#475569', // slate-600
  tilix: '#475569', // slate-600
  iterm: '#475569', // slate-600
  warp: '#475569', // slate-600
  intellij: '#f43f5e', // rose-500
  pycharm: '#f43f5e', // rose-500
  webstorm: '#f43f5e', // rose-500
  sublime: '#d97706', // amber-600
  vim: '#16a34a', // green-600
  nvim: '#16a34a', // green-600
  neovim: '#16a34a', // green-600

  // Communication
  slack: '#9333ea', // purple-600
  discord: '#6366f1', // indigo-500
  teams: '#7c3aed', // violet-600
  zoom: '#2563eb', // blue-600

  // Calendar/Meetings
  calendar: '#ef4444', // red-500
  meet: '#14b8a6', // teal-500

  // Productivity
  notion: '#44403c', // stone-700
  figma: '#d946ef', // fuchsia-500
  linear: '#7c3aed', // violet-600
  obsidian: '#7e22ce', // purple-700

  // File managers
  nautilus: '#f59e0b', // amber-500
  files: '#f59e0b', // amber-500
  finder: '#f59e0b', // amber-500

  // Custom
  traq: '#0891b2', // cyan-600
};

// Default color for unknown apps
export const DEFAULT_APP_COLOR = '#6b7280'; // gray-500

// Get hex color for an app name
export function getAppHexColor(appName: string): string {
  const normalized = appName.toLowerCase();

  // Check exact matches first
  if (APP_HEX_COLORS[normalized]) {
    return APP_HEX_COLORS[normalized];
  }

  // Check pattern matches
  for (const [pattern, color] of Object.entries(APP_HEX_COLORS)) {
    if (normalized.includes(pattern)) {
      return color;
    }
  }

  return DEFAULT_APP_COLOR;
}
