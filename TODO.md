# UI Fixes - COMPLETED!

All high and medium priority items have been completed successfully.

## Completed This Session
- [x] Fix AI summaries not generating (model path, port, libraries, LD_LIBRARY_PATH)
- [x] Fix 'invalid date' in focus event times (was using `timestamp` instead of `startTime`)
- [x] Fix sessions from previous days showing in today (timezone mismatch - now uses local time)
- [x] Fix light/dark theme based on system (CSS media query for `data-theme="system"`)
- [x] Fix today's hours worked showing 0 (ongoing sessions now use current time instead of start time)
- [x] Fix 0 breaks showing (skip ongoing sessions when calculating breaks)
- [x] Fix screenshot lane not showing anything (pass screenshots || [] instead of undefined)
- [x] Fix activity lane hover behavior (added 'rounded' class for consistency)
- [x] Fix settings page width cutting off content on Sources tab (increased to max-w-5xl, added resize-y to textareas)

## Still To Do

### High Priority
(All completed!)

### Medium Priority
- [x] Add 'generate missing' button like v1 (batch generate summaries)
- [x] Make calendar expandable/dropdown instead of always visible on right side
- [x] Make page responsive for large screen widths (stats/tags: top row on small screens, left sidebar on xl+)
