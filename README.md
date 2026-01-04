# Activity Tracker

A Linux background service that automatically captures desktop screenshots at regular intervals, stores metadata in SQLite, and provides a rich web interface with timeline visualization and analytics for browsing your activity history.

## Features

- **Automated Screenshot Capture**: Captures desktop screenshots every 30 seconds
- **Perceptual Duplicate Detection**: Uses dhash algorithm to skip near-identical screenshots
- **Window Context Extraction**: Records active window title and application name
- **Session-Based Tracking**: Automatically detects AFK periods to group activity into sessions
- **AFK Detection**: Uses pynput to monitor keyboard/mouse activity (configurable timeout)
- **Window Focus Tracking**: Real-time tracking of app/window usage with duration metrics
- **Terminal Introspection**: Detects what's running in terminals (vim, python, npm) with tmux/SSH context
- **Timeline View**: Interactive calendar heatmap with session-based activity breakdown
- **Analytics Dashboard**: Comprehensive charts showing activity patterns and trends
- **Report Generation**: Natural language time ranges ("last week", "past 3 days") with multiple formats
- **Web-based Viewer**: Rich Flask interface with multiple views for browsing and analysis
- **Efficient Storage**: WebP compression with thumbnails for fast loading
- **Systemd Integration**: Runs as user service with automatic restart
- **X11 Support**: Optimized for X11 display server (Wayland support planned)
- **AI Activity Summaries**: Two-stage vision LLM-powered summaries with structured output
- **Activity-Based Summarization**: Summaries triggered on session end with debouncing
- **Focus-Weighted Sampling**: Hamilton allocation by (app, window_title) pairs
- **Smart Session Resume**: Resumes previous session on restart if within AFK timeout
- **Multi-monitor Support**: Captures only the active monitor, reducing storage needs
- **Project Grouping**: Groups related activities in timeline view

## Architecture

### Components

1. **Screenshot Capture (`tracker/capture.py`)**
   - MSS library for fast cross-platform screen capture
   - Perceptual hashing (dhash) for duplicate detection
   - WebP compression with 80% quality
   - Organized filesystem storage (YYYY/MM/DD structure)

2. **Database Storage (`tracker/storage.py`)**
   - SQLite database for metadata storage
   - Indexed queries for time-range and hash-based lookups
   - Context manager for safe database operations

3. **Background Daemon (`tracker/daemon.py`)**
   - Main service process with 30-second intervals
   - Signal handling for graceful shutdown
   - Window information extraction via xdotool
   - Duplicate detection and storage optimization
   - Session management with AFK detection
   - Smart session resume on restart

4. **AFK Detection (`tracker/afk.py`)**
   - Monitors keyboard and mouse activity via pynput
   - Configurable timeout (default 3 minutes)
   - Fires callbacks on AFK/active state transitions
   - Auto-installs missing dependencies

5. **Session Manager (`tracker/sessions.py`)**
   - Tracks continuous activity periods
   - Links screenshots to sessions
   - Handles session start/end with metadata
   - Minimum session duration filtering

6. **Web Viewer (`web/app.py`)**
   - Flask application with multiple views (timeline, analytics, day view)
   - Interactive timeline with calendar heatmap and session breakdown
   - Analytics dashboard with charts and statistics
   - Date-based navigation
   - REST API for programmatic access

7. **Analytics Engine (`tracker/analytics.py`)**
   - Activity pattern analysis and statistics
   - Calendar heatmap data generation
   - Hourly/daily/weekly aggregations
   - Application usage tracking

8. **Vision Summarizer (`tracker/vision.py`)**
   - Two-stage LLM summarization via Ollama
   - Focus-weighted screenshot sampling (Hamilton allocation)
   - Groups by (app_name, window_title) pairs with min 3 samples
   - Structured output: SUMMARY, EXPLANATION, CONFIDENCE, TAGS
   - App/window usage context passed to LLM for accurate summaries
   - Returns full API request details for debugging

9. **Summarizer Worker (`tracker/summarizer_worker.py`)**
   - Activity-based triggers (summarizes on session end)
   - Debouncing to handle brief returns
   - Session merging for daemon-restart fragmentation
   - Startup recovery for unsummarized sessions
   - Preview summaries during active sessions

10. **Window Focus Tracker (`tracker/window_watcher.py`)**
    - Real-time window focus tracking via xdotool/xprop
    - Duration tracking per app and window title
    - Focus events stored in database with session links
    - Provides time breakdown data for AI summarization

11. **Terminal Introspection (`tracker/terminal_introspect.py`)**
    - Inspects processes running inside terminal emulators
    - Walks process tree via /proc filesystem
    - Detects foreground command (vim, python, npm, etc.)
    - Identifies SSH sessions and tmux context
    - Supports multiple terminals: Tilix, gnome-terminal, Alacritty, Kitty, etc.

12. **Report Generator (`tracker/reports.py`, `tracker/report_export.py`)**
    - Natural language time range parsing ("last week", "past 3 days")
    - Three report types: Summary, Detailed, Standup
    - Export to Markdown, HTML, PDF, JSON formats
    - Cached reports (daily/weekly/monthly) with LLM synthesis
    - Export history tracking

13. **Tag Detector (`tracker/tag_detector.py`)**
    - Extracts activity tags from summaries
    - Categories: development, communication, research, etc.

### Data Storage Structure

```
~/activity-tracker-data/
├── screenshots/
│   └── YYYY/
│       └── MM/
│           └── DD/
│               └── YYYYMMDD_HHMMSS_hash.webp
├── activity.db (SQLite database)
└── logs/
    └── daemon.log
```

### Database Schema

```sql
-- Screenshots with window geometry and monitor info
CREATE TABLE screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    filepath TEXT NOT NULL,
    dhash TEXT NOT NULL,
    window_title TEXT,
    app_name TEXT,
    window_x INTEGER,
    window_y INTEGER,
    window_width INTEGER,
    window_height INTEGER,
    monitor_name TEXT,
    monitor_width INTEGER,
    monitor_height INTEGER
);

CREATE INDEX idx_timestamp ON screenshots(timestamp);
CREATE INDEX idx_dhash ON screenshots(dhash);

-- Hourly activity summaries (legacy)
CREATE TABLE activity_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    hour INTEGER NOT NULL,
    summary TEXT NOT NULL,
    screenshot_ids TEXT NOT NULL,
    model_used TEXT NOT NULL,
    inference_time_ms INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, hour)
);

-- Daily consolidated summaries
CREATE TABLE daily_summaries (
    date TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity sessions (continuous periods of user activity)
CREATE TABLE activity_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    summary TEXT,
    screenshot_count INTEGER DEFAULT 0,
    unique_windows INTEGER DEFAULT 0,
    model_used TEXT,
    inference_time_ms INTEGER,
    prompt_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Session screenshots junction table
CREATE TABLE session_screenshots (
    session_id INTEGER REFERENCES activity_sessions(id),
    screenshot_id INTEGER REFERENCES screenshots(id),
    PRIMARY KEY (session_id, screenshot_id)
);

-- Session OCR cache (per unique window title)
CREATE TABLE session_ocr_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES activity_sessions(id),
    window_title TEXT NOT NULL,
    ocr_text TEXT,
    screenshot_id INTEGER,
    UNIQUE(session_id, window_title)
);

-- Activity-based summaries (triggered on session end)
CREATE TABLE threshold_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    summary TEXT NOT NULL,
    screenshot_ids TEXT NOT NULL,
    screenshot_count INTEGER NOT NULL,
    model_used TEXT NOT NULL,
    config_snapshot TEXT,
    inference_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    regenerated_from INTEGER REFERENCES threshold_summaries(id)
);

-- Summary to screenshot relationships
CREATE TABLE threshold_summary_screenshots (
    summary_id INTEGER NOT NULL REFERENCES threshold_summaries(id) ON DELETE CASCADE,
    screenshot_id INTEGER NOT NULL REFERENCES screenshots(id) ON DELETE CASCADE,
    PRIMARY KEY (summary_id, screenshot_id)
);

-- Window focus tracking
CREATE TABLE window_focus_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    window_title TEXT NOT NULL,
    app_name TEXT NOT NULL,
    window_class TEXT,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration_seconds REAL NOT NULL,
    session_id INTEGER REFERENCES activity_sessions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Exported reports history
CREATE TABLE exported_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    time_range TEXT NOT NULL,
    report_type TEXT NOT NULL,
    format TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cached periodic reports (daily/weekly/monthly)
CREATE TABLE cached_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    period_type TEXT NOT NULL,
    period_date TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    executive_summary TEXT,
    sections_json TEXT,
    analytics_json TEXT,
    summary_ids_json TEXT,
    model_used TEXT,
    inference_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    prompt_text TEXT,
    explanation TEXT,
    tags TEXT
);
```

## Installation

### Prerequisites

- **Python 3.11+** with pip
- **X11 display server** (standard on most Linux desktops)
- **xdotool** for window information extraction
- **systemd** for service management (optional but recommended)

```bash
# Ubuntu/Debian
sudo apt install python3 python3-pip python3-venv xdotool

# Fedora/RHEL
sudo dnf install python3 python3-pip xdotool

# Arch Linux
sudo pacman -S python python-pip xdotool
```

### Setup

1. **Clone and setup virtual environment:**

```bash
git clone <repository-url>
cd activity-tracker
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. **Install as systemd service:**

```bash
# Run the installation script (automatically enables and starts the service)
./scripts/install.sh

# The script automatically enables:
# - Web interface at http://127.0.0.1:55555
# - Auto-summarization (triggers on session end)
```

3. **Verify installation:**

```bash
# Check service status
systemctl --user status activity-tracker

# View live logs
journalctl --user -u activity-tracker -f
```

### AI Summarization (Optional)

The activity tracker can generate AI-powered summaries of your work using a local vision LLM running in Docker. This requires additional setup:

**Hardware Requirements:**
- **gemma3:12b-it-qat** (recommended): ~8GB VRAM (RTX 3080, 4070, 4080)
- **gemma3:27b-it-qat** (high-end): ~18GB VRAM (RTX 3090, 4090, A6000)
- **gemma3:4b-it-qat** (lightweight): ~3GB VRAM (any modern GPU)

**Software Dependencies:**

```bash
# Start Ollama Docker container (with GPU support)
docker run -d --gpus=all \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  --name ollama \
  ollama/ollama

# Pull the vision model (choose based on your VRAM)
docker exec ollama ollama pull gemma3:12b-it-qat    # ~8GB VRAM (recommended)
# OR
docker exec ollama ollama pull gemma3:27b-it-qat    # ~18GB VRAM (high-end)
```

**Managing the Ollama Container:**

```bash
# Stop the container
docker stop ollama

# Start the container
docker start ollama

# View container logs
docker logs ollama

# Check available models
docker exec ollama ollama list
```

**Remote Ollama Server:**

Configure the Ollama host in the Settings page (`http://127.0.0.1:55555/settings`) or edit `~/.config/activity-tracker/config.yaml`:

```yaml
summarization:
  ollama_host: http://gpu-server:11434
```

**Activity-Based Summarization:**

Auto-summarization is enabled by default. Summaries are generated when sessions end (user goes AFK). Configure this in the Settings page:
- **Model**: Select from available Ollama models (auto-detected)
- **Quality Preset**: Quick (5 samples), Balanced (10 samples), Thorough (15 samples)
- **Content to Include**: App/window usage, Screenshots, OCR text (checkboxes)
- **Advanced Settings**: Ollama host, crop to window, prompt preview

**How Two-Stage Summarization Works:**
1. Focus-weighted sampling selects screenshots by (app, window_title) time spent
2. Hamilton allocation ensures fair representation (min 3 samples)
3. Stage 1: Vision LLM analyzes screenshots with focus context
4. Stage 2: Text LLM synthesizes structured output (summary, explanation, confidence, tags)

## Usage

### Running the Service

The service runs automatically after installation via systemd:

```bash
# Start the service
systemctl --user start activity-tracker

# Stop the service
systemctl --user stop activity-tracker

# Restart the service
systemctl --user restart activity-tracker

# View status and recent logs
systemctl --user status activity-tracker
```

### Web Interface

The web interface can run in two modes:

**Option 1: Integrated Mode (Recommended)**
If you enabled the web interface during installation, it runs automatically with the daemon:
```bash
# Web server is already running with the systemd service
# Just open your browser
firefox http://localhost:55555
```

**Option 2: Standalone Mode**
Run the web interface separately (if you didn't enable it during install):
```bash
# Start the web interface
cd activity-tracker
source venv/bin/activate
python web/app.py

# Open in browser (runs on port 55555)
firefox http://localhost:55555
```

### AI Summarization

Generate activity summaries from your screenshots:

```bash
# Summarize today's unsummarized hours
python scripts/summarize_activity.py

# Summarize a specific date
python scripts/summarize_activity.py --date 2025-12-01

# Backfill last 7 days
python scripts/summarize_activity.py --backfill 7

# Summarize only a specific hour
python scripts/summarize_activity.py --hour 14

# Re-generate existing summaries
python scripts/summarize_activity.py --force

# Preview what would be processed
python scripts/summarize_activity.py --dry-run

# Use a different model (for lower VRAM)
python scripts/summarize_activity.py --model gemma3:14b-it-qat
```

**Web Interface:**
- Timeline view shows activity summaries with explanation and tags
- Click any summary to view details (screenshots, focus breakdown)
- "Generate" on any time slot to create a summary
- Daily Summary section shows consolidated summaries
- Analytics dashboard displays recent activity summaries

#### Available Views

1. **Timeline View** (`http://localhost:55555/timeline`) - Default homepage
   - Interactive calendar heatmap showing daily activity intensity
   - Click any day to see session-based breakdown
   - Summaries grouped by project/activity
   - Keyboard navigation: Arrow keys for day navigation, H/L for month navigation

2. **Analytics Dashboard** (`http://localhost:55555/analytics`)
   - Summary statistics (total screenshots, daily average, most active periods)
   - Daily activity bar chart with weekend highlighting
   - Top applications pie chart and detailed usage table
   - Hourly activity heatmap (7 days × 24 hours)
   - 30-day activity trend line chart
   - Date range selector (last 7 days, last 30 days, this month)

3. **Day View** (`http://localhost:55555/day/YYYY-MM-DD`)
   - View all screenshots from a specific date
   - Navigate between days using arrow buttons
   - Shows window title and application for each screenshot

4. **Reports** (`http://localhost:55555/reports`)
   - Generate reports with natural language time ranges
   - Export to Markdown, HTML, PDF, or JSON
   - Report types: Summary, Detailed, Standup
   - Export history with download links

5. **Settings** (`http://localhost:55555/settings`)
   - Configure capture interval, AFK timeout
   - Summarization settings (model, quality, content)
   - Test Ollama connection
   - View/edit prompt templates

### Manual Operation

For testing or development:

```bash
# Activate virtual environment
source venv/bin/activate

# Run daemon manually (Ctrl+C to stop)
python -m tracker.daemon

# Capture a single screenshot
python -c "from tracker.capture import ScreenCapture; c = ScreenCapture(); print(c.capture_screen())"

# Query database
python -c "from tracker.storage import ActivityStorage; s = ActivityStorage(); print(len(s.get_screenshots(0, 2147483647)))"
```

### Configuration

Configuration is managed via YAML file at `~/.config/activity-tracker/config.yaml` or through the web Settings page at `http://127.0.0.1:55555/settings`.

**Default Settings:**

- **Capture Interval**: 30 seconds (configurable via Settings)
- **Image Format**: WebP with 80% quality
- **Duplicate Threshold**: 3 bits Hamming distance
- **Storage Location**: `~/activity-tracker-data/`
- **AFK Timeout**: 180 seconds (3 minutes)

**Example config.yaml:**
```yaml
capture:
  interval_seconds: 30
  format: webp
  quality: 80
afk:
  timeout_seconds: 180
  min_session_minutes: 5
summarization:
  enabled: true
  model: gemma3:14b-it-qat
  ollama_host: http://localhost:11434
  focus_weighted_sampling: true
  include_focus_context: true
  include_screenshots: true
```

## API Reference

### Python API

```python
from tracker import ScreenCapture, ActivityStorage, ActivityDaemon

# Capture screenshots
capture = ScreenCapture()
filepath, dhash = capture.capture_screen()
similar = capture.are_similar(hash1, hash2, threshold=10)

# Database operations
storage = ActivityStorage()
screenshot_id = storage.save_screenshot(filepath, dhash, "Firefox", "firefox")
screenshots = storage.get_screenshots(start_timestamp, end_timestamp)

# Run daemon
daemon = ActivityDaemon()
daemon.run()  # Blocks until interrupted
```

### REST API

The web interface provides a comprehensive REST API:

#### Core Endpoints

**Get screenshots in time range:**
```bash
curl "http://localhost:55555/api/screenshots?start=1637000000&end=1637100000"
```

**Get calendar heatmap data:**
```bash
curl "http://localhost:55555/api/calendar/2024/12"
```

**Get daily summary statistics:**
```bash
curl "http://localhost:55555/api/day/2024-12-03/summary"
```

**Get hourly breakdown for a day:**
```bash
curl "http://localhost:55555/api/day/2024-12-03/hourly"
```

**Get screenshots for specific hour:**
```bash
curl "http://localhost:55555/api/screenshots/2024-12-03/14"
```

**Get weekly statistics:**
```bash
curl "http://localhost:55555/api/week/2024-12-03"
```

#### Summarization Endpoints

**Get summaries for a date:**
```bash
curl "http://localhost:55555/api/summaries/2024-12-03"
# Returns: { "date": "...", "summaries": [...] }
```

**Get summary coverage stats:**
```bash
curl "http://localhost:55555/api/summaries/coverage"
# Returns: { "total_days": 14, "summarized_hours": 89, "total_hours": 120, "coverage_pct": 74.2 }
```

**Generate summaries (background):**
```bash
curl -X POST "http://localhost:55555/api/summaries/generate" \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-12-03"}'
```

#### Session Endpoints

**Get sessions for a date:**
```bash
curl "http://localhost:55555/api/sessions/2024-12-03"
# Returns: { "date": "...", "sessions": [...], "total_active_minutes": 420, "session_count": 4 }
```

**Get screenshots for a session:**
```bash
curl "http://localhost:55555/api/sessions/42/screenshots?page=1&per_page=50"
```

**Get current active session:**
```bash
curl "http://localhost:55555/api/sessions/current"
# Returns: { "session": {...} or null, "is_afk": true/false }
```

#### Report Endpoints

**Generate a report:**
```bash
curl -X POST "http://localhost:55555/api/reports/generate" \
  -H "Content-Type: application/json" \
  -d '{"time_range": "last week", "report_type": "summary", "format": "markdown"}'
```

**Get export history:**
```bash
curl "http://localhost:55555/api/reports/exports"
```

See [API_ENDPOINTS.md](API_ENDPOINTS.md) for complete documentation.

## Development

### Project Structure

```
activity-tracker/
├── tracker/                       # Core library
│   ├── __init__.py               # Package exports and metadata
│   ├── capture.py                # Screenshot capture and dhash
│   ├── storage.py                # SQLite database interface
│   ├── daemon.py                 # Background service process
│   ├── analytics.py              # Activity analytics and statistics
│   ├── vision.py                 # Two-stage LLM summarization
│   ├── summarizer_worker.py      # Activity-based summarization worker
│   ├── afk.py                    # AFK detection via pynput
│   ├── sessions.py               # Session management
│   ├── window_watcher.py         # Real-time window focus tracking
│   ├── terminal_introspect.py    # Terminal process introspection
│   ├── reports.py                # Report generation
│   ├── report_export.py          # Export to MD/HTML/PDF/JSON
│   ├── timeparser.py             # Natural language time parsing
│   ├── tag_detector.py           # Activity tag extraction
│   ├── app_inference.py          # Application context inference
│   ├── monitors.py               # Multi-monitor support
│   ├── config.py                 # Configuration settings
│   └── utils.py                  # Shared utilities
├── web/                          # Web interface
│   ├── app.py                    # Flask application with REST API
│   ├── static/                   # Static assets
│   │   ├── styles/               # CSS files
│   │   │   ├── base.css          # Shared styles
│   │   │   ├── timeline.css
│   │   │   ├── analytics.css
│   │   │   ├── day.css
│   │   │   ├── reports.css
│   │   │   └── settings.css
│   │   └── js/                   # JavaScript files
│   │       ├── utils.js          # Shared utilities
│   │       ├── timeline.js
│   │       ├── analytics.js
│   │       ├── day.js
│   │       ├── reports.js
│   │       └── settings.js
│   └── templates/                # HTML templates
│       ├── base.html             # Base template with navigation
│       ├── timeline.html         # Calendar heatmap view
│       ├── analytics.html        # Analytics dashboard
│       ├── reports.html          # Report generation UI
│       ├── settings.html         # Configuration UI
│       ├── day.html              # Daily screenshot view
│       └── partials/             # Reusable template partials
├── scripts/                      # Installation and utilities
│   ├── install.sh                # Systemd service setup
│   ├── uninstall.sh              # Service removal
│   └── summarize_activity.py     # CLI for generating summaries
├── tests/                        # Test suite
│   ├── conftest.py               # Pytest fixtures
│   ├── test_capture.py           # Capture tests
│   ├── test_storage.py           # Storage tests
│   └── test_dhash.py             # Hash comparison tests
├── requirements.txt              # Python dependencies
├── CLAUDE.md                     # Development documentation
└── README.md                     # This file
```

### Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run full test suite
pytest tests/ --cov=tracker --cov-report=html

# Test screenshot capture
python -c "from tracker.capture import ScreenCapture; c = ScreenCapture(); print('Screenshot test:', c.capture_screen()[0])"

# Test database operations
python -c "from tracker.storage import ActivityStorage; s = ActivityStorage(); print('Database test: OK')"
```

### Contributing

1. **Code Style**: Follow PEP 8 Python style guidelines
2. **Documentation**: Add comprehensive docstrings for new functions
3. **Error Handling**: Use appropriate exception types and logging
4. **Testing**: Test new features manually before submission

## Troubleshooting

### Common Issues

**Service won't start:**
```bash
# Check logs for errors
journalctl --user -u activity-tracker --no-pager

# Common causes:
# - X11 not available (check DISPLAY variable)
# - Permission denied (check data directory permissions)
# - Python dependencies missing (reinstall requirements.txt)
```

**Screenshots not captured:**
```bash
# Test manual capture
source venv/bin/activate
python -c "from tracker.capture import ScreenCapture; print(ScreenCapture().capture_screen())"

# Check X11 connection
echo $DISPLAY
xdpyinfo | head -5
```

**Web interface not accessible:**
```bash
# Check if Flask is running
ps aux | grep python.*app.py

# Verify database exists
ls -la ~/activity-tracker-data/activity.db

# Check Flask logs for errors
python web/app.py
```

**Permission errors:**
```bash
# Check data directory permissions
ls -ld ~/activity-tracker-data

# Fix permissions if needed
chmod 755 ~/activity-tracker-data
chmod 644 ~/activity-tracker-data/activity.db
```

### Performance Optimization

- **Storage usage**: Monitor `~/activity-tracker-data/screenshots/` size
- **Database performance**: SQLite handles thousands of records efficiently
- **Memory usage**: Daemon typically uses 50-100MB RAM
- **CPU usage**: Minimal impact with 30-second intervals

## Roadmap

### Completed
- [x] **Activity Analytics**: Usage patterns and application time tracking
- [x] **Timeline View**: Calendar heatmap with session-based breakdown
- [x] **Charts & Visualization**: Interactive charts using Chart.js
- [x] **Comprehensive Test Suite**: Pytest-based testing
- [x] **AI Summarization**: Two-stage vision LLM-powered activity summaries
- [x] **Activity-Based Summarization**: Triggers on session end with debouncing
- [x] **Session-Based Tracking**: AFK detection with pynput, session management
- [x] **Smart Session Resume**: Resume previous session on restart if within timeout
- [x] **Summary Debugging**: View exact API requests sent to Ollama
- [x] **Configuration File**: YAML-based settings with web UI (Settings page)
- [x] **Multi-monitor Support**: Captures only active monitor, stores monitor metadata
- [x] **Summary Regeneration**: Regenerate summaries with different models/settings
- [x] **Window Focus Tracking**: Real-time app/window usage with duration metrics
- [x] **Terminal Introspection**: Detect processes in terminals (vim, python, tmux, SSH)
- [x] **Report Generation**: Natural language time ranges with MD/HTML/PDF/JSON export
- [x] **Thumbnails**: Fast-loading timeline with 200px thumbnail previews
- [x] **Focus-Weighted Sampling**: Hamilton allocation by (app, window_title) pairs
- [x] **Two-Stage LLM**: Vision + text synthesis for structured output
- [x] **Structured Output**: Summary, explanation, confidence, and tags
- [x] **Project Grouping**: Related activities grouped in timeline UI
- [x] **Extracted CSS/JS**: Modular static assets (90% template size reduction)

### Planned
- [ ] **Wayland Support**: Add sway/wlroots integration for window information
- [ ] **Privacy Filters**: Blur sensitive areas or skip certain applications
- [ ] **Search & Tagging**: Search screenshots by window title, add custom tags
- [ ] **Database Normalization**: Unify summaries tables, separate prompts table

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the project's issue tracker.

---

**Note**: This software captures your screen continuously. Ensure compliance with your organization's security policies and applicable privacy laws. Screenshots may contain sensitive information - secure your data directory appropriately.
