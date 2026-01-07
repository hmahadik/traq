# Visual QA Issues

**Date Reviewed:** January 7, 2026
**Screens:** Timeline (Daily View), Day (Screenshots View)

---

## Critical Data Issues

### 1. ~~Day Span shows impossible time range~~ ✅ FIXED
- **Location:** Left sidebar, "Day Span" card
- **Issue:** Shows "6:59 PM - 10:57 AM" which spans across midnight, but all visible sessions are in the evening (6:59 PM to 9:31 PM)
- **Expected:** End time should reflect actual last session end time (likely ~10:XX PM)
- **Priority:** High
- **Fix:** Updated `calculateDayStats()` in `TimelineStats.tsx` to clamp start/end times to the selected day's boundaries. Sessions that span midnight now show the day-appropriate portion.

### 2. ~~Zero-duration session displayed~~ ✅ FIXED
- **Location:** Session list, second card
- **Issue:** "08:41 PM - 08:41 PM" session with "0 screenshots" and "0s" duration is being rendered
- **Expected:** Empty/zero-duration sessions should be filtered out or not created
- **Priority:** High
- **Fix:** Added filter in `GetSessionsForDate()` in `internal/service/timeline.go` to skip sessions that are not ongoing AND have 0 screenshots AND 0 duration. These empty sessions are now excluded from the API response.

### 3. ~~Thumbnail count mismatch~~ ✅ FIXED
- **Location:** Session cards, "+N" overflow badge
- **Issue:** Third session shows "12" screenshots but displays 5 thumbnails + "+2" = 7 total. Fourth session shows "31" screenshots with ~5 thumbnails + "+2"
- **Expected:** Math should add up: visible thumbnails + overflow count = total count
- **Priority:** Medium
- **Fix:** Changed `remainingCount` calculation in `SessionCard.tsx` to use `session.screenshotCount - displayThumbnails.length` instead of `thumbnails.length - 6`. The bug was that `thumbnails` array only contained the first 8 fetched thumbnails, not all screenshots.

---

## Formatting Inconsistencies

### 4. ~~Time format inconsistency~~ ✅ FIXED
- **Location:** Day Span vs Session cards
- **Issue:** Day Span uses "6:59 PM" (no leading zero) while session cards use "06:59 PM" (with leading zero)
- **Expected:** Consistent time formatting throughout the app
- **Priority:** Low
- **Fix:** Removed duplicate `formatTime()` function from `TimelineStats.tsx` and replaced with shared `formatTimestamp()` from `@/lib/utils`. Both Day Span and Session cards now use the same formatter with `hour: '2-digit'`.

### 5. ~~Timeline bleeding into sidebar~~ ✅ FIXED
- **Location:** Main timeline area, below the hour markers
- **Issue:** the timeline visualization area (the one with the 12 AM - 10 PM hour markers and the colored session/screenshot/activity bars) is clearly not respecting its container boundaries. It's overlapping or rendering on top of where the left sidebar stats should be cleanly separated.
- **Expected:** The entire timeline visualization should be contained within its boundaries.
- **Priority:** High
- **Fix:** Added `overflow-hidden` to the main container and all band row containers in `TimelineBands.tsx`. The time axis labels container and each band (Sessions, Screenshots, Activity, Summaries) now properly clip content at their boundaries.

---

## Day Page Issues

### 9. ~~Day page displays wrong date (timezone bug)~~ ✅ FIXED
- **Location:** Day page header and data fetching
- **Issue:** When navigating to `/day/2026-01-07`, the page header displayed "Tue, Jan 6" instead of "Wed, Jan 7". Additionally, no data was being shown even though 432 screenshots and 11 sessions existed for 2026-01-07.
- **Root Cause:** Using `new Date("YYYY-MM-DD")` creates a Date at UTC midnight, which in timezones behind UTC (e.g., America/Los_Angeles) gets converted to the previous day. Additionally, `toDateString()` was using `toISOString()` which converted back through UTC, compounding the timezone offset issue.
- **Expected:** Page should display the exact date from the URL parameter and fetch data for that date in local timezone.
- **Priority:** Critical
- **Fix:**
  - Added `parseDateString()` utility function in `frontend/src/lib/utils.ts` that parses YYYY-MM-DD strings into Date objects using local timezone components (`new Date(year, month-1, day)`)
  - Updated `toDateString()` to use local date components (`getFullYear()`, `getMonth()`, `getDate()`) instead of `toISOString()`
  - Modified `DayPage.tsx` to use `parseDateString()` instead of `new Date()`
  - Result: Date display and data fetching now work correctly across all timezones

---

## Questionable Data Display

### 6. ~~Break calculation seems incorrect~~ ✅ FIXED
- **Location:** Left sidebar, "Breaks" card and "Time Breakdown" card
- **Issue:** Shows 13h 3m of breaks with only 2h 55m of work. This suggests all idle/non-tracked time is being counted as "breaks"
- **Expected:** Clarify what constitutes a "break" vs just "not working" - current display is potentially misleading
- **Priority:** Medium
- **Fix:** Redefined "breaks" in `calculateDayStats()` in `TimelineStats.tsx` to only count gaps between consecutive sessions that fall within a reasonable range (3 minutes to 2 hours). Gaps shorter than 3 minutes are considered session transitions, while gaps longer than 2 hours are considered "away time" (lunch, overnight, etc.) rather than breaks. This provides a more intuitive and meaningful break metric.

---

## Minor Visual Issues

### 7. ~~No legend for timeline color bars~~ ✅ FIXED
- **Location:** Timeline visualization bar
- **Issue:** Colored segments (green, orange, purple, red) have no clear legend explaining what each color represents
- **Expected:** Either add a legend or use the existing labels properly
- **Priority:** Low
- **Fix:** Added a legend row at the bottom of the `TimelineBands` component in `TimelineBands.tsx`. The legend shows color meanings for Activity (Productive/green, Neutral/gray, Distracting/red), Screenshots (Captured/slate), and Summaries (AI Summary/blue). The legend is styled consistently with the rest of the component using the same label width and text styling.

### 8. ~~Inconsistent thumbnail aspect ratios~~ ✅ FIXED
- **Location:** Session card thumbnail strips
- **Issue:** Thumbnails have varying aspect ratios creating visual inconsistency
- **Expected:** Uniform thumbnail sizing/cropping
- **Priority:** Low
- **Fix:** Changed thumbnail containers in `SessionCard.tsx` from `aspect-video` to explicit fixed dimensions (`w-20 h-[45px]`). Made the `ThumbnailImage` component use absolute positioning (`absolute inset-0`) to fill the container completely, ensuring `object-cover` clips images uniformly regardless of source aspect ratio. Updated skeleton placeholders to match.

---

## Summary

| Priority | Count | Fixed |
|----------|-------|-------|
| Critical | 1     | 1     |
| High     | 3     | 3     |
| Medium   | 2     | 2     |
| Low      | 3     | 3     |
| **Total**| **9** | **9** |
