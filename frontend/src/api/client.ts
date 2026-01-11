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
  MonitorInfo,
  ServerStatus,
} from '@/types';

// Check if mock mode is enabled via env var or URL param
// This is checked dynamically on each API call to support navigation with mock param
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

// Export function for dynamic checking - called on each API request
// This supports navigation to URLs with ?mock=true after initial page load
export { isMockMode as MOCK_MODE };

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
    if (isMockMode()) return mockData.getDailyStats(date);
    await waitForReady();
    return withRetry(() => App.GetDailyStats(date));
  },

  getWeeklyStats: async (startDate: string) => {
    if (isMockMode()) return mockData.getWeeklyStats(startDate);
    await waitForReady();
    return withRetry(() => App.GetWeeklyStats(startDate));
  },

  getMonthlyStats: async (year: number, month: number) => {
    if (isMockMode()) return mockData.getWeeklyStats(`${year}-${String(month).padStart(2, '0')}-01`);
    await waitForReady();
    return withRetry(() => App.GetMonthlyStats(year, month));
  },

  getYearlyStats: async (year: number) => {
    if (isMockMode()) return mockData.getWeeklyStats(`${year}-01-01`);
    await waitForReady();
    return withRetry(() => App.GetYearlyStats(year));
  },

  getCustomRangeStats: async (startDate: string, endDate: string) => {
    if (isMockMode()) return mockData.getWeeklyStats(startDate);
    await waitForReady();
    return withRetry(() => App.GetCustomRangeStats(startDate, endDate));
  },

  getCalendarHeatmap: async (year: number, month: number) => {
    if (isMockMode()) return mockData.getCalendarHeatmap(year, month);
    await waitForReady();
    return withRetry(() => App.GetCalendarHeatmap(year, month));
  },

  getAppUsage: async (start: number, end: number) => {
    if (isMockMode()) return mockData.getAppUsage(start, end);
    await waitForReady();
    return withRetry(() => App.GetAppUsage(start, end));
  },

  getHourlyActivity: async (date: string) => {
    if (isMockMode()) return mockData.getHourlyActivity(date);
    await waitForReady();
    return withRetry(() => App.GetHourlyActivity(date));
  },

  getHourlyActivityHeatmap: async () => {
    if (isMockMode()) return [];
    await waitForReady();
    return withRetry(() => App.GetHourlyActivityHeatmap());
  },

  getDataSourceStats: async (start: number, end: number) => {
    if (isMockMode()) return mockData.getDataSourceStats(start, end);
    await waitForReady();
    return withRetry(() => App.GetDataSourceStats(start, end));
  },

  getProductivityScore: async (date: string) => {
    if (isMockMode()) return {
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
    if (isMockMode()) {
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
    if (isMockMode()) return [
      { tag: 'coding', minutes: 180, percentage: 45 },
      { tag: 'research', minutes: 80, percentage: 20 },
      { tag: 'communication', minutes: 60, percentage: 15 },
      { tag: 'other', minutes: 80, percentage: 20 },
    ];
    await waitForReady();
    return withRetry(() => App.GetActivityTags(date));
  },

  getTopWindows: async (date: string, limit: number) => {
    if (isMockMode()) return [
      { windowTitle: 'main.go - VS Code', appName: 'VS Code', durationSeconds: 3600 },
      { windowTitle: 'GitHub - Pull Request #42', appName: 'Firefox', durationSeconds: 1800 },
      { windowTitle: 'Terminal - ~/projects', appName: 'Terminal', durationSeconds: 1200 },
    ].slice(0, limit);
    await waitForReady();
    return withRetry(() => App.GetTopWindows(date, limit));
  },

  exportAnalytics: async (date: string, viewMode: string, format: string) => {
    if (isMockMode()) return 'mock-export-path';
    await waitForReady();
    return withRetry(() => App.ExportAnalytics(date, viewMode, format));
  },
};

/**
 * Timeline API
 */
export const timeline = {
  getSessionsForDate: async (date: string) => {
    if (isMockMode()) return mockData.getSessionsForDate(date);
    await waitForReady();
    return withRetry(() => App.GetSessionsForDate(date));
  },

  getScreenshotsForSession: async (
    sessionId: number,
    page: number,
    perPage: number
  ) => {
    if (isMockMode()) return mockData.getScreenshotsForSession(sessionId, page, perPage);
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForSession(sessionId, page, perPage));
  },

  getScreenshotsForHour: async (date: string, hour: number) => {
    if (isMockMode()) return mockData.getScreenshotsForHour(date, hour);
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForHour(date, hour));
  },

  getScreenshotsForDate: async (date: string) => {
    if (isMockMode()) {
      // Get all screenshots for the entire day
      const screenshots = [];
      for (let hour = 0; hour < 24; hour++) {
        screenshots.push(...mockData.getScreenshotsForHour(date, hour));
      }
      return screenshots;
    }
    await waitForReady();
    return withRetry(() => App.GetScreenshotsForDate(date));
  },

  getSessionContext: async (sessionId: number) => {
    if (isMockMode()) return mockData.getSessionContext(sessionId);
    await waitForReady();
    return withRetry(() => App.GetSessionContext(sessionId));
  },

  getTimelineGridData: async (date: string) => {
    if (isMockMode()) return mockData.getTimelineGridData?.(date) || null;
    await waitForReady();
    return withRetry(() => App.GetTimelineGridData(date));
  },

  getRecentSessions: async (limit: number) => {
    if (isMockMode()) {
      const today = new Date().toISOString().split('T')[0];
      return mockData.getSessionsForDate(today).slice(0, limit);
    }
    await waitForReady();
    return withRetry(() => App.GetRecentSessions(limit));
  },

  deleteSession: async (sessionId: number) => {
    if (isMockMode()) return;
    await waitForReady();
    return App.DeleteSession(sessionId);
  },

  getTimelineEventsForDate: async (date: string, eventTypes?: string[]) => {
    if (isMockMode()) {
      // Return mock timeline events
      return {
        events: [
          {
            id: 1,
            type: 'screenshot',
            timestamp: Math.floor(new Date(date).getTime() / 1000) + 3600,
            endTime: Math.floor(new Date(date).getTime() / 1000) + 5400,
            appName: 'VS Code',
            sessionId: 1,
            screenshot: {
              filepath: '/path/to/screenshot.png',
              windowTitle: 'main.go - VS Code',
            },
          },
          {
            id: 2,
            type: 'focus_change',
            timestamp: Math.floor(new Date(date).getTime() / 1000) + 7200,
            endTime: Math.floor(new Date(date).getTime() / 1000) + 9000,
            appName: 'Firefox',
            sessionId: 1,
            focusChange: {
              windowTitle: 'GitHub - Pull Request',
              durationSeconds: 1800,
            },
          },
        ],
        total: 2,
        hasMore: false,
        eventTypes: ['screenshot', 'git_commit', 'file_event', 'shell_command', 'browser_visit', 'focus_change', 'afk'],
      };
    }
    await waitForReady();
    return withRetry(() => App.GetTimelineEventsForDate(date, eventTypes || []));
  },
};

/**
 * Reports API
 */
export const reports = {
  generateReport: async (timeRange: string, reportType: string, _includeScreenshots: boolean) => {
    if (isMockMode()) return mockData.generateReport(timeRange, reportType);
    await waitForReady();
    return withRetry(() => App.GenerateReport(timeRange, reportType, _includeScreenshots));
  },

  getReport: async (id: number) => {
    if (isMockMode()) return mockData.generateReport('today', 'summary');
    await waitForReady();
    return withRetry(() => App.GetReport(id));
  },

  exportReport: async (reportId: number, format: string) => {
    if (isMockMode()) return `mock-report-${reportId}.${format}`;
    await waitForReady();
    return withRetry(() => App.ExportReport(reportId, format));
  },

  getReportHistory: async () => {
    if (isMockMode()) return mockData.getReportHistory();
    await waitForReady();
    return withRetry(() => App.GetReportHistory());
  },

  getDailySummaries: async (limit: number = 30) => {
    if (isMockMode()) return mockData.getReportHistory().slice(0, limit);
    await waitForReady();
    return withRetry(() => App.GetDailySummaries(limit));
  },

  parseTimeRange: async (input: string) => {
    if (isMockMode()) return mockData.parseTimeRange(input);
    await waitForReady();
    return withRetry(() => App.ParseTimeRange(input));
  },
};

/**
 * Config API
 */
export const config = {
  getConfig: async () => {
    if (isMockMode()) return mockData.getConfig();
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

  pauseCapture: async () => {
    await waitForReady();
    return App.PauseCapture();
  },

  resumeCapture: async () => {
    await waitForReady();
    return App.ResumeCapture();
  },

  getStorageStats: async () => {
    await waitForReady();
    return withRetry(() => App.GetStorageStats());
  },

  optimizeDatabase: async (): Promise<number> => {
    await waitForReady();
    return App.OptimizeDatabase();
  },

  getInferenceStatus: async (): Promise<InferenceStatus> => {
    await waitForReady();
    const status = await withRetry(() => App.GetInferenceStatus());
    return {
      type: (status.engine || 'bundled') as 'bundled' | 'ollama' | 'cloud',
      available: status.available,
      model: status.modelName || '',
      error: null,
    };
  },

  getAvailableModels: async (): Promise<ModelInfo[]> => {
    if (isMockMode()) return mockData.getAvailableModels();
    await waitForReady();
    const models = await withRetry(() => App.GetAvailableModels());
    return models.map((m) => ({
      id: m.id,
      name: m.name,
      size: m.size,
      description: m.description,
      downloaded: m.downloaded,
      downloadUrl: m.downloadUrl,
      filename: m.filename,
    }));
  },

  downloadModel: async (
    modelId: string,
    _onProgress: (progress: number) => void
  ): Promise<void> => {
    if (isMockMode()) {
      console.warn('Model download not available in mock mode');
      return;
    }
    await waitForReady();
    // Start the download - progress will come via events
    await withRetry(() => App.DownloadModel(modelId));
  },

  deleteModel: async (modelId: string): Promise<void> => {
    if (isMockMode()) return;
    await waitForReady();
    await withRetry(() => App.DeleteModel(modelId));
  },

  getServerStatus: async (): Promise<ServerStatus> => {
    if (isMockMode()) {
      return {
        installed: false,
        serverPath: '/home/user/.local/share/traq/bin/llama-server',
        version: 'b4547',
      };
    }
    await waitForReady();
    const status = await withRetry(() => App.GetServerStatus());
    return {
      installed: status.installed,
      serverPath: status.serverPath,
      version: status.version,
      downloadUrl: status.downloadUrl,
      size: status.size,
    };
  },

  downloadServer: async (): Promise<void> => {
    if (isMockMode()) {
      console.warn('Server download not available in mock mode');
      return;
    }
    await waitForReady();
    // Start the download - progress will come via events
    await withRetry(() => App.DownloadServer());
  },
};

/**
 * Screenshots API
 */
export const screenshots = {
  getScreenshot: async (id: number) => {
    if (isMockMode()) return mockData.getScreenshot(id);
    await waitForReady();
    return withRetry(() => App.GetScreenshot(id));
  },

  getScreenshotImage: async (id: number) => {
    // Returns the file:// path to the screenshot
    if (isMockMode()) return mockData.getScreenshotImageUrl(id);
    await waitForReady();
    return withRetry(() => App.GetScreenshotPath(id));
  },

  getThumbnail: async (id: number) => {
    // Returns the file:// path to the thumbnail
    if (isMockMode()) return mockData.getThumbnailUrl(id);
    await waitForReady();
    return withRetry(() => App.GetThumbnailPath(id));
  },

  deleteScreenshot: async (id: number) => {
    if (isMockMode()) return;
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

  getAvailableMonitors: async (): Promise<MonitorInfo[]> => {
    if (isMockMode()) {
      // Return mock monitor data for development
      return [
        { index: 0, name: 'Display 1', width: 1920, height: 1080, x: 0, y: 0, isPrimary: true },
        { index: 1, name: 'Display 2', width: 2560, height: 1440, x: 1920, y: 0, isPrimary: false },
      ];
    }
    await waitForReady();
    const monitors = await withRetry(() => App.GetAvailableMonitors());
    return monitors || [];
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

/**
 * Git Repository API - Manage tracked git repositories
 */
export interface GitRepository {
  id: number;
  path: string;
  name: string;
  remoteUrl: { String: string; Valid: boolean } | null;
  lastScanned: { Int64: number; Valid: boolean } | null;
  isActive: boolean;
  createdAt: number;
}

export const git = {
  getTrackedRepositories: async (): Promise<GitRepository[]> => {
    await waitForReady();
    const repos = await withRetry(() => App.GetTrackedRepositories());
    return repos || [];
  },

  registerRepository: async (path: string): Promise<GitRepository> => {
    await waitForReady();
    return App.RegisterGitRepository(path);
  },

  unregisterRepository: async (repoId: number): Promise<void> => {
    await waitForReady();
    return App.UnregisterGitRepository(repoId);
  },

  discoverRepositories: async (searchPaths: string[], maxDepth: number): Promise<GitRepository[]> => {
    await waitForReady();
    const repos = await App.DiscoverGitRepositories(searchPaths, maxDepth);
    return repos || [];
  },

  getCategorizationRules: async () => {
    await waitForReady();
    return withRetry(() => App.GetCategorizationRules());
  },

  setAppTimelineCategory: async (appName: string, category: string) => {
    await waitForReady();
    return App.SetAppTimelineCategory(appName, category);
  },

  deleteTimelineCategoryRule: async (appName: string) => {
    await waitForReady();
    return App.DeleteTimelineCategoryRule(appName);
  },
};

/**
 * File Watch API - Manage watched directories for file event tracking
 */
export const fileWatch = {
  getWatchedDirectories: async (): Promise<string[]> => {
    await waitForReady();
    const dirs = await withRetry(() => App.GetWatchedDirectories());
    return dirs || [];
  },

  watchDirectory: async (path: string): Promise<void> => {
    await waitForReady();
    return App.WatchDirectory(path);
  },

  unwatchDirectory: async (path: string): Promise<void> => {
    await waitForReady();
    return App.UnwatchDirectory(path);
  },

  getAllowedExtensions: async (): Promise<string[]> => {
    await waitForReady();
    const exts = await withRetry(() => App.GetFileAllowedExtensions());
    return exts || [];
  },

  setAllowedExtensions: async (extensions: string[]): Promise<void> => {
    await waitForReady();
    return App.SetFileAllowedExtensions(extensions);
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
  git,
  fileWatch,
};
