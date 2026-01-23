import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTimelineData } from './useTimelineData';
import type { TimelineGridData, ActivityBlock } from '@/types/timeline';
import type { TimelineFilters } from '../FilterControls';

// Helper to create mock activity data
const createMockActivity = (overrides: Partial<ActivityBlock> = {}): ActivityBlock => ({
  id: 1,
  sessionId: 1,
  startTime: 1705363200, // 2024-01-16 00:00:00 UTC
  endTime: 1705363260,
  durationSeconds: 60,
  appName: 'Chrome',
  windowTitle: 'Test Window',
  category: 'focus',
  color: 'green',
  inferenceId: null,
  ...overrides,
});

// Helper to create mock grid data
const createMockGridData = (overrides: Partial<TimelineGridData> = {}): TimelineGridData => ({
  date: '2024-01-16',
  hourlyGrid: {},
  afkBlocks: {},
  gitEvents: {},
  shellEvents: {},
  browserEvents: {},
  fileEvents: {},
  ...overrides,
});

// Default filters
const defaultFilters: TimelineFilters = {
  showScreenshots: true,
  showGit: true,
  showShell: true,
  showBrowser: true,
  showFiles: true,
  showAfk: true,
};

describe('useTimelineData', () => {
  describe('null/empty data handling', () => {
    it('returns null when data is null', () => {
      const { result } = renderHook(() =>
        useTimelineData({ data: null, filters: defaultFilters })
      );
      expect(result.current).toBeNull();
    });

    it('returns null when data is undefined', () => {
      const { result } = renderHook(() =>
        useTimelineData({ data: undefined, filters: defaultFilters })
      );
      expect(result.current).toBeNull();
    });

    it('returns empty rows when grid has no events', () => {
      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData(),
          filters: defaultFilters,
        })
      );
      expect(result.current).not.toBeNull();
      expect(result.current?.rows).toHaveLength(0);
      expect(result.current?.totalEvents).toBe(0);
    });
  });

  describe('time range', () => {
    it('sets time range to full day based on date', () => {
      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({ date: '2024-01-16' }),
          filters: defaultFilters,
        })
      );
      expect(result.current).not.toBeNull();
      const { start, end } = result.current!.timeRange;
      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(16);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });
  });

  describe('activity processing', () => {
    it('transforms activities into EventDots', () => {
      const activity = createMockActivity({
        id: 1,
        appName: 'VS Code',
        windowTitle: 'index.ts - project',
        startTime: 1705363200,
        durationSeconds: 300,
        category: 'focus',
      });

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: {
              '0': { 'VS Code': [activity] },
            },
          }),
          filters: defaultFilters,
        })
      );

      expect(result.current).not.toBeNull();
      expect(result.current?.totalEvents).toBe(1);

      const row = result.current?.rows.find((r) => r.name === 'VS Code');
      expect(row).toBeDefined();
      expect(row?.data).toHaveLength(1);

      const dot = row?.data[0];
      expect(dot?.type).toBe('activity');
      expect(dot?.label).toBe('index.ts - project');
      expect(dot?.duration).toBe(300);
      expect(dot?.originalId).toBe(1);
    });

    it('groups activities by app name when groupBy is app', () => {
      const chromeActivity = createMockActivity({ id: 1, appName: 'Chrome' });
      const vscodeActivity = createMockActivity({ id: 2, appName: 'VS Code' });

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: {
              '0': {
                Chrome: [chromeActivity],
                'VS Code': [vscodeActivity],
              },
            },
          }),
          filters: defaultFilters,
          groupBy: 'app',
        })
      );

      expect(result.current?.rows).toHaveLength(2);
      expect(result.current?.rows.find((r) => r.name === 'Chrome')).toBeDefined();
      expect(result.current?.rows.find((r) => r.name === 'VS Code')).toBeDefined();
    });

    it('does not process activities when showScreenshots is false', () => {
      const activity = createMockActivity();

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: {
              '0': { Chrome: [activity] },
            },
          }),
          filters: { ...defaultFilters, showScreenshots: false },
        })
      );

      // Activity should not be added
      const chromeRow = result.current?.rows.find((r) => r.name === 'Chrome');
      expect(chromeRow).toBeUndefined();
    });
  });

  describe('git events processing', () => {
    it('transforms git events into EventDots', () => {
      const gitEvent = {
        id: 1,
        timestamp: 1705363200,
        repository: 'my-repo',
        branch: 'main',
        message: 'feat: add new feature',
        messageSubject: 'feat: add new feature',
        hash: 'abc123',
        insertions: 10,
        deletions: 5,
        filesChanged: 3,
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            gitEvents: {
              '0': [gitEvent],
            },
          }),
          filters: defaultFilters,
        })
      );

      expect(result.current?.totalEvents).toBe(1);
      const gitRow = result.current?.rows.find((r) => r.name === 'Git');
      expect(gitRow).toBeDefined();
      expect(gitRow?.data[0].type).toBe('git');
      expect(gitRow?.data[0].label).toBe('feat: add new feature');
    });

    it('does not process git events when showGit is false', () => {
      const gitEvent = {
        id: 1,
        timestamp: 1705363200,
        repository: 'my-repo',
        branch: 'main',
        message: 'feat: test',
        messageSubject: 'feat: test',
        hash: 'abc123',
        insertions: 0,
        deletions: 0,
        filesChanged: 0,
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            gitEvents: { '0': [gitEvent] },
          }),
          filters: { ...defaultFilters, showGit: false },
        })
      );

      const gitRow = result.current?.rows.find((r) => r.name === 'Git');
      expect(gitRow).toBeUndefined();
    });
  });

  describe('shell events processing', () => {
    it('transforms shell events into EventDots', () => {
      const shellEvent = {
        id: 1,
        timestamp: 1705363200,
        command: 'npm test',
        durationSeconds: 10,
        shellType: 'bash',
        exitCode: 0,
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            shellEvents: { '0': [shellEvent] },
          }),
          filters: defaultFilters,
        })
      );

      expect(result.current?.totalEvents).toBe(1);
      const shellRow = result.current?.rows.find((r) => r.name === 'Shell');
      expect(shellRow).toBeDefined();
      expect(shellRow?.data[0].type).toBe('shell');
      expect(shellRow?.data[0].label).toBe('npm test');
      expect(shellRow?.data[0].duration).toBe(10);
    });

    it('does not process shell events when showShell is false', () => {
      const shellEvent = {
        id: 1,
        timestamp: 1705363200,
        command: 'npm test',
        durationSeconds: 10,
        shellType: 'bash',
        exitCode: 0,
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            shellEvents: { '0': [shellEvent] },
          }),
          filters: { ...defaultFilters, showShell: false },
        })
      );

      const shellRow = result.current?.rows.find((r) => r.name === 'Shell');
      expect(shellRow).toBeUndefined();
    });
  });

  describe('AFK blocks processing', () => {
    // Note: useTimelineData uses AFK blocks to calculate Activity periods in "In Focus" mode,
    // not to create Breaks events directly. Breaks events are created in EventList.tsx instead.
    it('handles AFK blocks without crashing', () => {
      const afkBlock = {
        id: 1,
        sessionId: 1,
        startTime: 1705363200,
        endTime: 1705364100,
        durationSeconds: 900,
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            afkBlocks: { '0': [afkBlock] },
          }),
          filters: defaultFilters,
        })
      );

      // Hook should process data without errors
      expect(result.current).not.toBeNull();
      // AFK blocks don't create rows directly in useTimelineData (handled by EventList)
      expect(result.current?.rows).toBeDefined();
    });
  });

  describe('screenshots processing', () => {
    it('transforms screenshots into EventDots when provided', () => {
      const screenshot = {
        id: 1,
        sessionId: 1,
        timestamp: 1705363200,
        filePath: '/screenshots/test.png',
        width: 1920,
        height: 1080,
        appName: 'Chrome',
        windowTitle: 'Test Page',
        windowClass: 'google-chrome',
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData(),
          filters: defaultFilters,
          screenshots: [screenshot],
        })
      );

      expect(result.current?.totalEvents).toBe(1);
      const screenshotsRow = result.current?.rows.find((r) => r.name === 'Screenshots');
      expect(screenshotsRow).toBeDefined();
      expect(screenshotsRow?.data[0].type).toBe('screenshot');
      expect(screenshotsRow?.data[0].label).toBe('Test Page');
    });
  });

  describe('row sorting', () => {
    it('sorts app rows by event count (most first)', () => {
      const chromeActivities = [
        createMockActivity({ id: 1, appName: 'Chrome' }),
        createMockActivity({ id: 2, appName: 'Chrome' }),
        createMockActivity({ id: 3, appName: 'Chrome' }),
      ];
      const vscodeActivity = createMockActivity({ id: 4, appName: 'VS Code' });

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: {
              '0': {
                Chrome: chromeActivities,
                'VS Code': [vscodeActivity],
              },
            },
          }),
          filters: defaultFilters,
        })
      );

      // Chrome has more events, should come first
      const appRows = result.current?.rows.filter(
        (r) => !['Git', 'Shell', 'Browser', 'Files', 'Breaks', 'Screenshots'].includes(r.name)
      );
      expect(appRows?.[0].name).toBe('Chrome');
    });

    it('places special rows (Git, Shell, etc.) at the end', () => {
      const activity = createMockActivity({ appName: 'Chrome' });
      const gitEvent = {
        id: 1,
        timestamp: 1705363200,
        repository: 'repo',
        branch: 'main',
        message: 'test',
        messageSubject: 'test',
        hash: 'abc',
        insertions: 0,
        deletions: 0,
        filesChanged: 0,
      };

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: { '0': { Chrome: [activity] } },
            gitEvents: { '0': [gitEvent] },
          }),
          filters: defaultFilters,
        })
      );

      const rows = result.current?.rows;
      const chromeIndex = rows?.findIndex((r) => r.name === 'Chrome') ?? -1;
      const gitIndex = rows?.findIndex((r) => r.name === 'Git') ?? -1;
      expect(chromeIndex).toBeLessThan(gitIndex);
    });
  });

  describe('row name normalization', () => {
    it('combines events with different casing into same row', () => {
      const chromeActivity1 = createMockActivity({ id: 1, appName: 'Chrome' });
      const chromeActivity2 = createMockActivity({ id: 2, appName: 'chrome' });

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: {
              '0': { Chrome: [chromeActivity1] },
              '1': { chrome: [chromeActivity2] },
            },
          }),
          filters: defaultFilters,
        })
      );

      // Should be combined into one row
      const chromeRows = result.current?.rows.filter(
        (r) => r.name.toLowerCase() === 'chrome'
      );
      expect(chromeRows).toHaveLength(1);
      expect(chromeRows?.[0].dotCount).toBe(2);
    });

    it('prefers capitalized display name', () => {
      const chromeActivity1 = createMockActivity({ id: 1, appName: 'chrome' });
      const chromeActivity2 = createMockActivity({ id: 2, appName: 'Chrome' });

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: {
              '0': { chrome: [chromeActivity1] },
              '1': { Chrome: [chromeActivity2] },
            },
          }),
          filters: defaultFilters,
        })
      );

      const chromeRow = result.current?.rows.find(
        (r) => r.name.toLowerCase() === 'chrome'
      );
      expect(chromeRow?.name).toBe('Chrome');
    });
  });

  describe('event sorting within rows', () => {
    it('sorts events by timestamp within each row', () => {
      const activities = [
        createMockActivity({ id: 1, startTime: 1705366800 }), // Later
        createMockActivity({ id: 2, startTime: 1705363200 }), // Earlier
        createMockActivity({ id: 3, startTime: 1705365000 }), // Middle
      ];

      const { result } = renderHook(() =>
        useTimelineData({
          data: createMockGridData({
            hourlyGrid: { '0': { Chrome: activities } },
          }),
          filters: defaultFilters,
        })
      );

      const chromeRow = result.current?.rows.find((r) => r.name === 'Chrome');
      const timestamps = chromeRow?.data.map((d) => d.timestamp.getTime()) ?? [];

      // Verify sorted ascending
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });
});
