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

// Use 'unknown' for backend types that may differ from frontend definitions
// Components should handle the actual structure

/**
 * Analytics API
 */
export const analytics = {
  getDailyStats: async (date: string) => {
    return App.GetDailyStats(date);
  },

  getWeeklyStats: async (startDate: string) => {
    return App.GetWeeklyStats(startDate);
  },

  getMonthlyStats: async (year: number, month: number) => {
    return App.GetMonthlyStats(year, month);
  },

  getCalendarHeatmap: async (year: number, month: number) => {
    return App.GetCalendarHeatmap(year, month);
  },

  getAppUsage: async (start: number, end: number) => {
    return App.GetAppUsage(start, end);
  },

  getHourlyActivity: async (date: string) => {
    return App.GetHourlyActivity(date);
  },

  getDataSourceStats: async (start: number, end: number) => {
    return App.GetDataSourceStats(start, end);
  },

  getProductivityScore: async (date: string) => {
    return App.GetProductivityScore(date);
  },

  getFocusDistribution: async (date: string) => {
    return App.GetFocusDistribution(date);
  },

  getActivityTags: async (date: string) => {
    return App.GetActivityTags(date);
  },

  getTopWindows: async (date: string, limit: number) => {
    return App.GetTopWindows(date, limit);
  },

  exportAnalytics: async (date: string, viewMode: string, format: string) => {
    return App.ExportAnalytics(date, viewMode, format);
  },
};

/**
 * Timeline API
 */
export const timeline = {
  getSessionsForDate: async (date: string) => {
    return App.GetSessionsForDate(date);
  },

  getScreenshotsForSession: async (
    sessionId: number,
    page: number,
    perPage: number
  ) => {
    return App.GetScreenshotsForSession(sessionId, page, perPage);
  },

  getScreenshotsForHour: async (date: string, hour: number) => {
    return App.GetScreenshotsForHour(date, hour);
  },

  getSessionContext: async (sessionId: number) => {
    return App.GetSessionContext(sessionId);
  },

  getRecentSessions: async (limit: number) => {
    return App.GetRecentSessions(limit);
  },
};

/**
 * Reports API
 */
export const reports = {
  generateReport: async (timeRange: string, reportType: string, includeScreenshots: boolean) => {
    return App.GenerateReport(timeRange, reportType, includeScreenshots);
  },

  getReport: async (id: number) => {
    return App.GetReport(id);
  },

  exportReport: async (reportId: number, format: string) => {
    return App.ExportReport(reportId, format);
  },

  getReportHistory: async () => {
    return App.GetReportHistory();
  },

  parseTimeRange: async (input: string) => {
    return App.ParseTimeRange(input);
  },
};

/**
 * Config API
 */
export const config = {
  getConfig: async () => {
    return App.GetConfig();
  },

  updateConfig: async (updates: Record<string, unknown>) => {
    return App.UpdateConfig(updates);
  },

  restartDaemon: async () => {
    return App.RestartTracking();
  },

  getDaemonStatus: async () => {
    return App.GetDaemonStatus();
  },

  startDaemon: async () => {
    return App.StartTracking();
  },

  stopDaemon: async () => {
    return App.StopTracking();
  },

  getStorageStats: async () => {
    return App.GetStorageStats();
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
    return App.GetScreenshot(id);
  },

  getScreenshotImage: async (id: number) => {
    // Returns the file:// path to the screenshot
    return App.GetScreenshotPath(id);
  },

  getThumbnail: async (id: number) => {
    // Returns the file:// path to the thumbnail
    return App.GetThumbnailPath(id);
  },

  deleteScreenshot: async (id: number) => {
    return App.DeleteScreenshot(id);
  },
};

/**
 * System API
 */
export const system = {
  getDataDir: async () => {
    return App.GetDataDir();
  },

  getVersion: async () => {
    return App.GetVersion();
  },

  getSystemInfo: async () => {
    return App.GetSystemInfo();
  },

  getCurrentTime: async () => {
    return App.GetCurrentTime();
  },

  openDataDir: async () => {
    return App.OpenDataDir();
  },

  forceCapture: async () => {
    return App.ForceCapture();
  },
};

/**
 * Summaries API (stubs - not yet implemented in backend)
 */
export const summaries = {
  generateSummary: async (_sessionId: number): Promise<void> => {
    console.warn('Summary generation not implemented');
  },

  regenerateSummary: async (_sessionId: number): Promise<void> => {
    console.warn('Summary regeneration not implemented');
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
