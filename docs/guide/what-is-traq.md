# What is Traq?

Traq is a desktop application that helps you understand how you spend your time on your computer.

## How It Works

Traq runs in the background and:

1. **Captures screenshots** at regular intervals (default: every 30 seconds)
2. **Records window context** - which application is active and its window title
3. **Tracks development activity** - git commits, shell commands, file changes, browser visits
4. **Detects sessions** - groups your activity and recognizes when you're away (AFK)
5. **Generates AI summaries** - natural language descriptions of what you worked on (optional)
6. **Provides insights** - visualizes your activity patterns and app usage

## Key Features

### Smart Screenshot Capture

Traq uses perceptual hashing (dHash) to detect near-identical screenshots and skips them automatically. This saves disk space while still capturing meaningful changes in your activity.

### Session-Based Tracking

Activity is grouped into sessions. When you step away from your computer for more than 3 minutes (configurable), Traq detects this as AFK time and starts a new session when you return.

### Developer Activity Tracking

Beyond screenshots, Traq captures:
- **Git commits** - repository, branch, message, insertions/deletions
- **Shell commands** - terminal activity with exit codes and duration
- **File events** - downloads, project file changes, document edits
- **Browser visits** - pages visited with time spent

### AI-Powered Summaries

Optionally connect to an AI provider (OpenAI, Anthropic, or local Ollama) to automatically generate:
- Session summaries describing what you worked on
- Tags and categories for quick filtering
- Confidence scores for summary accuracy

### Privacy-First

All data stays on your machine:
- Screenshots are stored locally in `~/.local/share/traq/screenshots/`
- Activity data is stored in a local SQLite database
- Nothing is sent to external servers (AI summaries use your own API keys)

## Use Cases

- **Time tracking** - See where your time goes each day
- **Productivity analysis** - Identify patterns in your work habits
- **Activity review** - Scroll through your day's screenshots as a visual timeline
- **Report generation** - Create summaries for timesheets or personal records
- **Standup prep** - Quickly review what you accomplished yesterday
- **Break reminders** - Color-coded indicators show when you need a break
