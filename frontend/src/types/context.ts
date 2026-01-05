import type { Screenshot } from './screenshot';
import type { Session, WindowFocusEvent } from './session';
import type { Summary } from './summary';

export interface SessionContext {
  session: Session;
  summary: Summary | null;
  screenshots: Screenshot[];
  focusEvents: WindowFocusEvent[];
  shellCommands: ShellCommand[];
  gitCommits: GitCommit[];
  fileEvents: FileEvent[];
  browserVisits: BrowserVisit[];
}

export interface ShellCommand {
  id: number;
  timestamp: number;
  command: string;
  shellType: string;
  workingDirectory: string | null;
  exitCode: number | null;
  durationSeconds: number | null;
  hostname: string | null;
  sessionId: number | null;
  createdAt: number;
}

export interface GitCommit {
  id: number;
  timestamp: number;
  commitHash: string;
  shortHash: string;
  repositoryId: number;
  repositoryName: string;
  branch: string | null;
  message: string;
  messageSubject: string;
  filesChanged: number | null;
  insertions: number | null;
  deletions: number | null;
  authorName: string | null;
  authorEmail: string | null;
  isMerge: boolean;
  sessionId: number | null;
  createdAt: number;
}

export interface FileEvent {
  id: number;
  timestamp: number;
  eventType: 'created' | 'modified' | 'deleted' | 'renamed';
  filePath: string;
  fileName: string;
  directory: string;
  fileExtension: string | null;
  fileSizeBytes: number | null;
  watchCategory: string;
  oldPath: string | null;
  sessionId: number | null;
  createdAt: number;
}

export interface BrowserVisit {
  id: number;
  timestamp: number;
  url: string;
  title: string | null;
  domain: string;
  browser: string;
  visitDurationSeconds: number | null;
  transitionType: string | null;
  sessionId: number | null;
  createdAt: number;
}
