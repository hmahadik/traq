export interface Screenshot {
  id: number;
  timestamp: number;
  filepath: string;
  dhash: string;
  windowTitle: string | null;
  appName: string | null;
  windowClass: string | null;
  windowX: number | null;
  windowY: number | null;
  windowWidth: number | null;
  windowHeight: number | null;
  monitorName: string | null;
  monitorWidth: number | null;
  monitorHeight: number | null;
  sessionId: number | null;
  createdAt: number;
}

export interface ScreenshotPage {
  screenshots: Screenshot[];
  total: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}
