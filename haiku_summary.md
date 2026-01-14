● Summary for Opus

  Session Focus: Analysis of Traq's reporting capabilities compared to a manually-generated daily activity report

  What Happened

  You generated a high-quality daily report manually by querying and cross-referencing multiple data sources (sessions, git commits, window focus events, browser history, file activity). Then you analyzed what Traq's current system produces to identify gaps.

  Key Findings

  Manual Report Included:
  - Window-level context ("Chrome: Claude work 15m, Acusight 22m, Research 30m" instead of just "Chrome 3h")
  - Meeting detection from Slack window titles (Huddles with emoji indicators)
  - Work theme clustering (grouping related activities like "Traq dev", "Acusight", "Research")
  - Narrative insights ("afternoon commit burst", patterns, cross-referenced activities)
  - Granular breakdowns of email/documents, files, browser topics by domain

  Current Traq Gaps:
  1. Window title analysis not exposed - Shows app name only, not what you were actually doing within each app
  2. No meeting detection - Slack huddles, Google Meets not identified
  3. No work theme extraction - No project-based grouping, purely app-centric
  4. Limited browser analysis - Shows URLs, not topics/research categorization
  5. Flat data structure - All reports treat data as simple lists instead of cross-referenced contexts

  Prioritized Implementation Path

  P0 (Critical):
  1. Add window title analysis to reports (biggest impact)
  2. Detect meetings from Slack patterns
  3. Extract work themes through keyword clustering

  P1 (Should Have):
  - Group browser history by domain/topic
  - Break down VS Code by file
  - Extract document names from Mail window titles
  - Add narrative/pattern generation

  Current AI Summary Prompt Issue:
  The inference.go prompt (lines 187-287) is good at per-session summaries but limited to 1-2 sentences and doesn't request theme/project analysis or meeting detection.

  Bottom Line

  Traq has all the raw data. It needs context inference layers (window-level detail, pattern detection, theme extraction) to match the quality of the manual report. This isn't a data problem—it's an aggregation and presentation problem.
