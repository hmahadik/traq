# Design: Add Project-Based Sections to Reports

## Context

Daily reports currently have `sections=[]` hardcoded. Users see a single executive summary but no structured breakdown by project. The data to support project grouping already exists:
- Window titles contain workspace names (VS Code) and page titles (Chrome)
- Terminal context contains working_directory (80% populated)
- Threshold summaries mention specific files and projects

This change adds structure without changing data capture.

## Goals / Non-Goals

### Goals
- Organize daily reports by project (not a wall of text)
- Show time spent per project
- Categorize non-project activities (Research, Communication)
- Propagate project structure to weekly/monthly reports

### Non-Goals
- Changing data capture (terminal introspection, screenshots)
- Adding new analytics (deep work sessions, context switches)
- Modifying threshold summarization prompts

## Decisions

### D1: Project Extraction Strategy

**Decision**: Extract project name from window titles and terminal context at report generation time.

**Patterns**:
```python
# VS Code: "file.py - workspace (Workspace) - Visual Studio Code"
VSCODE_WORKSPACE = r"- (.+?) \(Workspace\) -"

# Terminal: use last component of working_directory
# "/home/user/projects/activity-tracker" -> "activity-tracker"
```

**Categories**:
| Source | Project Name |
|--------|--------------|
| VS Code window title | Workspace name |
| Terminal with cwd | Directory name |
| Chrome (non-localhost) | "Research" |
| Slack/Thunderbird/Zoom | "Communication" |
| Other | App name as fallback |

### D2: Section Structure

**Decision**: ReportSection per project, limited to top 5 by time.

```python
sections = [
    ReportSection(title="activity-tracker (2h 15m)", content="..."),
    ReportSection(title="Research (45m)", content="..."),
    ReportSection(title="Communication (20m)", content="..."),
]
```

Remaining activities aggregated under "Other".

### D3: Weekly/Monthly Aggregation

**Decision**: Aggregate project time across days, pass to LLM for synthesis.

Weekly prompt includes:
```
Project time this week:
- activity-tracker: 12h 30m (Mon, Tue, Thu)
- acusight: 8h 15m (Wed, Fri)
- Research: 3h 45m
```

## Risks / Trade-offs

### R1: Project Name Variations
**Risk**: Same project may appear as "activity-tracker" and "Activity Tracker".
**Mitigation**: Normalize to lowercase, strip common suffixes. Accept some duplication initially.

### R2: Miscategorization
**Risk**: Chrome on localhost:55555 might be "Research" when it's testing activity-tracker.
**Mitigation**: Exclude localhost from Research category.

## Open Questions

1. Should we merge similar project names (fuzzy matching)?
   - **Proposed**: No, keep simple. Let variations exist for now.

2. How to handle days with no clear project?
   - **Proposed**: Use "General" or top app name as section.
