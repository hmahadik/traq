# What is Traq?

Traq is a desktop application that helps you understand how you spend your time on your computer.

## How It Works

Traq runs in the background and:

1. **Captures screenshots** at regular intervals (default: every 30 seconds)
2. **Records window context** - which application is active and its window title
3. **Detects sessions** - groups your activity and recognizes when you're away (AFK)
4. **Provides insights** - visualizes your activity patterns and app usage

## Key Features

### Smart Screenshot Capture

Traq uses perceptual hashing (dHash) to detect near-identical screenshots and skips them automatically. This saves disk space while still capturing meaningful changes in your activity.

### Session-Based Tracking

Activity is grouped into sessions. When you step away from your computer for more than 3 minutes (configurable), Traq detects this as AFK time and starts a new session when you return.

### Privacy-First

All data stays on your machine:
- Screenshots are stored locally in `~/.local/share/traq/screenshots/`
- Activity data is stored in a local SQLite database
- Nothing is sent to external servers

## Use Cases

- **Time tracking** - See where your time goes each day
- **Productivity analysis** - Identify patterns in your work habits
- **Activity review** - Scroll through your day's screenshots as a visual timeline
- **Report generation** - Create summaries for timesheets or personal records
