#!/bin/bash

# Test prompt based on session 86 data
PROMPT='Analyze this work session and provide a detailed summary.

Session Duration: 51m
Screenshots: 101

=== APPLICATION ACTIVITY ===

Terminal (43m):
  - Tilix: tmux (11m)
  - Tilix: tmux (10m)
  - Tilix: tmux (6m)
  - Tilix: tmux (4m)
  - Tilix: tmux (3m)
  ... and 10 more windows

Chrome (17m):
  - traq-init - Google Chrome (6m)
  - Fine-tuning Gemma model - Claude - Google Chrome (5m)
  - Arcturus Networks Inc. uCmib™ - Google Chrome (5m)
  - Activity Tracker - 2026-01-12 - Google Chrome (2m)
  - 192.168.154.1 - Google Chrome (2m)

VS Code (3m):
  - TimelineWeekView.tsx - activity-tracker (Workspace) - Visual Studio Code (3m)

Traq (2m):
  - Traq (2m)

Please respond in this exact JSON format:
{
  "summary": "2-3 sentences describing SPECIFIC activities and accomplishments. Be specific about files, projects, documents worked on. Never use generic phrases like '\''coding and browsing'\''.",
  "explanation": "A paragraph explaining the main work themes and how activities connected.",
  "workThemes": ["theme1", "theme2"],
  "meetings": ["Meeting title 1", "Meeting title 2"],
  "keyActivities": [
    "Specific activity 1 with file/project names",
    "Specific activity 2 with context",
    "Specific activity 3"
  ],
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": "high"
}

GUIDELINES:
- Be SPECIFIC: mention file names, project names, document titles, meeting channels
- Detect work themes from related activities (e.g., files + commits in same project = "Project X development")
- Extract meeting titles from window titles (e.g., "Huddle: #eng-mv" = "Eng sync with #eng-mv")
- NEVER use generic phrases like "various activities", "code editing", "browser usage"
- If you see multiple files from the same project, group them as a single theme
- The summary should read like a human wrote it for a standup report
- workThemes should be 2-4 word descriptions of what was worked on (e.g., "Report Enhancement", "Bug Fixes", "Documentation Review")
- meetings should list clean meeting names extracted from window titles
- keyActivities should be 3-5 specific things accomplished
'

echo "=== Testing qwen2.5-1.5b-instruct ==="
time curl -s http://localhost:11434/api/generate -d "{
  \"model\": \"qwen2.5:1.5b-instruct\",
  \"prompt\": $(echo "$PROMPT" | jq -Rs .),
  \"stream\": false
}" | jq -r '.response'

echo -e "\n\n=== Testing gemma3:4b ==="
time curl -s http://localhost:11434/api/generate -d "{
  \"model\": \"gemma3:4b\",
  \"prompt\": $(echo "$PROMPT" | jq -Rs .),
  \"stream\": false
}" | jq -r '.response'

echo -e "\n\n=== Testing gemma3:12b-it-qat ==="
time curl -s http://localhost:11434/api/generate -d "{
  \"model\": \"gemma3:12b-it-qat\",
  \"prompt\": $(echo "$PROMPT" | jq -Rs .),
  \"stream\": false
}" | jq -r '.response'
