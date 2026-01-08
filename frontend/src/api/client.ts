/**
 * Wails Binding Wrappers
 *
 * This file wraps the auto-generated Wails bindings for type safety
 * and consistent API usage across the frontend.
 *
 * Mock Mode:
 * Set VITE_MOCK_DATA=true or add ?mock=true to URL for mock data.
 * Useful for screenshots and development without backend.
 */

import * as App from '@wailsjs/go/main/App';
import { mockData } from './mockData';

import type {
  InferenceStatus,
  ModelInfo,
} from '@/types';

// Check if mock mode is enabled via env var or URL param
function isMockMode(): boolean {
  // Check environment variable
  if (import.meta.env.VITE_MOCK_DATA === 'true') {
    return true;
  }
  // Check URL parameter
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock') === 'true') {
      return true;
    }
    // Also check hash params for hash-based routing
    const hash = window.location.hash;
    if (hash.includes('mock=true')) {
      return true;
    }
  }
  return false;
}

export const MOCK_MODE = isMockMode();

// ============================================================================
// Wails Runtime Utilities
// ============================================================================

/** Track if the app backend is ready */
let appReady = false;
let readyPromise: Promise<void> | null = null;

/**
 * Wait for the Wails backend to be ready.
 * Polls IsReady() until it returns true, with exponential backoff.
 */
export async function waitForReady(maxAttempts = 20, initialDelay = 100): Promise<void> {
  if (appReady) return;
  
  if (readyPromise) return readyPromise;
  
  readyPromise = (async () => {
    let delay = initialDelay;
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const ready = await App.IsReady();
        if (ready) {
          appReady = true;
          return;
        }
      } catch {
        // Wails runtime not yet available, keep trying
      }
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * 1.5, 2000); // Cap at 2 seconds
    }
    console.warn('Wails backend did not become ready within timeout');
  })();
  
  return readyPromise;
}

/**
 * Check if the Wails runtime is available (window.__go_wails__ exists)
 */
export function isWailsRuntimeAvailable(): boolean {
  return typeof window !== 'undefined' && 
    (window as unknown as { go?: unknown }).go !== undefined;
}

/**
 * Wrap an async function with retry logic for transient Wails failures.
 * @param fn The async function to call
 * @param retries Number of retry attempts (default: 3)
 * @param delay Initial delay between retries in ms (default: 200)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 200
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      
      // Don't retry if this is clearly not a transient error
      if (lastError.message.includes('not found') || 
          lastError.message.includes('invalid')) {
        throw lastError;
      }
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Safe wrapper for Wails API calls that handles runtime unavailability gracefully.
 * Returns undefined if Wails runtime is not available.
 */
export async function safeCall<T>(
  fn: () => Promise<T>,
  fallback?: T
): Promise<T | undefined> {
  if (!isWailsRuntimeAvailable()) {
    console.warn('Wails runtime not available - running in browser mode?');
    return fallback;
  }
  
  try {
    await waitForReady();
    return await fn();
  } catch (err) {
    console.error('Wails API call failed:', err);
    return fallback;
  }
}

// Use 'unknown' for backend types that may differ from frontend definitions
// Components should handle the actual structure

/**
 * Analytics API
 */
export const analytics = {
  getDailyStats: async (date: string) => {
    if (MOCK_MODE) return mockData.getDailyStats(date);
    await waitForReady();
    return withRetry(() => App.GetDailyStats(date));
  },

  getWeeklyStats: async (startDate: string) => {
    if (MOCK_MODE) return mockData.getWeeklyStats(startDate);
    await waitForReady();
    return withRetry(() => App.GetWeeklyStats(startDate));
  },

  getMonthlyStats: async (year: number, month: number) => {
    if (MOCK_MODE) return mockData.getWeeklyStats(`${year}-${String(month).padStart(2, '0')}-01`);
    await waitForReady();
    return withRetry(() => App.GetMonthlyStats(year, month));
  },

  getCalendarHeatmap: async (year: number, month: number) => {
    if (MOCK_MODE) return mockData.getCalendarHeatmap(year, month);
    await waitForReady();
    return withRetry(() => App.GetCalendarHeatmap(year, month));
  },

  getAppUsage: async (start: number, end: number) => {
    if (MOCK_MODE) return mockData.getAppUsage(start, end);
    await waitForReady();
    return withRetry(() => App.GetAppUsage(start, end));
  },

  getHourlyActivity: async (date: string) => {
    if (MOCK_MODE) return mockData.getHourlyActivity(date);
    await waitForReady();
    return withRetry(() => App.GetHourlyActivity(date));
  },

  getDataSourceStats: async (start: number, end: number) => {
    if (MOCK_MODE) return mockData.getDataSourceStats(start, end);
    await waitForReady();
    return withRetry(() => App.GetDataSourceStats(start, end));
  },

  getProductivityScore: async (date: string) => {
    if (MOCK_MODE) return {
      score: 4,
      productiveMinutes: 240,
      neutralMinutes: 90,
      distractingMinutes: 30,
      totalMinutes: 360,
      productivePercentage: 66.7,
    };
    await waitForReady();
    return withRetry(() => App.GetProductivityScore(date));
  },

  getFocusDistribution: async (_date: string) => {
    if (MOCK_MODE) {
      // Return hourly focus data
      return Array.from({ length: 24 }, (_, hour) => {
        const isWorkHour = hour >= 9 && hour <= 18;
        const focusQuality = isWorkHour ? 50 + Math.floor(Math.random() * 50) : Math.floor(Math.random() * 30);
        return {
          hour,
          contextSwitches: isWorkHour ? Math.floor(Math.random() * 10) : 0,
          focusQuality,
          focusLabel: focusQuality >= 75 ? 'Focused' : focusQuality >= 50 ? 'Fair' : focusQuality > 0 ? 'Fragmented' : 'Inactive',
        };
      });
    }
    await waitForReady();
    return withRetry(() => App.GetFocusDistribution(_date));
  },

  getActivityTags: async (date: string) => {
    if (MOCK_MODE) return [
      { tag: 'coding', minutes: 180, percentage: 45 },
      { tag: 'research', minutes: 80, percentage: 20 },
      { tag: 'communication', minutes: 60, percentage: 15 },
      { tag: 'other', minutes: 80, percentage: 20 },
    ];
    await waitForReady();
    return withRetry(() => App.GetActivityTags(date));
  },

  getTopWindows: async (date: string, limit: number) => {
    if (MOCK_MODE) return [
      { windowTitle: 'main.go - VS Code', appName: 'VS Code', durationSeconds: 3600 },
      { windowTitle: 'GitHub - Pull Request #42', appName: 'Firefox', durationSeconds: 1800 },
      { windowTitle: 'Terminal - ~/projects', appName: 'Terminal', durationSeconds: 1200 },
    ].slice(0, limit);
    await waitForReady();
    return withRetry(() => App.GetTopWindows(date, limit));
  },

  exportAnalytics: async (date: string, viewMode: string, format: string) => {
    if (MOCK_MODE) return 'mock-export-path';
    await waitForReady();
    return withRetry(() => App.ExportAnalytics(date, viewMode, format));
  },
};

/**
 * Timeline API
 */
export const timeline = {
  getSessionsForDate: async (date: string) => {
    if (MOCK_MODE) return mockData.getSessionsForDate(date);
    await waitForReady();
    return withRetry(() => App.GetSessionsForDate(date));
  },

  getScreenshotsForSession: async (
    sessionId: number,
    page: number,
    perPage: number
  ) => {
    if (MOCK_MODE) return mockData.getScreenshotsForSession(sessionId, page, perPage);
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForSession(sessionId, page, perPage));
  },

  getScreenshotsForHour: async (date: string, hour: number) => {
    if (MOCK_MODE) return mockData.getScreenshotsForHour(date, hour);
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForHour(date, hour));
  },

  getSessionContext: async (sessionId: number) => {
    if (MOCK_MODE) return mockData.getSessionContext(sessionId);
    await waitForReady();
    return withRetry(() => App.GetSessionContext(sessionId));
  },

  getRecentSessions: async (limit: number) => {
    if (MOCK_MODE) {
      const today = new Date().toISOString().split('T')[0];
      return mockData.getSessionsForDate(today).slice(0, limit);
    }
    await waitForReady();
    return withRetry(() => App.GetRecentSessions(limit));
  },

  deleteSession: async (sessionId: number) => {
    if (MOCK_MODE) return;
    await waitForReady();
    return App.DeleteSession(sessionId);
  },
};

/**
 * Reports API
 */
export const reports = {
  generateReport: async (timeRange: string, reportType: string, _includeScreenshots: boolean) => {
    if (MOCK_MODE) return mockData.generateReport(timeRange, reportType);
    await waitForReady();
    return withRetry(() => App.GenerateReport(timeRange, reportType, _includeScreenshots));
  },

  getReport: async (id: number) => {
    if (MOCK_MODE) return mockData.generateReport('today', 'summary');
    await waitForReady();
    return withRetry(() => App.GetReport(id));
  },

  exportReport: async (reportId: number, format: string) => {
    if (MOCK_MODE) return `mock-report-${reportId}.${format}`;
    await waitForReady();
    return withRetry(() => App.ExportReport(reportId, format));
  },

  getReportHistory: async () => {
    if (MOCK_MODE) return mockData.getReportHistory();
    await waitForReady();
    return withRetry(() => App.GetReportHistory());
  },

  getDailySummaries: async (limit: number = 30) => {
    if (MOCK_MODE) return mockData.getReportHistory().slice(0, limit);
    await waitForReady();
    return withRetry(() => App.GetDailySummaries(limit));
  },

  parseTimeRange: async (input: string) => {
    if (MOCK_MODE) return mockData.parseTimeRange(input);
    await waitForReady();
    return withRetry(() => App.ParseTimeRange(input));
  },
};

/**
 * Config API
 */
export const config = {
  getConfig: async () => {
    if (MOCK_MODE) return mockData.getConfig();
    await waitForReady();
    return withRetry(() => App.GetConfig());
  },

  updateConfig: async (updates: Record<string, unknown>) => {
    await waitForReady();
    return App.UpdateConfig(updates);
  },

  restartDaemon: async () => {
    await waitForReady();
    return App.RestartTracking();
  },

  getDaemonStatus: async () => {
    await waitForReady();
    return withRetry(() => App.GetDaemonStatus());
  },

  startDaemon: async () => {
    await waitForReady();
    return App.StartTracking();
  },

  stopDaemon: async () => {
    await waitForReady();
    return App.StopTracking();
  },

  getStorageStats: async () => {
    await waitForReady();
    return withRetry(() => App.GetStorageStats());
  },

  // These are stubs - inference not implemented yet
  getInferenceStatus: async (): Promise<InferenceStatus> => {
    return {
      type: 'bundled',
      available: false,
      model: '',
      error: null,
    };
  },

  getAvailableModels: async (): Promise<ModelInfo[]> => {
    return [];
  },

  downloadModel: async (
    _modelId: string,
    _onProgress: (progress: number) => void
  ): Promise<void> => {
    console.warn('Model download not implemented');
  },
};

/**
 * Screenshots API
 */
export const screenshots = {
  getScreenshot: async (id: number) => {
    if (MOCK_MODE) return mockData.getScreenshot(id);
    await waitForReady();
    return withRetry(() => App.GetScreenshot(id));
  },

  getScreenshotImage: async (id: number) => {
    // Returns the file:// path to the screenshot
    if (MOCK_MODE) return mockData.getScreenshotImageUrl(id);
    await waitForReady();
    return withRetry(() => App.GetScreenshotPath(id));
  },

  getThumbnail: async (id: number) => {
    // Returns the file:// path to the thumbnail
    if (MOCK_MODE) return mockData.getThumbnailUrl(id);
    await waitForReady();
    return withRetry(() => App.GetThumbnailPath(id));
  },

  deleteScreenshot: async (id: number) => {
    if (MOCK_MODE) return;
    await waitForReady();
    return App.DeleteScreenshot(id);
  },
};

/**
 * System API
 */
export const system = {
  getDataDir: async () => {
    await waitForReady();
    return App.GetDataDir();
  },

  getVersion: async () => {
    await waitForReady();
    return App.GetVersion();
  },

  getSystemInfo: async () => {
    await waitForReady();
    return withRetry(() => App.GetSystemInfo());
  },

  getCurrentTime: async () => {
    await waitForReady();
    return App.GetCurrentTime();
  },

  openDataDir: async () => {
    await waitForReady();
    return App.OpenDataDir();
  },

  forceCapture: async () => {
    await waitForReady();
    return App.ForceCapture();
  },
};

/**
 * Summaries API - AI-generated session summaries
 */
export const summaries = {
  generateSummary: async (sessionId: number): Promise<void> => {
    await waitForReady();
    await App.GenerateSummary(sessionId);
  },

  regenerateSummary: async (sessionId: number): Promise<void> => {
    await waitForReady();
    await App.RegenerateSummary(sessionId);
  },
};

// Unified API export
export const api = {
  analytics,
  timeline,
  reports,
  config,
  screenshots,
  system,
  summaries,
};
