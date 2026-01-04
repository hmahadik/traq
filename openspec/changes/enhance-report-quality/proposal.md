# Change: Add Project-Based Sections to Reports

## Why

Daily reports lack structure. While threshold summaries already contain specific details (file names, project context), daily reports flatten everything into a single `executive_summary` with `sections=[]` hardcoded.

Users want to see their day organized by project, not as a wall of text.

**Current state (what works well):**
- Terminal context captures working_directory, foreground_process (80% coverage)
- Threshold summaries mention specific files (day.js, daemon.py, etc.)
- LLM already extracts file/project names from window titles

**Gap:**
- Daily reports have no sections structure
- Weekly/monthly reports don't aggregate by project
- No "Research" or "Communication" categorization

## What Changes

### 1. Add Project-Based Sections to Daily Reports
- Derive project names from VS Code workspace or terminal cwd
- Group threshold summaries by project
- Add "Research" category for browser activity (non-localhost)
- Add "Communication" category for Slack/email/Zoom
- Limit to top 5 projects + "Other"

### 2. Enhance Weekly/Monthly Synthesis
- Pass project sections (not just executive summaries) to weekly LLM prompt
- Request pattern identification: "Which projects got most attention?"
- Generate weekly sections aggregating daily project data

### 3. Improve HTML Export Layout
- Display project sections as cards with time spent
- Keep existing analytics (already has app breakdown, focus chart)

## Out of Scope (Future Work)

- **Terminal context fixes** - Already working at 80% coverage
- **Window title parsing** - LLM already extracts specifics from titles
- **Derived analytics** (deep work, context switches) - Separate proposal
- **PDF export changes** - Uses HTML, changes flow through

## Impact

- **Affected specs**: reports
- **Affected code**:
  - `tracker/reports.py` - Project extraction, section generation
  - `tracker/report_export.py` - HTML template for sections
- **Risk**: Low - additive change, doesn't break existing reports
