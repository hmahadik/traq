# Timeline v2 Implementation - APP-BASED COLUMNS Architecture

**Overall Goal:** Transform Timeline page to match Timely's layout with app-based columns, vertical bars, daily summary sidebar, and AI summary column.

**Key Architecture (FINAL - APP-BASED):**
- **Sidebar** (280px) - Daily summary stats (hero, stats, breakdown, top apps, activity cards)
- **Hour Axis** (50px, sticky left) - Time labels
- **AI Summary Column** (160px, sticky) - Text summaries
- **App Columns** (140px each, scrollable) - One column per app
  - Vertical bars where HEIGHT = duration (60px = 1 hour)
  - Activities stack vertically in their app's column
  - NO overlap detection (each app isolated)
  - Parent-child flexbox pattern: skinny bar (left) + info (right)
- Reference: `/home/harshad/projects/traq/screenshots/references/traq-timeline-v3.html`

**NO Memories column - just app columns**

**Implementation Order:** Refactor core components, then integrate

---

## Phase 1: Foundation - Core Components & Grid Layout ✅ COMPLETE

### Grid & Time Management ✅
- [x] **Create TimelineGrid component**
  - File: `frontend/src/components/timeline/TimelineGrid.tsx` ✅
  - Displays hourly grid with 60px per hour ✅
  - Creates hour labels on left side (e.g., "2 PM", "3 PM") ✅
  - Horizontal grid lines at each hour ✅
  - Container for activity blocks ✅
  - Reference: traq-timeline-v2.html lines 146-198 ✅

- [x] **Create ActivityBlock component (parent container)**
  - File: `frontend/src/components/timeline/ActivityBlock.tsx` ✅
  - Structure: `position: absolute` + `display: flex` + `align-items: flex-start` ✅
  - Accepts: startTime, duration, appName, appIcon, color ✅
  - Calculates: Y position from startTime, height from duration ✅
  - Calculates: Left offset for overlapping activities ✅
  - Reference: traq-timeline-v2.html lines 388-395 ✅

### Activity Visualization Components ✅
- [x] **Create ActivityBar component (child - skinny vertical bar)**
  - File: `frontend/src/components/timeline/ActivityBar.tsx` ✅
  - Props: height (px), backgroundColor ✅
  - Fixed width: 28px, border-radius: 6px ✅
  - Reference: traq-timeline-v2.html lines 209-266 ✅

- [x] **Create ActivityInfo component (child - title + duration + icon)**
  - File: `frontend/src/components/timeline/ActivityInfo.tsx` ✅
  - Displays: app icon + app name + duration ✅
  - Flex column layout, positioned right of bar with padding-left: 12px ✅
  - Reference: traq-timeline-v2.html lines 224-257 ✅

- [x] **Create ActivityIconOnly component (for very short activities)**
  - File: `frontend/src/components/timeline/ActivityIconOnly.tsx` ✅
  - Circular 28px indicator with app icon ✅
  - Used when activity height < ~20px ✅
  - Reference: traq-timeline-v2.html lines 268-297 ✅

### Data & Utilities ✅
- [x] **Create timeline utilities file**
  - File: `frontend/src/utils/timelineHelpers.ts` ✅
  - Function: `timeToPixels()` - calculates Y position ✅
  - Function: `durationToPixels()` - converts duration to height ✅
  - Function: `layoutActivities()` - auto overlap detection & lane assignment ✅
  - Function: `getAppColor()` and `getAppIcon()` - app metadata ✅
  - Verification: All functions calculate positions correctly per 60px/hour scaling ✅

- [x] **Create type definitions**
  - File: `frontend/src/types/timeline.ts` ✅
  - Types: PositionedActivityBlock, DailySummary, CategoryBreakdown, TopApp, TimelineGridConfig ✅
  - Ensure compatibility with API events from backend ✅

---

## Phase 2: Sidebar - Daily Summary Stats ✅ COMPLETE

### Sidebar Components ✅
- [x] **Create TimelineSidebar component**
  - File: `frontend/src/components/timeline/TimelineSidebar.tsx` ✅
  - Fixed width: ~280-340px ✅
  - Layout sections: header, hero, stats, breakdown, top apps, cards ✅
  - Reference: traq-timeline-v3.html lines 27-195 ✅

- [x] **Create DailySummaryCard component**
  - File: `frontend/src/components/timeline/DailySummaryCard.tsx` ✅
  - Displays: project/activity name + duration + category icon ✅
  - Color-coded background based on activity type ✅

- [x] **Create DailySummaryHero component**
  - File: `frontend/src/components/timeline/DailySummaryHero.tsx` ✅
  - Displays: large centered total hours with gradient color ✅
  - Format: shows "Xh XXm" in large font ✅
  - Reference: traq-timeline-v3.html lines 59-80 ✅

- [x] **Create SummaryStatsRow component**
  - File: `frontend/src/components/timeline/SummaryStatsRow.tsx` ✅
  - Displays: label + value pairs (Day Span, Breaks, Longest Focus, etc.) ✅
  - Stacked layout with subtle separators ✅
  - Reference: traq-timeline-v3.html lines 82-101 ✅

- [x] **Create BreakdownBar component**
  - File: `frontend/src/components/timeline/BreakdownBar.tsx` ✅
  - Visual bar chart showing time breakdown by category (Focus, Meetings, Comms, Other) ✅
  - Colored segments with legend below ✅
  - Reference: traq-timeline-v3.html lines 103-136 ✅

- [x] **Create TopAppsSection component**
  - File: `frontend/src/components/timeline/TopAppsSection.tsx` ✅
  - Lists top apps by time spent ✅
  - Shows: app icon + name + total time ✅
  - Reference: traq-timeline-v3.html lines 138-194 ✅

### Stats & Summary Data ✅
- [x] **Create summary calculation function**
  - File: `frontend/src/utils/summaryHelpers.ts` ✅
  - Function: `calculateDailySummary(activities: Activity[]): DailySummary` ✅
  - Returns: { totalHours, hourSpan, breaks, longestFocus, breakdown, topApps } ✅
  - Includes activity categorization logic ✅
  - Verification: Calculates stats correctly from activity data ✅

- [x] **Create TimelineGridView wrapper component**
  - File: `frontend/src/components/timeline/TimelineGridView.tsx` ✅
  - Combines TimelineGrid + TimelineSidebar ✅
  - Handles data flow and summary calculation ✅
  - Verification: Both grid and sidebar render together ✅

- [x] **Update component exports**
  - File: `frontend/src/components/timeline/index.ts` ✅
  - Exported all Phase 1 & 2 components ✅
  - Verification: Components importable from @/components/timeline ✅

---

## Phase 3: Page Integration & Data Flow ✅ COMPLETE

### Page-Level Components
- [x] **Refactor TimelinePage to use TimelineGridView**
  - File: `frontend/src/pages/TimelinePage.tsx` ✅
  - Replace old layout with TimelineGridView ✅
  - Keep existing date navigation, view toggle, etc. ✅
  - Fetch daily events and pass to TimelineGridView ✅
  - Reference: TimelineGridView.tsx component ✅
  - Verification: Page displays full layout with sidebar and grid ✅
  - Implementation: Added 'timeline' view mode to view toggle (Sessions/Events/Timeline)
  - Timeline mode renders TimelineGridView with fetched timeline events
  - Proper loading states and empty states for timeline view

- [x] **Create TimelineHeader component**
  - File: `frontend/src/components/timeline/TimelineHeader.tsx` ✅
  - Shows: page title ("Today's memories") ✅
  - View toggle: List / Timeline buttons ✅
  - Search icon / filter controls ✅
  - Reference: traq-timeline-v2.html lines 338-347 ✅
  - Verification: Header renders with all controls ✅
  - Implementation: Component created with ViewMode type, exported from index.ts

- [x] **Integrate view toggle (List vs Timeline)**
  - Add state to TimelinePage for current view ✅
  - List view: displays events as scrollable list (existing component) ✅
  - Timeline view: displays TimelineGridView (new) ✅
  - Toggle between views smoothly ✅
  - Verification: Clicking buttons switches between views ✅
  - Implementation: TimelinePage has Sessions/Events/Timeline toggle (lines 268-296)

---

## Phase 4: Interactions & Polish ⏳ TODO

### Hover & Click States
- [ ] **Implement hover effects**
  - ActivityBlock hover: scale(1.05) + shadow elevation ✅ (CSS ready)
  - Show tooltip on hover with: title, time range, duration
  - Reference: traq-timeline-v2.html CSS lines 218-222
  - Verification: Hover effects work smoothly

- [ ] **Create ActivityTooltip component**
  - File: `frontend/src/components/timeline/ActivityTooltip.tsx`
  - Shows on hover: activity name, time range, duration
  - Positioned above/below block as needed
  - Verification: Tooltip appears on hover with correct info

- [ ] **Add click interactions**
  - Click activity block to show details
  - Optional: display options popover
  - Verification: Click handlers work

### Colors & Styling ✅
- [x] **App color system**
  - Color palette per app defined in timelineHelpers.ts ✅
  - Maps in getAppColor() function ✅
  - Verification: Colors available for use ✅

- [ ] **Apply gradient backgrounds**
  - ActivityBar uses gradient styling in ActivityBar.tsx
  - Sidebar cards use solid colors in DailySummaryCard.tsx
  - Verification: Colors match mockup

### Scrolling & Navigation
- [ ] **Implement vertical scrolling**
  - TimelineGrid scrolls vertically through day
  - Hour axis stays visible (sticky positioning) ✅ (CSS ready)
  - Smooth scroll behavior
  - Verification: Can scroll through full day timeline

- [ ] **Implement horizontal scrolling for overlaps**
  - When many activities overlap, allow horizontal scroll
  - Keep sidebar and hour axis fixed
  - Verification: Can scroll horizontally to see overlaps

---

## Phase 5: Cleanup & Optimization ⏳ TODO

### Component Management
- [ ] **Delete deprecated components** (after full v2 deployment)
  - Remove: `TimelineBands.tsx`
  - Remove: `TimelineStats.tsx` (if stats migrated)
  - Remove: `TimelineTags.tsx`
  - Verification: Old files removed, no broken imports

- [ ] **Update TimelineLayout component**
  - File: `frontend/src/pages/TimelineLayout.tsx`
  - Ensure proper spacing with new design
  - Verify responsive layout
  - Verification: Layout looks professional

### Quality Assurance
- [ ] **Test responsive design**
  - Test on desktop (1920px+)
  - Test on tablet (768px - 1024px)
  - Test mobile behavior
  - Verification: Layout adapts correctly

- [ ] **Performance optimization**
  - Check rendering performance with many activities
  - Optimize re-renders with React.memo
  - Verify smooth scrolling (60fps)
  - Verification: No stuttering

- [ ] **Final QA**
  - Check console for errors
  - Verify all interactions
  - Test accessibility
  - Polish animations
  - Verification: Professional appearance

---

## File Structure Summary

### ✅ New Components Created
```
frontend/src/components/timeline/
├── TimelineGrid.tsx              ✅ (hourly grid container)
├── ActivityBlock.tsx             ✅ (parent flex container)
├── ActivityBar.tsx               ✅ (skinny vertical bar - child)
├── ActivityInfo.tsx              ✅ (title/duration/icon - child)
├── ActivityIconOnly.tsx          ✅ (circular icon for short activities)
├── TimelineSidebar.tsx           ✅ (left sidebar - main container)
├── TimelineGridView.tsx          ✅ (grid + sidebar wrapper)
├── DailySummaryHero.tsx          ✅ (large total hours display)
├── SummaryStatsRow.tsx           ✅ (day span, breaks, etc.)
├── BreakdownBar.tsx              ✅ (activity category breakdown)
├── TopAppsSection.tsx            ✅ (top apps by time)
├── DailySummaryCard.tsx          ✅ (colored entry cards)
├── TimelineHeader.tsx            ⏳ (view toggle + controls - TODO)
├── ActivityTooltip.tsx           ⏳ (hover tooltip - TODO)
└── index.ts                      ✅ (exports updated)
```

### ✅ Utilities & Types Created
```
frontend/src/
├── utils/timelineHelpers.ts      ✅ (position calculations, layout, colors)
├── utils/summaryHelpers.ts       ✅ (stats calculations, categorization)
└── types/timeline.ts             ✅ (type definitions)
```

### ⏳ Files to Modify
```
frontend/src/
├── pages/TimelinePage.tsx        ⏳ (integrate TimelineGridView)
└── pages/TimelineLayout.tsx      ⏳ (adjust spacing for new layout)
```

### ⏳ Files to Delete (after v2 deployment)
```
frontend/src/components/timeline/
├── TimelineBands.tsx             (old layout)
├── TimelineStats.tsx             (replaced by sidebar components)
└── TimelineTags.tsx              (old layout)
```

### Reference Files
- **PRIMARY REFERENCE:** `/home/harshad/projects/traq/screenshots/references/traq-timeline-final.html` ✅ (Unified timeline with sidebar, no Memories column)
- Layout reference: `/home/harshad/Downloads/traq-timeline-d3-v2.html` (D3 scales & positioning approach)
- OLD (DO NOT USE): `/home/harshad/projects/traq/screenshots/references/traq-timeline-v2.html`
- OLD (DO NOT USE): `/home/harshad/projects/traq/screenshots/references/traq-timeline-v3.html` (has Memories column - NOT in our design)
- Architecture: `/home/harshad/projects/traq/PLAN.md`

---

## Layout Algorithm (layoutActivities function)

**Smart Overlap Detection - Parallel Lanes:**
1. Filter activities with duration > 0
2. Sort by start time
3. For each activity, calculate:
   - `top = timeToPixels(timestamp, startHour)` (Y position)
   - `height = durationToPixels(duration)` (bar height)
4. Detect overlaps with all previous activities
5. Assign `left` offset based on max lane depth:
   - First activity: `left: 0px`
   - First overlap: `left: 48px` (60px wide bar + 12px padding - margins)
   - Second overlap: `left: 96px`
   - Third overlap: `left: 144px`
   - etc.

**Key Points:**
- NO hardcoded app columns
- NO separate "swimlanes" per app
- Automatic detection of what overlaps with what
- Always positions activities side-by-side when they share time
- Unified single timeline (all activities in same scrollable area)

## Key Metrics & Specifications

- **Pixel Scaling:** 60px = 1 hour (adjustable via pixelsPerHour)
- **Activity Bar Width:** 28px (fixed)
- **Bar Border Radius:** 6px
- **Lane Width (left offset step):** 48px (gap between overlapping bars)
- **Sidebar Width:** 280px
- **Hour Axis Width:** 50px
- **Minimum Bar Height:** ~20px (below this, use ActivityIconOnly)
- **Base Time Display:** 2 PM - 1 AM (12-hour span, adjustable)
- **Grid Line Height:** 60px (matches 1 hour)

---

## Success Criteria - Phase 1 & 2 Complete ✅

### Core Architecture ✅
- ✅ Activities render as vertical bars with height = duration
- ✅ Overlapping activities auto-positioned side-by-side (parallel lanes)
- ✅ Hourly grid with proper scaling (60px/hour)
- ✅ Hour axis sticky on left side
- ✅ Parent-child flexbox pattern (bar + info)
- ✅ Icon-only mode for activities < 20px height

### Sidebar Statistics ✅
- ✅ Daily summary hero (large total hours with gradient)
- ✅ Summary stats rows (Day Span, Breaks, Longest Focus)
- ✅ Breakdown bar (Focus/Meetings/Comms/Other segments)
- ✅ Top apps section (apps by time spent)
- ✅ Activity cards (colored category cards)
- ✅ Scrollable sidebar content

### Components ✅
- ✅ TimelineGrid - Grid container
- ✅ ActivityBlock - Parent flex container
- ✅ ActivityBar - Skinny 28px vertical bar
- ✅ ActivityInfo - Title/duration/icon info
- ✅ ActivityIconOnly - Circular icon markers
- ✅ TimelineSidebar - Main sidebar container
- ✅ TimelineGridView - Grid + sidebar wrapper
- ✅ 7 sidebar sub-components (Hero, Stats, Breakdown, Apps, Cards)

### Utilities ✅
- ✅ timelineHelpers.ts - Position calculations, overlap detection, color mapping
- ✅ summaryHelpers.ts - Stats calculation, categorization, app grouping
- ✅ timeline.ts - TypeScript type definitions

### TODO - Phase 3+
- ⏳ Integrate TimelineGridView into TimelinePage
- ⏳ Create TimelineHeader component
- ⏳ Implement hover tooltips
- ⏳ Add click interactions
- ⏳ Test responsive design
- ⏳ Delete old components
