# Traq - Current Status & Remaining Work

## ✅ COMPLETED: Issue Reporting Feature

The issue reporting feature is fully implemented and working:

### Backend (Go) - DONE
- ✅ Database migration v7 (`/internal/storage/migrations.go`) - `issue_reports` table
- ✅ Storage layer (`/internal/storage/issues.go`) - CRUD operations + GetScreenshotIDsSince
- ✅ Service layer (`/internal/service/issues.go`) - Report creation with auto-attached context + Slack webhook support
- ✅ Wails bindings (`/app.go`) - ReportIssue, GetIssueReports, GetIssueReport, DeleteIssueReport, TestIssueWebhook

### Frontend (React) - DONE
- ✅ API client (`/frontend/src/api/client.ts`) - issues namespace
- ✅ React Query hooks (`/frontend/src/api/hooks.ts`) - useIssueReports, useReportIssue, useDeleteIssueReport
- ✅ Report dialog (`/frontend/src/components/common/ReportIssueDialog.tsx`) - manual reporting UI
- ✅ Global error handler (`/frontend/src/components/common/GlobalErrorHandler.tsx`) - unhandled errors
- ✅ Enhanced ErrorBoundary (`/frontend/src/components/common/ErrorBoundary.tsx`) - auto-report crashes
- ✅ Sidebar Report button (`/frontend/src/components/layout/Sidebar.tsx`)
- ✅ Settings webhook config (`/frontend/src/components/layout/SettingsDrawer.tsx`) - System tab
- ✅ App wrapped (`/frontend/src/components/layout/AppLayout.tsx`) - GlobalErrorHandler

### Fixes Applied
- ✅ Slack webhook 400 error - Fixed payload to use `text` field for Slack compatibility
- ✅ Report page crash "content.split is not a function" - Fixed by creating service-layer `Report` type with plain strings (not sql.NullString)

---

## 🔧 REMAINING UX ISSUES

Issues identified during user journey walkthrough:

### High Priority

#### 1. Technical App Names Everywhere
**Problem:** App names display as raw process names (e.g., "tilix", "google-chrome", "traq-dev-linux-amd64") instead of user-friendly names.

**Affected pages:** Timeline, Analytics, Screenshots, Reports

**Solution options:**
- A) Create app name mapping service with common overrides (tilix → "Terminal", google-chrome → "Chrome", code → "VS Code")
- B) Query desktop entry files for application names
- C) Hybrid: use desktop entries when available, fallback to mapping

**Files to modify:**
- `/internal/service/timeline.go` or new `/internal/service/appnames.go`
- Apply mapping at query time or in frontend

#### 2. Search Limited to Single Day
**Problem:** Search only works for the currently selected day on Timeline, not across all history.

**User expectation:** Global search across all captured data.

**Solution:**
- Add "Search All" mode to timeline search
- Create new API endpoint for global search across sessions
- Show results grouped by date

**Files to modify:**
- `/internal/storage/timeline.go` - Add global search query
- `/internal/service/timeline.go` - Add SearchAllSessions method
- `/app.go` - Expose SearchAllSessions
- Frontend search component to support global mode

### Medium Priority

#### 3. Markdown Bold Not Rendering in Reports
**Problem:** Report preview shows raw `**bold**` syntax instead of rendered bold text.

**Files to check:**
- `/frontend/src/components/pages/ReportsPage.tsx` - ReportPreview component
- Need to add markdown rendering (use existing markdown renderer or add react-markdown)

#### 4. Empty Focus Distribution Chart on Analytics
**Problem:** Focus Distribution pie chart sometimes shows empty/zero data.

**Root cause:** Need to investigate if data exists or if it's a display issue.

**Files to check:**
- `/frontend/src/components/pages/AnalyticsPage.tsx`
- `/internal/service/analytics.go` - GetFocusDistribution

### Low Priority

#### 5. Truncated Screenshot Paths
**Problem:** Screenshot file paths in labels are long absolute paths instead of just filename or relative.

**Files to modify:**
- Frontend components displaying screenshot labels
- Show just filename or "App - HH:MM" format

---

## Next Steps (Recommended Order)

1. **App Name Mapping** - This is the most visible UX issue affecting multiple pages
2. **Global Search** - Important for finding historical activity
3. **Markdown Rendering** - Quick fix for report preview
4. **Focus Distribution Debug** - May be data issue
5. **Screenshot Labels** - Polish item

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `/internal/service/issues.go` | Issue reporting + webhook |
| `/internal/service/reports.go` | Report generation with service types |
| `/app.go` | All Wails bindings |
| `/frontend/src/api/client.ts` | API client pattern |
| `/frontend/src/components/layout/SettingsDrawer.tsx` | Webhook config in System tab |
