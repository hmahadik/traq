export interface Config {
  capture: CaptureConfig;
  afk: AFKConfig;
  inference: InferenceConfig;
  dataSources: DataSourcesConfig;
  ui: UIConfig;
  system: SystemConfig;
}

export interface CaptureConfig {
  enabled: boolean;
  intervalSeconds: number;
  quality: number;
  duplicateThreshold: number;
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
}

export interface FileWatch {
  path: string;
  category: string;
  recursive: boolean;
}

export interface BrowserConfig {
  enabled: boolean;
  browsers: string[];
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
  path: string | null;
}
