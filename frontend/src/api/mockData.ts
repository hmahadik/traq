/**
 * Mock Data for Development
 *
 * This file provides realistic mock data for frontend development
 * before the Go backend is implemented.
 */

import type {
  DailyStats,
  WeeklyStats,
  CalendarData,
  CalendarDay,
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
  WindowFocusEvent,
  ShellCommand,
  GitCommit,
  FileEvent,
  BrowserVisit,
} from '@/types';

// Helper to generate timestamps
const now = Math.floor(Date.now() / 1000);
const day = 86400;
const hour = 3600;

// Parse date string to start of day timestamp
function dateToTimestamp(date: string): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

// Generate mock screenshots
function generateScreenshots(sessionId: number, count: number, startTime: number): Screenshot[] {
  const apps = ['VS Code', 'Firefox', 'Terminal', 'Slack', 'Chrome'];
  const titles = [
    'main.go - traq',
    'GitHub - Pull Request #42',
    'bash - ~/projects/traq',
    '#general | Slack',
    'Stack Overflow - How to...',
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: sessionId * 100 + i,
    timestamp: startTime + i * 30,
    filepath: `/screenshots/2024/01/15/screenshot_${sessionId}_${i}.webp`,
    dhash: `hash_${sessionId}_${i}`,
    windowTitle: titles[i % titles.length],
    appName: apps[i % apps.length],
    windowClass: null,
    processPid: 1234 + i,
    windowX: 0,
    windowY: 0,
    windowWidth: 1920,
    windowHeight: 1080,
    monitorName: 'Primary',
    monitorWidth: 1920,
    monitorHeight: 1080,
    sessionId,
    createdAt: startTime + i * 30,
  }));
}

// Session templates for realistic mock data
const sessionTemplates = [
  {
    summary: 'Morning standup and code review. Reviewed 3 pull requests for the authentication module, left feedback on error handling patterns. Discussed sprint priorities with the team.',
    tags: ['meetings', 'code-review'],
    confidence: 'high' as const,
    topApps: ['Slack', 'GitHub', 'VS Code'],
  },
  {
    summary: 'Deep work session on the dashboard redesign. Implemented the new chart components using Recharts, added responsive breakpoints, and integrated with the analytics API.',
    tags: ['coding', 'frontend'],
    confidence: 'high' as const,
    topApps: ['VS Code', 'Firefox', 'Terminal'],
  },
  {
    summary: 'Research and documentation for the new caching layer. Compared Redis vs Memcached performance benchmarks, drafted architecture decision record (ADR).',
    tags: ['research', 'documentation'],
    confidence: 'medium' as const,
    topApps: ['Firefox', 'Notion', 'VS Code'],
  },
  {
    summary: 'Debugging session for the file upload issue. Traced the problem to incorrect MIME type handling, wrote regression tests, and deployed the fix to staging.',
    tags: ['debugging', 'testing'],
    confidence: 'high' as const,
    topApps: ['VS Code', 'Terminal', 'Chrome'],
  },
  {
    summary: 'End-of-day wrap-up. Updated Jira tickets, pushed work-in-progress branch, and drafted tomorrow\'s task list. Quick sync with PM about timeline.',
    tags: ['planning', 'communication'],
    confidence: 'medium' as const,
    topApps: ['Jira', 'Slack', 'VS Code'],
  },
  {
    summary: 'API integration work for the third-party payment provider. Implemented webhook handlers, added retry logic for failed transactions, updated API documentation.',
    tags: ['coding', 'backend'],
    confidence: 'high' as const,
    topApps: ['VS Code', 'Postman', 'Terminal'],
  },
  {
    summary: 'Design review with UX team. Walked through new onboarding flow mockups, discussed user research findings, and prioritized accessibility improvements.',
    tags: ['meetings', 'design'],
    confidence: 'high' as const,
    topApps: ['Figma', 'Slack', 'Chrome'],
  },
  {
    summary: 'Database optimization work. Analyzed slow query logs, added missing indexes, and refactored N+1 queries in the reporting module. Performance improved 3x.',
    tags: ['coding', 'backend'],
    confidence: 'high' as const,
    topApps: ['VS Code', 'Terminal', 'DataGrip'],
  },
  {
    summary: 'Sprint retrospective and planning. Celebrated shipped features, identified process improvements, and estimated stories for next sprint.',
    tags: ['meetings', 'planning'],
    confidence: 'medium' as const,
    topApps: ['Miro', 'Slack', 'Jira'],
  },
  {
    summary: 'Security audit follow-up. Addressed findings from penetration test, implemented CSP headers, and updated dependency versions with known vulnerabilities.',
    tags: ['coding', 'security'],
    confidence: 'high' as const,
    topApps: ['VS Code', 'Terminal', 'Firefox'],
  },
];

// Generate mock session with rich, varied data
function generateSession(id: number, startTime: number, duration: number): SessionSummary {
  const endTime = startTime + duration;
  const screenshotCount = Math.floor(duration / 30);
  const template = sessionTemplates[id % sessionTemplates.length];

  return {
    id,
    startTime,
    endTime,
    durationSeconds: duration,
    screenshotCount,
    summaryId: id,
    createdAt: startTime,
    isOngoing: false,
    summary: template.summary,
    explanation: 'Analyzed window focus patterns and screenshot content to determine the primary activities during this session.',
    confidence: template.confidence,
    tags: template.tags,
    topApps: template.topApps,
    hasShell: Math.random() > 0.3,
    hasGit: Math.random() > 0.5,
    hasFiles: Math.random() > 0.4,
    hasBrowser: Math.random() > 0.3,
  };
}

export const mockData = {
  getDailyStats: (date: string): DailyStats => ({
    date,
    totalScreenshots: 580,
    totalSessions: 8,
    activeMinutes: 420,
    topApps: [
      { appName: 'VS Code', durationSeconds: 8400, percentage: 49, sessionCount: 6 },
      { appName: 'Firefox', durationSeconds: 3600, percentage: 21, sessionCount: 8 },
      { appName: 'Terminal', durationSeconds: 2700, percentage: 16, sessionCount: 5 },
      { appName: 'Slack', durationSeconds: 1500, percentage: 9, sessionCount: 4 },
      { appName: 'Chrome', durationSeconds: 900, percentage: 5, sessionCount: 2 },
    ],
    shellCommands: 127,
    gitCommits: 5,
    filesModified: 23,
    sitesVisited: 42,
  }),

  getWeeklyStats: (startDate: string): WeeklyStats => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });

    return {
      startDate,
      endDate: days[6],
      totalScreenshots: 2850,
      totalSessions: 48,
      totalActiveMinutes: 1680,
      dailyBreakdown: days.map(date => mockData.getDailyStats(date)),
      topApps: [
        { appName: 'VS Code', durationSeconds: 50400, percentage: 50, sessionCount: 35 },
        { appName: 'Firefox', durationSeconds: 20160, percentage: 20, sessionCount: 40 },
        { appName: 'Terminal', durationSeconds: 15120, percentage: 15, sessionCount: 25 },
        { appName: 'Slack', durationSeconds: 10080, percentage: 10, sessionCount: 20 },
        { appName: 'Chrome', durationSeconds: 5040, percentage: 5, sessionCount: 10 },
      ],
    };
  },

  getCalendarHeatmap: (year: number, month: number): CalendarData => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: CalendarDay[] = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
      const isWeekend = new Date(date).getDay() % 6 === 0;
      const activity = isWeekend ? Math.random() * 0.3 : Math.random();

      return {
        date,
        screenshotCount: Math.floor(activity * 500),
        sessionCount: Math.floor(activity * 10),
        activeMinutes: Math.floor(activity * 300),
        intensity: Math.min(4, Math.floor(activity * 5)) as 0 | 1 | 2 | 3 | 4,
      };
    });

    return { year, month, days };
  },

  getAppUsage: (_start: number, _end: number): AppUsage[] => [
    { appName: 'VS Code', durationSeconds: 8400, percentage: 49, sessionCount: 6 },
    { appName: 'Firefox', durationSeconds: 3600, percentage: 21, sessionCount: 8 },
    { appName: 'Terminal', durationSeconds: 2700, percentage: 16, sessionCount: 5 },
    { appName: 'Slack', durationSeconds: 1500, percentage: 9, sessionCount: 4 },
    { appName: 'Chrome', durationSeconds: 900, percentage: 5, sessionCount: 2 },
  ],

  getHourlyActivity: (_date: string): HourlyActivity[] =>
    Array.from({ length: 24 }, (_, hour) => {
      const isWorkHour = hour >= 9 && hour <= 18;
      const activity = isWorkHour ? 0.5 + Math.random() * 0.5 : Math.random() * 0.2;

      return {
        hour,
        screenshotCount: Math.floor(activity * 60),
        activeMinutes: Math.floor(activity * 60),
      };
    }),

  getDataSourceStats: (_start: number, _end: number): DataSourceStats => ({
    shell: {
      totalCommands: 127,
      topCommands: [
        { command: 'git', count: 45 },
        { command: 'npm', count: 32 },
        { command: 'cd', count: 28 },
        { command: 'ls', count: 22 },
      ],
    },
    git: {
      totalCommits: 5,
      repositories: [
        { name: 'traq', commitCount: 3, lastCommit: now - hour },
        { name: 'dotfiles', commitCount: 2, lastCommit: now - day },
      ],
    },
    files: {
      totalEvents: 23,
      byCategory: [
        { category: 'projects', count: 18 },
        { category: 'downloads', count: 5 },
      ],
    },
    browser: {
      totalVisits: 42,
      topDomains: [
        { domain: 'github.com', visits: 15 },
        { domain: 'stackoverflow.com', visits: 12 },
        { domain: 'docs.go.dev', visits: 8 },
        { domain: 'google.com', visits: 7 },
      ],
    },
  }),

  getSessionsForDate: (date: string): SessionSummary[] => {
    const dayStart = dateToTimestamp(date);

    return [
      generateSession(1, dayStart + 8 * hour + 30 * 60, 30 * 60),   // 8:30-9:00 - Early morning emails
      generateSession(2, dayStart + 9 * hour, 45 * 60),             // 9:00-9:45 - Standup & code review
      generateSession(3, dayStart + 10 * hour, 2 * hour),           // 10:00-12:00 - Deep work coding
      generateSession(4, dayStart + 12 * hour + 15 * 60, 45 * 60),  // 12:15-13:00 - Design review
      generateSession(5, dayStart + 13 * hour + 30 * 60, hour),     // 13:30-14:30 - Research & docs
      generateSession(6, dayStart + 14 * hour + 45 * 60, 90 * 60),  // 14:45-16:15 - Debugging
      generateSession(7, dayStart + 16 * hour + 30 * 60, 45 * 60),  // 16:30-17:15 - DB optimization
      generateSession(8, dayStart + 17 * hour + 30 * 60, 30 * 60),  // 17:30-18:00 - Wrap-up
    ];
  },

  getScreenshotsForSession: (
    sessionId: number,
    page: number,
    perPage: number
  ): ScreenshotPage => {
    const total = 120;
    const startTime = now - day + sessionId * 2 * hour;
    const allScreenshots = generateScreenshots(sessionId, total, startTime);
    const start = (page - 1) * perPage;

    return {
      screenshots: allScreenshots.slice(start, start + perPage),
      total,
      page,
      perPage,
      hasMore: start + perPage < total,
    };
  },

  getScreenshotsForHour: (date: string, hourNum: number): Screenshot[] => {
    const dayStart = dateToTimestamp(date);
    const hourStart = dayStart + hourNum * hour;
    return generateScreenshots(hourNum, 60, hourStart);
  },

  getSessionContext: (sessionId: number): SessionContext => {
    const startTime = now - day + sessionId * 2 * hour;
    const endTime = startTime + 2 * hour;

    const focusEvents: WindowFocusEvent[] = [
      {
        id: 1,
        windowTitle: 'main.go - traq',
        appName: 'VS Code',
        windowClass: 'code',
        startTime,
        endTime: startTime + 45 * 60,
        durationSeconds: 45 * 60,
        sessionId,
        createdAt: startTime,
      },
      {
        id: 2,
        windowTitle: 'GitHub - Pull Request',
        appName: 'Firefox',
        windowClass: 'firefox',
        startTime: startTime + 45 * 60,
        endTime: startTime + 60 * 60,
        durationSeconds: 15 * 60,
        sessionId,
        createdAt: startTime + 45 * 60,
      },
    ];

    const shellCommands: ShellCommand[] = [
      {
        id: 1,
        timestamp: startTime + 10 * 60,
        command: 'git status',
        shellType: 'zsh',
        workingDirectory: '~/projects/traq',
        exitCode: 0,
        durationSeconds: 0.5,
        hostname: 'dev-laptop',
        sessionId,
        createdAt: startTime + 10 * 60,
      },
      {
        id: 2,
        timestamp: startTime + 30 * 60,
        command: 'npm run build',
        shellType: 'zsh',
        workingDirectory: '~/projects/traq/frontend',
        exitCode: 0,
        durationSeconds: 12.5,
        hostname: 'dev-laptop',
        sessionId,
        createdAt: startTime + 30 * 60,
      },
    ];

    const gitCommits: GitCommit[] = [
      {
        id: 1,
        timestamp: startTime + 55 * 60,
        commitHash: 'abc123def456',
        shortHash: 'abc123d',
        repositoryId: 1,
        repositoryName: 'traq',
        branch: 'feature/frontend',
        message: 'Add timeline component with session cards',
        messageSubject: 'Add timeline component with session cards',
        filesChanged: 5,
        insertions: 250,
        deletions: 30,
        authorName: 'Developer',
        authorEmail: 'dev@example.com',
        isMerge: false,
        sessionId,
        createdAt: startTime + 55 * 60,
      },
    ];

    const fileEvents: FileEvent[] = [
      {
        id: 1,
        timestamp: startTime + 20 * 60,
        eventType: 'modified',
        filePath: '~/projects/traq/frontend/src/App.tsx',
        fileName: 'App.tsx',
        directory: '~/projects/traq/frontend/src',
        fileExtension: '.tsx',
        fileSizeBytes: 2048,
        watchCategory: 'projects',
        oldPath: null,
        sessionId,
        createdAt: startTime + 20 * 60,
      },
    ];

    const browserVisits: BrowserVisit[] = [
      {
        id: 1,
        timestamp: startTime + 48 * 60,
        url: 'https://github.com/user/traq/pull/42',
        title: 'Add frontend foundation - Pull Request #42',
        domain: 'github.com',
        browser: 'firefox',
        visitDurationSeconds: 180,
        transitionType: 'link',
        sessionId,
        createdAt: startTime + 48 * 60,
      },
    ];

    const sessionData = generateSession(sessionId, startTime, endTime - startTime);
    const template = sessionTemplates[sessionId % sessionTemplates.length];

    // Create Session object (base type without summary fields)
    const session = {
      id: sessionData.id,
      startTime: sessionData.startTime,
      endTime: sessionData.endTime,
      durationSeconds: sessionData.durationSeconds,
      screenshotCount: sessionData.screenshotCount,
      summaryId: sessionData.summaryId,
      createdAt: sessionData.createdAt,
    };

    // Create Summary object
    const summary = {
      id: sessionId,
      sessionId,
      summary: template.summary,
      explanation: 'Analyzed window focus patterns and screenshot content to determine the primary activities during this session.',
      confidence: template.confidence,
      tags: template.tags,
      modelUsed: 'gemma3n-e2b-q4',
      inferenceTimeMs: 2500 + Math.random() * 1000,
      screenshotIds: Array.from({ length: 5 }, (_, i) => sessionId * 100 + i),
      contextJson: null,
      createdAt: endTime + 60,
    };

    return {
      session,
      summary,
      screenshots: generateScreenshots(sessionId, 10, startTime),
      focusEvents,
      shellCommands,
      gitCommits,
      fileEvents,
      browserVisits,
    };
  },

  generateReport: (timeRange: string, reportType: string): Report => ({
    id: 1,
    title: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`,
    timeRange,
    reportType: reportType as 'summary' | 'detailed' | 'standup',
    format: 'markdown',
    content: `# Activity Report\n\n## ${timeRange}\n\nThis is a mock report for ${timeRange}.\n\n### Summary\n\n- Total active time: 4h 45m\n- Sessions: 8\n- Top activity: Development (VS Code)\n\n### Details\n\n...`,
    filepath: null,
    startTime: now - day,
    endTime: now,
    createdAt: now,
  }),

  getReportHistory: (): ReportMeta[] => [
    {
      id: 1,
      title: 'Daily Summary',
      timeRange: 'today',
      reportType: 'summary',
      format: 'markdown',
      createdAt: now - hour,
    },
    {
      id: 2,
      title: 'Weekly Report',
      timeRange: 'last week',
      reportType: 'detailed',
      format: 'html',
      createdAt: now - day,
    },
  ],

  parseTimeRange: (input: string): TimeRange => {
    const lowered = input.toLowerCase().trim();
    let start = now;
    let end = now;
    let label = input;

    if (lowered === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      start = Math.floor(d.getTime() / 1000);
      label = 'Today';
    } else if (lowered === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      d.setHours(0, 0, 0, 0);
      start = Math.floor(d.getTime() / 1000);
      end = start + day;
      label = 'Yesterday';
    } else if (lowered === 'last week' || lowered === 'past week') {
      start = now - 7 * day;
      label = 'Last 7 days';
    } else if (lowered === 'this week') {
      const d = new Date();
      const dayOfWeek = d.getDay();
      d.setDate(d.getDate() - dayOfWeek);
      d.setHours(0, 0, 0, 0);
      start = Math.floor(d.getTime() / 1000);
      label = 'This week';
    }

    return { start, end, label };
  },

  getConfig: (): Config => ({
    capture: {
      enabled: true,
      intervalSeconds: 30,
      quality: 80,
      duplicateThreshold: 3,
      monitorMode: 'active_window',
      monitorIndex: 0,
    },
    afk: {
      timeoutSeconds: 180,
      minSessionMinutes: 5,
    },
    inference: {
      engine: 'bundled',
      bundled: {
        model: 'gemma3n-e2b-q4',
      },
      ollama: {
        host: 'http://localhost:11434',
        model: 'gemma3:12b-it-qat',
      },
      cloud: {
        provider: 'anthropic',
        apiKey: '',
        model: 'claude-sonnet-4-20250514',
        endpoint: '',
      },
    },
    dataSources: {
      shell: {
        enabled: true,
        shellType: 'auto',
        historyPath: '',
        excludePatterns: ['^(ls|cd|pwd|clear)$'],
      },
      git: {
        enabled: true,
        searchPaths: ['~/projects', '~/code'],
        maxDepth: 3,
      },
      files: {
        enabled: true,
        watches: [
          { path: '~/Downloads', category: 'downloads', recursive: false },
          { path: '~/projects', category: 'projects', recursive: true },
        ],
        excludePatterns: [],
        allowedExtensions: [],
      },
      browser: {
        enabled: true,
        browsers: ['chrome', 'firefox'],
        excludedDomains: [],
        historyLimitDays: 7,
      },
    },
    ui: {
      theme: 'system',
      startMinimized: false,
      showNotifications: true,
    },
    system: {
      autoStart: true,
      startOnLogin: true,
    },
  }),

  getInferenceStatus: (): InferenceStatus => ({
    type: 'bundled',
    available: true,
    model: 'gemma3n-e2b-q4',
    error: null,
  }),

  getAvailableModels: (): ModelInfo[] => [
    {
      id: 'gemma3n-e2b-q4',
      name: 'Gemma 3n E2B (Recommended)',
      size: 1_500_000_000,
      description: 'Lightweight model, runs on CPU',
      downloaded: true,
      path: '~/.cache/traq/models/gemma3n-e2b-q4.gguf',
    },
    {
      id: 'gemma3n-e4b-q4',
      name: 'Gemma 3n E4B',
      size: 2_500_000_000,
      description: 'Better quality, still CPU-friendly',
      downloaded: false,
      path: null,
    },
  ],

  getScreenshot: (id: number): Screenshot => ({
    id,
    timestamp: now - (id * 30),
    filepath: `/screenshots/2024/01/15/screenshot_${id}.webp`,
    dhash: `hash_${id}`,
    windowTitle: 'VS Code - main.go',
    appName: 'VS Code',
    windowClass: null,
    processPid: 1234,
    windowX: 0,
    windowY: 0,
    windowWidth: 1920,
    windowHeight: 1080,
    monitorName: 'Primary',
    monitorWidth: 1920,
    monitorHeight: 1080,
    sessionId: Math.floor(id / 100),
    createdAt: now - (id * 30),
  }),

  getScreenshotImageUrl: (id: number): string => {
    // Return a placeholder gradient image
    return `https://via.placeholder.com/1920x1080/1a1a2e/16213e?text=Screenshot+${id}`;
  },

  getThumbnailUrl: (id: number): string => {
    return `https://via.placeholder.com/200x112/1a1a2e/16213e?text=${id}`;
  },
};
