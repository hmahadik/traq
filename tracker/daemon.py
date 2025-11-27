import sys
import time
import signal
import hashlib
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

import mss
from PIL import Image

from .capture import ScreenCapture
from .storage import ActivityStorage


class ActivityDaemon:
    def __init__(self):
        self.running = True
        self.capture = ScreenCapture()
        self.storage = ActivityStorage()
        self.last_dhash = None
        
        # Set up signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
    
    def _signal_handler(self, signum, frame):
        self.log(f"Received signal {signum}, shutting down gracefully...")
        self.running = False
    
    def log(self, message: str):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}", file=sys.stderr, flush=True)
    
    def _get_active_window_info(self) -> tuple[Optional[str], Optional[str]]:
        try:
            # Get active window title
            result = subprocess.run(
                ["xdotool", "getwindowfocus", "getwindowname"],
                capture_output=True,
                text=True,
                timeout=5
            )
            window_title = result.stdout.strip() if result.returncode == 0 else None
            
            # Get active window class (app name)
            result = subprocess.run(
                ["xdotool", "getwindowfocus", "getwindowclassname"],
                capture_output=True,
                text=True,
                timeout=5
            )
            app_name = result.stdout.strip() if result.returncode == 0 else None
            
            return window_title, app_name
            
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError) as e:
            self.log(f"Failed to get window info: {e}")
            return None, None
    
    def _hamming_distance(self, hash1: str, hash2: str) -> int:
        if len(hash1) != len(hash2):
            return float('inf')
        
        # Convert hex to int and XOR
        int1 = int(hash1, 16)
        int2 = int(hash2, 16)
        xor_result = int1 ^ int2
        
        # Count set bits (Hamming distance)
        return bin(xor_result).count('1')
    
    def _should_skip_screenshot(self, current_dhash: str) -> bool:
        if not self.last_dhash or not current_dhash:
            return False
        
        distance = self._hamming_distance(current_dhash, self.last_dhash)
        return distance < 3
    
    def run(self):
        self.log("Activity daemon starting...")
        
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
                    Path(filepath).unlink(missing_ok=True)
                    time.sleep(30)
                    continue
                
                # Get window information
                window_title, app_name = self._get_active_window_info()
                
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
                self.log(f"Error in capture loop: {e}")
            
            # Sleep for 30 seconds
            for _ in range(30):
                if not self.running:
                    break
                time.sleep(1)
        
        self.log("Activity daemon stopped")


if __name__ == "__main__":
    daemon = ActivityDaemon()
    daemon.run()