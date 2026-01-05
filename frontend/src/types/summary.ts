export interface Summary {
  id: number;
  sessionId: number;
  summary: string;
  explanation: string | null;
  confidence: 'high' | 'medium' | 'low' | null;
  tags: string[];
  modelUsed: string;
  inferenceTimeMs: number | null;
  screenshotIds: number[];
  contextJson: string | null;
  createdAt: number;
}
