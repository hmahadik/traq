# Traq Phase 1: Make It Real — Implementation Guide

## Objective

The Traq UI is functional but displays mock/placeholder data. This guide provides step-by-step instructions to wire up real functionality so the app captures and displays actual user activity.

## Success Criteria (How We Know We're Done)

By the end of this phase:

1. ✅ App launches and immediately starts capturing screenshots every 30 seconds
2. ✅ Screenshots saved to `~/.local/share/traq/screenshots/YYYY/MM/DD/` as WebP files
3. ✅ Thumbnails generated alongside each screenshot
4. ✅ SQLite database at `~/.local/share/traq/data.db` contains real rows
5. ✅ Window title and app name recorded with each screenshot
6. ✅ Sessions auto-create on first activity, auto-end on AFK (3 min default)
7. ✅ UI displays real data from database (not mocks)
8. ✅ App restart preserves all data
9. ✅ All trackers have integration tests that pass

---

## Pre-Implementation Checklist

Before starting, verify current state:

```bash
# 1. Check project structure exists
ls -la internal/tracker/
ls -la internal/storage/
ls -la internal/platform/

# 2. Check if data directory exists from previous runs
ls -la ~/.local/share/traq/

# 3. Check current database state (if exists)
sqlite3 ~/.local/share/traq/data.db ".tables" 2>/dev/null || echo "No database yet"

# 4. Verify app builds
wails build -tags webkit2_41

# 5. Check what's currently stubbed
grep -r "TODO\|STUB\|MOCK\|placeholder" internal/ --include="*.go" | head -20
```

---

## Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Storage Layer Verification                                   │
│     Ensure database creates tables and CRUD operations work      │
├─────────────────────────────────────────────────────────────────┤
│  2. Platform Layer Verification                                  │
│     Ensure window info and paths work on Linux                   │
├─────────────────────────────────────────────────────────────────┤
│  3. Screenshot Capture                                           │
│     Capture screen → save WebP → generate thumbnail → store hash │
├─────────────────────────────────────────────────────────────────┤
│  4. Window Tracking                                              │
│     Poll active window → record focus changes with duration      │
├─────────────────────────────────────────────────────────────────┤
│  5. AFK Detection                                                │
│     Monitor input → detect idle → fire callbacks                 │
├─────────────────────────────────────────────────────────────────┤
│  6. Session Management                                           │
│     Create session on activity → end on AFK → resume logic       │
├─────────────────────────────────────────────────────────────────┤
│  7. Daemon Loop                                                  │
│     Tie everything together → run on app start                   │
├─────────────────────────────────────────────────────────────────┤
│  8. Frontend Wiring                                              │
│     Remove mocks → fetch real data → display                     │
├─────────────────────────────────────────────────────────────────┤
│  9. Integration Tests                                            │
│     Verify each component with real system                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Storage Layer Verification

### 1.1 Verify Database Initialization

Check `internal/storage/sqlite.go`:

```go
// Must have:
func NewStore(dbPath string) (*Store, error) {
    // Creates directory if not exists
    // Opens/creates SQLite database
    // Runs migrations
    // Returns connected store
}
```

**Test it:**

```bash
# Create a simple test
cat > internal/storage/sqlite_test.go << 'EOF'
package storage

import (
    "os"
    "path/filepath"
    "testing"
)

func TestNewStore(t *testing.T) {
    // Use temp directory
    tmpDir := t.TempDir()
    dbPath := filepath.Join(tmpDir, "test.db")
    
    store, err := NewStore(dbPath)
    if err != nil {
        t.Fatalf("Failed to create store: %v", err)
    }
    defer store.Close()
    
    // Verify file exists
    if _, err := os.Stat(dbPath); os.IsNotExist(err) {
        t.Error("Database file was not created")
    }
}
EOF

go test ./internal/storage/ -run TestNewStore -v
```

### 1.2 Verify Screenshot CRUD

Check `internal/storage/screenshots.go`:

```go
// Must have these methods:
func (s *Store) SaveScreenshot(sc *Screenshot) (int64, error)
func (s *Store) GetScreenshots(start, end int64) ([]*Screenshot, error)
func (s *Store) GetScreenshotsBySession(sessionID int64) ([]*Screenshot, error)
func (s *Store) GetScreenshotByID(id int64) (*Screenshot, error)
```

**Test it:**

```go
func TestScreenshotCRUD(t *testing.T) {
    store := setupTestStore(t)
    defer store.Close()
    
    // Save
    sc := &Screenshot{
        Timestamp:   time.Now().Unix(),
        Filepath:    "/tmp/test.webp",
        DHash:       "abc123",
        WindowTitle: "Test Window",
        AppName:     "test-app",
    }
    id, err := store.SaveScreenshot(sc)
    if err != nil {
        t.Fatalf("SaveScreenshot failed: %v", err)
    }
    if id == 0 {
        t.Error("Expected non-zero ID")
    }
    
    // Retrieve
    retrieved, err := store.GetScreenshotByID(id)
    if err != nil {
        t.Fatalf("GetScreenshotByID failed: %v", err)
    }
    if retrieved.WindowTitle != sc.WindowTitle {
        t.Errorf("WindowTitle mismatch: got %s, want %s", retrieved.WindowTitle, sc.WindowTitle)
    }
}
```

### 1.3 Verify Session CRUD

Similar tests for:
- `CreateSession(startTime int64) (int64, error)`
- `EndSession(id int64, endTime int64) error`
- `GetCurrentSession() (*Session, error)`
- `GetSessionsByDateRange(start, end int64) ([]*Session, error)`

**Run all storage tests:**

```bash
go test ./internal/storage/ -v
```

**Expected output:** All tests pass. If any fail, fix before proceeding.

---

## Step 2: Platform Layer Verification

### 2.1 Verify Data Paths

Check `internal/platform/linux.go`:

```go
func (p *LinuxPlatform) DataDir() string {
    // Should return ~/.local/share/traq
    home, _ := os.UserHomeDir()
    return filepath.Join(home, ".local", "share", "traq")
}

func (p *LinuxPlatform) ScreenshotDir() string {
    return filepath.Join(p.DataDir(), "screenshots")
}
```

**Test it:**

```bash
cat > internal/platform/linux_test.go << 'EOF'
//go:build linux

package platform

import (
    "os"
    "strings"
    "testing"
)

func TestLinuxDataDir(t *testing.T) {
    p := NewLinuxPlatform()
    dataDir := p.DataDir()
    
    home, _ := os.UserHomeDir()
    expected := home + "/.local/share/traq"
    
    if dataDir != expected {
        t.Errorf("DataDir = %s, want %s", dataDir, expected)
    }
}
EOF

go test ./internal/platform/ -v -tags linux
```

### 2.2 Verify Window Info Retrieval

Check that `GetActiveWindow()` actually works:

```go
func (p *LinuxPlatform) GetActiveWindow() (*WindowInfo, error) {
    // Should use xdotool or similar
    // Returns actual window title and app name
}
```

**Test it (integration test, needs display):**

```go
//go:build integration && linux

func TestGetActiveWindow_Integration(t *testing.T) {
    p := NewLinuxPlatform()
    
    info, err := p.GetActiveWindow()
    if err != nil {
        t.Fatalf("GetActiveWindow failed: %v", err)
    }
    
    // Should return something (we're running in a terminal)
    if info.Title == "" && info.AppName == "" {
        t.Error("Expected non-empty window info")
    }
    
    t.Logf("Current window: %s (%s)", info.Title, info.AppName)
}
```

**Run integration test:**

```bash
go test ./internal/platform/ -v -tags "integration,linux" -run Integration
```

---

## Step 3: Screenshot Capture

### 3.1 Verify Capture Implementation

Check `internal/tracker/screenshot.go`:

```go
type ScreenCapture struct {
    outputDir string
    quality   int
    platform  platform.Platform
}

func NewScreenCapture(outputDir string, quality int, p platform.Platform) *ScreenCapture

func (c *ScreenCapture) Capture() (*CaptureResult, error) {
    // 1. Capture screen using kbinani/screenshot or similar
    // 2. Encode as WebP with configured quality
    // 3. Save to outputDir/YYYY/MM/DD/YYYYMMDD_HHMMSS_<hash>.webp
    // 4. Generate thumbnail (200px width)
    // 5. Compute dhash
    // 6. Return CaptureResult with paths and hash
}

type CaptureResult struct {
    Filepath      string
    ThumbnailPath string
    DHash         string
    Width         int
    Height        int
    Timestamp     int64
}
```

### 3.2 Implement if Missing

If capture is stubbed, implement it:

```go
package tracker

import (
    "fmt"
    "image"
    "os"
    "path/filepath"
    "time"

    "github.com/kbinani/screenshot"
    "github.com/chai2010/webp"
    "github.com/disintegration/imaging"
    "github.com/corona10/goimagehash"
)

func (c *ScreenCapture) Capture() (*CaptureResult, error) {
    // Get active display bounds
    bounds := screenshot.GetDisplayBounds(0)
    
    // Capture
    img, err := screenshot.CaptureRect(bounds)
    if err != nil {
        return nil, fmt.Errorf("screen capture failed: %w", err)
    }
    
    // Generate timestamp and paths
    now := time.Now()
    timestamp := now.Unix()
    dateDir := now.Format("2006/01/02")
    filename := now.Format("20060102_150405")
    
    // Compute dhash
    hash, err := goimagehash.DifferenceHash(img)
    if err != nil {
        return nil, fmt.Errorf("dhash failed: %w", err)
    }
    hashStr := fmt.Sprintf("%016x", hash.GetHash())
    
    // Create output directory
    outputPath := filepath.Join(c.outputDir, dateDir)
    if err := os.MkdirAll(outputPath, 0755); err != nil {
        return nil, fmt.Errorf("mkdir failed: %w", err)
    }
    
    // Save full image as WebP
    fullPath := filepath.Join(outputPath, filename+"_"+hashStr[:8]+".webp")
    fullFile, err := os.Create(fullPath)
    if err != nil {
        return nil, fmt.Errorf("create file failed: %w", err)
    }
    defer fullFile.Close()
    
    if err := webp.Encode(fullFile, img, &webp.Options{Quality: float32(c.quality)}); err != nil {
        return nil, fmt.Errorf("webp encode failed: %w", err)
    }
    
    // Generate thumbnail
    thumb := imaging.Resize(img, 200, 0, imaging.Lanczos)
    thumbPath := filepath.Join(outputPath, filename+"_"+hashStr[:8]+"_thumb.webp")
    thumbFile, err := os.Create(thumbPath)
    if err != nil {
        return nil, fmt.Errorf("create thumb failed: %w", err)
    }
    defer thumbFile.Close()
    
    if err := webp.Encode(thumbFile, thumb, &webp.Options{Quality: 70}); err != nil {
        return nil, fmt.Errorf("thumb encode failed: %w", err)
    }
    
    return &CaptureResult{
        Filepath:      fullPath,
        ThumbnailPath: thumbPath,
        DHash:         hashStr,
        Width:         bounds.Dx(),
        Height:        bounds.Dy(),
        Timestamp:     timestamp,
    }, nil
}
```

### 3.3 Test Screenshot Capture

```go
//go:build integration

func TestCapture_Integration(t *testing.T) {
    tmpDir := t.TempDir()
    p := platform.NewLinuxPlatform()
    cap := NewScreenCapture(tmpDir, 80, p)
    
    result, err := cap.Capture()
    if err != nil {
        t.Fatalf("Capture failed: %v", err)
    }
    
    // Verify file exists
    if _, err := os.Stat(result.Filepath); os.IsNotExist(err) {
        t.Error("Screenshot file not created")
    }
    
    // Verify thumbnail exists
    if _, err := os.Stat(result.ThumbnailPath); os.IsNotExist(err) {
        t.Error("Thumbnail file not created")
    }
    
    // Verify dhash is valid
    if len(result.DHash) != 16 {
        t.Errorf("DHash length = %d, want 16", len(result.DHash))
    }
    
    t.Logf("Captured: %s (dhash: %s)", result.Filepath, result.DHash)
}
```

**Run:**

```bash
go test ./internal/tracker/ -v -tags integration -run TestCapture
```

**Expected:** Test passes, actual screenshot file exists in temp directory.

---

## Step 4: Window Tracking

### 4.1 Verify Implementation

Check `internal/tracker/window.go`:

```go
type WindowTracker struct {
    platform     platform.Platform
    store        *storage.Store
    currentFocus *WindowFocus
    mu           sync.Mutex
}

func (t *WindowTracker) Poll() (*platform.WindowInfo, bool, error) {
    // Get current window
    // Compare to last known window
    // If changed, record focus end for previous, start for new
    // Return (currentWindow, changed, error)
}
```

### 4.2 Test Window Tracking

```go
//go:build integration

func TestWindowTracker_Integration(t *testing.T) {
    store := setupTestStore(t)
    defer store.Close()
    
    p := platform.NewLinuxPlatform()
    tracker := NewWindowTracker(p, store)
    
    // Poll current window
    info, changed, err := tracker.Poll()
    if err != nil {
        t.Fatalf("Poll failed: %v", err)
    }
    
    t.Logf("Window: %s (%s), changed: %v", info.Title, info.AppName, changed)
    
    // First poll should always be "changed" (from nothing to something)
    if !changed {
        t.Error("First poll should report changed=true")
    }
    
    // Second immediate poll should NOT be changed
    _, changed2, _ := tracker.Poll()
    if changed2 {
        t.Error("Immediate second poll should report changed=false")
    }
}
```

---

## Step 5: AFK Detection

### 5.1 Verify Implementation

Check `internal/tracker/afk.go`:

```go
type AFKDetector struct {
    platform   platform.Platform
    timeout    time.Duration
    isAFK      bool
    lastActive time.Time
    mu         sync.Mutex
    onAFK      func()
    onReturn   func()
}

func (d *AFKDetector) Poll() bool {
    // Get last input time from platform
    // Compare to timeout
    // Fire callbacks on state change
    // Return true if state changed
}
```

### 5.2 Platform Method for Last Input

In `internal/platform/linux.go`:

```go
func (p *LinuxPlatform) GetLastInputTime() (time.Time, error) {
    // Option 1: Use X11 screensaver extension
    // Option 2: Parse /proc/interrupts (less accurate)
    // Option 3: Use xprintidle command
    
    // Using xprintidle (install: apt install xprintidle)
    out, err := exec.Command("xprintidle").Output()
    if err != nil {
        return time.Time{}, err
    }
    
    idleMs, err := strconv.ParseInt(strings.TrimSpace(string(out)), 10, 64)
    if err != nil {
        return time.Time{}, err
    }
    
    return time.Now().Add(-time.Duration(idleMs) * time.Millisecond), nil
}
```

**Ensure xprintidle is installed:**

```bash
which xprintidle || sudo apt install xprintidle
```

### 5.3 Test AFK Detection

```go
//go:build integration

func TestAFKDetector_Integration(t *testing.T) {
    p := platform.NewLinuxPlatform()
    
    afkFired := false
    returnFired := false
    
    detector := NewAFKDetector(p, 5*time.Second) // Short timeout for test
    detector.SetCallbacks(
        func() { afkFired = true },
        func() { returnFired = true },
    )
    
    // Should not be AFK immediately after input
    changed := detector.Poll()
    if detector.IsAFK() {
        t.Error("Should not be AFK right after activity")
    }
    
    t.Logf("AFK state: %v, changed: %v", detector.IsAFK(), changed)
}
```

---

## Step 6: Session Management

### 6.1 Verify Implementation

Check `internal/tracker/session.go`:

```go
type SessionManager struct {
    store          *storage.Store
    currentSession *Session
    afkDetector    *AFKDetector
    mu             sync.Mutex
}

func (m *SessionManager) EnsureSession() (*Session, error) {
    // If no current session, create one
    // Return current session
}

func (m *SessionManager) EndCurrentSession() error {
    // End current session with timestamp
    // Clear current session
}

func (m *SessionManager) HandleAFK() {
    // Called when AFK detected
    // Ends current session
}

func (m *SessionManager) HandleReturn() {
    // Called when user returns from AFK
    // May resume recent session or create new one
}
```

### 6.2 Test Session Management

```go
func TestSessionManager(t *testing.T) {
    store := setupTestStore(t)
    defer store.Close()
    
    // Create manager without AFK (test isolation)
    manager := NewSessionManager(store, nil)
    
    // No session initially
    if manager.GetCurrentSession() != nil {
        t.Error("Should have no session initially")
    }
    
    // Create session
    session, err := manager.EnsureSession()
    if err != nil {
        t.Fatalf("EnsureSession failed: %v", err)
    }
    if session.ID == 0 {
        t.Error("Session should have ID")
    }
    
    // Calling again returns same session
    session2, _ := manager.EnsureSession()
    if session2.ID != session.ID {
        t.Error("Should return same session")
    }
    
    // End session
    err = manager.EndCurrentSession()
    if err != nil {
        t.Fatalf("EndCurrentSession failed: %v", err)
    }
    
    // Verify session ended in database
    ended, _ := store.GetSession(session.ID)
    if ended.EndTime == 0 {
        t.Error("Session should have EndTime set")
    }
}
```

---

## Step 7: Daemon Loop

### 7.1 Verify Daemon Implementation

Check `internal/tracker/daemon.go`:

```go
type Daemon struct {
    store      *storage.Store
    platform   platform.Platform
    capture    *ScreenCapture
    window     *WindowTracker
    afk        *AFKDetector
    session    *SessionManager
    interval   time.Duration
    running    bool
    stopCh     chan struct{}
    mu         sync.Mutex
}

func (d *Daemon) Start() error {
    // Initialize all components
    // Start main loop in goroutine
    // Return immediately
}

func (d *Daemon) Stop() error {
    // Signal stop channel
    // Wait for clean shutdown
}

func (d *Daemon) run() {
    ticker := time.NewTicker(d.interval)
    defer ticker.Stop()
    
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
    // 1. Check AFK status
    if d.afk.Poll() {
        if d.afk.IsAFK() {
            d.session.HandleAFK()
            return // Don't capture while AFK
        } else {
            d.session.HandleReturn()
        }
    }
    
    // Skip if AFK
    if d.afk.IsAFK() {
        return
    }
    
    // 2. Ensure we have a session
    session, err := d.session.EnsureSession()
    if err != nil {
        log.Printf("Session error: %v", err)
        return
    }
    
    // 3. Poll window
    windowInfo, _, _ := d.window.Poll()
    
    // 4. Capture screenshot
    result, err := d.capture.Capture()
    if err != nil {
        log.Printf("Capture error: %v", err)
        return
    }
    
    // 5. Check for duplicate (skip if too similar to last)
    // ... dhash comparison logic ...
    
    // 6. Save to database
    screenshot := &storage.Screenshot{
        Timestamp:   result.Timestamp,
        Filepath:    result.Filepath,
        DHash:       result.DHash,
        WindowTitle: windowInfo.Title,
        AppName:     windowInfo.AppName,
        SessionID:   session.ID,
        // ... other fields
    }
    
    _, err = d.store.SaveScreenshot(screenshot)
    if err != nil {
        log.Printf("Save error: %v", err)
    }
}
```

### 7.2 Wire Daemon to App Startup

In `app.go`, ensure daemon starts when app starts:

```go
func (a *App) startup(ctx context.Context) {
    a.ctx = ctx
    
    // Initialize platform
    a.platform = platform.New() // Auto-detects OS
    
    // Initialize storage
    dbPath := filepath.Join(a.platform.DataDir(), "data.db")
    store, err := storage.NewStore(dbPath)
    if err != nil {
        log.Fatalf("Failed to initialize storage: %v", err)
    }
    a.store = store
    
    // Initialize and start daemon
    a.daemon = tracker.NewDaemon(tracker.DaemonConfig{
        Store:       store,
        Platform:    a.platform,
        Interval:    30 * time.Second,
        AFKTimeout:  3 * time.Minute,
    })
    
    if err := a.daemon.Start(); err != nil {
        log.Printf("Failed to start daemon: %v", err)
    }
    
    // Initialize services for frontend
    a.initServices()
}

func (a *App) shutdown(ctx context.Context) {
    if a.daemon != nil {
        a.daemon.Stop()
    }
    if a.store != nil {
        a.store.Close()
    }
}
```

### 7.3 Test Daemon

```go
//go:build integration

func TestDaemon_Integration(t *testing.T) {
    tmpDir := t.TempDir()
    dbPath := filepath.Join(tmpDir, "test.db")
    screenshotDir := filepath.Join(tmpDir, "screenshots")
    
    store, _ := storage.NewStore(dbPath)
    defer store.Close()
    
    p := platform.NewLinuxPlatform()
    
    daemon := NewDaemon(DaemonConfig{
        Store:         store,
        Platform:      p,
        Interval:      2 * time.Second, // Fast for testing
        AFKTimeout:    1 * time.Minute,
        ScreenshotDir: screenshotDir,
    })
    
    // Start daemon
    err := daemon.Start()
    if err != nil {
        t.Fatalf("Start failed: %v", err)
    }
    
    // Wait for a few captures
    time.Sleep(5 * time.Second)
    
    // Stop daemon
    daemon.Stop()
    
    // Verify screenshots were captured
    screenshots, _ := store.GetScreenshots(0, time.Now().Unix()+1000)
    if len(screenshots) == 0 {
        t.Error("No screenshots captured")
    } else {
        t.Logf("Captured %d screenshots", len(screenshots))
    }
    
    // Verify session was created
    sessions, _ := store.GetSessionsByDateRange(0, time.Now().Unix()+1000)
    if len(sessions) == 0 {
        t.Error("No session created")
    }
    
    // Verify files exist
    files, _ := filepath.Glob(filepath.Join(screenshotDir, "*/*/*.webp"))
    if len(files) == 0 {
        t.Error("No screenshot files found")
    } else {
        t.Logf("Found %d screenshot files", len(files))
    }
}
```

---

## Step 8: Frontend Wiring

### 8.1 Remove Mock Data

Find and remove all mock/placeholder data in frontend:

```bash
# In frontend directory
grep -r "mock\|placeholder\|dummy\|fake\|sample" src/ --include="*.ts" --include="*.tsx" | head -30
```

### 8.2 Verify Wails Bindings Return Real Data

Check that service methods query the database:

```go
// internal/service/analytics.go
func (s *AnalyticsService) GetDailyStats(date string) (*DailyStats, error) {
    // Parse date
    t, err := time.Parse("2006-01-02", date)
    if err != nil {
        return nil, err
    }
    
    startOfDay := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location()).Unix()
    endOfDay := startOfDay + 86400
    
    // Query real data
    screenshots, _ := s.store.GetScreenshots(startOfDay, endOfDay)
    sessions, _ := s.store.GetSessionsByDateRange(startOfDay, endOfDay)
    
    // Calculate real stats
    return &DailyStats{
        Date:             date,
        TotalScreenshots: len(screenshots),
        TotalSessions:    len(sessions),
        // ... calculate other real stats
    }, nil
}
```

### 8.3 Verify Frontend Fetches Real Data

In frontend, ensure API hooks call Wails bindings:

```typescript
// frontend/src/api/hooks.ts
import * as Analytics from '@wailsjs/go/service/AnalyticsService';

export function useDailyStats(date: string) {
    return useQuery({
        queryKey: ['analytics', 'daily', date],
        queryFn: () => Analytics.GetDailyStats(date),
    });
}
```

### 8.4 Test End-to-End

1. Build and run the app:
   ```bash
   wails dev -tags webkit2_41
   ```

2. Wait 2 minutes for captures

3. Check the Analytics page shows real numbers (not 450, not 0)

4. Check Timeline shows real sessions

5. Verify database has data:
   ```bash
   sqlite3 ~/.local/share/traq/data.db "SELECT COUNT(*) FROM screenshots;"
   sqlite3 ~/.local/share/traq/data.db "SELECT COUNT(*) FROM sessions;"
   ```

---

## Step 9: Integration Tests

### 9.1 Create Test Suite

```bash
# Create integration test file
cat > internal/tracker/integration_test.go << 'EOF'
//go:build integration

package tracker

import (
    "os"
    "path/filepath"
    "testing"
    "time"
    
    "github.com/yourusername/traq/internal/platform"
    "github.com/yourusername/traq/internal/storage"
)

func TestFullPipeline_Integration(t *testing.T) {
    // Setup
    tmpDir := t.TempDir()
    dbPath := filepath.Join(tmpDir, "test.db")
    screenshotDir := filepath.Join(tmpDir, "screenshots")
    
    store, err := storage.NewStore(dbPath)
    if err != nil {
        t.Fatalf("Failed to create store: %v", err)
    }
    defer store.Close()
    
    plat := platform.New()
    
    // Test each component
    t.Run("Platform", func(t *testing.T) {
        info, err := plat.GetActiveWindow()
        if err != nil {
            t.Errorf("GetActiveWindow: %v", err)
        }
        t.Logf("Window: %+v", info)
    })
    
    t.Run("Capture", func(t *testing.T) {
        cap := NewScreenCapture(screenshotDir, 80, plat)
        result, err := cap.Capture()
        if err != nil {
            t.Errorf("Capture: %v", err)
        }
        if _, err := os.Stat(result.Filepath); err != nil {
            t.Errorf("Screenshot file missing: %v", err)
        }
        t.Logf("Captured: %s", result.Filepath)
    })
    
    t.Run("Session", func(t *testing.T) {
        mgr := NewSessionManager(store, nil)
        session, err := mgr.EnsureSession()
        if err != nil {
            t.Errorf("EnsureSession: %v", err)
        }
        if session.ID == 0 {
            t.Error("Session ID is 0")
        }
        t.Logf("Session: %d", session.ID)
    })
    
    t.Run("Daemon", func(t *testing.T) {
        daemon := NewDaemon(DaemonConfig{
            Store:         store,
            Platform:      plat,
            Interval:      1 * time.Second,
            AFKTimeout:    1 * time.Minute,
            ScreenshotDir: screenshotDir,
        })
        
        daemon.Start()
        time.Sleep(3 * time.Second)
        daemon.Stop()
        
        count, _ := store.GetScreenshots(0, time.Now().Unix()+1000)
        if len(count) == 0 {
            t.Error("No screenshots captured by daemon")
        }
        t.Logf("Daemon captured %d screenshots", len(count))
    })
}
EOF
```

### 9.2 Run All Integration Tests

```bash
go test ./... -tags integration -v
```

**Expected:** All tests pass.

---

## Verification Checklist

Run through this checklist to confirm Phase 1 is complete:

```bash
#!/bin/bash
echo "=== Traq Phase 1 Verification ==="

echo -e "\n1. Checking data directory..."
ls -la ~/.local/share/traq/

echo -e "\n2. Checking screenshots directory..."
find ~/.local/share/traq/screenshots -name "*.webp" 2>/dev/null | head -5

echo -e "\n3. Checking database..."
sqlite3 ~/.local/share/traq/data.db "SELECT 'Screenshots:', COUNT(*) FROM screenshots;"
sqlite3 ~/.local/share/traq/data.db "SELECT 'Sessions:', COUNT(*) FROM sessions;"
sqlite3 ~/.local/share/traq/data.db "SELECT 'Focus Events:', COUNT(*) FROM window_focus_events;"

echo -e "\n4. Running unit tests..."
go test ./internal/storage/ -v | tail -5

echo -e "\n5. Running integration tests..."
go test ./internal/tracker/ -tags integration -v | tail -10

echo -e "\n6. Building app..."
wails build -tags webkit2_41 2>&1 | tail -3

echo -e "\n=== Verification Complete ==="
```

---

## Troubleshooting

### Screenshots not capturing

1. Check xdotool is installed: `which xdotool`
2. Check display is set: `echo $DISPLAY`
3. Check permissions: try running with `DISPLAY=:0`

### Database not persisting

1. Check directory permissions: `ls -la ~/.local/share/traq/`
2. Check SQLite errors in logs
3. Verify store.Close() is called on shutdown

### UI still showing mock data

1. Clear browser cache in Wails webview
2. Check Network tab for API calls
3. Add console.log in frontend to verify data

### AFK not detecting

1. Check xprintidle is installed: `which xprintidle`
2. Test manually: `xprintidle` (shows idle milliseconds)
3. Check callback wiring

---

## Timeline Expectations

| Task | Estimated Time |
|------|----------------|
| Storage verification | 30 min |
| Platform verification | 30 min |
| Screenshot capture | 1-2 hours |
| Window tracking | 30 min |
| AFK detection | 1 hour |
| Session management | 30 min |
| Daemon loop | 1-2 hours |
| Frontend wiring | 1 hour |
| Integration tests | 1 hour |
| **Total** | **6-9 hours** |

If Claude Code is efficient and existing code is close to working, could be 4-6 hours.
If significant rewriting needed, could be 8-12 hours.

---

## End State

When complete, you should be able to:

1. Run `wails dev -tags webkit2_41`
2. Wait 2 minutes
3. See real screenshots in Timeline
4. See real stats in Analytics
5. Close app, reopen, data persists
6. All tests pass: `go test ./... -tags integration`
