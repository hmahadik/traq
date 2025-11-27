# Activity Tracker MVP

## Session Start Instructions
When starting a new session on this project:
1. Run `git status` and `git log --oneline -10` to understand recent changes
2. Check for any TODO comments: `grep -r "TODO" tracker/`
3. Review the Decision Log below for context
4. After completion of a task, update CLAUDE.md if needed

## Project Goal
Linux background service that captures screenshots at intervals, stores metadata in SQLite, and provides a simple web viewer.

## Tech Stack
- Python 3.11+
- mss for screenshots
- SQLite for metadata
- Flask for web viewer
- WebP for image compression

## Architecture
- Capture daemon: runs via systemd user service
- Storage: ~/activity-tracker-data/
  - screenshots/YYYY/MM/DD/{timestamp}_{hash}.webp
  - activity.db (SQLite)
- Web viewer: localhost:5000

## Key Constraints
- X11 first (Wayland support later)
- Fixed 30-second intervals for MVP
- No OCR in MVP
- Single monitor assumption for MVP

## File Structure
```
activity-tracker/
├── tracker/
│   ├── __init__.py
│   ├── capture.py      # Screenshot capture logic
│   ├── storage.py      # SQLite + filesystem management
│   └── config.py       # Configuration handling
├── web/
│   ├── app.py          # Flask application
│   └── templates/
├── scripts/
│   └── install.sh      # Systemd service setup
├── config.yaml.example
├── requirements.txt
└── CLAUDE.md
```

