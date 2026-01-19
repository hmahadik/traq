# Project Assignment Improvements Design

## Overview

Improve project assignment UX with bulk operations, working backfill, and auto-assignment toggle.

## Problem

1. **Bulk delete** - No way to select multiple projects for deletion
2. **Broken backfill** - Only uses learned patterns (git_repo type), doesn't match focus events
3. **No auto-assign** - Users must manually run backfill; no "set and forget" option
4. **Confusing Settings section** - Called "Backfill" instead of "Projects"

## Solution

### 1. Fix Backfill Backend

**File:** `internal/service/backfill.go`

Add ReportsService dependency and use detection functions as fallback:

```go
type BackfillService struct {
    store    *storage.Store
    projects *ProjectAssignmentService
    reports  *ReportsService  // NEW
}
```

In `processBackfill()`, after pattern matching fails:
1. Try `reports.DetectProjectFromWindowTitle(windowTitle, appName)`
2. Look up project by detected name
3. Assign if found

Also process git commits (not just focus events) using `DetectProjectFromGitRepo()`.

### 2. Projects Page - Selection Mode

**File:** `frontend/src/pages/ProjectsPage.tsx`

Add toggle selection mode for bulk delete:

**State:**
```tsx
const [selectionMode, setSelectionMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
```

**Header behavior:**
- Default: Shows "New Project" button
- Selection mode: Shows "Select All" checkbox + "Delete Selected (N)" + "Cancel"

**Card behavior in selection mode:**
- Checkbox appears in top-left corner
- Clicking card toggles selection

**Bulk delete:**
- Confirmation dialog shows count
- Loops through selected IDs and deletes

### 3. Projects Page Banner Update

**Current:**
```
"You have 18,998 activities without project assignments. Assign them to help Traq learn your patterns."
```

**New:**
```
"You have 18,998 activities without project assignments." [Configure in Settings →]
```

Link navigates to `/#/settings/projects`.

### 4. Settings - Rename "Backfill" to "Projects"

**Files:**
- `frontend/src/components/settings/SettingsSidebar.tsx`
- `frontend/src/pages/SettingsPage.tsx`
- `frontend/src/components/settings/sections/BackfillSettings.tsx` → `ProjectsSettings.tsx`

**Changes:**
- Sidebar label: "Backfill" → "Projects"
- Sidebar icon: History → FolderKanban
- Route: `/settings/backfill` → `/settings/projects`

### 5. Settings - Add Auto-Assignment Toggle

**File:** `frontend/src/components/settings/sections/ProjectsSettings.tsx`

Add new card above existing Backfill card:

```
┌─────────────────────────────────────────────────┐
│ Auto-Assignment                                 │
│ Automatically assign activities to projects    │
│                                                 │
│ Auto-assign new activities        [━━━━━━●━]   │
└─────────────────────────────────────────────────┘
```

**Backend:**
- New config key: `projects.auto_assign` (boolean)
- New storage methods: `GetProjectsAutoAssign()`, `SetProjectsAutoAssign()`

**Note:** Actually assigning new activities requires daemon integration - out of scope for this task. The toggle stores the preference; daemon implementation is separate.

## Files to Modify

| File | Changes |
|------|---------|
| `internal/service/backfill.go` | Add ReportsService, use detection functions |
| `app.go` | Update BackfillService constructor |
| `frontend/src/pages/ProjectsPage.tsx` | Add selection mode, update banner |
| `frontend/src/components/settings/SettingsSidebar.tsx` | Rename Backfill → Projects |
| `frontend/src/pages/SettingsPage.tsx` | Update route |
| `frontend/src/components/settings/sections/BackfillSettings.tsx` | Rename to ProjectsSettings, add auto-assign toggle |
| `frontend/src/components/settings/sections/index.ts` | Update export |
| `internal/storage/config.go` | Add auto_assign config methods |
| `frontend/src/api/hooks.ts` | Add useProjectsAutoAssign hook |

## Verification

1. `go test ./internal/...` - all tests pass
2. `npm test --prefix frontend` - all tests pass
3. Manual test:
   - Delete all projects
   - Reload page → projects auto-discovered
   - Go to Settings → Projects
   - Run backfill preview → should show matches (not 0)
   - Run backfill → activities get assigned
   - Go to Projects page
   - Enter selection mode → select multiple → bulk delete
