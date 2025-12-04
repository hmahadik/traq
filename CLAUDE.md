# Activity Tracker MVP

## Session Start Instructions
When starting a new session on this project:
1. Run `git status`, `git diff`, and `git log --oneline -10` to understand recent changes
2. Check for any TODO comments: `grep -r "TODO" tracker/`
3. Review the Decision Log below for context
4. Inform user that you've reviewed recent changes and ask what to work on next

**IMPORTANT:** After every task, check if CLAUDE.md needs to be updated

## Project Goal
Linux background service that captures screenshots at intervals, stores metadata in SQLite, and provides a simple web viewer.

## Tech Stack
- Python 3.11+
- mss for screenshots
- SQLite for metadata
- Flask for web viewer
- WebP for image compression
- pytest for testing

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
│   └── daemon.py       # Background service daemon
├── web/
│   ├── app.py          # Flask application
│   └── templates/
├── tests/              # Pytest test suite
│   ├── conftest.py     # Test fixtures
│   ├── test_capture.py # Capture functionality tests
│   ├── test_storage.py # Storage CRUD tests
│   └── test_dhash.py   # Hash comparison tests
├── scripts/
│   └── install.sh      # Systemd service setup
├── config.yaml.example
├── requirements.txt
├── README.md           # Project documentation
└── CLAUDE.md
```

## Decision Log
- **2025-11-27**: Added comprehensive test suite with pytest (85% coverage target)
- **2025-11-27**: Added full docstrings to all modules following PEP 257
- **2025-11-27**: Created README.md with installation and usage instructions
- **2025-11-27**: Identified 13 edge cases requiring attention (see TODO comments)
### 2024-12-02 - Phase 1: Timeline + Analytics
- Building rich timeline UI with calendar heatmap + hourly drill-down
- Full analytics dashboard with charts (using Chart.js)
- New routes: /timeline, /analytics, /api/activity-data
- Keeping existing day view, timeline is additive
- Stack: Flask + Jinja2 + Chart.js + vanilla JS (no React)

## Known Issues (TODO Comments Added)
- **Multi-monitor support**: Currently hardcoded to primary monitor
- **Wayland compatibility**: Assumes X11, needs display server detection  
- **Permission handling**: Missing checks for directory/file access
- **Configuration**: config.py mentioned but doesn't exist
- **Error resilience**: Daemon needs better error recovery

## Testing
Run tests with: `pytest tests/ --cov=tracker --cov-report=html`
Test categories: capture, storage, dhash, integration

