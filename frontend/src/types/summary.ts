export interface Summary {
  id: number;
  sessionId: number;
  summary: string;
  explanation: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  tags: string[];
  projects: ProjectBreakdown[];
  modelUsed: string;
  inferenceTimeMs: number | null;
  screenshotIds: number[];
  contextJson: string | null;
  createdAt: number;
}

export interface ProjectBreakdown {
  name: string;
  timeMinutes: number;
  activities: string[];
  confidence: string;
}
