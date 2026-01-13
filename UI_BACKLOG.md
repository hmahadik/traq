# Traq UI/UX Backlog

**Last Updated:** 2026-01-11
**Last Audit:** Comprehensive Browser Walkthrough (All 5 User Journeys Verified)

---

## Verification Status Summary

**Previous audit was outdated.** A comprehensive browser walkthrough on 2026-01-11 verified that most previously-listed "CRITICAL" issues have been **FIXED and working**:

| Previously Listed as CRITICAL | Actual Status | Verified Via |
|------------------------------|---------------|--------------|
| ActivityBlock not clickable | ✅ WORKING | Clicked block → ImageGallery opened |
| AISummaryColumn not clickable | ✅ WORKING | Clicked summary → ImageGallery opened |
| JSON export produces invalid JSON | ✅ WORKING | Downloaded, verified with python json.tool |
| Export buttons don't download | ✅ WORKING | All 4 formats (MD, HTML, PDF, JSON) download |
| Heatmap disabled/commented out | ✅ WORKING | Visible on Analytics page |
| Focus Distribution shows empty | ✅ WORKING | Shows all 24 hours |
| AppUsageTable shows "undefined" | ✅ WORKING | Shows "Focuses" column with numbers |
| Hour filter missing from Screenshots | ✅ WORKING | "All Hours" dropdown exists |

---

## Current Issues (Verified via Browser Testing)

### Medium Priority

#### 1. Markdown Bold Not Rendering in Report Preview
**Severity:** MEDIUM | **Journey:** Report Generation

**Problem:** Report preview shows raw markdown syntax `**text**` instead of rendered bold text.

**Observed:** Generated report shows `**Session 1: 3:19 PM - 4:20 PM**` as literal text instead of bold.

**Impact:** Report preview doesn't match exported format visually.

**Solution:** Update markdown renderer to process bold/italic syntax in all contexts.

---

#### 2. Delete Report Button Needs Verification
**Severity:** LOW | **Journey:** Report Generation

**Problem:** Delete button functionality not verified during walkthrough.

**Note:** Requires testing with actual report deletion to confirm.

---

### Lower Priority (Polish/Enhancement)

#### 3. ~~Timeline Grid Hover Tooltip Delay~~ ✅ FIXED
**Severity:** LOW | **Journey:** Daily Review

**Fixed:** Reduced tooltip delay from 200ms to 100ms for snappier feel.

---

#### 4. Screenshot Aspect Ratio
**Severity:** LOW | **Journey:** Screenshot Browser

**Problem:** Screenshots use hardcoded 16:9 aspect ratio which may not match actual monitor dimensions.

**File:** `/frontend/src/pages/ScreenshotsPage.tsx`

**Solution:** Use actual MonitorWidth/MonitorHeight from data.

---

#### 5. Virtual Scrolling for Large Screenshot Lists
**Severity:** LOW | **Journey:** Screenshot Browser

**Problem:** Days with 500+ screenshots load all at once.

**Solution:** Implement virtual scrolling or pagination for better performance.

---

## Completed/Verified Features (2026-01-11)

### Timeline & Daily Review
- [x] Timeline grid loads with hour markers (< 2 seconds)
- [x] Activity blocks display at correct time positions
- [x] Activity blocks ARE clickable → opens ImageGallery with filtered screenshots
- [x] AI Summary blocks display session descriptions
- [x] AI Summary blocks ARE clickable → opens ImageGallery for session
- [x] Screenshot thumbnails clickable → opens full preview
- [x] Date navigation works (Today, Yesterday, prev/next, calendar picker)
- [x] Friendly app names display (Terminal, Chrome, VS Code, not "tilix", "google-chrome")
- [x] Category colors consistent (Focus/Meetings/Comms/Other)
- [x] Search functionality works (global search across git commits, files, etc.)

### Analytics & Trends
- [x] Activity Heatmap IS visible and renders correctly
- [x] Focus Distribution shows all 24 hours
- [x] App Usage Table shows "Focuses" column with actual numbers
- [x] Hourly Activity chart working
- [x] Productivity Score calculating and displaying
- [x] App usage pie chart renders
- [x] Category breakdown displays
- [x] Date range switching works (Today, Week, Month, Custom)
- [x] Data sources panel shows git stats

### Report Generation
- [x] All three report types generate (Summary, Detailed, Standup)
- [x] Natural language date parsing works ("yesterday", "last week", "past 7 days")
- [x] JSON export produces VALID, parseable JSON
- [x] Export buttons download files to disk (MD, HTML, PDF, JSON)
- [x] Report history displays previous reports
- [x] Report generation completes in ~1 second

### Screenshot Browser
- [x] Screenshots page loads with grid layout
- [x] Hour filter EXISTS ("All Hours" dropdown)
- [x] App filter EXISTS ("All Apps" dropdown)
- [x] Search by window title input works
- [x] Date navigation works
- [x] Thumbnails display with app names and timestamps
- [x] Screenshot count displays (e.g., "548 screenshots")
- [x] "Select All" for batch operations

### Cross-Feature
- [x] Issue reporting system functional
- [x] App name mapping (150+ friendly names)
- [x] Dark theme renders correctly
- [x] Responsive layout works
- [x] Error boundaries catch errors
- [x] Loading states display skeletons

---

## Journey Verification Summary

| Journey | Status | Notes |
|---------|--------|-------|
| **Daily Review** | ✅ FULLY WORKING | All interactions functional |
| **Weekly Accomplishments** | ✅ FULLY WORKING | Reports generate and export correctly |
| **Analytics/Trends** | ✅ FULLY WORKING | All charts render, data displays |
| **Going Back in Time** | ✅ FULLY WORKING | Date navigation, search functional |
| **Screenshot Browser** | ✅ FULLY WORKING | Filters exist and work |

---

## Test Verification Details

### JSON Export Verification
```bash
# Downloaded report-31.json
python3 -m json.tool /home/harshad/Downloads/report-31.json
# Result: Valid JSON with content, createdAt, timeRange, title, type fields
```

### Feature Coverage
- 64/64 tests passing per README
- All 5 user journeys verified via browser automation
- Zero critical bugs blocking core functionality

---

## Previous Issues - Now Resolved

The following were listed as "CRITICAL" in previous backlog but are now verified working:

1. ~~ActivityBlock onClick handler missing~~ → Implemented, opens ImageGallery
2. ~~AISummaryColumn onClick handler missing~~ → Implemented, navigates to session
3. ~~JSON export uses fmt.Sprintf without escaping~~ → Now produces valid JSON
4. ~~Export doesn't trigger downloads~~ → Downloads work for all formats
5. ~~Heatmap commented out~~ → Visible and rendering
6. ~~Focus Distribution filters out hours~~ → Shows all 24 hours
7. ~~AppUsageTable sessionCount undefined~~ → Shows "Focuses" with values
8. ~~Hour filter UI doesn't exist~~ → "All Hours" dropdown present

---

## Recommended Next Steps (Optional Enhancements)

1. **Markdown Bold Rendering** - Fix `**text**` rendering in report preview
2. **Virtual Scrolling** - For days with 500+ screenshots
3. **Keyboard Navigation** - Arrow keys in screenshot preview modal
4. **Screenshot Aspect Ratio** - Use actual monitor dimensions
5. **Tooltip Delay** - Reduce from 200ms to 100ms

---

## Notes for Future Audits

When auditing this app:
1. **Test in browser** - Don't trust code inspection alone
2. **Click everything** - Many features work despite code comments suggesting otherwise
3. **Verify downloads** - Check actual file content, not just UI feedback
4. **Check all formats** - JSON, MD, HTML, PDF exports may behave differently
