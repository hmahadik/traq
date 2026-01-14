  Session Summary: Traq Daily Summary Analysis & Gap Assessment

  Context: Traq is a privacy-first desktop activity tracker (Go/Wails + React/TypeScript) that captures screenshots, window focus events, and groups activity into sessions with AI-generated summaries.

  What Happened (3 user messages, 171 total conversation entries):

  1. Manual Daily Summary Generation

  User asked Claude to create a comprehensive daily summary (Jan 12, 2026) using all available Traq data. Claude directly queried SQLite tables:
  - sessions, window_focus_events, git_commits, browser_history, file_events, screenshots, afk_events
  - Manually aggregated and cross-referenced data
  - Produced a rich narrative report with specific details like:
    - "Chrome: Claude (15m), Acusight docs (22m), Antigravity research (30+ pages)"
    - "~30min Slack huddle in #eng-mv" (inferred from window title)
    - "Worked on Traq timeline fixes, added AFK column"
    - Time breakdown: 9h 35m active, 2h 16m AFK

  2. Gap Analysis Request

  User asked Claude to:
  - Document which data sources it used and how
  - For each Traq UI page, identify "expected behavior" vs actual behavior
  - Create a prioritized fix list to make Traq's reports match Claude's quality

  3. Comprehensive Analysis & UI Review

  Claude:
  - Examined the codebase (reports.go, inference.go, DailySummaryCard.tsx, ReportsPage.tsx)
  - Opened the Traq app in browser and reviewed actual UI output
  - Found the AI summary prompt (in inference.go) that generates session summaries
  - Identified the root cause: prompt asks for "1-2 sentences" and passes limited context (top 5-10 items only)

  Key Findings:

  Current AI Summary Prompt Issues:
  - Only passes top 10 focus events (>30s duration)
  - Only top 5 browser visits, top 5 file events
  - Asks for "brief 1-2 sentence summary"
  - Result: Generic summaries like "session involved code editing, browser usage, and documentation"

  What's Missing from Reports:
  1. Window titles not surfaced - Data exists but UI shows "Terminal 3h" instead of "Terminal: wails dev, git commands, npm test"
  2. No meeting detection - Slack title "Huddle: #eng-mv 🎤" not detected
  3. Browser history unused - Shows "Chrome 2h 59m" with zero context about what was researched
  4. No VS Code file breakdown - Can't see which files were edited
  5. No work theme clustering - No grouping into "Traq Dev", "Acusight", "Research" themes
  6. AFK breakdown missing - No detailed break times

  Prioritized Fix List (P0-P2):

  P0 (Critical):
  1. Add window titles to reports (GetAppUsageWithWindowTitles())
  2. Rewrite AI summary prompt to ask for specifics + pass more context
  3. Implement meeting detection (pattern-match Slack/Zoom titles)

  P1 (Important):
  4. Group browser history by domain/topic
  5. Extract VS Code filenames from window titles
  6. Add detailed AFK breakdown with times

  P2 (Nice-to-have):
  7. Implement work theme detection/clustering

  Session ended with Claude asking: "Want me to start implementing these fixes? I'd suggest starting with P0: Window titles in reports."

  ---
  Key Insight: Claude demonstrated that Traq collects all the necessary data but the current AI prompt and report generation logic don't leverage it effectively. The gap between what's possible (Claude's manual analysis) and what's currently shown (generic summaries) is entirely fixable through better data aggregation and prompt engineering.
