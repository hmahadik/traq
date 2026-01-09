/**
 * TanStack Query Hooks
 *
 * These hooks wrap the API client with TanStack Query for caching,
 * background refetching, and optimistic updates.
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EventsOn, EventsOff } from '@wailsjs/runtime/runtime';
import { api } from './client';
import type { Config } from '@/types';

// Helper to convert date string to timestamp range
function getDateRange(date: string): { start: number; end: number } {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000;
  const end = start + 24 * 60 * 60 - 1; // End of day
  return { start, end };
}

// Query keys for cache management
export const queryKeys = {
  analytics: {
    daily: (date: string) => ['analytics', 'daily', date] as const,
    weekly: (startDate: string) => ['analytics', 'weekly', startDate] as const,
    monthly: (year: number, month: number) => ['analytics', 'monthly', year, month] as const,
    calendar: (year: number, month: number) => ['analytics', 'calendar', year, month] as const,
    appUsage: (start: number, end: number) => ['analytics', 'appUsage', start, end] as const,
    hourly: (date: string) => ['analytics', 'hourly', date] as const,
    dataSources: (start: number, end: number) => ['analytics', 'dataSources', start, end] as const,
    productivityScore: (date: string) => ['analytics', 'productivityScore', date] as const,
    focusDistribution: (date: string) => ['analytics', 'focusDistribution', date] as const,
    activityTags: (date: string) => ['analytics', 'activityTags', date] as const,
    topWindows: (date: string, limit: number) => ['analytics', 'topWindows', date, limit] as const,
  },
  timeline: {
    sessions: (date: string) => ['timeline', 'sessions', date] as const,
    screenshots: (sessionId: number, page: number, perPage: number) =>
      ['timeline', 'screenshots', sessionId, page, perPage] as const,
    hourScreenshots: (date: string, hour: number) =>
      ['timeline', 'hourScreenshots', date, hour] as const,
    context: (sessionId: number) => ['timeline', 'context', sessionId] as const,
  },
  reports: {
    history: () => ['reports', 'history'] as const,
    timeRange: (input: string) => ['reports', 'timeRange', input] as const,
  },
  config: {
    all: () => ['config'] as const,
    inference: () => ['config', 'inference'] as const,
    models: () => ['config', 'models'] as const,
  },
  screenshots: {
    detail: (id: number) => ['screenshots', id] as const,
    image: (id: number) => ['screenshots', 'image', id] as const,
    thumbnail: (id: number) => ['screenshots', 'thumbnail', id] as const,
  },
};

// ============================================================================
// Analytics Hooks
// ============================================================================

export function useDailyStats(date: string) {
  return useQuery({
    queryKey: queryKeys.analytics.daily(date),
    queryFn: () => api.analytics.getDailyStats(date),
    staleTime: 60_000, // 1 minute
  });
}

export function useWeeklyStats(startDate: string) {
  return useQuery({
    queryKey: queryKeys.analytics.weekly(startDate),
    queryFn: () => api.analytics.getWeeklyStats(startDate),
    staleTime: 60_000,
  });
}

export function useMonthlyStats(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.analytics.monthly(year, month),
    queryFn: () => api.analytics.getMonthlyStats(year, month),
    staleTime: 60_000,
  });
}

export function useCalendarHeatmap(year: number, month: number) {
  return useQuery({
    queryKey: queryKeys.analytics.calendar(year, month),
    queryFn: () => api.analytics.getCalendarHeatmap(year, month),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useAppUsageRange(start: number, end: number) {
  return useQuery({
    queryKey: queryKeys.analytics.appUsage(start, end),
    queryFn: () => api.analytics.getAppUsage(start, end),
    staleTime: 60_000,
  });
}

export function useAppUsage(date: string) {
  const { start, end } = getDateRange(date);
  return useQuery({
    queryKey: queryKeys.analytics.appUsage(start, end),
    queryFn: () => api.analytics.getAppUsage(start, end),
    staleTime: 60_000,
  });
}

export function useHourlyActivity(date: string) {
  return useQuery({
    queryKey: queryKeys.analytics.hourly(date),
    queryFn: () => api.analytics.getHourlyActivity(date),
    staleTime: 60_000,
  });
}

export function useDataSourceStatsRange(start: number, end: number) {
  return useQuery({
    queryKey: queryKeys.analytics.dataSources(start, end),
    queryFn: () => api.analytics.getDataSourceStats(start, end),
    staleTime: 60_000,
  });
}

export function useDataSourceStats(date: string) {
  const { start, end } = getDateRange(date);
  return useQuery({
    queryKey: queryKeys.analytics.dataSources(start, end),
    queryFn: () => api.analytics.getDataSourceStats(start, end),
    staleTime: 60_000,
  });
}

export function useProductivityScore(date: string) {
  return useQuery({
    queryKey: queryKeys.analytics.productivityScore(date),
    queryFn: () => api.analytics.getProductivityScore(date),
    staleTime: 60_000,
  });
}

export function useFocusDistribution(date: string) {
  return useQuery({
    queryKey: queryKeys.analytics.focusDistribution(date),
    queryFn: () => api.analytics.getFocusDistribution(date),
    staleTime: 60_000,
  });
}

export function useActivityTags(date: string) {
  return useQuery({
    queryKey: queryKeys.analytics.activityTags(date),
    queryFn: () => api.analytics.getActivityTags(date),
    staleTime: 60_000,
  });
}

export function useTopWindows(date: string, limit: number = 10) {
  return useQuery({
    queryKey: queryKeys.analytics.topWindows(date, limit),
    queryFn: () => api.analytics.getTopWindows(date, limit),
    staleTime: 60_000,
  });
}

// ============================================================================
// Timeline Hooks
// ============================================================================

export function useSessionsForDate(date: string) {
  return useQuery({
    queryKey: queryKeys.timeline.sessions(date),
    queryFn: () => api.timeline.getSessionsForDate(date),
    staleTime: 30_000, // 30 seconds
  });
}

export function useScreenshotsForSession(
  sessionId: number,
  page: number = 1,
  perPage: number = 20
) {
  return useQuery({
    queryKey: queryKeys.timeline.screenshots(sessionId, page, perPage),
    queryFn: () => api.timeline.getScreenshotsForSession(sessionId, page, perPage),
    staleTime: 60_000,
  });
}

export function useScreenshotsForHour(date: string, hour: number) {
  return useQuery({
    queryKey: queryKeys.timeline.hourScreenshots(date, hour),
    queryFn: () => api.timeline.getScreenshotsForHour(date, hour),
    staleTime: 60_000,
  });
}

export function useSessionContext(sessionId: number) {
  return useQuery({
    queryKey: queryKeys.timeline.context(sessionId),
    queryFn: () => api.timeline.getSessionContext(sessionId),
    staleTime: 30_000,
  });
}

// ============================================================================
// Reports Hooks
// ============================================================================

export function useReportHistory() {
  return useQuery({
    queryKey: queryKeys.reports.history(),
    queryFn: () => api.reports.getReportHistory(),
    staleTime: 60_000,
  });
}

export function useDailySummaries(limit: number = 30) {
  return useQuery({
    queryKey: ['reports', 'dailySummaries', limit],
    queryFn: () => api.reports.getDailySummaries(limit),
    staleTime: 60_000,
  });
}

export function useParseTimeRange(input: string) {
  return useQuery({
    queryKey: queryKeys.reports.timeRange(input),
    queryFn: () => api.reports.parseTimeRange(input),
    enabled: input.length > 0,
    staleTime: Infinity, // Time range parsing is deterministic
  });
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ timeRange, reportType, includeScreenshots }: { timeRange: string; reportType: string; includeScreenshots: boolean }) =>
      api.reports.generateReport(timeRange, reportType, includeScreenshots),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.history() });
    },
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: ({ reportId, format }: { reportId: number; format: string }) =>
      api.reports.exportReport(reportId, format),
  });
}

// ============================================================================
// Config Hooks
// ============================================================================

export function useConfig() {
  return useQuery({
    queryKey: queryKeys.config.all(),
    queryFn: () => api.config.getConfig(),
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useUpdateConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<Config>) => api.config.updateConfig(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.config.all() });
    },
  });
}

export function useRestartDaemon() {
  return useMutation({
    mutationFn: () => api.config.restartDaemon(),
  });
}

export function useInferenceStatus() {
  return useQuery({
    queryKey: queryKeys.config.inference(),
    queryFn: () => api.config.getInferenceStatus(),
    staleTime: 30_000,
    refetchInterval: 30_000, // Poll every 30 seconds
  });
}

export function useAvailableModels() {
  return useQuery({
    queryKey: queryKeys.config.models(),
    queryFn: () => api.config.getAvailableModels(),
    staleTime: 5 * 60_000,
  });
}

export function useDownloadModel() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);

  useEffect(() => {
    // Listen for download progress events
    const cancelProgress = EventsOn('model:download:progress', (data: { modelId: string; percent: number }) => {
      setProgress(data.percent);
    });

    const cancelComplete = EventsOn('model:download:complete', (data: { modelId: string }) => {
      setProgress(null);
      setDownloadingModelId(null);
      // Refresh the models list to show the newly downloaded model
      queryClient.invalidateQueries({ queryKey: queryKeys.config.models() });
    });

    const cancelError = EventsOn('model:download:error', (data: { modelId: string; error: string }) => {
      setProgress(null);
      setDownloadingModelId(null);
      console.error('Model download failed:', data.error);
    });

    return () => {
      cancelProgress();
      cancelComplete();
      cancelError();
    };
  }, [queryClient]);

  const download = useCallback(async (modelId: string) => {
    setDownloadingModelId(modelId);
    setProgress(0);
    await api.config.downloadModel(modelId, () => {});
  }, []);

  return {
    download,
    progress,
    downloadingModelId,
    isDownloading: downloadingModelId !== null,
  };
}

export function useServerStatus() {
  return useQuery({
    queryKey: ['config', 'server'],
    queryFn: () => api.config.getServerStatus(),
    staleTime: 30_000,
  });
}

export function useDownloadServer() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for download progress events
    const cancelProgress = EventsOn('server:download:progress', (data: { percent: number }) => {
      setProgress(data.percent);
    });

    const cancelComplete = EventsOn('server:download:complete', () => {
      setProgress(null);
      setIsDownloading(false);
      setError(null);
      // Refresh the server status to show it's installed
      queryClient.invalidateQueries({ queryKey: ['config', 'server'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.config.inference() });
    });

    const cancelError = EventsOn('server:download:error', (data: { error: string }) => {
      setProgress(null);
      setIsDownloading(false);
      setError(data.error);
      console.error('Server download failed:', data.error);
    });

    return () => {
      cancelProgress();
      cancelComplete();
      cancelError();
    };
  }, [queryClient]);

  const download = useCallback(async () => {
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    await api.config.downloadServer();
  }, []);

  return {
    download,
    progress,
    isDownloading,
    error,
  };
}

export function useStorageStats() {
  return useQuery({
    queryKey: ['config', 'storage'],
    queryFn: () => api.config.getStorageStats(),
    staleTime: 60_000, // 1 minute
  });
}

export function useOpenDataDir() {
  return useMutation({
    mutationFn: () => api.system.openDataDir(),
  });
}

export function useDataDir() {
  return useQuery({
    queryKey: ['system', 'dataDir'],
    queryFn: () => api.system.getDataDir(),
    staleTime: Infinity, // Data directory doesn't change
  });
}

export function useAvailableMonitors() {
  return useQuery({
    queryKey: ['system', 'monitors'],
    queryFn: () => api.system.getAvailableMonitors(),
    staleTime: 30_000, // 30 seconds - monitors can change on hot-plug
  });
}

export function useOptimizeDatabase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.config.optimizeDatabase(),
    onSuccess: () => {
      // Refresh storage stats after optimization
      queryClient.invalidateQueries({ queryKey: ['config', 'storage'] });
    },
  });
}

// ============================================================================
// Screenshot Hooks
// ============================================================================

export function useScreenshot(id: number) {
  return useQuery({
    queryKey: queryKeys.screenshots.detail(id),
    queryFn: () => api.screenshots.getScreenshot(id),
    staleTime: Infinity, // Screenshots don't change
  });
}

export function useScreenshotImage(id: number) {
  return useQuery({
    queryKey: queryKeys.screenshots.image(id),
    queryFn: () => api.screenshots.getScreenshotImage(id),
    staleTime: Infinity,
  });
}

export function useThumbnail(id: number) {
  return useQuery({
    queryKey: queryKeys.screenshots.thumbnail(id),
    queryFn: () => api.screenshots.getThumbnail(id),
    staleTime: Infinity,
  });
}

export function useDeleteScreenshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => api.screenshots.deleteScreenshot(id),
    onSuccess: () => {
      // Invalidate all timeline queries since screenshot counts may change
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
}

// ============================================================================
// Summary Hooks
// ============================================================================

export function useGenerateSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => api.summaries.generateSummary(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useRegenerateSummary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => api.summaries.regenerateSummary(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sessionId: number) => api.timeline.deleteSession(sessionId),
    onSuccess: () => {
      // Invalidate all timeline queries since the session is deleted
      queryClient.invalidateQueries({ queryKey: ['timeline'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}
