/**
 * Wails Binding Wrappers
 *
 * This file wraps the auto-generated Wails bindings for type safety
 * and consistent API usage across the frontend.
 */

import * as App from '@wailsjs/go/main/App';

import type {
  InferenceStatus,
  ModelInfo,
} from '@/types';

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
    await waitForReady();
    return withRetry(() => App.GetDailyStats(date));
  },

  getWeeklyStats: async (startDate: string) => {
    await waitForReady();
    return withRetry(() => App.GetWeeklyStats(startDate));
  },

  getMonthlyStats: async (year: number, month: number) => {
    await waitForReady();
    return withRetry(() => App.GetMonthlyStats(year, month));
  },

  getCalendarHeatmap: async (year: number, month: number) => {
    await waitForReady();
    return withRetry(() => App.GetCalendarHeatmap(year, month));
  },

  getAppUsage: async (start: number, end: number) => {
    await waitForReady();
    return withRetry(() => App.GetAppUsage(start, end));
  },

  getHourlyActivity: async (date: string) => {
    await waitForReady();
    return withRetry(() => App.GetHourlyActivity(date));
  },

  getDataSourceStats: async (start: number, end: number) => {
    await waitForReady();
    return withRetry(() => App.GetDataSourceStats(start, end));
  },

  getProductivityScore: async (date: string) => {
    await waitForReady();
    return withRetry(() => App.GetProductivityScore(date));
  },

  getFocusDistribution: async (date: string) => {
    await waitForReady();
    return withRetry(() => App.GetFocusDistribution(date));
  },

  getActivityTags: async (date: string) => {
    await waitForReady();
    return withRetry(() => App.GetActivityTags(date));
  },

  getTopWindows: async (date: string, limit: number) => {
    await waitForReady();
    return withRetry(() => App.GetTopWindows(date, limit));
  },

  exportAnalytics: async (date: string, viewMode: string, format: string) => {
    await waitForReady();
    return withRetry(() => App.ExportAnalytics(date, viewMode, format));
  },
};

/**
 * Timeline API
 */
export const timeline = {
  getSessionsForDate: async (date: string) => {
    await waitForReady();
    return withRetry(() => App.GetSessionsForDate(date));
  },

  getScreenshotsForSession: async (
    sessionId: number,
    page: number,
    perPage: number
  ) => {
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForSession(sessionId, page, perPage));
  },

  getScreenshotsForHour: async (date: string, hour: number) => {
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForHour(date, hour));
  },

  getSessionContext: async (sessionId: number) => {
    await waitForReady();
    return withRetry(() => App.GetSessionContext(sessionId));
  },

  getRecentSessions: async (limit: number) => {
    await waitForReady();
    return withRetry(() => App.GetRecentSessions(limit));
  },

  deleteSession: async (sessionId: number) => {
    await waitForReady();
    return App.DeleteSession(sessionId);
  },
};

/**
 * Reports API
 */
export const reports = {
  generateReport: async (timeRange: string, reportType: string, includeScreenshots: boolean) => {
    await waitForReady();
    return withRetry(() => App.GenerateReport(timeRange, reportType, includeScreenshots));
  },

  getReport: async (id: number) => {
    await waitForReady();
    return withRetry(() => App.GetReport(id));
  },

  exportReport: async (reportId: number, format: string) => {
    await waitForReady();
    return withRetry(() => App.ExportReport(reportId, format));
  },

  getReportHistory: async () => {
    await waitForReady();
    return withRetry(() => App.GetReportHistory());
  },

  getDailySummaries: async (limit: number = 30) => {
    await waitForReady();
    return withRetry(() => App.GetDailySummaries(limit));
  },

  parseTimeRange: async (input: string) => {
    await waitForReady();
    return withRetry(() => App.ParseTimeRange(input));
  },
};

/**
 * Config API
 */
export const config = {
  getConfig: async () => {
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
    await waitForReady();
    return withRetry(() => App.GetScreenshot(id));
  },

  getScreenshotImage: async (id: number) => {
    // Returns the file:// path to the screenshot
    await waitForReady();
    return withRetry(() => App.GetScreenshotPath(id));
  },

  getThumbnail: async (id: number) => {
    // Returns the file:// path to the thumbnail
    await waitForReady();
    return withRetry(() => App.GetThumbnailPath(id));
  },

  deleteScreenshot: async (id: number) => {
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
