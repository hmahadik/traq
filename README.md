# Activity Tracker

A Linux background service that automatically captures desktop screenshots at regular intervals, stores metadata in SQLite, and provides a rich web interface with timeline visualization and analytics for browsing your activity history.

## Features

- **Automated Screenshot Capture**: Captures desktop screenshots every 30 seconds
- **Perceptual Duplicate Detection**: Uses dhash algorithm to skip near-identical screenshots
- **Window Context Extraction**: Records active window title and application name
- **Timeline View**: Interactive calendar heatmap with hourly activity breakdown
- **Analytics Dashboard**: Comprehensive charts showing activity patterns and trends
- **Web-based Viewer**: Rich Flask interface with multiple views for browsing and analysis
- **Efficient Storage**: WebP compression and organized directory structure
- **Systemd Integration**: Runs as user service with automatic restart
- **X11 Support**: Optimized for X11 display server (Wayland support planned)

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

4. **Web Viewer (`web/app.py`)**
   - Flask application with multiple views (timeline, analytics, day view)
   - Interactive timeline with calendar heatmap and hourly breakdown
   - Analytics dashboard with charts and statistics
   - Date-based navigation
   - REST API for programmatic access

5. **Analytics Engine (`tracker/analytics.py`)**
   - Activity pattern analysis and statistics
   - Calendar heatmap data generation
   - Hourly/daily/weekly aggregations
   - Application usage tracking

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
CREATE TABLE screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,           -- Unix timestamp
    filepath TEXT NOT NULL,              -- Relative path to image file
    dhash TEXT NOT NULL,                 -- Perceptual hash (16-char hex)
    window_title TEXT,                   -- Active window title
    app_name TEXT                        -- Application class name
);

-- Indexes for performance
CREATE INDEX idx_timestamp ON screenshots(timestamp);
CREATE INDEX idx_dhash ON screenshots(dhash);
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

# The script will ask: "Enable web interface? (y/N):"
# - Answer 'y' to enable the integrated web server (accessible at http://0.0.0.0:55555)
# - Answer 'n' to run capture-only mode (you can start web separately)
```

3. **Verify installation:**

```bash
# Check service status
systemctl --user status activity-tracker

# View live logs
journalctl --user -u activity-tracker -f
```

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

#### Available Views

1. **Timeline View** (`http://localhost:55555/timeline`) - Default homepage
   - Interactive calendar heatmap showing daily activity intensity
   - Click any day to see hourly breakdown
   - Click hourly bars to view screenshots from that hour
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

The system uses default settings optimized for most users:

- **Capture Interval**: 30 seconds (fixed in MVP)
- **Image Format**: WebP with 80% quality
- **Duplicate Threshold**: 3 bits Hamming distance
- **Storage Location**: `~/activity-tracker-data/`
- **Service Name**: `activity-tracker`

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

See [API_ENDPOINTS.md](API_ENDPOINTS.md) for complete documentation.

## Development

### Project Structure

```
activity-tracker/
├── tracker/                    # Core library
│   ├── __init__.py            # Package exports and metadata
│   ├── capture.py             # Screenshot capture and dhash
│   ├── storage.py             # SQLite database interface
│   ├── daemon.py              # Background service process
│   └── analytics.py           # Activity analytics and statistics
├── web/                       # Web interface
│   ├── app.py                 # Flask application with REST API
│   └── templates/             # HTML templates
│       ├── base.html          # Base template with navigation
│       ├── timeline.html      # Calendar heatmap view
│       ├── analytics.html     # Analytics dashboard
│       └── day.html           # Daily screenshot view
├── scripts/                   # Installation and utilities
│   ├── install.sh             # Systemd service setup
│   └── uninstall.sh          # Service removal
├── tests/                     # Test suite
│   ├── conftest.py            # Pytest fixtures
│   ├── test_capture.py        # Capture tests
│   ├── test_storage.py        # Storage tests
│   └── test_dhash.py          # Hash comparison tests
├── requirements.txt           # Python dependencies
├── CLAUDE.md                  # Project documentation
└── README.md                  # This file
```

### Running Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Test screenshot capture
python -c "from tracker.capture import ScreenCapture; c = ScreenCapture(); print('Screenshot test:', c.capture_screen()[0])"

# Test database operations
python -c "from tracker.storage import ActivityStorage; s = ActivityStorage(); print('Database test: OK')"

# Test duplicate detection
python -c "
from tracker.capture import ScreenCapture
c = ScreenCapture()
# Same image should have distance 0
h1 = c._generate_dhash(c.capture_screen()[0])
h2 = c._generate_dhash(c.capture_screen()[0]) 
print('Hash test:', c.compare_hashes(h1, h2) == 0)
"
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

### Completed ✓
- [x] **Activity Analytics**: Usage patterns and application time tracking
- [x] **Timeline View**: Calendar heatmap with hourly breakdown
- [x] **Charts & Visualization**: Interactive charts using Chart.js
- [x] **Comprehensive Test Suite**: Pytest-based testing with 85% coverage

### Planned
- [ ] **Wayland Support**: Add sway/wlroots integration for window information
- [ ] **Multi-monitor Support**: Capture specific monitors or all monitors
- [ ] **Configuration File**: YAML-based settings for intervals and thresholds
- [ ] **OCR Integration**: Extract text content from screenshots
- [ ] **Privacy Filters**: Blur sensitive areas or skip certain applications
- [ ] **Export Features**: Generate reports and data exports (CSV/JSON/PDF)
- [ ] **Search & Tagging**: Search screenshots by window title, add custom tags

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the project's issue tracker.

---

**Note**: This software captures your screen continuously. Ensure compliance with your organization's security policies and applicable privacy laws. Screenshots may contain sensitive information - secure your data directory appropriately.