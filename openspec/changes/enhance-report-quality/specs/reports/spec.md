# Reports Spec Delta

## ADDED Requirements

### Requirement: Project-Based Daily Report Sections
Daily reports SHALL include sections grouped by project rather than a single flat summary.

#### Scenario: Daily report with multiple projects
- **GIVEN** a day with activity in activity-tracker (3 hours), research (1 hour), and Slack (30 min)
- **WHEN** a daily report is generated
- **THEN** the report SHALL include sections:
  - "activity-tracker (3h 0m)" with summarized activities
  - "Research (1h 0m)" with topics explored
  - "Communication (30m)" with apps used
- **AND** sections SHALL be ordered by time spent (descending)

#### Scenario: Limit number of project sections
- **GIVEN** a day with activity in 10 different projects
- **WHEN** a daily report is generated
- **THEN** the report SHALL include at most 5 project sections
- **AND** remaining projects SHALL be aggregated under an "Other" section

#### Scenario: Daily report with no clear project
- **GIVEN** a day with only browser and terminal activity (no VS Code workspace)
- **WHEN** a daily report is generated
- **THEN** the report SHALL categorize activities by type (Research, Communication, terminal app names)

### Requirement: Project Extraction Logic
The system SHALL derive project names from window titles and terminal context.

#### Scenario: Extract project from VS Code workspace
- **GIVEN** focus events with window title "daemon.py - activity-tracker (Workspace) - Visual Studio Code"
- **WHEN** extracting project name
- **THEN** the project name SHALL be "activity-tracker"

#### Scenario: Extract project from terminal cwd
- **GIVEN** focus events with terminal_context containing `working_directory: "/home/user/projects/myapp"`
- **WHEN** extracting project name
- **THEN** the project name SHALL be "myapp" (directory name)

#### Scenario: Categorize browser activity as Research
- **GIVEN** Chrome activity on non-localhost pages
- **WHEN** extracting project name
- **THEN** the activity SHALL be categorized as "Research"

#### Scenario: Exclude localhost from Research
- **GIVEN** Chrome activity on "localhost:55555/timeline"
- **WHEN** extracting project name
- **THEN** the activity SHALL NOT be categorized as "Research"
- **AND** the activity MAY be linked to a project if determinable from context

#### Scenario: Categorize communication apps
- **GIVEN** activity in Slack, Thunderbird, or Zoom
- **WHEN** extracting project name
- **THEN** the activity SHALL be categorized as "Communication"

### Requirement: Weekly Report Project Aggregation
Weekly reports SHALL aggregate project time across days.

#### Scenario: Weekly report shows project distribution
- **GIVEN** a week where activity-tracker received 60% of time across 3 days
- **AND** acusight received 25% of time across 2 days
- **WHEN** a weekly report is generated
- **THEN** the executive summary SHALL mention project distribution
- **AND** sections SHALL exist for top projects

#### Scenario: Weekly report includes day breakdown
- **WHEN** a weekly report is generated
- **THEN** project sections SHALL indicate which days the project was worked on

### Requirement: Monthly Report Project Trends
Monthly reports SHALL show project focus across the month.

#### Scenario: Monthly report project summary
- **GIVEN** a month with varying project focus across weeks
- **WHEN** a monthly report is generated
- **THEN** the report SHALL identify which projects received most focus
- **AND** the report SHALL show weekly trends if available

### Requirement: HTML Export Project Sections
HTML exports SHALL display project sections with visual distinction.

#### Scenario: Project section cards in HTML
- **GIVEN** a report with project sections
- **WHEN** exporting to HTML
- **THEN** each project section SHALL be displayed as a card
- **AND** cards SHALL show time spent prominently
- **AND** Research and Communication sections MAY have distinct styling
