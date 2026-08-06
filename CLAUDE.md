# Traq - Claude Code Context

## Quick Reference

**Local dev port:** 34115 (NOT 5173, 5174, etc. - always 34115!)

**Build command:** `wails dev -tags webkit2_41` (Ubuntu 24.04+)

**Test commands:**
- Backend: `go test ./...`
- Frontend: `cd frontend && npm test`

---

## Project Overview

Traq is a **privacy-first desktop activity tracker** that:
1. Captures screenshots at regular intervals
2. Tracks window focus (app name + window title)
3. Groups activity into sessions with AFK detection
4. Provides timeline visualization, analytics, and report generation

**Key differentiator:** 100% local - no cloud, no accounts, no data leaves the machine.

---

## Architecture

### Core Patterns

#### 1. Wails Bindings
Go methods on `App` struct become callable from frontend via generated TypeScript bindings.

```go
// In app.go
func (a *App) GetTimelineGridData(date string) (*service.TimelineGridData, error)

// Generates frontend/wailsjs/go/main/App.ts
// Called from React: await GetTimelineGridData("2026-01-11")
```

After changing `app.go`, run `wails generate bindings` or `wails dev` to regenerate.

#### 2. Service Layer Types
Storage layer uses `sql.NullString` for nullable fields. Service layer converts to plain types for frontend:

```go
// storage/models.go - DB types
type Screenshot struct {
    AppName sql.NullString  // Nullable in DB
}

// service/timeline.go - Frontend types
type ScreenshotDisplay struct {
    AppName string  // Clean for JSON
}
```

#### 3. App Name Mapping
Technical process names are converted to friendly display names:
- `google-chrome` → "Chrome"
- `tilix` → "Terminal"
- `code` → "VS Code"
- `traq-dev-linux-amd64` → "Traq"

See `/internal/service/appnames.go` for the full mapping (150+ entries).

---

## Common Workflows

Step-by-step recipes (add an API endpoint, add a DB migration, run/extend Playwright E2E tests) live in the `traq-recipes` skill: `.claude/skills/traq-recipes/SKILL.md`.

---

## Known Issues & Quirks

- **Hash routing required:** App uses `/#/path` routing for Wails compatibility
- **webkit2gtk-4.1:** Ubuntu 24.04+ needs `-tags webkit2_41` build flag
- **Port 34115:** Dev server always runs here, don't look for other ports

---

## More Context

- UX backlog: `/UI_BACKLOG.md`
- Full spec: `/TRAQ_SPEC.md`
