# Traq - TODO

**Last Updated:** 2026-01-11

This file tracks outstanding work, known issues, and future ideas.

For UX-specific issues and priorities, see [UI_BACKLOG.md](./UI_BACKLOG.md).

---

## Current Sprint

### High Priority

- [ ] **Global Search** - Search across all history, not just selected day
  - Add "Search All" mode to timeline search
  - Create global search API endpoint
  - Show results grouped by date

- [ ] **Markdown Rendering in Reports** - Report preview shows raw `**bold**` syntax
  - Fix in `/frontend/src/pages/ReportsPage.tsx`
  - Add react-markdown or use existing renderer

### Medium Priority

- [ ] **Focus Distribution Chart** - Sometimes empty on Analytics page
  - Debug: check if data exists or display issue
  - Files: `/frontend/src/pages/AnalyticsPage.tsx`, `/internal/service/analytics.go`

- [ ] **Screenshot Labels** - Paths are long absolute paths
  - Show just filename or "App - HH:MM" format

### Polish

- [ ] **Timeline v3 Hover Tooltips** - Show details on activity block hover
  - Create `ActivityTooltip.tsx` component
  - Show: activity name, time range, duration

- [ ] **Timeline v3 Click Interactions** - Click activity to see details

---

## Tech Debt

- [ ] **Delete deprecated timeline components** (after confirming v3 is stable)
  - `TimelineBands.tsx`
  - `TimelineStats.tsx`
  - `TimelineTags.tsx`

- [ ] **Update internal/inference/ folder** - Currently marked as "planned" but empty
  - Either implement local inference or remove the folder

- [ ] **macOS support** - Marked as supported but partially implemented
  - Need testing and platform-specific fixes

- [ ] **Windows support** - Marked as supported but partially implemented
  - Need testing and platform-specific fixes

---

## Future Ideas (from TRAQ_SPEC.md)

### Near-term (P1/P2)

- [ ] Bundled local AI model (offline inference without external APIs)
- [ ] Screenshot OCR search
- [ ] Custom categories and tags (user-defined)
- [ ] Data retention policies (auto-delete old data)
- [ ] Full tag/time/app filtering on Timeline

### Long-term (P3)

- [ ] Unified timeline mixing git commits, file changes, screenshots
- [ ] Calendar integration (import events for context)
- [ ] Plugin/extension system
- [ ] Export all data for backup/migration

---

## Completed (Archive)

### 2026-01-11
- [x] **App Name Mapping** - 150+ app mappings for friendly display names
- [x] **Issue Reporting** - In-app bug reporting with Slack webhook

### 2026-01-10
- [x] **Timeline v3 Grid** - Hour-based grid with app columns
- [x] **AI Summary Column** - Session summaries in grid
- [x] **Categorization Rules** - Focus/Meetings/Comms/Other with CRUD

---

## Notes

- Timeline v2 implementation details were archived (previously in this file)
- Reference HTML mockups are in `/screenshots/references/`
- Full product spec is in [TRAQ_SPEC.md](./TRAQ_SPEC.md)

# Miscellaneous Issues (Documented by a Human)

## Bugs

- [ ] Sessions that start before midnight and span through to the next day

## Features

- [ ] 
- [ ] Allow for prev/next browsing of screenshots in screenshots page
- [ ] Pre-fetch screenshot images to make navigating prev/next faster
- [ ] Hovering over an activity in timeline should show screenshot 