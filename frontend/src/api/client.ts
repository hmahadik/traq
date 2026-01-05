/**
 * Wails Binding Wrappers
 *
 * TODO: Once Phase 4 (Backend Services & Wails Bindings) is complete,
 * replace these mock implementations with actual Wails bindings:
 *
 * import * as Analytics from '@wailsjs/go/service/AnalyticsService';
 * import * as Timeline from '@wailsjs/go/service/TimelineService';
 * import * as Reports from '@wailsjs/go/service/ReportsService';
 * import * as Config from '@wailsjs/go/service/ConfigService';
 * import * as Screenshots from '@wailsjs/go/service/ScreenshotService';
 * import * as Summaries from '@wailsjs/go/service/SummaryService';
 */

import type {
  DailyStats,
  WeeklyStats,
  CalendarData,
  AppUsage,
  HourlyActivity,
  DataSourceStats,
  SessionSummary,
  ScreenshotPage,
  SessionContext,
  Config,
  InferenceStatus,
  ModelInfo,
  Report,
  ReportMeta,
  TimeRange,
  Screenshot,
} from '@/types';

import { mockData } from './mockData';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Analytics API
 */
export const analytics = {
  getDailyStats: async (date: string): Promise<DailyStats> => {
    await delay(200);
    return mockData.getDailyStats(date);
  },

  getWeeklyStats: async (startDate: string): Promise<WeeklyStats> => {
    await delay(300);
    return mockData.getWeeklyStats(startDate);
  },

  getCalendarHeatmap: async (year: number, month: number): Promise<CalendarData> => {
    await delay(200);
    return mockData.getCalendarHeatmap(year, month);
  },

  getAppUsage: async (start: number, end: number): Promise<AppUsage[]> => {
    await delay(200);
    return mockData.getAppUsage(start, end);
  },

  getHourlyActivity: async (date: string): Promise<HourlyActivity[]> => {
    await delay(150);
    return mockData.getHourlyActivity(date);
  },

  getDataSourceStats: async (start: number, end: number): Promise<DataSourceStats> => {
    await delay(250);
    return mockData.getDataSourceStats(start, end);
  },
};

/**
 * Timeline API
 */
export const timeline = {
  getSessionsForDate: async (date: string): Promise<SessionSummary[]> => {
    await delay(300);
    return mockData.getSessionsForDate(date);
  },

  getScreenshotsForSession: async (
    sessionId: number,
    page: number,
    perPage: number
  ): Promise<ScreenshotPage> => {
    await delay(200);
    return mockData.getScreenshotsForSession(sessionId, page, perPage);
  },

  getScreenshotsForHour: async (date: string, hour: number): Promise<Screenshot[]> => {
    await delay(200);
    return mockData.getScreenshotsForHour(date, hour);
  },

  getSessionContext: async (sessionId: number): Promise<SessionContext> => {
    await delay(300);
    return mockData.getSessionContext(sessionId);
  },
};

/**
 * Reports API
 */
export const reports = {
  generateReport: async (timeRange: string, reportType: string): Promise<Report> => {
    await delay(1000); // Reports take longer to generate
    return mockData.generateReport(timeRange, reportType);
  },

  exportReport: async (reportId: number, format: string): Promise<string> => {
    await delay(500);
    return `/exports/report-${reportId}.${format}`;
  },

  getReportHistory: async (): Promise<ReportMeta[]> => {
    await delay(200);
    return mockData.getReportHistory();
  },

  parseTimeRange: async (input: string): Promise<TimeRange> => {
    await delay(100);
    return mockData.parseTimeRange(input);
  },
};

/**
 * Config API
 */
export const config = {
  getConfig: async (): Promise<Config> => {
    await delay(150);
    return mockData.getConfig();
  },

  updateConfig: async (updates: Partial<Config>): Promise<void> => {
    await delay(200);
    console.log('Config updated:', updates);
    // In real implementation, this would call the backend
  },

  restartDaemon: async (): Promise<void> => {
    await delay(500);
    console.log('Daemon restarted');
  },

  getInferenceStatus: async (): Promise<InferenceStatus> => {
    await delay(200);
    return mockData.getInferenceStatus();
  },

  getAvailableModels: async (): Promise<ModelInfo[]> => {
    await delay(200);
    return mockData.getAvailableModels();
  },

  downloadModel: async (
    _modelId: string,
    onProgress: (progress: number) => void
  ): Promise<void> => {
    // Simulate download progress
    for (let i = 0; i <= 100; i += 10) {
      await delay(200);
      onProgress(i);
    }
  },
};

/**
 * Screenshots API
 */
export const screenshots = {
  getScreenshot: async (id: number): Promise<Screenshot> => {
    await delay(100);
    return mockData.getScreenshot(id);
  },

  getScreenshotImage: async (id: number): Promise<string> => {
    await delay(50);
    // Return a placeholder image URL
    return mockData.getScreenshotImageUrl(id);
  },

  getThumbnail: async (id: number): Promise<string> => {
    await delay(50);
    return mockData.getThumbnailUrl(id);
  },

  deleteScreenshot: async (id: number): Promise<void> => {
    await delay(200);
    console.log('Screenshot deleted:', id);
  },
};

/**
 * Summaries API
 */
export const summaries = {
  generateSummary: async (sessionId: number): Promise<void> => {
    await delay(3000); // Summaries take time to generate
    console.log('Summary generated for session:', sessionId);
  },

  regenerateSummary: async (sessionId: number): Promise<void> => {
    await delay(3000);
    console.log('Summary regenerated for session:', sessionId);
  },
};

// Unified API export
export const api = {
  analytics,
  timeline,
  reports,
  config,
  screenshots,
  summaries,
};
