// Timeline v3 Grid View Types
// These types match the backend service structures from internal/service/timeline_grid.go

export interface TimelineGridData {
  date: string;
  dayStats: DayStats | null;
  topApps: TopApp[];
  hourlyGrid: Record<number, Record<string, ActivityBlock[]>>; // hour -> app -> blocks
  sessionSummaries: SessionSummaryWithPosition[];
  categories: Record<string, string>; // app -> category
}

export interface DayStats {
  totalSeconds: number;
  totalHours: number;
  breakCount: number;
  breakDuration: number; // Total AFK seconds
  longestFocus: number; // Longest continuous focus seconds
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

export interface CategorizationRule {
  id: number;
  appName: string;
  category: string; // 'focus' | 'meetings' | 'comms' | 'other'
  isSystemDefault: boolean;
  createdAt: number; // Unix timestamp
}

// UI State Types (transformed for rendering)

export interface TimelineGridState {
  date: string;
  stats: DayStats | null;
  topApps: TopApp[];
  activeHours: number[]; // List of hours with activity (e.g., [8, 9, 10, 11, ...])
  appColumns: AppColumnData[];
  sessionBlocks: SessionBlock[];
  categories: Record<string, string>;
}

export interface AppColumnData {
  appName: string;
  category: string;
  totalDuration: number; // seconds
  activityBlocks: ActivityBlock[];
}

export interface SessionBlock extends SessionSummaryWithPosition {
  // Additional UI-specific fields if needed
}

// Category colors and configuration

export type CategoryType = 'focus' | 'meetings' | 'comms' | 'other';

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  focus: 'bg-green-500',
  meetings: 'bg-red-500',
  comms: 'bg-purple-500',
  other: 'bg-gray-500',
};

export const CATEGORY_BORDER_COLORS: Record<CategoryType, string> = {
  focus: 'border-l-green-500',
  meetings: 'border-l-red-500',
  comms: 'border-l-purple-500',
  other: 'border-l-gray-500',
};

export const CATEGORY_TEXT_COLORS: Record<CategoryType, string> = {
  focus: 'text-green-600',
  meetings: 'text-red-600',
  comms: 'text-purple-600',
  other: 'text-gray-600',
};

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  focus: 'Focus',
  meetings: 'Meetings',
  comms: 'Communication',
  other: 'Other',
};

// Grid layout constants

export const GRID_CONSTANTS = {
  HOUR_HEIGHT_PX: 60,
  HOUR_COLUMN_WIDTH_PX: 50,
  AI_SUMMARY_COLUMN_WIDTH_PX: 160,
  APP_COLUMN_WIDTH_PX: 140,
  MIN_BLOCK_HEIGHT_PX: 4,
  MIN_SESSION_HEIGHT_PX: 10,
} as const;
