export interface DailyStats {
  date: string;
  totalScreenshots: number;
  totalSessions: number;
  activeMinutes: number;
  topApps: AppUsage[];
  shellCommands: number;
  gitCommits: number;
  filesModified: number;
  sitesVisited: number;
}

export interface WeeklyStats {
  startDate: string;
  endDate: string;
  dailyStats: DailyStats[];
  totalActive: number;
  averages: DailyStats | null;
}

export interface MonthlyStats {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  dailyStats: DailyStats[];
  weeklyStats: WeekStats[];
  totalActive: number;
  averages: DailyStats | null;
}

export interface WeekStats {
  weekNumber: number;
  startDate: string;
  endDate: string;
  totalActive: number;
  activeDays: number;
}

export interface AppUsage {
  appName: string;
  durationSeconds: number;
  percentage: number;
  sessionCount: number;
}

export interface WindowUsage {
  windowTitle: string;
  appName: string;
  durationSeconds: number;
  percentage: number;
  focusCount: number;
}

export interface HourlyActivity {
  hour: number;
  screenshotCount: number;
  activeMinutes: number;
}

export interface CalendarData {
  year: number;
  month: number;
  days: CalendarDay[];
}

export interface CalendarDay {
  date: string;
  screenshotCount: number;
  sessionCount: number;
  activeMinutes: number;
  intensity: 0 | 1 | 2 | 3 | 4; // 0 = none, 4 = highest
}

export interface DataSourceStats {
  shell: ShellStats | null;
  git: GitStats | null;
  files: FileStats | null;
  browser: BrowserStats | null;
}

export interface ShellStats {
  totalCommands: number;
  topCommands: CommandCount[];
}

export interface CommandCount {
  command: string;
  count: number;
}

export interface GitStats {
  totalCommits: number;
  repositories: RepositoryStats[];
}

export interface RepositoryStats {
  name: string;
  commitCount: number;
  lastCommit: number;
}

export interface FileStats {
  totalEvents: number;
  byCategory: CategoryCount[];
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface BrowserStats {
  totalVisits: number;
  topDomains: DomainCount[];
}

export interface DomainCount {
  domain: string;
  visits: number;
}

export interface YearlyStats {
  year: number;
  startDate: string;
  endDate: string;
  monthlyStats: MonthStats[];
  totalActive: number;
  activeMonths: number;
  averages: MonthStats | null;
}

export interface MonthStats {
  monthNumber: number;
  monthName: string;
  startDate: string;
  endDate: string;
  totalActive: number;
  activeDays: number;
  sessions: number;
  screenshots: number;
}
