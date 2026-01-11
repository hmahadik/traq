# Traq UI/UX Backlog

**Last Updated:** 2026-01-11
**Last Audit:** Comprehensive User Journey Walkthrough (4 core journeys)

---

## Critical Priority (Journey-Breaking Issues)

### 1. ActivityBlock Not Clickable - Core Interaction Broken
**Severity:** CRITICAL | **Journey:** Daily Review

**Problem:** Activity blocks in the timeline grid show `cursor-pointer` CSS but have NO onClick handler. Users cannot click to drill into activities or see associated screenshots.

**File:** `/frontend/src/components/timeline/ActivityBlock.tsx` (lines 75-81)

**Current code:**
```typescript
<div
  className={`... cursor-pointer ...`}  // Cursor says clickable
  style={{ top, height }}
>  // But no onClick!
```

**Impact:** Core workflow blocked. Users can hover (see tooltip) but cannot navigate to session details or screenshots from the main timeline view.

**Solution:**
- Add `onClick` handler to open ImageGallery for that activity's time range
- Or navigate to session detail modal with screenshots and context

---

### 2. AISummaryColumn Blocks Not Clickable
**Severity:** CRITICAL | **Journey:** Daily Review

**Problem:** Session summary blocks have `cursor-pointer` but no onClick handler. Users cannot navigate to session details.

**File:** `/frontend/src/components/timeline/AISummaryColumn.tsx` (lines 144-149)

**Impact:** Cannot drill into session details from AI summary column.

**Solution:** Add onClick to navigate to session detail view or open modal.

---

### 3. JSON Export Produces Invalid JSON
**Severity:** CRITICAL | **Journey:** Report Generation

**Problem:** JSON export uses raw `fmt.Sprintf` without escaping quotes, newlines, or special characters.

**File:** `/internal/service/reports.go` (line 343)
```go
return fmt.Sprintf(`{"title":"%s","content":"%s"}`, report.Title, content), nil
```

**Impact:** Any report with quotes or newlines produces unparseable JSON. Complete data corruption.

**Solution:** Use `encoding/json.Marshal()` instead of string interpolation.

---

### 4. Report Export Doesn't Download Files
**Severity:** CRITICAL | **Journey:** Report Generation

**Problem:** Export API returns string content but frontend doesn't trigger browser download.

**Files:**
- `/frontend/src/pages/ReportsPage.tsx` (lines 92-94)
- API returns content, frontend does nothing with it

**Impact:** All four export formats (MD, HTML, PDF, JSON) appear to work but no file is saved. Users think feature is broken.

**Solution:** Create blob from response, use `URL.createObjectURL()`, trigger download with `<a>` click.

---

### 5. Delete Report Button Is No-Op
**Severity:** HIGH | **Journey:** Report Generation

**Problem:** Delete button logs to console instead of calling API.

**File:** `/frontend/src/pages/ReportsPage.tsx` (lines 144-147)
```javascript
const handleDeleteReport = (reportId: number) => {
  console.log('Delete report:', reportId);  // No-op!
};
```

**Impact:** Users cannot delete old reports. Report history grows unbounded.

**Solution:**
1. Add `DeleteReport` method to backend (app.go)
2. Add storage method to delete from database
3. Wire up frontend call with confirmation dialog

---

### 6. XSS Vulnerability in Markdown Rendering
**Severity:** HIGH | **Journey:** Report Generation (Security)

**Problem:** Using `dangerouslySetInnerHTML` with user content that's only regex-processed, not sanitized.

**File:** `/frontend/src/components/reports/ReportPreview.tsx` (line 220)
```typescript
elements.push(
  <p key={index} dangerouslySetInnerHTML={{ __html: processedLine }} />
);
```

**Attack vector:** `**<img src=x onerror=alert('XSS')>**` would execute arbitrary JS.

**Solution:** Use a proper markdown library (react-markdown, marked) with sanitization.

---

### 7. AppUsageTable Data Field Mismatch
**Severity:** HIGH | **Journey:** Productivity Analysis

**Problem:** Frontend expects `app.sessionCount` but backend provides `app.focusCount`.

**File:** `/frontend/src/components/analytics/AppUsageTable.tsx` (line 141)

**Impact:** "Sessions" column shows `undefined` for every row.

**Solution:** Change `app.sessionCount` to `app.focusCount` or add sessionCount to backend.

---

### 8. Hour Filter Missing from Screenshots Page
**Severity:** HIGH | **Journey:** Screenshot Browser

**Problem:** README promises "filters by hour" but no hour filter UI exists despite backend supporting it.

**Files:**
- `/frontend/src/pages/ScreenshotsPage.tsx` - No hour filter control
- `/frontend/src/api/hooks.ts` (line 244) - `useScreenshotsForHour()` hook exists and works
- Backend `GetScreenshotsForHour()` is implemented

**Impact:** Users must scroll through entire day instead of jumping to "3pm activity".

**Solution:** Add hour dropdown that calls existing `useScreenshotsForHour()` hook.

---

## High Priority (User Journey Issues)

### 9. Focus Distribution Chart Shows Empty
**Severity:** HIGH | **Journey:** Productivity Analysis

**Problem:** Chart filters out ALL hours with `focusQuality > 0`, but includes hours with no activity.

**File:** `/frontend/src/components/analytics/FocusDistributionChart.tsx` (lines 50-51)
```typescript
const chartData = data?.filter((d) => d.focusQuality > 0)
```

**Impact:** If no activity before 2pm, hours 0-13 get filtered → chart appears empty.

**Solution:** Show all 24 hours, style "No Activity" hours differently (gray bars).

---

### 10. Heatmap Chart Disabled
**Severity:** HIGH | **Journey:** Productivity Analysis

**Problem:** HeatmapChart is commented out despite being fully implemented.

**File:** `/frontend/src/pages/AnalyticsPage.tsx` (line 368)
```typescript
{/* <HeatmapChart data={heatmapData} isLoading={heatmapLoading} /> */}
```

**Impact:** Missing day-of-week/hour activity patterns visualization.

**Solution:** Uncomment and verify it works (5-minute fix).

---

### 11. Custom Date Range Timestamp Bug
**Severity:** HIGH | **Journey:** Productivity Analysis

**Problem:** `Date.setHours()` mutates original date object during render.

**File:** `/frontend/src/pages/AnalyticsPage.tsx` (lines 149-150)
```typescript
const customStartTs = Math.floor(customRange.start.setHours(0, 0, 0, 0) / 1000);
const customEndTs = Math.floor(customRange.end.setHours(23, 59, 59, 999) / 1000);
```

**Impact:** Date picker values modified unexpectedly during render, causing weird state issues.

**Solution:** Clone dates before calling setHours():
```typescript
const startClone = new Date(customRange.start);
const customStartTs = Math.floor(startClone.setHours(0, 0, 0, 0) / 1000);
```

---

### 12. Missing Image Error Handling
**Severity:** MEDIUM | **Journey:** Screenshot Browser

**Problem:** If screenshot file deleted from disk but DB record exists, broken image shows.

**File:** `/frontend/src/pages/ScreenshotsPage.tsx` (lines 356-363)

**Solution:** Add `onError` handler with placeholder image and "File not found" message.

---

### 13. Markdown Tables Not Rendered
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Detailed reports generate markdown tables but preview shows raw `| text |` syntax.

**File:** `/frontend/src/components/reports/ReportPreview.tsx` (lines 154-225)

**Solution:** Add table parsing to `RenderedMarkdown` component.

---

### 14. Markdown Bold Not Rendering in Headers
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Bold works in paragraphs but NOT in headers, lists, or blockquotes.

**File:** `/frontend/src/components/reports/ReportPreview.tsx` (lines 182-211)

**Example:** `### **Session Title**` renders as `<h3>**Session Title**</h3>` (not bold)

**Solution:** Apply markdown syntax processing to ALL content types, not just paragraphs.

---

### 15. Screenshots in Report Exports Broken
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Report markdown includes `![Screenshot](/absolute/path/...)` which won't work in exports.

**File:** `/internal/service/reports.go` (lines 175-196)

**Impact:** Screenshot references in exported files point to local filesystem paths that won't work outside the app.

**Solution:** Either embed base64 images or use relative paths with copied files.

---

### 16. strings.Title() Deprecated - Build May Fail
**Severity:** HIGH | **Journey:** Report Generation (Build)

**Problem:** `strings.Title()` was deprecated in Go 1.18 and removed in Go 1.20+.

**File:** `/internal/service/reports.go` (line 106)
```go
Title: fmt.Sprintf("%s Report: %s", strings.Title(reportType), tr.Label),
```

**Impact:** Code won't compile on Go 1.20+.

**Solution:** Use `cases.Title(language.English).String(reportType)` from `golang.org/x/text`.

---

### 17. TypeScript Types Don't Match Backend
**Severity:** MEDIUM | **Journey:** Productivity Analysis

**Problem:** Frontend TypeScript interfaces don't match Go backend structs exactly.

**File:** `/frontend/src/types/analytics.ts` (lines 75-121)

**Examples:**
- Frontend: `repositories: RepositoryStats[]`
- Backend: `topRepos: []*RepoUsage`

**Impact:** Silent data loss or undefined behavior when rendering.

**Solution:** Align TypeScript interfaces exactly with Go struct JSON tags.

---

## Medium Priority (UX Issues)

### 18. No Session Context on Screenshots Grid
**Severity:** MEDIUM | **Journey:** Screenshot Browser

**Problem:** Thumbnails show app name and time but not window title or session info.

**File:** `/frontend/src/pages/ScreenshotsPage.tsx` (lines 366-371)

**Solution:** Add window title as truncated subtitle, show session badge on hover.

---

### 19. Timeline Grid Error States Missing
**Severity:** MEDIUM | **Journey:** Daily Review

**Problem:** `useTimelineGridData` can error but page only checks `isLoading` and `data`, never `isError`.

**File:** `/frontend/src/pages/TimelinePage.tsx` (lines 36, 179-276)

**Impact:** Errors show misleading "No data available" instead of actual error.

**Solution:** Check `isError` and show descriptive error message.

---

### 20. Batch Summary Generation Doesn't Refresh
**Severity:** MEDIUM | **Journey:** Daily Review

**Problem:** After batch summary generation completes, UI doesn't refresh to show new summaries.

**File:** `/frontend/src/pages/TimelinePage.tsx` (lines 50-76)

**Solution:** Invalidate `timeline.gridData` query after successful generation.

---

### 21. No Pagination for Screenshots
**Severity:** MEDIUM | **Journey:** Screenshot Browser

**Problem:** Page fetches ALL screenshots for entire day at once.

**Impact:** Slow performance on days with 500+ screenshots.

**Solution:** Add pagination or virtual scrolling.

---

### 22. Hardcoded 16:9 Aspect Ratio
**Severity:** MEDIUM | **Journey:** Screenshot Browser

**Problem:** Screenshot thumbnails use hardcoded `aspect-video` (16:9).

**File:** `/frontend/src/pages/ScreenshotsPage.tsx` (line 356)

**Impact:** Screenshots from ultrawide or portrait monitors get cropped/distorted.

**Solution:** Use actual monitor dimensions from data (MonitorWidth, MonitorHeight available).

---

### 23. Natural Language Date Parsing Edge Cases
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Time range parser has edge cases:
- "Past N days" arithmetic may be off by one
- Month names without year fail to parse
- Dash-separated ranges ("Jan 5 - Jan 20") not supported despite placeholder suggesting it

**File:** `/internal/service/reports.go` (lines 606-691)

**Solution:** Add proper range parsing and improve error messages.

---

### 24. Include Screenshots Toggle Doesn't Affect Exports
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Toggle works for preview but export doesn't receive the flag.

**Files:**
- `/frontend/src/pages/ReportsPage.tsx` (lines 62, 87, 197)

**Impact:** Screenshots in generated report disappear in exports.

**Solution:** Pass `includeScreenshots` to export API.

---

### 25. No Report History Pagination
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Fetches ALL reports every time, no pagination.

**File:** `/internal/service/reports.go` (line 481)

**Impact:** Memory grows unbounded with many reports.

**Solution:** Add limit/offset pagination.

---

## Lower Priority (Polish)

### 26. Timeline v3 Interactions
- [ ] Hover tooltips on ActivityBlocks - reduce delay from 200ms to 100ms
- [ ] Apply gradient backgrounds to bars/cards
- [ ] Horizontal scroll for overlapping activities
- [ ] Keyboard shortcuts for prev/next day navigation

### 27. Accessibility Pass
- [ ] Add `role="button"`, `aria-label` to ActivityBlock
- [ ] Add `aria-label` to AISummaryColumn blocks
- [ ] Focus management for modal dialogs
- [ ] Screen reader support for charts

### 28. Performance Optimization
- [ ] Virtual scrolling for ImageGallery thumbnail strip (200+ screenshots)
- [ ] Pagination for Screenshots page date view (1000+ per day)
- [ ] React.memo for frequently re-rendering components

### 29. Missing Preview Keyboard Navigation
**Journey:** Screenshot Browser

**Problem:** Preview modal has no arrow keys to navigate between screenshots.

**Solution:** Add left/right arrow key handlers to navigate.

### 30. Hourly Activity Approximation Misleading
**Journey:** Productivity Analysis

**Problem:** Backend estimates active minutes from screenshot count (assumes 1 screenshot = 2 minutes).

**File:** `/internal/service/analytics.go` (line 575)

**Impact:** "Hourly Activity" chart shows approximate data, not actual tracked time.

**Solution:** Document the approximation or calculate from actual session times.

---

## Completed (Reference)

### App Name Mapping (2026-01-11)
- [x] Created `/internal/service/appnames.go` with 150+ mappings
- [x] Applied to Timeline (grid, sessions, activity blocks)
- [x] Applied to Analytics (top apps, category breakdown)
- [x] Applied to Screenshots (screenshot info)
- [x] Applied to Reports (app usage tables)
- [x] Smart fallback: cleans dev suffixes, title-cases unknown apps

### Issue Reporting Feature (2026-01-11)
- [x] Backend: `issue_reports` table, CRUD, Slack webhook
- [x] Frontend: ReportIssueDialog, GlobalErrorHandler, enhanced ErrorBoundary
- [x] Sidebar Report button, Settings webhook config

### Timeline v3 Grid (2026-01-10)
- [x] Hour-based grid layout with app columns
- [x] AI Summary column with session summaries
- [x] Daily summary sidebar (stats, breakdown, top apps)
- [x] Categorization rules system with full CRUD
- [x] Skeleton loaders for loading states
- [x] All 32 tests passing

---

## Summary by Journey

| Journey | Status | Critical Issues | Blocking? |
|---------|--------|-----------------|-----------|
| **Daily Review** | BROKEN | ActivityBlock/AISummary not clickable | YES |
| **Productivity Analysis** | PARTIAL | AppUsageTable data mismatch, heatmap disabled | PARTIAL |
| **Report Generation** | BROKEN | JSON invalid, export doesn't download, delete no-op, XSS | YES |
| **Screenshot Browser** | PARTIAL | Hour filter missing, no image error handling | NO |

---

## Recommended Fix Priority

**Week 1 - Unblock Core Journeys:**
1. ActivityBlock onClick - #1 most impactful fix
2. AISummaryColumn onClick - complete timeline interactivity
3. Report Export Download - users think feature is broken
4. JSON Export Escaping - data corruption

**Week 2 - Fix Data/Display Issues:**
5. Delete Report handler - allow cleanup
6. AppUsageTable field name - silent failure
7. Hour Filter for Screenshots - missing promised feature
8. Heatmap Enable - 5-minute fix, high value

**Week 3 - Security & Polish:**
9. XSS fix in markdown - security vulnerability
10. strings.Title deprecation - build may fail
11. TypeScript type alignment - prevent silent failures
12. Image error handling - UX improvement
