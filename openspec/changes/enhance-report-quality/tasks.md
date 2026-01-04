# Tasks: Add Project-Based Sections to Reports

## Phase 1: Project Extraction Logic

### 1.1 Implement Project Name Extraction
- [ ] 1.1.1 Add `_extract_project_from_summary(summary: dict, focus_events: list) -> str` to `reports.py`
- [ ] 1.1.2 Parse VS Code workspace from window titles (regex: `- (.+?) \(Workspace\) -`)
- [ ] 1.1.3 Parse terminal cwd from focus events' `terminal_context.working_directory`
- [ ] 1.1.4 Categorize as "Research" if Chrome on non-localhost URLs
- [ ] 1.1.5 Categorize as "Communication" if app in (Slack, Thunderbird, Zoom, Teams)
- [ ] 1.1.6 Fallback to app name if no project determinable

### 1.2 Group Summaries by Project
- [ ] 1.2.1 Add `_group_summaries_by_project(summaries, focus_events) -> dict[str, list]`
- [ ] 1.2.2 Aggregate time spent per project from underlying focus events
- [ ] 1.2.3 Sort projects by time spent (descending)
- [ ] 1.2.4 Cap at 5 projects + "Other" bucket

## Phase 2: Daily Report Sections

### 2.1 Generate Project Sections
- [ ] 2.1.1 Remove `sections=[]` hardcoding in `generate_daily_report()`
- [ ] 2.1.2 Call `_group_summaries_by_project()` to get project groupings
- [ ] 2.1.3 Create `ReportSection` for each project with title and aggregated content
- [ ] 2.1.4 Include time spent in section title (e.g., "Project: activity-tracker (2h 15m)")

### 2.2 Update Daily LLM Prompt
- [ ] 2.2.1 Pass project groupings to LLM prompt (not just flat summaries)
- [ ] 2.2.2 Request executive summary that mentions top projects
- [ ] 2.2.3 Test daily report generation with new sections

## Phase 3: Weekly/Monthly Synthesis

### 3.1 Update Weekly Report
- [ ] 3.1.1 Aggregate project sections across daily reports
- [ ] 3.1.2 Pass project time totals to weekly LLM prompt
- [ ] 3.1.3 Request pattern identification in prompt
- [ ] 3.1.4 Generate weekly sections by project

### 3.2 Update Monthly Report
- [ ] 3.2.1 Aggregate weekly project data
- [ ] 3.2.2 Pass to monthly LLM prompt
- [ ] 3.2.3 Generate monthly sections by project

## Phase 4: HTML Export Layout

### 4.1 Update HTML Template
- [ ] 4.1.1 Add project section cards to `_generate_html_report()` in `report_export.py`
- [ ] 4.1.2 Style cards with time spent badge
- [ ] 4.1.3 Use different colors for Research/Communication vs project sections

## Validation

- [ ] V1: Daily report for yesterday has project sections (not empty)
- [ ] V2: Project sections show time spent
- [ ] V3: Weekly report aggregates projects across days
- [ ] V4: HTML export displays section cards
