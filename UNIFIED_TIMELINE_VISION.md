# Unified Timeline Vision

## Overview

This document describes a future enhancement for Traq: integrating all data sources (git commits, shell commands, file events, browser visits) directly into the Timeline view alongside screenshots and app activity.

## Current State (v1.0 - Production Ready)

**What works today:**
- Timeline shows hour-by-hour grid with app activity blocks
- AI summaries describe work sessions
- Screenshots visible in grid with click-to-view gallery
- Data sources tracked in background (git, shell, files, browser)
- Data sources **viewable in Analytics page** under "Data Sources" tab
- Reports include data source counts in overview

**User can currently:**
- See what apps they used at any time → Timeline
- Analyze productivity patterns → Analytics
- Generate reports with session summaries → Reports
- Review detailed git/shell/files/browser stats → Analytics > Data Sources

## Vision: Unified Timeline (Future Enhancement)

### Goal
Show ALL activity types inline in Timeline, creating a complete picture of work in chronological order.

### What Would Change

**Timeline view would show:**
- **Current:** App columns with activity blocks + AI summaries + screenshots
- **Future:** App columns + Git column + Shell column + Files column + Browser column

**Example Timeline (unified):**
```
Hour    AI Summary              Terminal    Chrome    VS Code    Git          Shell           Files
12 PM   Debugging auth bug      ████████    ███       ████       📝 Fix bug   $ npm test     📄 auth.ts modified
        Fixed login issues                                       📝 Add test  $ git commit   📄 auth.test.ts created
        25 minutes
```

### Features to Implement

#### 1. Inline Event Display (Tests 56-59)
- Git commits appear as blocks in Git column at commit timestamp
- Shell commands appear in Shell column at execution time
- File events appear in Files column when created/modified/deleted
- Browser visits appear in Browser column at navigation time

**Backend needed:**
- New API: `GetTimelineEvents(date, eventTypes[])` that returns mixed events
- Event type: `{type: "git"|"shell"|"file"|"browser", timestamp, data}`

**Frontend needed:**
- New columns: `<GitColumn>`, `<ShellColumn>`, `<FilesColumn>`, `<BrowserColumn>`
- Event block components for each type
- Click handlers to show event details

#### 2. Event Filtering (Test 60)
- Toggle switches to show/hide each event type
- "Show: [✓] Apps [✓] Git [✓] Shell [✓] Files [✓] Browser [✓] Screenshots"
- Filters apply immediately without reload

**Implementation:**
- State management for active filters
- Conditional rendering of columns based on filters
- Preserve filter state in URL params or localStorage

#### 3. Activity Correlation (Test 61)
- Visual grouping of related events
- Example: Git commit + file changes + shell commands that happened together
- Clustering algorithm to identify related activities

**Challenge:**
- Define "related" - temporal proximity? Shared file paths? Commit message keywords?
- UI design for showing clusters without cluttering timeline

#### 4. Unified Search (Test 62)
- Search box finds events across ALL data sources
- "Search: auth" finds:
  - Git commits mentioning "auth"
  - Files with "auth" in path
  - Browser visits to auth-related pages
  - Screenshots with "auth" in window title

**Backend needed:**
- Full-text search across all event types
- Ranking/relevance scoring

**Frontend needed:**
- Search UI component
- Results list with jump-to-timeline functionality

#### 5. Reports with Event Timeline (Test 63)
- Reports include chronological event list
- Not just "21 git commits" but actual commit messages with timestamps
- Interleaved with session summaries

**Example report section:**
```markdown
## Event Timeline

- 9:15 AM - Started "Debugging authentication" session
- 9:22 AM - Modified src/auth/login.ts (file event)
- 9:30 AM - Committed "Fix login validation bug" (git)
- 9:35 AM - Ran `npm test` (shell)
- 9:40 AM - All tests passing ✓
- 9:45 AM - Session ended
```

#### 6. Full Context Reconstruction (Test 64)
- Given a past date, reconstruct the complete story:
  - What was on screen (screenshots)
  - What code changed (git commits)
  - What commands ran (shell)
  - What was researched (browser)

**This is the ultimate goal:** time travel with full context.

## Technical Architecture

### Backend API Changes

**New endpoint:**
```go
func (a *App) GetTimelineEventsForDate(date string, eventTypes []string) (*TimelineEvents, error)
```

**Returns:**
```go
type TimelineEvents struct {
    Date       string
    GitCommits []GitEventDisplay
    ShellCmds  []ShellEventDisplay
    FileEvents []FileEventDisplay
    BrowserVisits []BrowserEventDisplay
}

type GitEventDisplay struct {
    Timestamp     int64
    Message       string
    Repository    string
    Author        string
    InsertionsDeletions string
}
// Similar structs for other event types
```

### Frontend Component Structure

**New components:**
- `components/timeline/GitColumn.tsx`
- `components/timeline/ShellColumn.tsx`
- `components/timeline/FilesColumn.tsx`
- `components/timeline/BrowserColumn.tsx`
- `components/timeline/EventBlock.tsx` (generic)
- `components/timeline/EventFilterBar.tsx`

**Modified components:**
- `TimelineGridView.tsx` - add event columns, filtering logic
- `TimelinePage.tsx` - fetch event data, manage filter state

### UI/UX Considerations

**Challenges:**
1. **Screen real estate:** Adding 4 new columns makes grid very wide
   - Solution: Collapsible columns? Horizontal scroll? Priority-based display?

2. **Visual noise:** Too many events could clutter the view
   - Solution: Grouping, smart summarization, hide low-importance events?

3. **Performance:** Loading 4 new data sources for each day
   - Solution: Lazy loading, virtual scrolling, aggressive caching

4. **Information overload:** Users might not need all event types all the time
   - Solution: Default to showing only screenshots + apps, let users opt-in to events

## Implementation Phases

### Phase 1: Single Event Type (Proof of Concept)
- Add just Git column to Timeline
- Implement filtering for git events only
- Test performance and UX

**Effort:** 1-2 days

### Phase 2: All Event Types
- Add Shell, Files, Browser columns
- Implement comprehensive filtering
- Polish UI with proper spacing and colors

**Effort:** 2-3 days

### Phase 3: Search and Correlation
- Unified search across all events
- Activity clustering/correlation
- Advanced filtering (by repo, by file type, by domain, etc.)

**Effort:** 3-5 days

### Phase 4: Reports Integration
- Include event timeline in reports
- Full context reconstruction feature

**Effort:** 2-3 days

**Total estimated effort:** 8-13 days (multiple sessions)

## Why Not Implement Now?

1. **Not in original spec** - This is a "nice to have," not a requirement
2. **Current solution sufficient** - Data sources accessible in Analytics page
3. **Diminishing returns** - 85.9% feature complete, remaining features are speculative
4. **Architectural risk** - Major changes to Timeline component could introduce bugs
5. **User research needed** - Should validate users actually want this before building it

## When to Implement

**Implement unified timeline when:**
- Users explicitly request it (feature request, user feedback)
- Current Analytics view proves insufficient for user needs
- After gathering data on which event types users care about most
- As a v2.0 major feature with proper design planning

**For now:**
- Ship v1.0 with current 85.9% feature set
- Monitor user behavior in Analytics > Data Sources tab
- Collect feedback on what timeline enhancements would be most valuable

## Alternative Approaches

Instead of inline events, consider:

1. **Hover-based context:** Hover over timeline → tooltip shows related git/shell/file/browser events
2. **Expandable rows:** Click hour → expands to show all events in that hour
3. **Side panel:** Selected time range → side panel shows related events
4. **Separate page:** "Event Inspector" page that shows unified view for selected time range

These alternatives avoid cluttering the Timeline while still providing access to full context.

## Conclusion

The unified timeline is a compelling vision for v2.0+. It would provide unprecedented insight into work patterns. However, it's not essential for v1.0, and the current 85.9% feature set meets all requirements from the original spec.

**Current milestone: COMPLETE ✓**

**Next milestone: Unified Timeline (future)**
