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

### Tech Stack
- **Backend:** Go 1.21+ with Wails v2 (desktop framework)
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS
- **Database:** SQLite with sql-migrate
- **UI:** Radix UI primitives, Lucide icons, Recharts

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

#### 4. API Client Pattern
Frontend uses a typed API client with React Query hooks:

```typescript
// api/client.ts - Thin wrapper around Wails bindings
export const api = {
  timeline: {
    getGridData: (date: string) => GetTimelineGridData(date),
  },
  issues: {
    report: (req: IssueReportRequest) => ReportIssue(req),
  }
}

// api/hooks.ts - React Query hooks
export function useTimelineGridData(date: string) {
  return useQuery({
    queryKey: ['timeline', 'grid', date],
    queryFn: () => api.timeline.getGridData(date),
  })
}
```

---

## Key Directories

```
/internal/
├── config/         # App configuration
├── platform/       # Platform-specific code (X11, macOS, Windows)
├── service/        # Business logic (THIS IS WHERE MOST CODE LIVES)
│   ├── appnames.go     # Process name → friendly name mapping
│   ├── timeline.go     # Timeline + screenshots
│   ├── timeline_grid.go # Timeline v3 grid data
│   ├── analytics.go    # Charts and stats
│   ├── reports.go      # Report generation
│   ├── issues.go       # Issue reporting + Slack webhook
│   └── config.go       # Settings management
├── storage/        # Database layer (SQLite)
│   ├── models.go       # DB types (use sql.NullString)
│   ├── migrations.go   # Schema migrations
│   └── *.go            # CRUD operations
└── tracker/        # Screenshot capture daemon

/frontend/src/
├── api/            # API client + React Query hooks
├── components/
│   ├── common/     # Shared components (ErrorBoundary, ReportIssueDialog)
│   ├── layout/     # AppLayout, Sidebar, SettingsDrawer
│   └── timeline/   # Timeline v3 components
├── pages/          # Route pages
└── types/          # TypeScript types
```

---

## Core User Journeys

### 1. Daily Review ("What did I do today?")
- User opens Timeline page
- Sees hour-by-hour grid with app activity blocks
- AI summaries show session descriptions
- Can click into any hour to see screenshots

### 2. Productivity Analysis ("Where does my time go?")
- User visits Analytics page
- Views app usage breakdown (pie chart, table)
- Checks hourly activity heatmap
- Sees category distribution (Focus, Meetings, Comms, Other)

### 3. Report Generation ("I need a standup update")
- User goes to Reports page
- Selects date range (natural language: "yesterday", "last week")
- Generates report (Summary, Detailed, or Standup format)
- Exports as Markdown, HTML, or JSON

### 4. Screenshot Browser ("Show me what I was doing at 3pm")
- User goes to Screenshots page
- Browses by date, filters by hour
- Views full screenshots with window context
- Can see which session each screenshot belongs to

### 5. Issue Reporting ("Something's broken")
- User clicks "Report Issue" in sidebar
- Fills description, selects severity
- System auto-attaches context (recent screenshots, config)
- Optionally sends to Slack webhook

---

## Recent Implementations

### Issue Reporting System (2026-01-11)
- **Backend:** `issue_reports` table, CRUD in storage/issues.go, Slack webhook support
- **Frontend:** ReportIssueDialog, GlobalErrorHandler, enhanced ErrorBoundary
- **Config:** Webhook URL in Settings → System tab

### App Name Mapping (2026-01-11)
- **Backend:** `/internal/service/appnames.go` with 150+ mappings
- Applied everywhere: Timeline, Analytics, Screenshots, Reports
- Smart fallback: cleans dev suffixes, title-cases unknown apps

### Timeline v3 Grid (2026-01-10)
- Hour-based grid with app columns
- AI Summary column with session summaries
- Daily stats sidebar (total time, category breakdown)
- Categorization rules system

---

## Common Tasks

### Adding a New API Endpoint

1. Add method to `App` struct in `app.go`:
```go
func (a *App) MyNewMethod(param string) (*service.MyType, error) {
    return a.timelineService.MyNewMethod(param)
}
```

2. Regenerate bindings: `wails dev` or `wails generate bindings`

3. Add to API client (`frontend/src/api/client.ts`):
```typescript
myNew: {
  method: (param: string) => MyNewMethod(param),
}
```

4. Add React Query hook (`frontend/src/api/hooks.ts`):
```typescript
export function useMyNewMethod(param: string) {
  return useQuery({
    queryKey: ['myNew', param],
    queryFn: () => api.myNew.method(param),
  })
}
```

### Adding a Database Migration

1. Add migration in `/internal/storage/migrations.go`:
```go
{
    ID:   8,
    Name: "add_my_new_table",
    Up:   "CREATE TABLE my_new_table (...);",
    Down: "DROP TABLE my_new_table;",
}
```

2. Add storage methods in `/internal/storage/my_new.go`

3. Add service layer types and methods if needed

---

## E2E Testing (Playwright)

User journey tests are in `/frontend/e2e/`. Run with `wails dev` running:

```bash
cd frontend
npx playwright test
```

### Test Coverage by User Journey

| Journey | Test File | Page Object |
|---------|-----------|-------------|
| Daily Review | `timeline.spec.ts` | `timeline.page.ts` |
| Day View | `day.spec.ts` | `day.page.ts` |
| Productivity Analysis | `analytics.spec.ts` | `analytics.page.ts` |
| Report Generation | `reports.spec.ts` | `reports.page.ts` |
| Screenshot Browser | `screenshots.spec.ts` | `screenshots.page.ts` |
| Issue Reporting | `issue-reporting.spec.ts` | `issue-dialog.ts` |
| Settings | `settings.spec.ts` | `settings-drawer.ts` |

### Running Tests

```bash
# Run all tests
npx playwright test

# Run specific test file
npx playwright test analytics.spec.ts

# Run with UI
npx playwright test --ui

# Run headed (see browser)
npx playwright test --headed
```

### Adding New Tests

1. Create page object in `e2e/pages/`
2. Add to fixtures in `e2e/fixtures/test-fixtures.ts`
3. Create test file in `e2e/tests/`

---

## Known Issues & Quirks

- **Hash routing required:** App uses `/#/path` routing for Wails compatibility
- **webkit2gtk-4.1:** Ubuntu 24.04+ needs `-tags webkit2_41` build flag
- **Port 34115:** Dev server always runs here, don't look for other ports

---

## File Quick Reference

| What | Where |
|------|-------|
| Wails bindings (all APIs) | `/app.go` |
| App name mapping | `/internal/service/appnames.go` |
| Timeline grid logic | `/internal/service/timeline_grid.go` |
| Screenshot handling | `/internal/service/timeline.go`, `screenshots.go` |
| Analytics calculations | `/internal/service/analytics.go` |
| Report generation | `/internal/service/reports.go` |
| Issue reporting | `/internal/service/issues.go` |
| DB models | `/internal/storage/models.go` |
| DB migrations | `/internal/storage/migrations.go` |
| API client | `/frontend/src/api/client.ts` |
| React Query hooks | `/frontend/src/api/hooks.ts` |
| Settings UI | `/frontend/src/components/layout/SettingsDrawer.tsx` |
| Timeline UI | `/frontend/src/components/timeline/` |
| UX backlog | `/UI_BACKLOG.md` |
| Full spec | `/TRAQ_SPEC.md` |
