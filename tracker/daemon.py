"""Activity Tracking Daemon Module.

This module implements the main daemon process that coordinates screenshot capture,
window information extraction, and duplicate detection. It runs continuously in
the background, capturing screenshots at 30-second intervals and managing storage.

The daemon provides:
- Automated screenshot capture with configurable intervals
- Perceptual duplicate detection to avoid storing redundant images
- Window context extraction using xdotool (X11)
- Signal handling for graceful shutdown
- Comprehensive logging and error handling
- Integration with systemd for service management

Key Features:
- Runs as background service via systemd
- Skip duplicate screenshots based on perceptual hash similarity  
- Extract active window title and application name
- Graceful signal handling (SIGTERM, SIGINT)
- Automatic restart capability via systemd
- Structured logging to files and stderr

Dependencies:
- tracker.capture: Screenshot capture and hashing
- tracker.storage: Database storage management
- xdotool: X11 window information extraction
- mss, PIL: Screen capture and image processing

Example:
    # Run daemon programmatically
    >>> from tracker.daemon import ActivityDaemon
    >>> daemon = ActivityDaemon()
    >>> daemon.run()  # Runs until interrupted
    
    # Or via command line
    $ python -m tracker.daemon
"""

import sys
import time
import signal
import hashlib
import subprocess
import argparse
import threading
import re
from datetime import datetime
from pathlib import Path
from typing import Optional

import mss
from PIL import Image

from .capture import ScreenCapture
from .storage import ActivityStorage
from .app_inference import get_app_name_with_inference


class ActivityDaemon:
    """Main daemon process for automated screenshot capture and monitoring.
    
    Coordinates screenshot capture, window information extraction, and storage
    operations. Runs continuously in the background with configurable intervals
    and provides duplicate detection to optimize storage usage.
    
    The daemon captures screenshots every 30 seconds, extracts window context
    using xdotool, computes perceptual hashes for duplicate detection, and
    stores metadata in SQLite database.
    
    Attributes:
        running (bool): Controls daemon execution loop
        capture (ScreenCapture): Screenshot capture instance
        storage (ActivityStorage): Database storage instance  
        last_dhash (str): Previous screenshot hash for duplicate detection
        
    Example:
        >>> daemon = ActivityDaemon()
        >>> daemon.run()  # Blocks until interrupted
        
        # Or with custom signal handling
        >>> daemon = ActivityDaemon()
        >>> try:
        ...     daemon.run()
        ... except KeyboardInterrupt:
        ...     daemon.log("Shutdown requested")
    """
    
    def __init__(self, enable_web=False, web_port=55555):
        """Initialize the activity daemon with default configuration.
        
        Sets up screenshot capture, database storage, signal handlers, and
        initializes tracking state for duplicate detection.
        
        Args:
            enable_web (bool): Whether to start the web server
            web_port (int): Port for the web server (default: 55555)
        
        Signal handlers are registered for:
        - SIGTERM: Graceful shutdown (systemd stop)
        - SIGINT: Interrupt signal (Ctrl+C)
        """
        self.running = True
        self.capture = ScreenCapture()
        self.storage = ActivityStorage()
        self.last_dhash = None
        self.enable_web = enable_web
        self.web_port = web_port
        self.flask_app = None
        self.web_thread = None
        
        if enable_web:
            self._setup_flask_app()
        
        # Set up signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        """Handle termination signals for graceful shutdown.
        
        Called when SIGTERM or SIGINT is received. Sets running flag to False
        to exit the main capture loop cleanly.
        
        Args:
            signum (int): Signal number received
            frame: Current stack frame (unused)
        """
        self.log(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def _setup_flask_app(self):
        """Set up the Flask web application for the activity viewer.

        Imports the existing Flask app from web/app.py instead of duplicating routes.
        This ensures all routes (/timeline, /analytics, etc.) are available.
        """
        import sys
        from pathlib import Path

        # Add project root to sys.path so we can import web.app
        project_root = Path(__file__).parent.parent
        if str(project_root) not in sys.path:
            sys.path.insert(0, str(project_root))

        # Import the existing Flask app from web/app.py
        from web.app import app
        self.flask_app = app
    
    def _start_web_server(self):
        """Start the Flask web server in a separate thread."""
        if self.flask_app:
            self.log(f"Starting web server on http://0.0.0.0`:{self.web_port}")
            self.flask_app.run(host='0.0.0.0', port=self.web_port, debug=False, use_reloader=False)
    
    def _stop_web_server(self):
        """Stop the web server thread."""
        if self.web_thread and self.web_thread.is_alive():
            self.log("Stopping web server...")
            # Flask doesn't have a clean shutdown method, thread will end when daemon stops
    
    def log(self, message: str):
        """Log a timestamped message to stderr.
        
        Provides structured logging with ISO timestamp format. Messages are
        written to stderr for systemd journal integration and immediate flushing.
        
        Args:
            message (str): Log message to write
            
        Example:
            >>> daemon = ActivityDaemon()
            >>> daemon.log("Screenshot captured successfully")
            [2023-11-27 10:30:15] Screenshot captured successfully
        """
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}", file=sys.stderr, flush=True)
    
    def _get_active_window_info(self) -> tuple[Optional[str], Optional[str]]:
        """Extract information about the currently active window.
        
        Uses xdotool to query X11 for the focused window's title and class name.
        This provides context about what application the user was using when
        the screenshot was captured.
        
        Returns:
            tuple[Optional[str], Optional[str]]: A tuple containing:
                - window_title: Title of the active window (or None if unavailable)
                - app_name: Application class name (or None if unavailable)
                
        Note:
            Requires xdotool to be installed and X11 display server.
            Wayland support is planned for future versions.
            
        Example:
            >>> daemon = ActivityDaemon()
            >>> title, app = daemon._get_active_window_info()
            >>> print(f"Active: {app} - {title}")
            Active: firefox - Mozilla Firefox
        """
        # TODO: Wayland compatibility - xdotool is X11-only, need alternative for Wayland
        # Should detect display server and use appropriate tools (e.g., swaymsg for Sway)
        try:
            # Get active window ID first
            result = subprocess.run(
                ["xdotool", "getwindowfocus"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode != 0:
                return None, None

            window_id = result.stdout.strip()

            # Get active window title
            result = subprocess.run(
                ["xdotool", "getwindowfocus", "getwindowname"],
                capture_output=True,
                text=True,
                timeout=5
            )
            window_title = result.stdout.strip() if result.returncode == 0 else None

            # Get active window class (app name) using xprop
            # WM_CLASS returns: "instance", "Class" - we want the Class (second value)
            result = subprocess.run(
                ["xprop", "-id", window_id, "WM_CLASS"],
                capture_output=True,
                text=True,
                timeout=5
            )
            app_name = None
            if result.returncode == 0:
                # Parse output like: WM_CLASS(STRING) = "tilix", "Tilix"
                output = result.stdout.strip()
                if '=' in output:
                    class_part = output.split('=', 1)[1].strip()
                    # Extract the second quoted string (the Class name)
                    matches = re.findall(r'"([^"]*)"', class_part)
                    if len(matches) >= 2:
                        app_name = matches[1]  # Use the Class (second value)
                    elif len(matches) == 1:
                        app_name = matches[0]  # Fallback to instance if only one value

            return window_title, app_name
            
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError) as e:
            # TODO: Permission errors - handle case where xdotool fails due to X11 permissions
            # Should check for X11 access permissions and provide helpful error messages
            self.log(f"Failed to get window info: {e}")
            return None, None
    
    def _hamming_distance(self, hash1: str, hash2: str) -> int:
        """Calculate Hamming distance between two perceptual hashes.
        
        Computes the number of differing bits between two hexadecimal hash strings
        by XORing their binary representations. Used for duplicate detection.
        
        Args:
            hash1 (str): First hash as hexadecimal string
            hash2 (str): Second hash as hexadecimal string
            
        Returns:
            int: Hamming distance (number of different bits).
                Returns infinity if hash lengths differ.
                
        Example:
            >>> daemon = ActivityDaemon()
            >>> distance = daemon._hamming_distance("abc123", "abc124")
            >>> print(f"Hashes differ by {distance} bits")
        """
        if len(hash1) != len(hash2):
            return float('inf')
        
        # Convert hex to int and XOR
        int1 = int(hash1, 16)
        int2 = int(hash2, 16)
        xor_result = int1 ^ int2
        
        # Count set bits (Hamming distance)
        return bin(xor_result).count('1')
    
    def _should_skip_screenshot(self, current_dhash: str) -> bool:
        """Determine if current screenshot should be skipped due to similarity.
        
        Compares the current screenshot's perceptual hash with the previous
        one to detect near-duplicates. Skips storage if images are too similar
        to avoid redundant data.
        
        Args:
            current_dhash (str): Perceptual hash of current screenshot
            
        Returns:
            bool: True if screenshot should be skipped (too similar to previous),
                False if it should be stored
                
        Note:
            Uses a threshold of 3 bits difference for duplicate detection.
            This catches minor changes like cursor movement while preserving
            significant content changes.
        """
        if not self.last_dhash or not current_dhash:
            return False
        
        distance = self._hamming_distance(current_dhash, self.last_dhash)
        return distance < 3
    
    def run(self):
        """Start the main daemon loop for continuous screenshot monitoring.
        
        Runs indefinitely until interrupted by signal or error. Captures screenshots
        every 30 seconds, performs duplicate detection, extracts window information,
        and stores metadata to database.
        
        The main loop:
        1. Capture screenshot and compute perceptual hash
        2. Check for similarity with previous screenshot
        3. Extract active window information via xdotool
        4. Store metadata to SQLite database
        5. Sleep for 30 seconds
        6. Repeat until shutdown signal received
        
        Raises:
            KeyboardInterrupt: If interrupted by Ctrl+C (gracefully handled)
            Exception: For unexpected errors (logged and daemon continues)
            
        Example:
            >>> daemon = ActivityDaemon()
            >>> try:
            ...     daemon.run()
            ... except KeyboardInterrupt:
            ...     print("Daemon stopped")
            
        Note:
            This method blocks until the daemon is stopped via signal.
            For systemd integration, stdout/stderr are redirected to journal.
        """
        self.log("Activity daemon starting...")
        
        # Start web server in separate thread if enabled
        if self.enable_web:
            self.web_thread = threading.Thread(target=self._start_web_server, daemon=True)
            self.web_thread.start()
        
        while self.running:
            try:
                # Capture screenshot
                filepath, current_dhash = self.capture.capture_screen()
                if not filepath:
                    self.log("Failed to capture screenshot")
                    time.sleep(30)
                    continue
                
                # Check if we should skip this screenshot
                if self._should_skip_screenshot(current_dhash):
                    self.log(f"Screenshot too similar to previous (distance < 3), skipping...")
                    # TODO: Permission errors - handle case where file deletion fails due to permissions
                    try:
                        Path(filepath).unlink(missing_ok=True)
                    except PermissionError as e:
                        self.log(f"Warning: Could not delete duplicate screenshot {filepath}: {e}")
                    time.sleep(30)
                    continue
                
                # Get window information
                window_title, app_name = self._get_active_window_info()

                # Infer app_name from window_title if app_name is NULL
                app_name = get_app_name_with_inference(app_name, window_title)

                # Save to database
                screenshot_id = self.storage.save_screenshot(
                    filepath=filepath,
                    dhash=current_dhash,
                    window_title=window_title,
                    app_name=app_name
                )
                
                self.last_dhash = current_dhash
                self.log(f"Saved screenshot {screenshot_id}: {Path(filepath).name}")
                
            except Exception as e:
                # TODO: Edge case - daemon should be more resilient to errors and not crash
                # Should implement exponential backoff and distinguish between recoverable/fatal errors
                self.log(f"Error in capture loop: {e}")
            
            # Sleep for 30 seconds
            for _ in range(30):
                if not self.running:
                    break
                time.sleep(1)
        
        self.log("Activity daemon stopped")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Activity tracking daemon")
    parser.add_argument("--web", action="store_true", help="Enable web server")
    parser.add_argument("--web-port", type=int, default=55555, help="Web server port (default: 55555)")
    
    args = parser.parse_args()
    
    daemon = ActivityDaemon(enable_web=args.web, web_port=args.web_port)
    daemon.run()
