export interface Report {
  id: number;
  title: string;
  timeRange: string;
  reportType: 'summary' | 'detailed' | 'standup';
  format: 'markdown' | 'html' | 'pdf' | 'json';
  content: string | null;
  filepath: string | null;
  startTime: number | null;
  endTime: number | null;
  createdAt: number;
}

export interface ReportMeta {
  id: number;
  title: string;
  timeRange: string;
  reportType: string;
  format: string;
  createdAt: number;
}

export interface TimeRange {
  start: number;
  end: number;
  label: string;
}

export interface DailySummary {
  id: number;
  date: string; // YYYY-MM-DD
  summary: string; // Preview text
  totalTime: number; // Total active time in seconds
  sessionsCount: number;
  createdAt: number;
}
