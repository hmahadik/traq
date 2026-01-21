export interface Config {
  capture: CaptureConfig;
  afk: AFKConfig;
  inference: InferenceConfig;
  dataSources: DataSourcesConfig;
  ui: UIConfig;
  system: SystemConfig;
  issues?: IssuesConfig;
  timeline?: TimelineConfig;
  ai?: AIConfig;
}

export interface AIConfig {
  summaryMode: 'auto_accept' | 'drafts' | 'off';
  summaryChunkMinutes: number;
  assignmentMode: 'auto_accept' | 'drafts' | 'off';
}

export interface TimelineConfig {
  minActivityDurationSeconds: number; // Filter activities shorter than this (0 = show all)
  titleDisplay: 'full' | 'app_only' | 'minimal';
  appGrouping: boolean;
  continuityMergeSeconds: number;
  visibleColumns: string[]; // Column IDs to show in timeline
}

export interface IssuesConfig {
  webhookEnabled: boolean;
  webhookUrl: string;
}

export interface CaptureConfig {
  enabled: boolean;
  intervalSeconds: number;
  quality: number;
  duplicateThreshold: number;
  monitorMode: 'active_window' | 'primary' | 'specific';
  monitorIndex: number;
}

export interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isPrimary: boolean;
}

export interface AFKConfig {
  timeoutSeconds: number;
  minSessionMinutes: number;
}

export interface InferenceConfig {
  engine: 'bundled' | 'ollama' | 'cloud';
  bundled: BundledInferenceConfig;
  ollama: OllamaConfig;
  cloud: CloudConfig;
}

export interface BundledInferenceConfig {
  model: string;
}

export interface OllamaConfig {
  host: string;
  model: string;
}

export interface CloudConfig {
  provider: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  endpoint: string; // Custom API endpoint (optional)
}

export interface DataSourcesConfig {
  shell: ShellConfig;
  git: GitConfig;
  files: FilesConfig;
  browser: BrowserConfig;
}

export interface ShellConfig {
  enabled: boolean;
  shellType: string; // "auto", "bash", "zsh", "fish", "powershell"
  historyPath: string; // Custom path to history file (empty = auto-detect)
  excludePatterns: string[];
}

export interface GitConfig {
  enabled: boolean;
  searchPaths: string[];
  maxDepth: number;
}

export interface FilesConfig {
  enabled: boolean;
  watches: FileWatch[];
  excludePatterns: string[]; // Directory patterns to exclude (e.g., node_modules, .git)
  allowedExtensions: string[]; // File extensions to track (empty = all, e.g., [".ts", ".go", ".py"])
}

export interface FileWatch {
  path: string;
  category: string;
  recursive: boolean;
}

export interface BrowserConfig {
  enabled: boolean;
  browsers: string[];
  excludedDomains: string[];
  historyLimitDays: number; // Limit how far back to read browser history (0 = unlimited)
}

export interface UIConfig {
  theme: 'dark' | 'light' | 'system';
  startMinimized: boolean;
  showNotifications: boolean;
}

export interface SystemConfig {
  autoStart: boolean;
  startOnLogin: boolean;
}

export interface InferenceStatus {
  type: 'bundled' | 'ollama' | 'cloud';
  available: boolean;
  model: string;
  error: string | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  size: number;
  description: string;
  downloaded: boolean;
  downloadUrl: string;
  filename: string;
}

export interface ServerStatus {
  installed: boolean;
  serverPath: string;
  version: string;
  downloadUrl?: string;
  size?: number;
}
