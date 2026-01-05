import type { Summary } from './summary';

export interface Session {
  id: number;
  startTime: number;
  endTime: number | null;
  durationSeconds: number | null;
  screenshotCount: number;
  summaryId: number | null;
  createdAt: number;
}

export interface SessionSummary extends Session {
  summary: Summary | null;
}

export interface WindowFocusEvent {
  id: number;
  windowTitle: string;
  appName: string;
  windowClass: string | null;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  sessionId: number | null;
  createdAt: number;
}
