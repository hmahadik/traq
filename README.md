# Activity Tracker

A Linux background service that automatically captures desktop screenshots at regular intervals, stores metadata in SQLite, and provides a simple web viewer for browsing your activity timeline.

## Features

- **Automated Screenshot Capture**: Captures desktop screenshots every 30 seconds
- **Perceptual Duplicate Detection**: Uses dhash algorithm to skip near-identical screenshots
- **Window Context Extraction**: Records active window title and application name
- **Web-based Viewer**: Simple Flask interface for browsing screenshots by date
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
   - Flask application for browsing screenshots
   - Date-based navigation
   - REST API for programmatic access

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
# Run the installation script
./scripts/install.sh

# Enable service to start on login
systemctl --user enable activity-tracker

# Start the service
systemctl --user start activity-tracker
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

Access the web viewer to browse your screenshots:

```bash
# Start the web interface
cd activity-tracker
source venv/bin/activate
python web/app.py

# Open in browser
firefox http://localhost:5000
```

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

The web interface provides a REST API:

```bash
# Get screenshots in time range
curl "http://localhost:5000/api/screenshots?start=1637000000&end=1637100000"

# Response format:
{
  "screenshots": [
    {
      "id": 123,
      "timestamp": 1637012345,
      "file_path": "2021/11/15/20211115_143905_a1b2c3d4.webp",
      "file_hash": "a1b2c3d4e5f67890",
      "iso_time": "2021-11-15T14:39:05"
    }
  ],
  "count": 1,
  "start": 1637000000,
  "end": 1637100000
}
```

## Development

### Project Structure

```
activity-tracker/
├── tracker/                    # Core library
│   ├── __init__.py            # Package exports and metadata
│   ├── capture.py             # Screenshot capture and dhash
│   ├── storage.py             # SQLite database interface
│   └── daemon.py              # Background service process
├── web/                       # Web interface
│   ├── app.py                 # Flask application
│   └── templates/             # HTML templates
├── scripts/                   # Installation and utilities
│   ├── install.sh             # Systemd service setup
│   └── uninstall.sh          # Service removal
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

- [ ] **Wayland Support**: Add sway/wlroots integration for window information
- [ ] **Multi-monitor Support**: Capture specific monitors or all monitors
- [ ] **Configuration File**: YAML-based settings for intervals and thresholds
- [ ] **OCR Integration**: Extract text content from screenshots
- [ ] **Activity Analytics**: Usage patterns and application time tracking
- [ ] **Privacy Filters**: Blur sensitive areas or skip certain applications
- [ ] **Export Features**: Generate reports and data exports

## License

MIT License - see LICENSE file for details.

## Support

For issues and feature requests, please use the project's issue tracker.

---

**Note**: This software captures your screen continuously. Ensure compliance with your organization's security policies and applicable privacy laws. Screenshots may contain sensitive information - secure your data directory appropriately.