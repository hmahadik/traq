# Timely-Style Timeline - Corrected Implementation Plan

**Goal:** Transform Timeline page to match Timely's new Timeline View exactly

**Reference:** `/screenshots/references/` - Timely screenshots and documentation

---

## Critical Corrections from Original Plan

The original plan had fundamental misunderstandings. Here's what Timely ACTUALLY does:

### What We Got WRONG:

1. **NOT "dynamic lanes based on overlap"** - Timely uses **FIXED APP-BASED COLUMNS**
   - Each tracked app (VS Code, Chrome, Calendar, Slack) gets its own dedicated column
   - The rightmost column is "Your Memories" showing grouped activity
   - This is NOT a dynamic lane algorithm - it's a simple per-app column layout

2. **NOT "SessionSidebar with summaries"** - It's a **TIMESHEET PANEL**
   - Shows logged TIME ENTRIES tied to PROJECTS (not sessions)
   - Each entry shows: Project name, duration, billable amount
   - Colors represent PROJECTS, not apps
   - Apps are identified by their icons, not colors

3. **Missing the SUMMARY LANE** - Timely has a special collapsible lane
   - Shows the most active memory per time interval (default 15min)
   - Can be toggled on/off
   - Shows activity titles with time ranges

4. **Missing COLUMN HEADERS** - Each app column has:
   - App icon + name + total time (e.g., "Visual Studio Code 7h 6min")
   - Clickable for actions: Configure, Add all to time entry, Remove all

---

## Chunk 1: Core Multi-Column Layout ✅ (Completed)

This was marked complete but needs verification against the new understanding.

---

## Chunk 2: App-Column Timeline Grid

**What we'll build:**
- TimelineGrid component with hour axis + app columns
- AppColumn component (one per tracked app)
- Column headers showing app icon, name, and total time
- Activity blocks positioned vertically by time within each column

**Visual Reference:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│ EDT  │ VS Code 7h 6m │ Chrome 41m │ Calendar 30m │ Your Memories 9h 38m│
├──────┼───────────────┼────────────┼──────────────┼─────────────────────┤
│ 8 AM │ ┌───────────┐ │            │ ┌──────────┐ │ ┌─────────────────┐ │
│      │ │ VS Code   │ │            │ │ Calendar │ │ │ Terminal, GH    │ │
│      │ │ 30m       │ │            │ │ 30m      │ │ │ Slack, Meet     │ │
│      │ └───────────┘ │            │ └──────────┘ │ └─────────────────┘ │
│ 9 AM │ ┌───────────┐ │ ┌────────┐ │              │                     │
│      │ │ VS Code   │ │ │ Chrome │ │              │                     │
│      │ │ 50m       │ │ │ 4m     │ │              │                     │
│      │ └───────────┘ │ └────────┘ │              │                     │
│ ...  │               │            │              │                     │
└──────┴───────────────┴────────────┴──────────────┴─────────────────────┘
```

**Key Behaviors:**
- Columns are FIXED per app, not dynamically assigned
- Within a column, blocks stack vertically at their correct time positions
- Overlapping activities in DIFFERENT apps appear side-by-side at the same Y position
- Scrolls vertically through the day (not horizontally)

**Files to create:**
- `frontend/src/components/timeline/TimelineGrid.tsx`
- `frontend/src/components/timeline/AppColumn.tsx`
- `frontend/src/components/timeline/ColumnHeader.tsx`
- `frontend/src/components/timeline/ActivityBlock.tsx`

**Data transformation needed:**
```typescript
interface AppColumnData {
  appName: string;
  appIcon?: string;
  totalDuration: number; // in seconds
  activities: Activity[];
}

interface Activity {
  id: string;
  title: string;        // file name or activity description
  startTime: number;    // unix timestamp
  endTime: number;      // unix timestamp
  duration: number;     // in seconds
}

// Group events by app
function groupEventsByApp(events: TimelineEvent[]): Map<string, AppColumnData>
```

**Verification:**
- [ ] Each app gets its own column
- [ ] Column headers show app icon + name + total time
- [ ] Activity blocks positioned at correct Y (time) positions
- [ ] Horizontal scrolling when many apps exceed viewport

**Stop point:** App columns render with correct positioning

---

## Chunk 3: Timesheet Panel (Left Sidebar)

**What we'll build:**
- TimesheetPanel component replacing current TimelineStats
- LoggedEntry cards showing project, duration, amount
- "Timesheet" header with total logged time
- Ability to view entries as collapsed cards

**Visual Reference:**
```
┌──────────────────────────────┐
│ Timesheet                    │
│ 3h 41m - €414.58             │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ Company Meeting          │ │
│ │ Admin                    │ │
│ │ €402.08 ⏱         3h 13m │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Distractions             │ │
│ │ €6.26 ⏱            25m   │ │
│ └──────────────────────────┘ │
│ [+]                          │
└──────────────────────────────┘
```

**Key Behaviors:**
- Shows LOGGED entries (converted from memories), not raw sessions
- Color of card matches PROJECT color
- Entry cards are collapsible/expandable
- "+" button to manually add time entry
- Click entry to edit

**Files to create:**
- `frontend/src/components/timeline/TimesheetPanel.tsx`
- `frontend/src/components/timeline/LoggedEntryCard.tsx`

**NOTE:** Since traq doesn't have a "projects" concept yet, we'll adapt:
- Use the PRIMARY APP as the "project" for now
- Color-code by app category (productivity, communication, etc.)
- Show session summary as entry title

**Verification:**
- [ ] Left sidebar shows logged entries as cards
- [ ] Total time and "earnings" shown in header
- [ ] Cards have project-based colors
- [ ] Layout matches Timely's Timesheet panel

**Stop point:** Timesheet panel renders with entry cards

---

## Chunk 4: Summary Lane (Optional Collapsible)

**What we'll build:**
- SummaryLane component showing dominant activity per interval
- Configurable time interval (15min default)
- Toggle to show/hide individual memories alongside
- Memory title formatting (app name vs file/page name)

**Visual Reference:**
```
┌─ ✨ Summary ─────────────────────────────────────────────┐
│ PR #422: Refactor notification system   8:00AM - 8:30AM  │
│ PR #419: Migrate API endpoints to v2    8:30AM - 9:00AM  │
│ PR #422: Refactor notification system   9:00AM - 9:15AM  │
│ Engineering All-Hands                   9:15AM - 10:30AM │
│ TT-4350: Implement user activity tra... 10:30AM - 11:00AM│
└──────────────────────────────────────────────────────────┘
```

**Key Behaviors:**
- Shows the MOST ACTIVE memory per time interval
- Calendar events always shown separately (not grouped)
- Clicking a summary item can scroll to that time in the main view
- Configurable interval: 15min, 30min, 1hr

**Files to create:**
- `frontend/src/components/timeline/SummaryLane.tsx`
- `frontend/src/components/timeline/SummaryItem.tsx`

**Algorithm:**
```typescript
interface SummaryItem {
  title: string;
  appName: string;
  appIcon?: string;
  startTime: string;  // formatted "8:00AM"
  endTime: string;    // formatted "8:30AM"
  color: string;      // stripe color
}

function calculateSummary(
  events: TimelineEvent[],
  intervalMinutes: number = 15
): SummaryItem[]
```

**Verification:**
- [ ] Summary lane shows dominant activity per interval
- [ ] Clicking item scrolls to that time
- [ ] Can toggle between summary-only and expanded view
- [ ] Time interval is configurable

**Stop point:** Summary lane working with configurable intervals

---

## Chunk 5: Activity Blocks & Interactions

**What we'll build:**
- ActivityBlock component with proper styling
- Hover tooltip with time/duration details
- Click to expand details
- Display options popover (configure, hide, etc.)

**Visual Reference:**
```
┌────────────────────────┐
│ 🔵 Visual Studio Code  │
│    30m                 │
│ ┌────────────────────┐ │
│ │ ? │ 🗑 │ ⚙️       │ │  <- hover actions
│ └────────────────────┘ │
└────────────────────────┘

On hover:
┌─────────────────────────────┐
│ Google search               │
│ 4m  11:18AM - 11:22AM       │
│ [?] [🗑] [⚙️ Display options]│
└─────────────────────────────┘
```

**Block Styling Rules:**
- Minimum height: 20px (for very short activities)
- Show app icon + name always
- Show duration if block tall enough
- Pastel/muted colors, NOT saturated
- Small activities can show as just icon + duration text

**Files to modify:**
- `frontend/src/components/timeline/ActivityBlock.tsx`
- Create: `frontend/src/components/timeline/ActivityTooltip.tsx`
- Create: `frontend/src/components/timeline/DisplayOptionsPopover.tsx`

**Verification:**
- [ ] Blocks render with app icon, name, duration
- [ ] Hover shows tooltip with full details
- [ ] Click opens display options
- [ ] Very short activities render as compact blocks

**Stop point:** Activity blocks fully interactive

---

## Chunk 6: "Your Memories" Column

**What we'll build:**
- MemoriesColumn component (rightmost column)
- Groups concurrent activities from multiple apps
- Shows total memory time in header
- Compact view for overlapping activities

**Visual Reference:**
```
┌── Your Memories ⏱ 9h 38min ──┐
│ ┌─────────────────────────────┐ │
│ │ 🖥️ Terminal                 │ │
│ │ 🐙 GitHub                   │ │
│ │ 💬 Slack                    │ │
│ │ 📹 Google Meet              │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ 📹 Google Meet              │ │
│ │    45m                      │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Key Behaviors:**
- Shows ALL activities overlaid/stacked when concurrent
- Multiple small app icons when activities overlap
- Expands to show detail on hover/click
- Header shows total tracked time

**Files to create:**
- `frontend/src/components/timeline/MemoriesColumn.tsx`
- `frontend/src/components/timeline/StackedActivityBlock.tsx`

**Verification:**
- [ ] Shows on far right of timeline
- [ ] Concurrent activities shown as stacked icons
- [ ] Total time calculated correctly
- [ ] Expands to detail view

**Stop point:** Memories column working with stacked view

---

## Chunk 7: Page Layout Integration & Polish

**What we'll build:**
- Full page layout matching Timely
- Horizontal scroll for many app columns
- Sticky hour markers
- Smooth scroll-to-time functionality
- Day/Week/Month view toggle (Week view cards, Month view summary)

**Final Layout:**
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Day] [Week] [Month]  < Today, Jan 10 >  [Today]  [0h]       [Options] [Me ▼]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Timesheet    │ EDT │ VS Code   │ Chrome    │ Calendar  │ Your Memories      │
│ 0h           │     │ 7h 6min   │ 41min     │ 30min     │ 9h 38min           │
│ ┌──────────┐ │─────┼───────────┼───────────┼───────────┼────────────────────│
│ │ Entry 1  │ │ 6AM │           │           │           │                    │
│ │ Project  │ │     │           │           │           │                    │
│ │ 2h 04m   │ │ 7AM │           │           │           │                    │
│ └──────────┘ │     │           │           │           │                    │
│ ┌──────────┐ │ 8AM │ ┌───────┐ │           │ ┌───────┐ │ ┌────────────────┐ │
│ │ Entry 2  │ │     │ │ Block │ │           │ │ Cal   │ │ │ Terminal, GH   │ │
│ │ Project  │ │     │ │ 30m   │ │           │ │ 30m   │ │ │ Slack, Linear  │ │
│ │ 25m      │ │     │ └───────┘ │           │ └───────┘ │ └────────────────┘ │
│ └──────────┘ │ 9AM │ ┌───────┐ │ ┌───────┐ │           │                    │
│ [+ Add]      │     │ │ ...   │ │ │ ...   │ │           │                    │
│              │     │ └───────┘ │ └───────┘ │           │                    │
└──────────────┴─────┴───────────┴───────────┴───────────┴────────────────────┘
```

**Files to modify:**
- `frontend/src/pages/TimelinePage.tsx` - major refactor

**Delete these files (no longer needed):**
- `TimelineBands.tsx` - replaced by TimelineGrid
- `TimelineStats.tsx` - replaced by TimesheetPanel
- `TimelineTags.tsx` - integrated into new design

**Verification:**
- [ ] Layout matches Timely exactly
- [ ] Horizontal scroll works for many apps
- [ ] Hour markers stay visible while scrolling
- [ ] Day/Week/Month toggles work
- [ ] No console errors
- [ ] Responsive design

**Stop point:** Full Timely clone achieved

---

## Layout Specifications (from Timely)

| Element | Size |
|---------|------|
| Timesheet panel (left) | ~280px fixed |
| Hour axis column | ~60px fixed |
| App columns | ~150-200px each, flexible |
| Memories column | ~200px, flexible |
| Hour row height | ~60-80px (adjustable) |
| Block minimum height | 20px |
| Header row | 48px |

## Color Palette (Timely-style)

```css
/* Activity block colors - pastel/muted */
--block-code: hsl(200, 60%, 85%);      /* VS Code - light blue */
--block-browser: hsl(150, 50%, 85%);   /* Chrome - light green */
--block-calendar: hsl(260, 60%, 90%);  /* Calendar - light purple */
--block-comms: hsl(180, 50%, 85%);     /* Slack/Discord - light teal */
--block-terminal: hsl(0, 0%, 85%);     /* Terminal - light gray */

/* Project colors (for Timesheet entries) - more saturated */
--project-admin: hsl(180, 60%, 45%);   /* Teal */
--project-dev: hsl(260, 60%, 50%);     /* Purple */
--project-meetings: hsl(200, 70%, 45%);/* Blue */
--project-other: hsl(30, 70%, 50%);    /* Orange */
```

---

## Implementation Order

1. **Chunk 2** first - Get the core grid layout working
2. **Chunk 5** next - Make blocks look right and be interactive
3. **Chunk 3** then - Add the Timesheet panel
4. **Chunk 6** next - Add the Memories column
5. **Chunk 4** then - Add optional Summary lane
6. **Chunk 7** finally - Polish and integrate

---

## Success Criteria

At completion, someone looking at traq's Timeline should think:
"This looks almost exactly like Timely's new Timeline View"

Specifically:
- [ ] Multi-column layout with app-based columns
- [ ] Hour markers on left with horizontal gridlines
- [ ] Activity blocks positioned correctly by time
- [ ] Timesheet panel on left with logged entries
- [ ] "Your Memories" combined column on right
- [ ] Column headers with app icon + name + duration
- [ ] Hover tooltips with activity details
- [ ] Pastel/muted color scheme
- [ ] Clean, professional appearance
- [ ] Smooth scrolling and interactions
