# Traq v2 — Implementation Plan

## Executive Summary

Complete rewrite of Traq as a cross-platform desktop application with bundled AI inference.

**From:** Python + Flask + Jinja + Vanilla JS (Linux only, requires external Ollama)
**To:** Go + Wails + React + TypeScript + bundled llama.cpp (Windows/macOS/Linux, AI works out of box)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Wails Application                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 React Frontend (WebView)                  │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │  │
│  │  │Timeline │ │Analytics│ │ Reports │ │Settings │         │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │  │
│  │  Tailwind CSS + shadcn/ui + TanStack Query + Recharts    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↕ Wails Bindings                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                     Go Backend                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                   Service Layer                      │ │  │
│  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────────┐ │ │  │
│  │  │  │Sessions│ │Analytics│ │Reports │ │  Inference    │ │ │  │
│  │  │  └────────┘ └────────┘ └────────┘ └────────────────┘ │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │                  Tracker Layer                       │ │  │
│  │  │  ┌──────┐ ┌──────┐ ┌────┐ ┌────┐ ┌───┐ ┌────┐ ┌───┐ │ │  │
│  │  │  │Screen│ │Window│ │AFK │ │File│ │Git│ │Shell│ │Web│ │ │  │
│  │  │  └──────┘ └──────┘ └────┘ └────┘ └───┘ └────┘ └───┘ │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │              Storage Layer (SQLite)                  │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Platform Abstraction Layer                   │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐                     │  │
│  │  │ Linux   │ │ Windows │ │  macOS  │                     │  │
│  │  └─────────┘ └─────────┘ └─────────┘                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Inference Engine                             │
│  ┌─────────────────────┐  OR  ┌─────────────────────────────┐  │
│  │ Bundled llama.cpp   │      │ External Ollama / Cloud API │  │
│  │ + gemma3n model     │      │ (user configured)           │  │
│  └─────────────────────┘      └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | Go 1.22+ | Single binary, cross-compiles, excellent system integration |
| Desktop Framework | Wails v2 | Native webview, small bundles, Go backend |
| Database | SQLite + modernc.org/sqlite | Pure Go, no CGO required for basic builds |
| Screen Capture | kbinani/screenshot | Cross-platform, pure Go |
| Image Processing | disintegration/imaging | Resize, WebP encoding |
| Perceptual Hash | corona10/goimagehash | dhash implementation |
| File Watching | fsnotify/fsnotify | Cross-platform inotify/FSEvents/ReadDirectoryChanges |
| AI Inference | llama.cpp (sidecar) | Bundled server binary, OpenAI-compatible API |

### Frontend
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Framework | React 18 + TypeScript | Industry standard, great DX |
| Styling | Tailwind CSS | Utility-first, no custom CSS maintenance |
| Components | shadcn/ui | Beautiful defaults, fully customizable, accessible |
| State/Data | TanStack Query | Caching, background refetch, optimistic updates |
| Charts | Recharts | React-native, composable |
| Routing | React Router v6 | Standard |
| Forms | React Hook Form + Zod | Validation, good shadcn/ui integration |

### Build & Distribution
| Component | Technology | Rationale |
|-----------|------------|-----------|
| Build | Wails CLI | Handles Go + frontend build |
| Packaging | Wails + platform tools | .app, .exe, AppImage/deb |
| Model Delivery | On-demand download | Don't bloat initial installer |

---

## Project Structure

```
traq/
├── main.go                     # Wails entry point
├── app.go                      # Application lifecycle, bindings
├── wails.json                  # Wails configuration
│
├── internal/
│   ├── platform/               # Platform abstraction
│   │   ├── platform.go         # Interface definitions
│   │   ├── linux.go            # Linux implementations
│   │   ├── windows.go          # Windows implementations
│   │   ├── darwin.go           # macOS implementations
│   │   └── common.go           # Shared utilities
│   │
│   ├── tracker/                # Data collection
│   │   ├── screenshot.go       # Screen capture + dhash
│   │   ├── window.go           # Active window tracking
│   │   ├── afk.go              # AFK detection
│   │   ├── session.go          # Session management
│   │   ├── shell.go            # Shell history tracking
│   │   ├── git.go              # Git activity tracking
│   │   ├── files.go            # File modification tracking
│   │   ├── browser.go          # Browser history tracking
│   │   └── daemon.go           # Main tracking loop
│   │
│   ├── storage/                # Data persistence
│   │   ├── sqlite.go           # SQLite connection management
│   │   ├── migrations.go       # Schema migrations
│   │   ├── screenshots.go      # Screenshot CRUD
│   │   ├── sessions.go         # Session CRUD
│   │   ├── summaries.go        # Summary CRUD
│   │   ├── shell.go            # Shell command CRUD
│   │   ├── git.go              # Git activity CRUD
│   │   ├── files.go            # File event CRUD
│   │   ├── browser.go          # Browser history CRUD
│   │   └── config.go           # Config persistence
│   │
│   ├── inference/              # AI summarization
│   │   ├── engine.go           # Inference engine interface
│   │   ├── bundled.go          # llama.cpp sidecar management
│   │   ├── ollama.go           # External Ollama client
│   │   ├── cloud.go            # Cloud API client (Anthropic/OpenAI)
│   │   ├── models.go           # Model download/management
│   │   └── summarizer.go       # Summary generation logic
│   │
│   ├── service/                # Business logic
│   │   ├── analytics.go        # Analytics calculations
│   │   ├── reports.go          # Report generation
│   │   ├── export.go           # Export to MD/HTML/PDF
│   │   └── timeline.go         # Timeline data assembly
│   │
│   └── config/                 # Configuration
│       ├── config.go           # Config struct and defaults
│       └── paths.go            # Platform-specific paths
│
├── frontend/                   # React application
│   ├── src/
│   │   ├── main.tsx            # Entry point
│   │   ├── App.tsx             # Root component + router
│   │   │
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── SettingsDrawer.tsx
│   │   │   ├── common/
│   │   │   │   ├── Screenshot.tsx
│   │   │   │   ├── ImageGallery.tsx
│   │   │   │   ├── AppBadge.tsx
│   │   │   │   ├── TagBadge.tsx
│   │   │   │   ├── DurationDisplay.tsx
│   │   │   │   └── LoadingStates.tsx
│   │   │   ├── timeline/
│   │   │   │   ├── Calendar.tsx
│   │   │   │   ├── HorizontalTimeline.tsx
│   │   │   │   ├── SessionCard.tsx
│   │   │   │   ├── Filmstrip.tsx
│   │   │   │   └── SummaryTable.tsx
│   │   │   ├── analytics/
│   │   │   │   ├── StatsGrid.tsx
│   │   │   │   ├── ActivityChart.tsx
│   │   │   │   ├── AppUsageChart.tsx
│   │   │   │   ├── DataSourcesPanel.tsx
│   │   │   │   └── HeatmapChart.tsx
│   │   │   └── reports/
│   │   │       ├── ReportGenerator.tsx
│   │   │       ├── ReportPreview.tsx
│   │   │       └── ExportHistory.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── TimelinePage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── DayPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useWailsBinding.ts
│   │   │   ├── useKeyboardNav.ts
│   │   │   ├── useLocalStorage.ts
│   │   │   └── useMediaQuery.ts
│   │   │
│   │   ├── api/
│   │   │   ├── client.ts        # Wails binding wrappers
│   │   │   ├── screenshots.ts
│   │   │   ├── sessions.ts
│   │   │   ├── summaries.ts
│   │   │   ├── analytics.ts
│   │   │   └── config.ts
│   │   │
│   │   ├── types/
│   │   │   ├── screenshot.ts
│   │   │   ├── session.ts
│   │   │   ├── summary.ts
│   │   │   ├── analytics.ts
│   │   │   ├── config.ts
│   │   │   └── index.ts
│   │   │
│   │   └── lib/
│   │       ├── utils.ts         # cn(), formatters
│   │       ├── constants.ts
│   │       └── timeParser.ts
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── build/                      # Build assets
│   ├── appicon.png
│   ├── windows/
│   ├── darwin/
│   └── linux/
│
├── scripts/
│   ├── download-model.go       # Model downloader
│   └── build-all.sh            # Cross-platform build script
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   └── PLATFORM_SPECIFICS.md
│
├── go.mod
├── go.sum
└── README.md
```

---

## Database Schema

Unified schema supporting all data sources. SQLite file location:
- Linux: `~/.local/share/traq/data.db`
- macOS: `~/Library/Application Support/Traq/data.db`  
- Windows: `%APPDATA%\Traq\data.db`

```sql
-- ============================================================================
-- Core Tables
-- ============================================================================

CREATE TABLE screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    filepath TEXT NOT NULL,
    dhash TEXT NOT NULL,
    window_title TEXT,
    app_name TEXT,
    window_x INTEGER,
    window_y INTEGER,
    window_width INTEGER,
    window_height INTEGER,
    monitor_name TEXT,
    monitor_width INTEGER,
    monitor_height INTEGER,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_screenshots_timestamp ON screenshots(timestamp);
CREATE INDEX idx_screenshots_session ON screenshots(session_id);
CREATE INDEX idx_screenshots_dhash ON screenshots(dhash);

CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration_seconds INTEGER,
    screenshot_count INTEGER DEFAULT 0,
    summary_id INTEGER REFERENCES summaries(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_sessions_start ON sessions(start_time);
CREATE INDEX idx_sessions_end ON sessions(end_time);

CREATE TABLE summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id),
    summary TEXT NOT NULL,
    explanation TEXT,
    confidence TEXT,
    tags TEXT,                              -- JSON array
    model_used TEXT NOT NULL,
    inference_time_ms INTEGER,
    screenshot_ids TEXT,                    -- JSON array
    context_json TEXT,                      -- Full context sent to model
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_summaries_session ON summaries(session_id);

CREATE TABLE window_focus_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_title TEXT NOT NULL,
    app_name TEXT NOT NULL,
    window_class TEXT,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    duration_seconds REAL NOT NULL,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_focus_session ON window_focus_events(session_id);
CREATE INDEX idx_focus_start ON window_focus_events(start_time);

-- ============================================================================
-- Extended Data Sources
-- ============================================================================

CREATE TABLE shell_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    command TEXT NOT NULL,
    shell_type TEXT NOT NULL,               -- 'bash', 'zsh', 'fish', 'powershell'
    working_directory TEXT,
    exit_code INTEGER,
    duration_seconds REAL,
    hostname TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_shell_timestamp ON shell_commands(timestamp);
CREATE INDEX idx_shell_session ON shell_commands(session_id);

CREATE TABLE git_repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    remote_url TEXT,
    last_scanned INTEGER,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE git_commits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    commit_hash TEXT NOT NULL,
    short_hash TEXT NOT NULL,
    repository_id INTEGER REFERENCES git_repositories(id),
    branch TEXT,
    message TEXT NOT NULL,
    message_subject TEXT NOT NULL,
    files_changed INTEGER,
    insertions INTEGER,
    deletions INTEGER,
    author_name TEXT,
    author_email TEXT,
    is_merge INTEGER DEFAULT 0,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(commit_hash, repository_id)
);

CREATE INDEX idx_git_timestamp ON git_commits(timestamp);
CREATE INDEX idx_git_session ON git_commits(session_id);
CREATE INDEX idx_git_repo ON git_commits(repository_id);

CREATE TABLE file_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,               -- 'created', 'modified', 'deleted', 'renamed'
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    directory TEXT NOT NULL,
    file_extension TEXT,
    file_size_bytes INTEGER,
    watch_category TEXT NOT NULL,           -- 'downloads', 'projects', 'documents'
    old_path TEXT,                          -- For renamed events
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_files_timestamp ON file_events(timestamp);
CREATE INDEX idx_files_session ON file_events(session_id);
CREATE INDEX idx_files_category ON file_events(watch_category);

CREATE TABLE browser_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    domain TEXT NOT NULL,
    browser TEXT NOT NULL,                  -- 'chrome', 'firefox', 'safari', 'edge'
    visit_duration_seconds INTEGER,
    transition_type TEXT,
    session_id INTEGER REFERENCES sessions(id),
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_browser_timestamp ON browser_history(timestamp);
CREATE INDEX idx_browser_session ON browser_history(session_id);
CREATE INDEX idx_browser_domain ON browser_history(domain);

-- ============================================================================
-- Reports & Cache
-- ============================================================================

CREATE TABLE reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    time_range TEXT NOT NULL,
    report_type TEXT NOT NULL,              -- 'summary', 'detailed', 'standup'
    format TEXT NOT NULL,                   -- 'markdown', 'html', 'pdf', 'json'
    content TEXT,
    filepath TEXT,
    start_time INTEGER,
    end_time INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- Configuration
-- ============================================================================

CREATE TABLE config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- ============================================================================
-- Schema Version
-- ============================================================================

CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at INTEGER DEFAULT (strftime('%s', 'now'))
);

INSERT INTO schema_version (version) VALUES (1);
```

---

## Implementation Phases

Each phase is designed to be independently implementable and testable. Phases can run in parallel where dependencies allow.

```
Phase 0 ─────────────────────────────────────────────────────────────────────
    │
    ▼
Phase 1 ──┬── Phase 2 ──┬── Phase 3
          │             │
          ▼             ▼
       Phase 4 ◄────► Phase 5
          │             │
          └──────┬──────┘
                 ▼
              Phase 6
                 │
                 ▼
              Phase 7
                 │
                 ▼
              Phase 8
```

---

## Phase 0: Project Scaffolding

**Goal:** Initialize project structure, tooling, and verify cross-platform builds.

**Estimated effort:** 1 session

### Tasks

- [ ] **0.1** Initialize Go module
  ```bash
  mkdir traq && cd traq
  go mod init github.com/yourusername/traq
  ```

- [ ] **0.2** Initialize Wails project
  ```bash
  wails init -n traq -t react-ts
  ```

- [ ] **0.3** Configure frontend tooling
  - Install Tailwind CSS
  - Initialize shadcn/ui (`npx shadcn@latest init`)
  - Install dependencies: TanStack Query, React Router, Recharts, React Hook Form, Zod
  - Configure path aliases in tsconfig.json

- [ ] **0.4** Set up project structure per specification above

- [ ] **0.5** Configure Wails for development
  - Set up hot reload
  - Configure asset embedding for production

- [ ] **0.6** Verify cross-platform build
  ```bash
  wails build -platform linux/amd64
  wails build -platform windows/amd64
  wails build -platform darwin/amd64
  wails build -platform darwin/arm64
  ```

- [ ] **0.7** Set up CI/CD scaffold (GitHub Actions)

### Verification

```
□ `wails dev` starts application with React frontend
□ Hot reload works for both Go and React changes
□ `wails build` produces working binary on current platform
□ Cross-compilation produces binaries (may not be testable without VMs)
□ shadcn/ui button component renders correctly
```

---

## Phase 1: Platform Abstraction & Core Storage

**Goal:** Implement platform-specific abstractions and SQLite storage layer.

**Estimated effort:** 2 sessions

**Dependencies:** Phase 0

### Tasks

#### Platform Abstraction

- [ ] **1.1** Define platform interface (`internal/platform/platform.go`)
  ```go
  type Platform interface {
      // Paths
      DataDir() string           // Where to store data.db, screenshots
      ConfigDir() string         // Where to store config.yaml
      CacheDir() string          // Where to store model files
      
      // Window Information
      GetActiveWindow() (*WindowInfo, error)
      
      // Input Monitoring
      GetLastInputTime() (time.Time, error)
      
      // Shell
      GetShellHistoryPath() string
      GetShellType() string
      
      // Browser
      GetBrowserHistoryPaths() map[string]string  // browser -> path
      
      // System
      OpenURL(url string) error
      ShowNotification(title, body string) error
  }
  
  type WindowInfo struct {
      Title       string
      AppName     string
      Class       string
      PID         int
      X, Y        int
      Width       int
      Height      int
  }
  ```

- [ ] **1.2** Implement Linux platform (`internal/platform/linux.go`)
  - Use xdotool/xprop for window info (exec commands)
  - Read /proc for input times or use X11 screensaver extension
  - Paths: XDG spec (~/.local/share, ~/.config, ~/.cache)

- [ ] **1.3** Implement Windows platform (`internal/platform/windows.go`)
  - Use Win32 API (GetForegroundWindow, GetWindowText)
  - GetLastInputInfo for input times
  - Paths: %APPDATA%, %LOCALAPPDATA%

- [ ] **1.4** Implement macOS platform (`internal/platform/darwin.go`)
  - Use Accessibility API (requires permission)
  - Paths: ~/Library/Application Support, ~/Library/Caches

- [ ] **1.5** Create platform detector and factory

#### Storage Layer

- [ ] **1.6** Implement SQLite connection manager (`internal/storage/sqlite.go`)
  ```go
  type Store struct {
      db *sql.DB
  }
  
  func NewStore(dbPath string) (*Store, error)
  func (s *Store) Close() error
  func (s *Store) Migrate() error
  ```

- [ ] **1.7** Implement migrations (`internal/storage/migrations.go`)
  - Embed schema as string
  - Track applied migrations in schema_version table

- [ ] **1.8** Implement config storage (`internal/storage/config.go`)
  ```go
  func (s *Store) GetConfig(key string) (string, error)
  func (s *Store) SetConfig(key, value string) error
  func (s *Store) GetAllConfig() (map[string]string, error)
  ```

- [ ] **1.9** Implement screenshot storage (`internal/storage/screenshots.go`)
  ```go
  func (s *Store) SaveScreenshot(sc *Screenshot) (int64, error)
  func (s *Store) GetScreenshots(start, end int64) ([]*Screenshot, error)
  func (s *Store) GetScreenshotsBySession(sessionID int64) ([]*Screenshot, error)
  func (s *Store) GetScreenshotByID(id int64) (*Screenshot, error)
  ```

- [ ] **1.10** Implement session storage (`internal/storage/sessions.go`)
  ```go
  func (s *Store) CreateSession(startTime int64) (int64, error)
  func (s *Store) EndSession(id int64, endTime int64) error
  func (s *Store) GetSession(id int64) (*Session, error)
  func (s *Store) GetSessionsByDateRange(start, end int64) ([]*Session, error)
  func (s *Store) GetCurrentSession() (*Session, error)
  ```

### Verification

```
□ Platform detection returns correct platform on each OS
□ GetActiveWindow returns current window title and app name (test manually)
□ DataDir/ConfigDir return appropriate paths per OS
□ Database file created in correct location
□ Migrations apply cleanly on fresh database
□ Config get/set roundtrips correctly
□ Screenshot save/retrieve works
□ Session create/end/query works
□ Unit tests pass for storage layer
```

### Test Cases

```go
// internal/storage/sqlite_test.go

func TestMigrations(t *testing.T) {
    // Fresh database applies all migrations
    // Re-running migrations is idempotent
}

func TestScreenshotCRUD(t *testing.T) {
    // Save screenshot returns ID
    // Get by ID returns same data
    // Get by time range filters correctly
    // Get by session ID filters correctly
}

func TestSessionCRUD(t *testing.T) {
    // Create session returns ID
    // End session updates end_time and duration
    // GetCurrentSession returns open session
    // GetCurrentSession returns nil when no open session
}
```

---

## Phase 2: Core Trackers

**Goal:** Implement screenshot capture, window tracking, AFK detection, and session management.

**Estimated effort:** 2-3 sessions

**Dependencies:** Phase 1

### Tasks

#### Screenshot Capture

- [ ] **2.1** Implement screen capture (`internal/tracker/screenshot.go`)
  ```go
  type ScreenCapture struct {
      outputDir string
      quality   int
  }
  
  func NewScreenCapture(outputDir string, quality int) *ScreenCapture
  func (c *ScreenCapture) Capture() (*CaptureResult, error)
  func (c *ScreenCapture) ComputeDHash(img image.Image) (string, error)
  func (c *ScreenCapture) AreSimilar(hash1, hash2 string, threshold int) bool
  
  type CaptureResult struct {
      Filepath    string
      Thumbnail   string
      DHash       string
      Width       int
      Height      int
      MonitorName string
  }
  ```

- [ ] **2.2** Implement multi-monitor support
  - Detect active monitor (where mouse cursor is, or where active window is)
  - Capture only that monitor
  - Store monitor metadata

- [ ] **2.3** Implement WebP encoding with configurable quality

- [ ] **2.4** Implement thumbnail generation (200px width)

- [ ] **2.5** Implement dhash comparison with configurable threshold

#### Window Tracking

- [ ] **2.6** Implement window tracker (`internal/tracker/window.go`)
  ```go
  type WindowTracker struct {
      platform    platform.Platform
      store       *storage.Store
      currentFocus *WindowFocus
  }
  
  func NewWindowTracker(p platform.Platform, s *storage.Store) *WindowTracker
  func (t *WindowTracker) Poll() (*WindowInfo, error)
  func (t *WindowTracker) RecordFocusChange(newWindow *WindowInfo) error
  
  type WindowFocus struct {
      WindowInfo
      StartTime time.Time
  }
  ```

- [ ] **2.7** Implement focus duration tracking
  - Record start time on focus change
  - Save duration to database when focus changes away

#### AFK Detection

- [ ] **2.8** Implement AFK detector (`internal/tracker/afk.go`)
  ```go
  type AFKDetector struct {
      platform    platform.Platform
      timeout     time.Duration
      isAFK       bool
      lastActive  time.Time
      onAFK       func()
      onReturn    func()
  }
  
  func NewAFKDetector(p platform.Platform, timeout time.Duration) *AFKDetector
  func (d *AFKDetector) SetCallbacks(onAFK, onReturn func())
  func (d *AFKDetector) Poll() bool  // Returns true if state changed
  func (d *AFKDetector) IsAFK() bool
  ```

- [ ] **2.9** Implement platform-specific input time detection
  - Linux: Read from X11 screensaver info or /proc
  - Windows: GetLastInputInfo
  - macOS: CGEventSourceSecondsSinceLastEventType

#### Session Management

- [ ] **2.10** Implement session manager (`internal/tracker/session.go`)
  ```go
  type SessionManager struct {
      store          *storage.Store
      currentSession *Session
      afkDetector    *AFKDetector
  }
  
  func NewSessionManager(s *storage.Store, afk *AFKDetector) *SessionManager
  func (m *SessionManager) StartSession() (*Session, error)
  func (m *SessionManager) EndSession() error
  func (m *SessionManager) GetCurrentSession() *Session
  func (m *SessionManager) HandleAFK()
  func (m *SessionManager) HandleReturn()
  ```

- [ ] **2.11** Implement session resume logic
  - On startup, check if last session ended recently (within AFK timeout)
  - If so, resume that session instead of creating new one

#### Daemon

- [ ] **2.12** Implement main tracking daemon (`internal/tracker/daemon.go`)
  ```go
  type Daemon struct {
      store        *storage.Store
      platform     platform.Platform
      capture      *ScreenCapture
      window       *WindowTracker
      afk          *AFKDetector
      session      *SessionManager
      interval     time.Duration
      running      bool
      stopCh       chan struct{}
  }
  
  func NewDaemon(config *Config) (*Daemon, error)
  func (d *Daemon) Start() error
  func (d *Daemon) Stop() error
  func (d *Daemon) IsRunning() bool
  ```

- [ ] **2.13** Implement main loop
  ```go
  func (d *Daemon) run() {
      ticker := time.NewTicker(d.interval)
      for {
          select {
          case <-ticker.C:
              d.tick()
          case <-d.stopCh:
              return
          }
      }
  }
  
  func (d *Daemon) tick() {
      // Check AFK status
      if d.afk.Poll() {
          if d.afk.IsAFK() {
              d.session.HandleAFK()
              return
          } else {
              d.session.HandleReturn()
          }
      }
      
      if d.afk.IsAFK() {
          return
      }
      
      // Capture screenshot
      result, err := d.capture.Capture()
      // Check for duplicate
      // Save to database
      // Update window tracking
  }
  ```

### Verification

```
□ Screenshot captures current screen as WebP file
□ Thumbnail generated alongside full screenshot
□ dhash computed and stored
□ Similar screenshots detected (test with static screen)
□ Window title and app name captured correctly on each platform
□ Focus changes recorded with duration
□ AFK detected after configured timeout
□ AFK return detected on input
□ Session created on first activity
□ Session ended on AFK
□ Session resumed on quick return
□ Daemon starts and stops cleanly
□ Daemon respects capture interval
□ No screenshots captured during AFK
```

### Test Cases

```go
func TestDHashSimilarity(t *testing.T) {
    // Identical images have distance 0
    // Similar images have low distance
    // Different images have high distance
}

func TestAFKDetection(t *testing.T) {
    // Not AFK when input recent
    // AFK after timeout with no input
    // Callbacks fired on state change
}

func TestSessionLifecycle(t *testing.T) {
    // Session created on first capture
    // Session ended when AFK
    // Session resumed if return within timeout
    // New session if return after timeout
}
```

---

## Phase 3: Extended Data Sources

**Goal:** Implement shell history, git activity, file watching, and browser history trackers.

**Estimated effort:** 2-3 sessions

**Dependencies:** Phase 1

**Note:** This phase can run in parallel with Phase 2.

### Tasks

#### Shell History

- [ ] **3.1** Implement shell history tracker (`internal/tracker/shell.go`)
  ```go
  type ShellTracker struct {
      platform    platform.Platform
      store       *storage.Store
      lastOffset  int64
      checkpoint  string  // Path to checkpoint file
  }
  
  func NewShellTracker(p platform.Platform, s *storage.Store) *ShellTracker
  func (t *ShellTracker) Poll() ([]*ShellCommand, error)
  func (t *ShellTracker) parseHistory(path string, offset int64) ([]*ShellCommand, int64, error)
  ```

- [ ] **3.2** Implement history parsers
  - Bash: `#timestamp\ncommand` format
  - Zsh: `: timestamp:duration;command` format
  - Fish: YAML format
  - PowerShell: `Get-History` XML or `ConsoleHost_history.txt`

- [ ] **3.3** Implement checkpoint persistence
  - Store file offsets in JSON file
  - Load on startup to avoid re-reading entire history

- [ ] **3.4** Implement sensitive command filtering
  - Skip commands containing: password, secret, token, key=, api_key
  - Configurable additional patterns

- [ ] **3.5** Implement shell command storage (`internal/storage/shell.go`)

#### Git Activity

- [ ] **3.6** Implement git tracker (`internal/tracker/git.go`)
  ```go
  type GitTracker struct {
      store           *storage.Store
      searchPaths     []string
      knownRepos      map[string]*GitRepo
      lastScan        time.Time
      discoveryInt    time.Duration
  }
  
  func NewGitTracker(s *storage.Store, searchPaths []string) *GitTracker
  func (t *GitTracker) DiscoverRepositories() error
  func (t *GitTracker) Poll() ([]*GitCommit, error)
  func (t *GitTracker) scanRepo(repo *GitRepo) ([]*GitCommit, error)
  ```

- [ ] **3.7** Implement repository discovery
  - Walk search paths up to max depth
  - Find directories containing `.git`
  - Extract remote URL from git config

- [ ] **3.8** Implement commit scanning
  ```bash
  git log --since="<timestamp>" --format="%H|%h|%aI|%an|%ae|%s" --numstat
  ```

- [ ] **3.9** Implement git storage (`internal/storage/git.go`)

#### File Watching

- [ ] **3.10** Implement file watcher (`internal/tracker/files.go`)
  ```go
  type FileTracker struct {
      store      *storage.Store
      watcher    *fsnotify.Watcher
      watches    map[string]WatchConfig
      debouncer  *Debouncer
      eventCh    chan *FileEvent
  }
  
  type WatchConfig struct {
      Path      string
      Category  string
      Recursive bool
      MaxDepth  int
  }
  
  func NewFileTracker(s *storage.Store) (*FileTracker, error)
  func (t *FileTracker) AddWatch(config WatchConfig) error
  func (t *FileTracker) Start() error
  func (t *FileTracker) Stop() error
  func (t *FileTracker) Events() <-chan *FileEvent
  ```

- [ ] **3.11** Implement recursive directory watching
  - fsnotify doesn't do recursive automatically
  - Walk directory tree and add watches
  - Watch for new subdirectories

- [ ] **3.12** Implement debouncing
  - Group events for same file within 5-second window
  - Emit single event with final state

- [ ] **3.13** Implement file event storage (`internal/storage/files.go`)

#### Browser History

- [ ] **3.14** Implement browser history tracker (`internal/tracker/browser.go`)
  ```go
  type BrowserTracker struct {
      platform  platform.Platform
      store     *storage.Store
      lastPoll  map[string]int64  // browser -> last timestamp
  }
  
  func NewBrowserTracker(p platform.Platform, s *storage.Store) *BrowserTracker
  func (t *BrowserTracker) Poll() ([]*BrowserVisit, error)
  func (t *BrowserTracker) pollChrome(historyPath string, since int64) ([]*BrowserVisit, error)
  func (t *BrowserTracker) pollFirefox(placesPath string, since int64) ([]*BrowserVisit, error)
  ```

- [ ] **3.15** Implement safe database reading
  - Copy locked database to temp file
  - Open as read-only
  - Clean up temp file

- [ ] **3.16** Implement timestamp conversion
  - Chrome: microseconds since 1601-01-01
  - Firefox: microseconds since Unix epoch

- [ ] **3.17** Implement domain extraction and categorization

- [ ] **3.18** Implement browser history storage (`internal/storage/browser.go`)

### Verification

```
□ Shell history reads new commands since last poll
□ Shell history handles bash, zsh, fish (and PowerShell on Windows)
□ Sensitive commands filtered out
□ Checkpoint survives restart

□ Git repositories discovered in search paths
□ New commits detected since last scan
□ Commit metadata extracted correctly (hash, message, stats)
□ Branch tracked per commit

□ File watcher detects create/modify/delete/rename
□ Recursive watching works
□ Debouncing collapses rapid events
□ Download folder new files detected

□ Browser history reads from Chrome and Firefox
□ Locked database handled gracefully
□ Timestamps converted correctly
□ Domain extracted from URLs
```

---

## Phase 4: Backend Services & Wails Bindings

**Goal:** Implement business logic services and expose them to frontend via Wails.

**Estimated effort:** 2 sessions

**Dependencies:** Phases 2, 3

### Tasks

#### Analytics Service

- [ ] **4.1** Implement analytics service (`internal/service/analytics.go`)
  ```go
  type AnalyticsService struct {
      store *storage.Store
  }
  
  // Wails-bound methods (called from frontend)
  func (s *AnalyticsService) GetDailyStats(date string) (*DailyStats, error)
  func (s *AnalyticsService) GetWeeklyStats(startDate string) (*WeeklyStats, error)
  func (s *AnalyticsService) GetCalendarHeatmap(year, month int) (*CalendarData, error)
  func (s *AnalyticsService) GetAppUsage(start, end int64) ([]*AppUsage, error)
  func (s *AnalyticsService) GetHourlyActivity(date string) ([]*HourlyActivity, error)
  func (s *AnalyticsService) GetDataSourceStats(start, end int64) (*DataSourceStats, error)
  ```

- [ ] **4.2** Implement response types
  ```go
  type DailyStats struct {
      Date              string
      TotalScreenshots  int
      TotalSessions     int
      ActiveMinutes     int
      TopApps           []*AppUsage
      ShellCommands     int
      GitCommits        int
      FilesModified     int
      SitesVisited      int
  }
  
  type DataSourceStats struct {
      Shell   *ShellStats
      Git     *GitStats
      Files   *FileStats
      Browser *BrowserStats
  }
  ```

#### Timeline Service

- [ ] **4.3** Implement timeline service (`internal/service/timeline.go`)
  ```go
  type TimelineService struct {
      store *storage.Store
  }
  
  func (s *TimelineService) GetSessionsForDate(date string) ([]*SessionSummary, error)
  func (s *TimelineService) GetScreenshotsForSession(sessionID int64, page, perPage int) (*ScreenshotPage, error)
  func (s *TimelineService) GetScreenshotsForHour(date string, hour int) ([]*Screenshot, error)
  func (s *TimelineService) GetSessionContext(sessionID int64) (*SessionContext, error)
  ```

- [ ] **4.4** Implement session context assembly
  ```go
  type SessionContext struct {
      Session       *Session
      Screenshots   []*Screenshot
      FocusEvents   []*WindowFocusEvent
      ShellCommands []*ShellCommand
      GitCommits    []*GitCommit
      FileEvents    []*FileEvent
      BrowserVisits []*BrowserVisit
  }
  ```

#### Reports Service

- [ ] **4.5** Implement reports service (`internal/service/reports.go`)
  ```go
  type ReportsService struct {
      store     *storage.Store
      inference *inference.Engine
  }
  
  func (s *ReportsService) GenerateReport(timeRange, reportType string) (*Report, error)
  func (s *ReportsService) ExportReport(reportID int64, format string) (string, error)
  func (s *ReportsService) GetReportHistory() ([]*ReportMeta, error)
  func (s *ReportsService) ParseTimeRange(input string) (*TimeRange, error)
  ```

- [ ] **4.6** Implement natural language time parsing
  - "today", "yesterday"
  - "last week", "this week"
  - "past 3 days", "last 7 days"
  - "January", "December 2024"

- [ ] **4.7** Implement export formats (Markdown, HTML, PDF, JSON)

#### Config Service

- [ ] **4.8** Implement config service (`internal/service/config.go`)
  ```go
  type ConfigService struct {
      store    *storage.Store
      platform platform.Platform
      daemon   *tracker.Daemon
  }
  
  func (s *ConfigService) GetConfig() (*Config, error)
  func (s *ConfigService) UpdateConfig(updates map[string]interface{}) error
  func (s *ConfigService) RestartDaemon() error
  func (s *ConfigService) GetInferenceStatus() (*InferenceStatus, error)
  ```

#### Screenshot Service

- [ ] **4.9** Implement screenshot service (`internal/service/screenshots.go`)
  ```go
  type ScreenshotService struct {
      store    *storage.Store
      dataDir  string
  }
  
  func (s *ScreenshotService) GetScreenshot(id int64) (*Screenshot, error)
  func (s *ScreenshotService) GetScreenshotImage(id int64) ([]byte, error)
  func (s *ScreenshotService) GetThumbnail(id int64) ([]byte, error)
  func (s *ScreenshotService) DeleteScreenshot(id int64) error
  ```

#### Wails App Integration

- [ ] **4.10** Implement main app struct (`app.go`)
  ```go
  type App struct {
      ctx       context.Context
      platform  platform.Platform
      store     *storage.Store
      daemon    *tracker.Daemon
      inference *inference.Engine
      
      // Services (bound to Wails)
      Analytics   *service.AnalyticsService
      Timeline    *service.TimelineService
      Reports     *service.ReportsService
      Config      *service.ConfigService
      Screenshots *service.ScreenshotService
      Summaries   *service.SummaryService
  }
  
  func NewApp() *App
  func (a *App) startup(ctx context.Context)
  func (a *App) shutdown(ctx context.Context)
  func (a *App) beforeClose(ctx context.Context) bool
  ```

- [ ] **4.11** Wire up Wails bindings (`main.go`)
  ```go
  func main() {
      app := NewApp()
      
      err := wails.Run(&options.App{
          Title:  "Traq",
          Width:  1280,
          Height: 800,
          AssetServer: &assetserver.Options{
              Assets: frontend.Assets,
          },
          OnStartup:     app.startup,
          OnShutdown:    app.shutdown,
          OnBeforeClose: app.beforeClose,
          Bind: []interface{}{
              app.Analytics,
              app.Timeline,
              app.Reports,
              app.Config,
              app.Screenshots,
              app.Summaries,
          },
      })
  }
  ```

### Verification

```
□ Analytics.GetDailyStats returns correct counts
□ Timeline.GetSessionsForDate returns sessions with summaries
□ Timeline.GetSessionContext includes all data sources
□ Reports.ParseTimeRange handles various natural language inputs
□ Config.UpdateConfig persists and daemon picks up changes
□ Screenshots.GetThumbnail returns image bytes

□ Wails bindings accessible from frontend
□ Frontend can call Go methods and receive responses
□ Complex types serialize correctly to/from JSON
```

---

## Phase 5: AI Inference Engine

**Goal:** Implement bundled llama.cpp inference with fallback to external providers.

**Estimated effort:** 2 sessions

**Dependencies:** Phase 1

**Note:** Can run in parallel with Phases 2-4.

### Tasks

#### Engine Interface

- [ ] **5.1** Define inference interface (`internal/inference/engine.go`)
  ```go
  type Engine interface {
      IsAvailable() bool
      GetStatus() *EngineStatus
      Complete(ctx context.Context, req *CompletionRequest) (*CompletionResponse, error)
      CompleteWithVision(ctx context.Context, req *VisionRequest) (*CompletionResponse, error)
  }
  
  type EngineStatus struct {
      Type      string  // "bundled", "ollama", "cloud"
      Available bool
      Model     string
      Error     string
  }
  
  type CompletionRequest struct {
      Model       string
      Prompt      string
      MaxTokens   int
      Temperature float64
  }
  
  type VisionRequest struct {
      CompletionRequest
      Images [][]byte  // Base64-encoded images
  }
  ```

#### Bundled llama.cpp

- [ ] **5.2** Implement bundled engine (`internal/inference/bundled.go`)
  ```go
  type BundledEngine struct {
      serverPath  string
      modelPath   string
      port        int
      cmd         *exec.Cmd
      client      *http.Client
  }
  
  func NewBundledEngine(modelPath string) *BundledEngine
  func (e *BundledEngine) Start() error
  func (e *BundledEngine) Stop() error
  func (e *BundledEngine) IsAvailable() bool
  func (e *BundledEngine) Complete(...) (*CompletionResponse, error)
  ```

- [ ] **5.3** Implement llama.cpp server management
  - Bundle `llama-server` binary (or compile from source for each platform)
  - Start server on random available port
  - Health check endpoint
  - Graceful shutdown

- [ ] **5.4** Implement model management (`internal/inference/models.go`)
  ```go
  type ModelManager struct {
      cacheDir string
      client   *http.Client
  }
  
  func (m *ModelManager) ListAvailableModels() []*ModelInfo
  func (m *ModelManager) ListDownloadedModels() []*ModelInfo
  func (m *ModelManager) DownloadModel(modelID string, progress func(float64)) error
  func (m *ModelManager) DeleteModel(modelID string) error
  func (m *ModelManager) GetModelPath(modelID string) string
  
  type ModelInfo struct {
      ID          string
      Name        string
      Size        int64
      Description string
      Downloaded  bool
      Path        string
  }
  ```

- [ ] **5.5** Define default model catalog
  ```go
  var DefaultModels = []*ModelInfo{
      {
          ID:          "gemma3n-e2b-q4",
          Name:        "Gemma 3n E2B (Recommended)",
          Size:        1_500_000_000,  // ~1.5GB
          Description: "Lightweight model, runs on CPU",
      },
      {
          ID:          "gemma3n-e4b-q4", 
          Name:        "Gemma 3n E4B",
          Size:        2_500_000_000,  // ~2.5GB
          Description: "Better quality, still CPU-friendly",
      },
  }
  ```

#### External Providers

- [ ] **5.6** Implement Ollama client (`internal/inference/ollama.go`)
  ```go
  type OllamaEngine struct {
      host   string
      client *http.Client
  }
  
  func NewOllamaEngine(host string) *OllamaEngine
  func (e *OllamaEngine) IsAvailable() bool
  func (e *OllamaEngine) ListModels() ([]string, error)
  func (e *OllamaEngine) Complete(...) (*CompletionResponse, error)
  ```

- [ ] **5.7** Implement cloud API client (`internal/inference/cloud.go`)
  ```go
  type CloudEngine struct {
      provider string  // "anthropic", "openai"
      apiKey   string
      client   *http.Client
  }
  
  func NewCloudEngine(provider, apiKey string) *CloudEngine
  func (e *CloudEngine) IsAvailable() bool
  func (e *CloudEngine) Complete(...) (*CompletionResponse, error)
  ```

#### Summarization

- [ ] **5.8** Implement summarizer (`internal/inference/summarizer.go`)
  ```go
  type Summarizer struct {
      engine Engine
      store  *storage.Store
  }
  
  func NewSummarizer(engine Engine, store *storage.Store) *Summarizer
  func (s *Summarizer) SummarizeSession(sessionID int64) (*Summary, error)
  func (s *Summarizer) buildContext(sessionID int64) (*SummaryContext, error)
  func (s *Summarizer) selectScreenshots(session *Session, maxCount int) ([]*Screenshot, error)
  ```

- [ ] **5.9** Implement focus-weighted screenshot sampling
  - Group screenshots by (app_name, window_title)
  - Allocate samples proportional to time spent
  - Hamilton method for fair allocation

- [ ] **5.10** Implement two-stage summarization
  - Stage 1: Vision model describes screenshots with focus context
  - Stage 2: Text model synthesizes structured summary

- [ ] **5.11** Implement structured output parsing
  ```go
  type SummaryOutput struct {
      Summary     string   `json:"summary"`
      Explanation string   `json:"explanation"`
      Confidence  string   `json:"confidence"`
      Tags        []string `json:"tags"`
  }
  ```

#### Engine Manager

- [ ] **5.12** Implement engine manager (`internal/inference/manager.go`)
  ```go
  type Manager struct {
      bundled    *BundledEngine
      ollama     *OllamaEngine
      cloud      *CloudEngine
      config     *Config
      modelMgr   *ModelManager
  }
  
  func NewManager(config *Config) *Manager
  func (m *Manager) GetActiveEngine() Engine
  func (m *Manager) GetStatus() *InferenceStatus
  func (m *Manager) SetPreferredEngine(engineType string) error
  ```

  Priority: External Ollama (if configured) → Cloud (if configured) → Bundled

### Verification

```
□ Bundled engine starts llama-server successfully
□ Bundled engine health check returns OK
□ Model download works with progress callback
□ Downloaded model loads successfully
□ Text completion returns response
□ Vision completion with images returns response

□ Ollama client connects to external host
□ Ollama client lists available models
□ Ollama completion works

□ Engine manager selects correct engine based on config
□ Fallback works when preferred engine unavailable

□ Session summarization produces structured output
□ Screenshot sampling weights by focus time
□ Summary saved to database
```

---

## Phase 6: Frontend Foundation

**Goal:** Build React application shell, routing, and shared components.

**Estimated effort:** 2 sessions

**Dependencies:** Phase 0

**Note:** Can run in parallel with backend phases.

### Tasks

#### Application Shell

- [ ] **6.1** Set up routing (`frontend/src/App.tsx`)
  ```tsx
  const router = createBrowserRouter([
    {
      path: "/",
      element: <AppLayout />,
      children: [
        { index: true, element: <TimelinePage /> },
        { path: "analytics", element: <AnalyticsPage /> },
        { path: "reports", element: <ReportsPage /> },
        { path: "day/:date", element: <DayPage /> },
        { path: "settings", element: <SettingsPage /> },
        { path: "session/:id", element: <SessionDetailPage /> },
      ],
    },
  ]);
  ```

- [ ] **6.2** Implement app layout (`frontend/src/components/layout/AppLayout.tsx`)
  - Header with navigation
  - Main content area with Outlet
  - Optional sidebar
  - Settings drawer (slide-out)
  - Toast notifications

- [ ] **6.3** Set up TanStack Query provider
  ```tsx
  const queryClient = new QueryClient({
      defaultOptions: {
          queries: {
              staleTime: 30_000,
              refetchOnWindowFocus: false,
          },
      },
  });
  ```

#### Wails Integration

- [ ] **6.4** Create Wails binding wrappers (`frontend/src/api/client.ts`)
  ```typescript
  // Wails generates these, but we wrap for type safety
  import * as wails from '@wailsjs/runtime';
  import * as Analytics from '@wailsjs/go/service/AnalyticsService';
  import * as Timeline from '@wailsjs/go/service/TimelineService';
  // etc.
  
  export const api = {
      analytics: {
          getDailyStats: Analytics.GetDailyStats,
          getWeeklyStats: Analytics.GetWeeklyStats,
          // ...
      },
      timeline: {
          getSessionsForDate: Timeline.GetSessionsForDate,
          // ...
      },
  };
  ```

- [ ] **6.5** Create TanStack Query hooks (`frontend/src/api/hooks.ts`)
  ```typescript
  export function useDailyStats(date: string) {
      return useQuery({
          queryKey: ['analytics', 'daily', date],
          queryFn: () => api.analytics.getDailyStats(date),
      });
  }
  
  export function useSessionsForDate(date: string) {
      return useQuery({
          queryKey: ['timeline', 'sessions', date],
          queryFn: () => api.timeline.getSessionsForDate(date),
      });
  }
  ```

#### TypeScript Types

- [ ] **6.6** Define types (`frontend/src/types/`)
  ```typescript
  // screenshot.ts
  export interface Screenshot {
      id: number;
      timestamp: number;
      filepath: string;
      dhash: string;
      windowTitle: string | null;
      appName: string | null;
      sessionId: number | null;
  }
  
  // session.ts
  export interface Session {
      id: number;
      startTime: number;
      endTime: number | null;
      durationSeconds: number | null;
      screenshotCount: number;
      summary: Summary | null;
  }
  
  // ... etc for all entities
  ```

#### Shared Components

- [ ] **6.7** Install shadcn/ui components
  ```bash
  npx shadcn@latest add button card dialog drawer tabs
  npx shadcn@latest add switch slider input textarea
  npx shadcn@latest add select toast sonner
  npx shadcn@latest add scroll-area skeleton badge
  ```

- [ ] **6.8** Create Screenshot component
  ```tsx
  interface ScreenshotProps {
      screenshot: Screenshot;
      size?: 'thumbnail' | 'medium' | 'full';
      onClick?: () => void;
  }
  
  export function Screenshot({ screenshot, size = 'thumbnail', onClick }: ScreenshotProps) {
      const src = useThumbnail(screenshot.id);  // Or full image based on size
      return (
          <div className="relative cursor-pointer" onClick={onClick}>
              <img src={src} alt={screenshot.windowTitle ?? ''} />
              <div className="absolute bottom-0 left-0 right-0 ...">
                  <AppBadge app={screenshot.appName} />
              </div>
          </div>
      );
  }
  ```

- [ ] **6.9** Create ImageGallery component
  - Lightbox modal for full-size viewing
  - Arrow key navigation
  - Thumbnail strip

- [ ] **6.10** Create utility components
  - `AppBadge` - App icon and name
  - `TagBadge` - Colored tag pills
  - `DurationDisplay` - Human-readable duration
  - `TimeDisplay` - Formatted timestamp
  - `ConfidenceBadge` - Summary confidence indicator

- [ ] **6.11** Create loading states
  - `ScreenshotSkeleton`
  - `SessionCardSkeleton`
  - `StatsSkeleton`

- [ ] **6.12** Implement keyboard navigation hook
  ```typescript
  export function useKeyboardNav(handlers: {
      onLeft?: () => void;
      onRight?: () => void;
      onUp?: () => void;
      onDown?: () => void;
      onEscape?: () => void;
  }) {
      useEffect(() => {
          const handle = (e: KeyboardEvent) => {
              switch (e.key) {
                  case 'ArrowLeft': handlers.onLeft?.(); break;
                  // ...
              }
          };
          window.addEventListener('keydown', handle);
          return () => window.removeEventListener('keydown', handle);
      }, [handlers]);
  }
  ```

#### Utilities

- [ ] **6.13** Port utility functions (`frontend/src/lib/utils.ts`)
  ```typescript
  export function cn(...classes: ClassValue[]) { ... }
  export function formatDuration(seconds: number): string { ... }
  export function formatTimestamp(ts: number): string { ... }
  export function formatDate(ts: number): string { ... }
  export function formatTimeRange(start: number, end: number): string { ... }
  export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> { ... }
  ```

### Verification

```
□ App renders with header and navigation
□ Routing works for all defined routes
□ Wails bindings callable from React
□ TanStack Query caches responses
□ Screenshot component displays image
□ ImageGallery opens and navigates
□ Keyboard navigation works
□ Loading skeletons display while fetching
□ Toast notifications work
```

---

## Phase 7: Frontend Pages

**Goal:** Implement all page components.

**Estimated effort:** 4-5 sessions

**Dependencies:** Phases 4, 6

### Task Groups

#### 7A: Settings Page (1 session)

- [ ] **7A.1** Create SettingsDrawer component
  - Drawer slide-out from right
  - Tabs: Capture, AI, Data Sources, System

- [ ] **7A.2** Implement Capture settings tab
  - Interval slider (10-120 seconds)
  - AFK timeout slider (1-10 minutes)
  - Quality slider (60-100%)
  - Toggle: Capture on startup

- [ ] **7A.3** Implement AI settings tab
  - Engine selection (Bundled / External Ollama / Cloud)
  - Model selection dropdown
  - Ollama host input (if external)
  - API key input (if cloud)
  - Download model button with progress
  - Test connection button

- [ ] **7A.4** Implement Data Sources tab
  - Toggle each source: Screenshots, Shell, Git, Files, Browser
  - Git: Search paths list (add/remove)
  - Files: Watch paths list (add/remove)
  - Browser: Browser selection checkboxes
  - Shell: Exclude patterns

- [ ] **7A.5** Implement System tab
  - Data directory path (read-only)
  - Storage usage display
  - Export data button
  - Clear data button (with confirmation)
  - Restart daemon button

**Verification:**
```
□ Settings drawer opens/closes smoothly
□ All tabs render correctly
□ Changes persist to backend
□ Model download shows progress
□ Test connection returns status
□ Daemon restarts when config changes
```

#### 7B: Day View Page (1 session)

- [ ] **7B.1** Create DayPage layout
  - Date header with prev/next navigation
  - Screenshots grouped by hour

- [ ] **7B.2** Implement hour groupings
  - Collapsible sections per hour
  - Screenshot count per hour
  - Thumbnail grid

- [ ] **7B.3** Integrate ImageGallery
  - Click thumbnail to open gallery
  - Navigate within day's screenshots

- [ ] **7B.4** Add date picker
  - Calendar popup
  - Jump to specific date

- [ ] **7B.5** Implement keyboard navigation
  - Left/Right: prev/next day
  - Up/Down: prev/next hour section

**Verification:**
```
□ Screenshots display for selected date
□ Hour groupings collapse/expand
□ Gallery opens on thumbnail click
□ Date navigation works
□ Keyboard shortcuts work
```

#### 7C: Analytics Page (1-2 sessions)

- [ ] **7C.1** Design new analytics layout
  - Stats grid at top
  - Main chart area
  - Data sources breakdown
  - App usage table

- [ ] **7C.2** Implement StatsGrid
  - Total screenshots
  - Active hours
  - Sessions today
  - Shell commands
  - Git commits
  - Files modified
  - Sites visited

- [ ] **7C.3** Implement ActivityChart (Recharts)
  - Daily activity bar chart
  - Selectable time range (7d, 30d, 90d)
  - Hover tooltips

- [ ] **7C.4** Implement AppUsageChart
  - Doughnut/pie chart of app time
  - Legend with percentages

- [ ] **7C.5** Implement HeatmapChart
  - Hour of day (y) × Day of week (x)
  - Color intensity = activity level

- [ ] **7C.6** Implement DataSourcesPanel
  - Tab per source: Shell, Git, Files, Browser
  - Shell: Top commands, command timeline
  - Git: Commits by repo, recent commits list
  - Files: Recent files, category breakdown
  - Browser: Top domains, category pie

- [ ] **7C.7** Implement AppUsageTable
  - Sortable columns: App, Duration, Sessions, %
  - Click row to filter timeline

**Verification:**
```
□ Stats grid shows correct counts
□ Activity chart renders with real data
□ Time range selector updates chart
□ App usage pie shows top apps
□ Heatmap shows activity patterns
□ Data source tabs populate correctly
□ Table sorts correctly
```

#### 7D: Reports Page (1 session)

- [ ] **7D.1** Create ReportsPage layout
  - Report generator form
  - Preview panel
  - Export history

- [ ] **7D.2** Implement ReportGenerator
  - Time range input (natural language)
  - Parsed range display
  - Report type selector (Summary, Detailed, Standup)
  - Generate button

- [ ] **7D.3** Implement ReportPreview
  - Rendered markdown/HTML
  - Export format selector
  - Download button

- [ ] **7D.4** Implement ExportHistory
  - List of past exports
  - Download links
  - Delete option

**Verification:**
```
□ Time range parsing shows interpreted dates
□ Report generates successfully
□ Preview renders formatted content
□ Export downloads file
□ History shows past exports
```

#### 7E: Timeline Page (2 sessions)

- [ ] **7E.1** Create TimelinePage layout
  - Calendar on left (or top)
  - Session list in center
  - Detail panel on right (or modal)

- [ ] **7E.2** Implement Calendar component
  - Month view with day cells
  - Activity intensity coloring
  - Click day to select
  - Week view toggle

- [ ] **7E.3** Implement SessionList
  - Cards for each session on selected day
  - Time range, duration, screenshot count
  - Summary preview (if exists)
  - Activity indicators (shell, git, files, browser)

- [ ] **7E.4** Implement SessionCard
  - Expandable to show details
  - Filmstrip of screenshots
  - Action buttons: View details, Regenerate summary

- [ ] **7E.5** Implement Filmstrip
  - Horizontal scrolling thumbnail strip
  - Click to view full screenshot

- [ ] **7E.6** Implement SessionDetail modal/panel
  - Full summary with explanation
  - Tags
  - Focus breakdown (app time chart)
  - All data sources for session
  - Screenshot gallery

- [ ] **7E.7** Implement keyboard navigation
  - H/L: prev/next month
  - J/K: prev/next day
  - Arrow keys: navigate sessions
  - Enter: open session detail
  - Escape: close modal

- [ ] **7E.8** Implement summary generation
  - Generate button on unsummarized sessions
  - Loading state during generation
  - Auto-refresh when complete

**Verification:**
```
□ Calendar shows all days with activity
□ Day intensity colors reflect screenshot count
□ Clicking day loads sessions
□ Session cards display correctly
□ Filmstrip scrolls and clicks work
□ Session detail shows all context
□ Keyboard navigation works
□ Summary generation triggers and completes
```

---

## Phase 8: Desktop Integration & Polish

**Goal:** System tray, notifications, auto-start, and final polish.

**Estimated effort:** 1-2 sessions

**Dependencies:** All previous phases

### Tasks

#### System Tray

- [ ] **8.1** Add system tray icon
  ```go
  // Wails v2 has built-in system tray support
  systray.SetIcon(icon)
  systray.SetTitle("Traq")
  systray.SetTooltip("Traq - Running")
  ```

- [ ] **8.2** Implement tray menu
  - Open Dashboard
  - Current session status
  - Pause/Resume tracking
  - Settings
  - Quit

- [ ] **8.3** Implement tray icon states
  - Normal: Active and tracking
  - Paused: User paused tracking
  - AFK: User is away

#### Notifications

- [ ] **8.4** Implement native notifications
  - Session ended summary
  - AI summary generated
  - Model download complete
  - Errors/warnings

- [ ] **8.5** Add notification preferences
  - Toggle each notification type
  - Do not disturb schedule

#### Auto-Start

- [ ] **8.6** Implement auto-start on login
  - Linux: XDG autostart entry
  - Windows: Registry or Startup folder
  - macOS: Login Items

- [ ] **8.7** Add auto-start toggle in settings

#### Polish

- [ ] **8.8** Implement dark mode
  - System preference detection
  - Manual toggle
  - Persist preference

- [ ] **8.9** Add onboarding flow
  - First launch wizard
  - Permission requests (macOS accessibility)
  - Model download prompt

- [ ] **8.10** Error handling and recovery
  - Graceful degradation when AI unavailable
  - Retry logic for transient failures
  - User-friendly error messages

- [ ] **8.11** Performance optimization
  - Lazy load pages
  - Virtual scrolling for long lists
  - Image lazy loading

- [ ] **8.12** Accessibility
  - Keyboard navigation everywhere
  - Screen reader labels
  - Focus management

### Verification

```
□ Tray icon appears on all platforms
□ Tray menu items work
□ Icon reflects current state
□ Notifications appear and are actionable
□ Auto-start works on all platforms
□ Dark mode toggles correctly
□ Onboarding completes successfully
□ App handles errors gracefully
□ Performance acceptable with large datasets
```

---

## Phase 9: Testing & Documentation

**Goal:** Comprehensive testing and documentation.

**Estimated effort:** 2 sessions

**Dependencies:** All previous phases

### Tasks

#### Backend Testing

- [ ] **9.1** Unit tests for storage layer
- [ ] **9.2** Unit tests for each tracker
- [ ] **9.3** Unit tests for services
- [ ] **9.4** Integration tests for inference engine
- [ ] **9.5** Platform-specific tests (where possible)

#### Frontend Testing

- [ ] **9.6** Component tests with React Testing Library
- [ ] **9.7** Hook tests
- [ ] **9.8** Mock Wails bindings for testing

#### E2E Testing

- [ ] **9.9** Set up Playwright
- [ ] **9.10** Critical path tests
  - App launches
  - Navigation works
  - Settings save
  - Screenshots display

#### Documentation

- [ ] **9.11** Update README.md
- [ ] **9.12** Write ARCHITECTURE.md
- [ ] **9.13** Write CONTRIBUTING.md
- [ ] **9.14** API documentation
- [ ] **9.15** User guide

---

## Appendix A: Platform-Specific Implementation Notes

### Linux

**Window tracking:**
```go
// Use xdotool
cmd := exec.Command("xdotool", "getactivewindow", "getwindowname")
title, _ := cmd.Output()

// App name via xprop
cmd = exec.Command("xprop", "-id", windowID, "WM_CLASS")
```

**AFK detection:**
```go
// Option 1: X11 screensaver extension
// Option 2: Read /proc/interrupts keyboard line
```

**Browser paths:**
```go
chromePath := "~/.config/google-chrome/Default/History"
firefoxPath := "~/.mozilla/firefox/*.default*/places.sqlite"
```

### Windows

**Window tracking:**
```go
// Win32 API via syscall
user32 := syscall.NewLazyDLL("user32.dll")
getForegroundWindow := user32.NewProc("GetForegroundWindow")
getWindowTextW := user32.NewProc("GetWindowTextW")
```

**AFK detection:**
```go
// GetLastInputInfo
type LASTINPUTINFO struct {
    cbSize uint32
    dwTime uint32
}
```

**Browser paths:**
```go
chromePath := os.Getenv("LOCALAPPDATA") + "\\Google\\Chrome\\User Data\\Default\\History"
```

### macOS

**Window tracking:**
```go
// Requires Accessibility permission
// Use AppleScript or Accessibility API via CGO
```

**AFK detection:**
```go
// CGEventSourceSecondsSinceLastEventType
```

**Browser paths:**
```go
chromePath := "~/Library/Application Support/Google/Chrome/Default/History"
```

---

## Appendix B: Configuration Schema

```yaml
# ~/.config/traq/config.yaml (Linux)
# ~/Library/Application Support/Traq/config.yaml (macOS)
# %APPDATA%\Traq\config.yaml (Windows)

capture:
  enabled: true
  interval_seconds: 30
  quality: 80
  duplicate_threshold: 3

afk:
  timeout_seconds: 180
  min_session_minutes: 5

inference:
  engine: bundled  # bundled, ollama, cloud
  bundled:
    model: gemma3n-e2b-q4
  ollama:
    host: http://localhost:11434
    model: gemma3:12b-it-qat
  cloud:
    provider: anthropic  # anthropic, openai
    api_key: ""  # Or use ANTHROPIC_API_KEY env var
    model: claude-sonnet-4-20250514

data_sources:
  shell:
    enabled: true
    exclude_patterns:
      - "^(ls|cd|pwd|clear)$"
  git:
    enabled: true
    search_paths:
      - ~/projects
      - ~/code
    max_depth: 3
  files:
    enabled: true
    watches:
      - path: ~/Downloads
        category: downloads
      - path: ~/projects
        category: projects
        recursive: true
  browser:
    enabled: true
    browsers:
      - chrome
      - firefox

ui:
  theme: system  # light, dark, system
  start_minimized: false
  show_notifications: true

system:
  auto_start: true
  start_on_login: true
```

---

## Appendix C: Agent Deployment Guide

### How to Use This Plan with Claude Code

1. **Clone the plan to your repository:**
   ```bash
   cp TRAQ_IMPLEMENTATION_PLAN.md /path/to/traq/docs/PLAN.md
   ```

2. **Create a git worktree for v2 (from existing activity-tracker repo):**
   ```bash
   cd activity-tracker
   git worktree add ../traq -b v2
   cd ../traq
   ```

3. **Start a Claude Code session with context:**
   ```
   @PLAN.md Implement Phase 0: Project Scaffolding
   ```

4. **After each phase, update the plan:**
   - Check off completed tasks
   - Note any deviations or learnings
   - Update verification results

5. **Phase-specific prompts:**

   **Phase 0:**
   ```
   @PLAN.md Initialize the Wails + React + TypeScript project as specified in Phase 0.
   Set up Tailwind CSS and shadcn/ui. Verify the development environment works.
   ```

   **Phase 1:**
   ```
   @PLAN.md Implement Phase 1: Platform Abstraction & Core Storage.
   Start with the platform interface, then Linux implementation, then storage layer.
   Write tests as you go.
   ```

   **Phase 2:**
   ```
   @PLAN.md Implement Phase 2: Core Trackers.
   Focus on screenshot capture first, then window tracking, then AFK detection,
   then tie it together with the daemon.
   ```

   (Continue pattern for remaining phases)

6. **Verification checkpoints:**
   After each phase, run verification manually or create automated tests.
   Update the plan with results before proceeding.

### Parallelization

For faster progress, run multiple Claude Code sessions:

- **Session A:** Backend (Phases 1, 2, 3, 4, 5)
- **Session B:** Frontend (Phases 6, 7)

Merge point: Phase 7 (frontend pages need backend bindings from Phase 4)

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-04 | Initial plan |

---

*End of Plan*
