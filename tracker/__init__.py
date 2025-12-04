"""Activity Tracker - Linux Background Screenshot Monitoring Package.

This package provides a comprehensive solution for automatically capturing and managing
desktop screenshots at regular intervals. It consists of three main components:

1. Screen Capture Module (`capture.py`): Handles screenshot capturing using MSS library
   with perceptual hashing (dhash) for duplicate detection and WebP compression.

2. Storage Module (`storage.py`): Manages SQLite database operations for storing
   screenshot metadata and provides efficient querying capabilities.

3. Daemon Module (`daemon.py`): Background service that coordinates screenshot capture,
   window information extraction, and duplicate detection with configurable intervals.

4. Analytics Module (`analytics.py`): Provides comprehensive analytics and aggregation
   queries including daily summaries, hourly breakdowns, calendar heatmap data, and
   weekly statistics for activity visualization.

Key Features:
- Automated screenshot capture every 30 seconds
- Perceptual hashing for duplicate detection and storage optimization
- Window title and application name extraction via xdotool
- SQLite database for efficient metadata storage and retrieval
- WebP compression for space-efficient image storage
- Organized filesystem structure (YYYY/MM/DD hierarchy)
- Signal handling for graceful daemon shutdown
- X11 display server integration

Dependencies:
- mss: Cross-platform screen capture
- PIL (Pillow): Image processing and WebP compression
- sqlite3: Database operations (built-in)
- xdotool: X11 window information extraction

Data Storage Structure:
- Base directory: ~/activity-tracker-data/
- Screenshots: screenshots/YYYY/MM/DD/{timestamp}_{hash}.webp
- Database: activity.db (SQLite)
- Logs: logs/daemon.log

Usage:
    # Programmatic usage
    from tracker.capture import ScreenCapture
    from tracker.storage import ActivityStorage
    from tracker.daemon import ActivityDaemon
    from tracker.analytics import ActivityAnalytics

    # Capture a single screenshot
    capture = ScreenCapture()
    filepath, dhash = capture.capture_screen()

    # Store metadata
    storage = ActivityStorage()
    storage.save_screenshot(filepath, dhash)

    # Get analytics
    analytics = ActivityAnalytics()
    summary = analytics.get_daily_summary(date.today())

    # Run as daemon
    daemon = ActivityDaemon()
    daemon.run()

Author: Activity Tracker Project
License: MIT
Python Version: 3.11+
Platform: Linux (X11)
"""

# TODO: Missing config.py module - CLAUDE.md mentions config.py for configuration handling
# but the file doesn't exist. Should create config.py to handle settings like:
# - Screenshot intervals
# - Output directories  
# - Monitor selection
# - Image quality settings

# Package version
__version__ = "1.0.0"

# Main package exports
from .capture import ScreenCapture, ScreenCaptureError
from .storage import ActivityStorage
from .daemon import ActivityDaemon
from .analytics import ActivityAnalytics

__all__ = [
    "ScreenCapture",
    "ScreenCaptureError",
    "ActivityStorage",
    "ActivityDaemon",
    "ActivityAnalytics",
]