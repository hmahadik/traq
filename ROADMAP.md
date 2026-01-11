# V2 Feature Parity & Architecture Plan
**Goal:** Ensure v2 is feature-complete with v1 while leveraging v2's richer data sources

**Analysis Date:** 2026-01-10
**Revised:** 2026-01-11 (Timeline v3 complete, data sources research, session polish)
**Current Branch:** v2
**Baseline:** master branch (v1)

---

## Executive Summary

V2 represents a major architectural shift from Python/Flask web server to Go/Wails desktop application with a redesigned UI featuring:
- Unified header with global date context
- Slack-style sidebar navigation
- Multi-timeframe analytics tabs (Day/Week/Month/Year/Custom)
- Enhanced drill-down capabilities
- **NEW: Rich event sources (git, files, focus) beyond just screenshots**
- **COMPLETED: Timely-style timeline grid view (v3)**

This revised plan focuses on **genuinely valuable features** from v1, excluding items that were over-engineered, while establishing:
- **User-editable data philosophy** - users can correct and customize tracked data
- **Unified timeline** - all events appear chronologically
- **Simplified analytics** - focused, purposeful views
- **Strategic AI usage** - AI where it adds value, not everywhere

---

## SESSION LOG (2026-01-11)

### Completed Today
1. **Timeline v3 Grid View** - Timely-style layout with:
   - Hour column with Clock icon header alignment
   - AI Summary column with 15-minute snapping
   - Screenshot column for visual context
   - App columns with grouped activity blocks (5-min gap threshold)
   - Pill-styled activity blocks with dynamic corners
   - "Now" indicator line (red) for current time
   - Full 24-hour grid (12 AM - 11 PM) with ScrollArea

2. **Sidebar Improvements**:
   - Consistent icons: Clock (Timeline), PieChart (Analytics), ClipboardList (Reports)
   - Settings button at bottom (opens drawer)
   - Removed top UnifiedHeader nav

3. **Daily Summary Card**:
   - Hours format: "Xh Ym" (not decimal)
   - Percentage can exceed 100%
   - Split Day Span into Start Time / End Time
   - Removed card styling from Breaks/Longest Focus

4. **Generate Summaries Button** - Added back to timeline header with batch generation

5. **V2 Data Sources Research** - Comprehensive analysis of shell, git, files, browser (see Section D)

6. **Midnight-Spanning Session Bug Fix** - Sessions and focus events that cross midnight are now clipped to day boundaries
   - Backend: `timeline_grid.go` now clips effectiveStart/effectiveEnd to dayStart/dayEnd
   - Fixes overflow where sessions starting at 11 PM and ending at 1 AM would render past grid bottom

---

## SECTION A: IMPLEMENT (Well-Designed Features)

### 1. Unified Timeline with V2 Events
**Status:** ✅ PARTIAL - Grid view complete (v3), event integration pending
**Priority:** HIGH - Core v2 differentiator

**COMPLETED (2026-01-11):**
- [x] Timely-style grid layout with hour rows and app columns
- [x] Activity blocks with pill styling and grouping (5-min gap threshold)
- [x] AI Summary column with 15-minute snapping
- [x] Screenshot column showing captures
- [x] "Now" indicator for current time
- [x] Full 24-hour scroll with ScrollArea

**REMAINING:**

**Design Philosophy:**
V2 tracks multiple event types (git commits, file changes, focus events, screenshots). These should appear chronologically on the Timeline, creating a rich activity feed that tells the story of what happened.

#### 1a. Event Types for Timeline

| Event Type | Source | Display | Icon | Color |
|------------|--------|---------|------|-------|
| **Session** | Activity tracking | Summary + duration | 🖥️ | Blue |
| **Screenshot** | Capture service | Thumbnail + app name | 📷 | Gray |
| **Git Commit** | Git watcher | Message + files changed | 🔀 | Green |
| **Git Branch** | Git watcher | Branch name + action (create/switch/merge) | 🌿 | Teal |
| **File Created** | File watcher | File path + size | 📄+ | Yellow |
| **File Modified** | File watcher | File path + change type | 📄✎ | Orange |
| **File Deleted** | File watcher | File path | 📄✕ | Red |
| **App Focus** | Focus tracker | App name + duration | 🎯 | Purple |
| **AFK Start** | AFK detector | "Away from keyboard" | 💤 | Gray |
| **AFK End** | AFK detector | "Returned" + duration away | ☕ | Gray |

#### 1b. Backend Implementation
- [ ] Backend: Create unified event query API
  - `GetTimelineEvents(startTime, endTime, eventTypes[], projectId?)` - Returns mixed event types
  - Returns polymorphic event objects with common fields + type-specific data
- [ ] Backend: Event aggregation options
  - `collapseFileEvents` - Group rapid file changes into single "X files modified" event
  - `collapseGitEvents` - Group commits within time window
  - `minDuration` - Filter out very short focus events
- [ ] Backend: Ensure all event tables have indexed timestamp columns

#### 1c. Frontend Implementation
- [ ] Frontend: Redesign Timeline component for mixed events
  ```
  ┌─────────────────────────────────────────────────────────────┐
  │ Timeline                              [Filter ▼] [Group ▼]  │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │ 10:45 AM ─────────────────────────────────────────────────  │
  │                                                             │
  │   🔀 Committed: "Fix authentication bug"                    │
  │      traq/backend • 3 files changed                         │
  │                                                             │
  │   📷 Screenshot • VSCode - auth.go                          │
  │      [thumbnail]                                            │
  │                                                             │
  │ 10:32 AM ─────────────────────────────────────────────────  │
  │                                                             │
  │   📄✎ Modified 5 files in traq/backend                      │
  │      auth.go, session.go, middleware.go...                  │
  │                                                             │
  │   🖥️ Session: Working on authentication refactor            │
  │      VSCode, Terminal • 45 min                              │
  │                                                             │
  │ 9:45 AM ──────────────────────────────────────────────────  │
  │                                                             │
  │   🌿 Switched to branch: feature/auth-refactor              │
  │      traq repository                                        │
  │                                                             │
  │   ☕ Returned from AFK (12 min away)                        │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
  ```

- [ ] Frontend: Event filtering
  - Toggle visibility by event type
  - Filter by project
  - Filter by app/repository
- [ ] Frontend: Event grouping options
  - By hour (default)
  - By session
  - By project
  - Flat (no grouping)
- [ ] Frontend: Expandable event details
  - Git commits: Show full message, diff stats, file list
  - File events: Show before/after for renames, full path
  - Sessions: Show screenshots, app breakdown
- [ ] Frontend: Event actions
  - All events: Add to/remove from project
  - Git commits: Link to GitHub/GitLab
  - Screenshots: View full size, delete
  - Sessions: Edit summary, merge/split

#### 1d. Performance Considerations
- [ ] Backend: Implement pagination for timeline (load more on scroll)
- [ ] Backend: Event count limits per type to prevent overwhelming
- [ ] Frontend: Virtual scrolling for long timelines
- [ ] Frontend: Lazy load thumbnails and expanded details

---

### 2. Analytics Page Redesign
**Status:** Current Analytics has Day/Week/Month/Year/Custom tabs - may be cluttered
**Priority:** Medium

**Design Philosophy:**
Analytics should answer specific questions, not dump all possible charts. Each view should have a clear purpose. Consider splitting into focused sub-pages rather than one mega-page.

#### 2a. Option A: Dashboard + Drill-Down Pages (Recommended)

**Main Analytics Dashboard (`/analytics`)**
```
┌───────────────────────────────────────────────────────────────────┐
│ Analytics Dashboard                    [Jan 6-10, 2026 ▼]        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐        │
│  │ Time Tracked            │  │ Productivity Score      │        │
│  │ ████████████░░░░ 6h 23m │  │ ●●●●●●●○○○ 72%          │        │
│  │ vs last period: +12%    │  │ vs last period: +5%     │        │
│  │           [View Details →]│  │           [View Details →]│        │
│  └─────────────────────────┘  └─────────────────────────┘        │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐        │
│  │ Top Apps                │  │ Git Activity            │        │
│  │ VSCode      ████ 3h 12m │  │ 12 commits today        │        │
│  │ Chrome      ██░░ 1h 45m │  │ 3 branches active       │        │
│  │ Terminal    █░░░   52m  │  │ 47 files changed        │        │
│  │           [View Details →]│  │           [View Details →]│        │
│  └─────────────────────────┘  └─────────────────────────┘        │
│                                                                   │
│  ┌─────────────────────────┐  ┌─────────────────────────┐        │
│  │ Projects                │  │ Focus Patterns          │        │
│  │ traq        ████ 4h 10m │  │ Peak: 10am-12pm         │        │
│  │ fleet-mlops ██░░ 1h 30m │  │ Avg session: 45 min     │        │
│  │ other       █░░░   43m  │  │ Context switches: 8     │        │
│  │           [View Details →]│  │           [View Details →]│        │
│  └─────────────────────────┘  └─────────────────────────┘        │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Drill-Down Pages:**

| Page | URL | Purpose | Key Charts |
|------|-----|---------|------------|
| **Time Analytics** | `/analytics/time` | When do you work? | Hourly heatmap, daily totals, week comparison |
| **App Analytics** | `/analytics/apps` | What apps do you use? | App breakdown, category pie, trends |
| **Project Analytics** | `/analytics/projects` | What projects get attention? | Project time, cross-project comparison |
| **Git Analytics** | `/analytics/git` | Code activity patterns | Commits over time, repos, file types |
| **Focus Analytics** | `/analytics/focus` | Deep work vs fragmentation | Session lengths, context switches, focus score |

- [ ] Frontend: Create Analytics dashboard with summary cards
- [ ] Frontend: Create Time Analytics page
- [ ] Frontend: Create App Analytics page
- [ ] Frontend: Create Project Analytics page
- [ ] Frontend: Create Git Analytics page
- [ ] Frontend: Create Focus Analytics page
- [ ] Frontend: Each card links to detailed page
- [ ] Frontend: Detailed pages maintain global date context

#### 2b. Option B: Simplified Tabs (Alternative)

Keep current tab structure but simplify each tab:

| Tab | Focus | Remove |
|-----|-------|--------|
| **Overview** | Summary cards only | Complex charts |
| **Time** | When you worked | App breakdown (move to Apps) |
| **Apps** | App usage | Time-based charts (move to Time) |
| **Projects** | Project breakdown | (new) |
| **Git** | Code activity | (new) |

#### 2c. Common Improvements (Either Option)
- [ ] Frontend: Add "compared to last period" context to all metrics
- [ ] Frontend: Add export button to each chart (PNG, CSV)
- [ ] Frontend: Add "drill down to Timeline" from any data point
- [ ] Frontend: Responsive card layout for different screen sizes
- [ ] Backend: Pre-aggregate common metrics for faster load
- [ ] Backend: Add comparison period to all analytics APIs

---

### 3. Hierarchical Summaries System
**Status:** Not implemented in v2
**Priority:** High

**What to Implement:**
- [ ] Backend: Implement hierarchical summary generation service
  - Daily summaries (synthesize all sessions for a day)
  - Weekly summaries (synthesize daily summaries)
  - Monthly summaries (synthesize weekly summaries)
- [ ] Backend: Add API methods
  - `GetHierarchicalSummary(periodType, periodDate)` - Get summary
  - `GenerateHierarchicalSummary(periodType, periodDate)` - Generate on-demand
  - `RegenerateHierarchicalSummary(periodType, periodDate)` - Regenerate existing
  - `ListHierarchicalSummaries(periodType)` - List all summaries
- [ ] Database: Create `hierarchical_summaries` table
- [ ] Frontend: Create **single** unified summary page (`/summary/:periodType/:periodDate`)
  - Handles day/week/month with conditional rendering
  - NOT separate pages per period type
- [ ] Frontend: Add navigation to summaries from Analytics

**Database Schema:**
```sql
CREATE TABLE hierarchical_summaries (
  id INTEGER PRIMARY KEY,
  period_type TEXT NOT NULL,  -- 'day', 'week', 'month'
  period_date TEXT NOT NULL,  -- ISO date
  summary TEXT NOT NULL,
  user_edited INTEGER DEFAULT 0,  -- Track if user modified
  generated_at INTEGER NOT NULL,
  UNIQUE(period_type, period_date)
);
```

---

### 4. Screenshots Browser Page
**Status:** Not implemented in v2
**Priority:** High

**What to Implement:**
- [ ] Frontend: Create dedicated Screenshots page (`/screenshots`)
- [ ] Frontend: Screenshot gallery view with filtering
  - Filter by date range
  - Filter by application
  - Search by OCR content (if available)
- [ ] Frontend: Basic batch operations
  - Bulk delete
  - Bulk export
- [ ] Backend: Add batch screenshot operations API
  - `BatchDeleteScreenshots(ids)`
  - `BatchExportScreenshots(ids, format)`

---

### 5. Reports UI Redesign
**Status:** v2 has basic markdown reports, UI needs complete rethink
**Priority:** Medium

**Design Philosophy:**
The v1 Reports UI was built around presets, history, and caching - all workarounds for slow generation. V2 should have fast generation and a simple, context-aware UI.

**What to Implement:**

#### 5a. Simplified Report Generation UI
- [ ] Frontend: Redesign Reports page with clean, minimal interface:
  ```
  ┌─────────────────────────────────────────────────┐
  │  Generate Report                                │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │  Period: [Uses global date context]             │
  │  ───────────────────────────────────            │
  │  Currently selected: Jan 6-10, 2026             │
  │                                                 │
  │  Quick Select:                                  │
  │  [Today] [This Week] [This Month] [Custom...]  │
  │                                                 │
  │  Format:                                        │
  │  ○ Markdown  ○ HTML  ○ JSON                    │
  │                                                 │
  │  Include:                                       │
  │  ☑ Session summaries                           │
  │  ☑ Screenshots (thumbnails)                    │
  │  ☑ Time breakdown                              │
  │  ☐ Git activity                                │
  │  ☐ File changes                                │
  │                                                 │
  │           [Generate Report]                     │
  │                                                 │
  └─────────────────────────────────────────────────┘
  ```

- [ ] Frontend: Integrate with global date context
- [ ] Frontend: Live preview panel (optional enhancement)

#### 5b. Fast Report Generation
- [ ] Backend: Optimize report generation for speed
  - Target: < 2 seconds for daily report
  - Target: < 5 seconds for weekly report
- [ ] Backend: Implement HTML report export
- [ ] Backend: Implement JSON report export

#### 5c. Report Content Options
- [ ] Backend: Add content inclusion options to `ExportReport()`
  - `includeSessions`, `includeScreenshots`, `includeTimeBreakdown`
  - `includeGitActivity`, `includeFileChanges` (v2 features)

**Note:** No presets table, no history table, no caching. Fast generation eliminates the need.

---

### 6. Basic Tag Management
**Status:** Basic tag display exists, no management
**Priority:** Medium

**What to Implement:**
- [ ] Backend: Add API methods
  - `GetAllTags()` - List all tags with occurrence counts
  - `RenameTag(oldName, newName)` - Rename tag
  - `MergeTags(sourceTag, targetTag)` - Merge two tags
  - `DeleteTag(tagName)` - Delete tag
- [ ] Frontend: Create Tag Management section in Settings
- [ ] Frontend: Tag editing in Timeline/Sessions

---

### 7. Window Focus Analytics
**Status:** Basic window tracking exists, no dedicated analytics
**Priority:** Medium

**What to Implement:**
- [ ] Backend: Verify `window_focus_events` table exists and is populated
- [ ] Backend: Add API method `GetWindowFocusDistribution(date, period)`
- [ ] Frontend: Add Window Focus section to Analytics
  - Chart showing time distribution across windows
  - Top windows by focus time
  - Application switching frequency

---

### 8. Day View Enhancements
**Status:** DayPage.tsx exists but may need polish
**Priority:** Low

**What to Implement:**
- [ ] Frontend: Verify/add core features:
  - Hourly activity breakdown
  - Screenshots grouped by hour
  - Previous/Next day navigation
  - Link to Timeline view
- [ ] Frontend: Add hourly summary cards

---

### 9. Settings Verification (Core Options Only)
**Status:** Settings page exists
**Priority:** Low

**What to Verify/Add:**
- [x] Capture interval configuration
- [x] AFK timeout settings
- [x] Ollama/AI model selection
- [x] Model management UI
- [x] Restart functionality
- [ ] Image format selection (WebP, PNG, JPEG)
- [ ] Basic quality setting (if impactful)

---

### 10. Project Detection with Manual Editing
**Status:** Not implemented in v2
**Priority:** Medium

**Design Philosophy:**
Auto-detection is valuable but must be correctable. Users should always be able to override detected values.

#### 10a. Project Detection Sources (Heuristics)
- [ ] Backend: Detect projects from multiple sources:
  - Git repository names (most reliable - v2 already tracks this)
  - VSCode/IDE window titles
  - File paths from file watching (v2 feature)
- [ ] Backend: Confidence scoring for detected projects

#### 10b. Manual Project Management
- [ ] Backend: Add API methods
  - `GetProjects()`, `CreateProject()`, `UpdateProject()`, `DeleteProject()`
  - `AssignSessionToProject()`, `SetProjectForPattern()`
- [ ] Database: Create projects table
  ```sql
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    detection_patterns TEXT,  -- JSON array of patterns
    is_manual INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  ```

#### 10c. Frontend UI
- [ ] Frontend: Project management in Settings
- [ ] Frontend: Project assignment in Timeline/Session detail
- [ ] Frontend: Project filter in Timeline

---

### 11. User-Editable Data System
**Status:** Not implemented - NEW for v2
**Priority:** High

**Design Philosophy:**
Tracked data is often imperfect. Users should be able to correct mistakes, add context, and customize their activity history. All edits should be non-destructive.

#### 11a. Editable Session Data
- [ ] Backend: Add edit APIs for sessions
  - `UpdateSessionSummary()`, `UpdateSessionTags()`, `UpdateSessionProject()`
  - `UpdateSessionNotes()`, `UpdateSessionTimeRange()`
  - `MergeSessions()`, `SplitSession()`
- [ ] Database: Add edit tracking columns
- [ ] Frontend: Edit UI in Session detail

#### 11b. Editable Hierarchical Summaries
- [ ] Backend: Add edit APIs
- [ ] Frontend: Edit UI in Summary view

#### 11c. Editable App Categories
- [ ] Backend: Verify/add APIs
- [ ] Frontend: App Category management in Settings
- [ ] Frontend: Quick categorize from Analytics

#### 11d. Editable Screenshot Metadata
- [ ] Backend: Add edit APIs
- [ ] Database: Add columns (`user_note`, `app_override`, `flags`)
- [ ] Frontend: Screenshot annotation UI

#### 11e. Edit History & Audit Trail (Optional)
- [ ] Database: Create edit history table
- [ ] Backend: Log all edits
- [ ] Frontend: "View edit history" option

---

## SECTION B: AI STRATEGY

### AI Usage Review

**Current State (v1):**
V1 used AI primarily for session summarization - taking screenshots + OCR text and generating a summary of what the user was doing.

**V2 Context:**
V2 has significantly richer, structured data sources that reduce the need for AI inference:

| Data Type | V1 Approach | V2 Approach | AI Needed? |
|-----------|-------------|-------------|------------|
| **What app?** | Screenshot + OCR | Direct focus tracking | ❌ No |
| **What project?** | Infer from OCR | Git repo + file paths | ❌ No |
| **What doing?** | AI summarize screenshots | Git commits + file changes | ⚠️ Maybe |
| **Time spent** | Infer from screenshots | Direct tracking | ❌ No |
| **Code changes** | N/A | Git diff + file events | ❌ No |

### AI Summarization: When and How

#### When to Run AI Summarization

**Recommendation: On-Demand + Hierarchical, Not Always-On**

| Trigger | Run AI? | Rationale |
|---------|---------|-----------|
| Every screenshot | ❌ No | Too expensive, data already captured |
| End of session | ⚠️ Optional | Only if session has screenshots without git context |
| End of day | ✅ Yes | Daily summary synthesis is high value |
| End of week | ✅ Yes | Weekly summary synthesis |
| User requests | ✅ Yes | On-demand generation |
| Report export | ✅ Yes | If including summaries |

**Implementation:**
- [ ] Backend: Remove automatic per-screenshot summarization
- [ ] Backend: Add session summarization as optional (triggered by user or EOD)
- [ ] Backend: Implement hierarchical summarization (daily → weekly → monthly)
- [ ] Settings: Add toggle "Auto-generate daily summaries" (default: on)
- [ ] Settings: Add toggle "Auto-generate session summaries" (default: off)

#### Updated Summarization Prompts

**Session Summary Prompt (when used):**
```
Given the following activity data for a work session:

STRUCTURED DATA:
- Duration: {duration}
- Primary App: {primary_app}
- Project: {detected_project}
- Git Activity: {commit_count} commits, {files_changed} files changed
- Key Commits: {commit_messages}
- File Changes: {file_summary}

SCREENSHOTS (if available):
{screenshot_descriptions}

Generate a 1-2 sentence summary of what the user accomplished during this session.
Focus on outcomes and work products, not just "user was using VSCode".
If git commits are present, prioritize that information.
```

**Daily Summary Prompt:**
```
Synthesize the following sessions into a daily summary:

DATE: {date}
TOTAL TIME: {total_duration}
PROJECTS WORKED ON: {projects}

SESSIONS:
{session_summaries}

GIT ACTIVITY:
- Repositories: {repos}
- Total Commits: {commit_count}
- Key Changes: {notable_commits}

Generate a 2-3 paragraph summary of the day's work.
Highlight accomplishments, progress made, and any context switches between projects.
```

**Weekly Summary Prompt:**
```
Synthesize the following daily summaries into a weekly review:

WEEK: {week_start} - {week_end}
TOTAL TIME: {total_duration}
DAYS ACTIVE: {active_days}/7

DAILY SUMMARIES:
{daily_summaries}

WEEKLY GIT STATS:
- Commits: {total_commits}
- Repositories: {repos}
- Most Active Day: {peak_day}

Generate a weekly review (3-4 paragraphs) covering:
1. Major accomplishments
2. Projects that received focus
3. Patterns or trends noticed
4. (Optional) Suggestions for next week
```

### Model Selection Strategy

#### Model Types and Use Cases

| Use Case | Model Type | Why | Example Models |
|----------|------------|-----|----------------|
| **Session Summary** | Small LLM | Fast, cheap, simple task | Llama 3.2 3B, Phi-3 |
| **Daily/Weekly Summary** | Medium LLM | Synthesis needs reasoning | Llama 3.1 8B, Mistral 7B |
| **Screenshot OCR** | Vision model | Image understanding | LLaVA, Llama 3.2 Vision |
| **App Detection** | None | Use system APIs | N/A |
| **Project Detection** | None (or small LLM) | Heuristics sufficient | Optional refinement only |

#### Vision Model Usage

**Current:** Screenshots → OCR → Text → LLM summarization

**Recommendation:** Use vision models directly for screenshot analysis

- [ ] Backend: Add vision model support for screenshot analysis
- [ ] Backend: Vision model extracts: app name, window title, visible text, activity type
- [ ] Settings: Vision model selection (separate from text model)
- [ ] Performance: Run vision analysis async, batch if possible

**When to Use Vision:**
- Screenshot capture (extract metadata)
- User clicks "Describe this screenshot"
- Generating summaries that reference screenshots

**When NOT to Use Vision:**
- If git/file data already explains the session
- If screenshot is just desktop/idle
- If user has disabled screenshot capture

### Other AI Opportunities

#### Implemented or Easy Wins

| Feature | AI Type | Effort | Value |
|---------|---------|--------|-------|
| **Tag suggestions** | Small LLM | Low | Medium - Suggest tags from session content |
| **Project detection refinement** | Small LLM | Low | Medium - Improve heuristic matching |
| **Natural language search** | Embeddings | Medium | High - "Find when I worked on auth bug" |
| **Anomaly detection** | Small LLM | Low | Low - "Unusually long session detected" |

#### Future Possibilities (Not for v2)

| Feature | AI Type | Effort | Value |
|---------|---------|--------|-------|
| **Productivity coaching** | Large LLM | High | Medium - Weekly suggestions |
| **Meeting prep** | Large LLM | High | Medium - Summarize recent work for standup |
| **Goal tracking** | Tool-calling LLM | High | Medium - Track progress toward stated goals |
| **Auto-categorization** | Fine-tuned model | High | Medium - Learn user's app categories |

### AI Configuration in Settings

- [ ] Settings: Model selection
  - Text model for summaries
  - Vision model for screenshots (can be same or different)
  - "Use same model for both" toggle
- [ ] Settings: Summarization frequency
  - Daily summaries: Auto / Manual only
  - Session summaries: Auto / Manual only / Disabled
- [ ] Settings: AI usage toggle (master switch)
  - "Enable AI features" - global on/off
- [ ] Settings: Cost/performance tradeoff
  - "Prioritize speed" - use smaller models
  - "Prioritize quality" - use larger models
  - "Balanced" - default

---

## SECTION C: SKIP ENTIRELY

These should NOT be implemented in v2:

| Feature | Reason |
|---------|--------|
| **Threshold Summaries** | Was an experiment in v1, not actually useful |
| **Report History & Saved Reports** | Fix generation speed instead of caching slow reports |
| **Report Presets Database** | Use simple hardcoded buttons, not a preset system |
| **PDF Export** | Complex to do well, users can print HTML to PDF |
| **Summarization Queue Management UI** | Leaks implementation details to users |
| **Separate summary pages per period** | One unified page is better |
| **`cached_reports` table** | Premature optimization |
| **`report_presets` table** | Overkill for personal tool |
| **AI Tag Consolidation Suggestions** | Nice-to-have, high complexity |
| **Daily Summary Synthesis (separate)** | Already covered by hierarchical summaries |
| **Terminal Introspection** | Replaced by git activity + file watching in v2 |
| **Always-on session summarization** | Expensive, structured data often sufficient |

### Terminal Introspection - Replaced by V2 Data Sources

| V1 Terminal Data | V2 Replacement | Why Better |
|------------------|----------------|------------|
| Commands run | Git commits | Shows actual meaningful work output |
| Working directory | Git repo tracking | More accurate project detection |
| SSH sessions | File watching | Tracks actual file changes regardless of how made |
| Tmux context | N/A | Low value, niche use case |

---

## SECTION D: V2 DATA SOURCES RESEARCH (2026-01-11)

### Overview

V2 tracks four rich data sources beyond window focus events:
1. **Shell Commands** - Terminal/shell history parsing
2. **Git Commits** - Repository commit tracking
3. **File Modifications** - Real-time filesystem watching
4. **Browser Activity** - Browser history reading

**Current Status:** All four sources are **collected and stored** but **only exposed as boolean flags** (`HasShell`, `HasGit`, `HasFiles`, `HasBrowser`) to the frontend. They are NOT visualized in the timeline grid.

---

### 1. Shell Commands

| Aspect | Details |
|--------|---------|
| **Tracker** | `internal/tracker/shell.go` |
| **Collection** | Polls shell history files (bash, zsh, fish, powershell) |
| **Checkpoint** | `shell_checkpoint.json` tracks read positions |
| **DB Table** | `shell_commands` |
| **Fields** | `timestamp`, `command`, `shell_type`, `working_directory`, `exit_code`, `duration_seconds`, `hostname`, `session_id` |
| **Exclusions** | Sensitive commands (passwords, keys), basic utils (ls, cd, pwd) |
| **Analytics** | Total count, top commands by frequency, shell type distribution |
| **Frontend API** | `SessionSummary.HasShell` boolean only |

**Integration Opportunities:**
- Show terminal icon when session has shell activity
- Display command count in session details
- Include commands in AI prompt for richer context
- Create "Commands" lane in timeline grid

---

### 2. Git Commits

| Aspect | Details |
|--------|---------|
| **Tracker** | `internal/tracker/git.go` |
| **Collection** | Scans registered repos via `git log` |
| **Checkpoint** | `git_checkpoint.json` per-repo last commit hash |
| **DB Tables** | `git_repositories`, `git_commits` |
| **Commit Fields** | `commit_hash`, `branch`, `message`, `files_changed`, `insertions`, `deletions`, `author_name`, `session_id` |
| **Repository Fields** | `path`, `name`, `remote_url`, `active` |
| **Analytics** | Total commits, insertions/deletions, top repos |
| **Frontend API** | `SessionSummary.HasGit` boolean, plus `api/client.ts` repo management |

**Integration Opportunities:**
- Show git icon with commit count in session header
- Display commit messages in session details
- Create "Commits" lane showing commit timestamps on timeline
- Use commit messages to enrich AI summaries
- Link to GitHub/GitLab when remote URL available

---

### 3. File Modifications

| Aspect | Details |
|--------|---------|
| **Tracker** | `internal/tracker/files.go` |
| **Collection** | Real-time via `fsnotify` |
| **Watch Categories** | downloads, projects, documents (user-configured) |
| **DB Table** | `file_events` |
| **Fields** | `event_type` (created/modified/deleted/renamed), `file_path`, `file_extension`, `file_size_bytes`, `watch_category`, `session_id` |
| **Exclusions** | `.git`, `node_modules`, `__pycache__`, `.swp`, `.tmp`, etc. |
| **Analytics** | Event type breakdown, top extensions |
| **Frontend API** | `SessionSummary.HasFiles` boolean, plus directory watch management |

**Integration Opportunities:**
- Show file activity indicator in session
- Display modified file count and types
- Create "Files" lane for timeline (group rapid changes)
- Include file paths in AI context for project detection
- Correlate with git commits for commit-related file changes

---

### 4. Browser Activity

| Aspect | Details |
|--------|---------|
| **Tracker** | `internal/tracker/browser.go` |
| **Collection** | Reads browser history DBs (Chrome, Firefox, Brave, Edge, Safari) |
| **Checkpoint** | `browser_checkpoint.json` per-browser timestamp |
| **DB Table** | `browser_history` |
| **Fields** | `url`, `title`, `domain`, `browser`, `visit_duration_seconds`, `transition_type`, `session_id` |
| **Exclusions** | Configurable excluded domains (localhost, internal) |
| **Analytics** | Visit count, unique domains, top domains, browser distribution |
| **Frontend API** | `SessionSummary.HasBrowser` boolean only |

**Integration Opportunities:**
- Show browser icon with domain count in session
- Display top domains visited during session
- Create "Browsing" lane on timeline (show domain transitions)
- Include domains in AI context (distinguish work vs personal browsing)
- Calculate time spent on productive vs distracting sites

---

### Timeline Integration Plan

#### Phase 1: Data Source Indicators
Add visual indicators to existing session cards:
```
┌─────────────────────────────────────────┐
│ Session 10:30-11:45                     │
│ "Working on auth refactor"              │
│                                         │
│ 🖥️ VSCode (45m) │ Terminal (20m)        │
│                                         │
│ [📷12] [💻8] [🔀3] [📁45] [🌐15]         │
│  ↑      ↑     ↑     ↑      ↑            │
│  screenshots  commits files  visits     │
│        commands                          │
└─────────────────────────────────────────┘
```

#### Phase 2: Data Source Lanes
Add collapsible lanes below app activity:
```
Hour   │ Summary    │ Screenshot │ VSCode │ Terminal │ Chrome
───────┼────────────┼────────────┼────────┼──────────┼────────
       │            │            │        │          │
 10:00 │ [Working   │ [thumb]    │ ██████ │ ████     │ ███
       │  on auth]  │            │        │          │
───────┼────────────┼────────────┼────────┼──────────┼────────
       │ 📁 5 files modified                         │
       │ 🔀 "Fix auth bug" (+45/-12)                 │
       │ 💻 npm run test, git commit                 │
       │ 🌐 stackoverflow.com, github.com            │
───────┼────────────────────────────────────────────────────
```

#### Phase 3: AI Prompt Enrichment
Update session summarization prompts to include:
```
Given the following activity data:

FOCUS ACTIVITY:
- Duration: 1h 15m
- Primary App: VSCode
- Window Titles: auth.go, session.go

SHELL COMMANDS (8 total):
- npm run test (3x)
- git commit -m "Fix auth bug"
- git push origin feature/auth

GIT ACTIVITY:
- 3 commits in traq repository
- Key commits: "Fix auth bug", "Add session validation"
- +127 lines, -34 lines

FILE CHANGES (45 events):
- Modified: auth.go (5x), session.go (3x), middleware.go (2x)
- Created: auth_test.go

BROWSER VISITS (15 total):
- stackoverflow.com (5 visits) - JWT token validation
- github.com (3 visits) - auth library docs

Generate a summary focusing on accomplishments and outcomes.
```

---

### Backend API Additions Needed

```go
// Timeline event retrieval
GetTimelineEvents(startTime, endTime int64, types []string) ([]TimelineEvent, error)

// Data source details per session
GetSessionDataSources(sessionID int) (*SessionDataSources, error)

type SessionDataSources struct {
    ShellCommands   []ShellCommand   `json:"shellCommands"`
    GitCommits      []GitCommit      `json:"gitCommits"`
    FileEvents      []FileEvent      `json:"fileEvents"`
    BrowserVisits   []BrowserVisit   `json:"browserVisits"`
}
```

### Frontend Components Needed

1. **DataSourceIndicators** - Icon badges showing counts
2. **DataSourceLanes** - Collapsible rows below main timeline
3. **SessionDataSourcesPanel** - Expandable detail view
4. **DataSourceFilters** - Toggle visibility by type

---

## Database Schema (Final)

**New tables for v2:**
```sql
-- Hierarchical summaries for daily/weekly/monthly aggregations
CREATE TABLE hierarchical_summaries (
  id INTEGER PRIMARY KEY,
  period_type TEXT NOT NULL,  -- 'day', 'week', 'month'
  period_date TEXT NOT NULL,  -- ISO date
  summary TEXT NOT NULL,
  user_edited INTEGER DEFAULT 0,
  generated_at INTEGER NOT NULL,
  UNIQUE(period_type, period_date)
);

-- Projects for grouping sessions
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  detection_patterns TEXT,  -- JSON array
  is_manual INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Edit history for audit trail (optional)
CREATE TABLE edit_history (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  edited_at INTEGER NOT NULL
);
```

**Columns to add to existing tables:**
```sql
-- Sessions
ALTER TABLE sessions ADD COLUMN project_id INTEGER REFERENCES projects(id);
ALTER TABLE sessions ADD COLUMN project_override INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN summary_edited INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN summary_original TEXT;
ALTER TABLE sessions ADD COLUMN user_notes TEXT;
ALTER TABLE sessions ADD COLUMN time_edited INTEGER DEFAULT 0;

-- Screenshots
ALTER TABLE screenshots ADD COLUMN user_note TEXT;
ALTER TABLE screenshots ADD COLUMN app_override TEXT;
ALTER TABLE screenshots ADD COLUMN flags TEXT;
```

---

## Implementation Order (Revised 2026-01-11)

**Phase 0: Timeline v3 (COMPLETED)**
- [x] Timely-style grid view layout
- [x] Hour column with aligned headers
- [x] AI Summary column with 15-min snapping
- [x] Screenshot column
- [x] App columns with grouped activity blocks
- [x] Sidebar improvements (icons, settings button)
- [x] Daily summary card redesign
- [x] Generate summaries batch button

**Phase 1: Data Source Integration (NEXT)**
1. **Data Source Indicators** - Show 📷💻🔀📁🌐 counts in sessions
2. **Backend API expansion** - `GetSessionDataSources()` endpoint
3. **Data Source Lanes** - Optional collapsible rows in timeline
4. **AI Prompt Enrichment** - Include shell/git/files/browser in summaries

**Phase 2: Core Infrastructure**
5. **User-Editable Sessions** - Foundation for data quality
6. **Project Detection + Manual Editing** - Groups related work
7. **Screenshots Browser** - High value, self-contained
8. **Hierarchical Summaries** - Enable daily/weekly/monthly views

**Phase 3: Analytics & Reporting**
9. **Analytics Page Redesign** - Dashboard + drill-down pages
10. **Reports UI Redesign** - Simplified, context-aware interface

**Phase 4: AI Refinement**
11. **AI Strategy Implementation** - On-demand summarization, updated prompts
12. **Vision Model Integration** - Direct screenshot analysis

**Phase 5: Polish**
13. **Basic Tag Management** - User-requested feature
14. **App Category Editing** - Improves productivity analytics accuracy
15. **Window Focus Analytics** - Enhances Analytics page
16. **Day View Polish** - Low effort improvements
17. **Settings Verification** - Fill gaps

---

## Summary Statistics (Revised 2026-01-11)

**Phase 0 (Timeline v3): COMPLETED** ✅
**Remaining Features:** 17 items across 5 phases
**Features to Skip:** 12 items

**Completed Scope (2026-01-11):**
- Timeline grid view (Timely-style)
- Activity block grouping and pill styling
- 15-minute session snapping
- Daily summary card redesign
- Sidebar improvements
- Data sources research and integration plan

**Remaining Scope:**
- Backend API methods: ~35-40 (timeline events, edit operations, analytics)
- Frontend pages: 5-7 new (Screenshots, Summary, Analytics sub-pages)
- Database migrations: 2 new tables + column additions
- UI components: ~15-18 (data source indicators, inline editors, analytics cards)

**Key Architectural Decisions:**
- Unified timeline with all event types
- User-editable data is first-class
- Analytics split into dashboard + drill-down pages
- AI is on-demand/hierarchical, not always-on
- Vision models for screenshots, small LLMs for summaries
- Reports are fast, not cached
- Projects are detected but always overridable
- Terminal tracking replaced by git + file watching
- **NEW: V2 data sources (shell/git/files/browser) should be visualized and used for AI context**

---

## V2-Only Features (Improvements Over v1)

These exist in v2 and should be preserved:
- Global date context synchronization
- Unified header with date navigation
- Multi-timeframe analytics tabs (Year, Custom range)
- Analytics drill-down to Timeline
- **Git repository tracking** (replaces terminal introspection)
- **File system watching** (replaces terminal introspection)
- **Unified timeline with mixed events** (NEW)
- App categorization system
- Bundled AI engine
- Productivity score calculation
- System theme detection
- Monitor/display selection
