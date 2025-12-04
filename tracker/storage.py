"""SQLite Database Storage Module for Activity Tracker.

This module provides a comprehensive database interface for storing and retrieving
screenshot metadata. It manages SQLite connections, handles database schema 
initialization, and provides efficient querying methods for the web interface.

The database schema stores:
- Screenshot metadata (timestamp, filepath, perceptual hash)
- Window context information (title, application name)
- Indexed lookups for time-based and hash-based queries

Key Features:
- Automatic database initialization with proper indexes
- Context manager for connection handling
- Time-range queries for web interface
- Efficient storage of screenshot metadata
- Thread-safe database operations

Database Schema:
    screenshots table:
        - id: Primary key (autoincrement)
        - timestamp: Unix timestamp (indexed)
        - filepath: Relative path to screenshot file
        - dhash: Perceptual hash for duplicate detection (indexed)
        - window_title: Active window title (optional)
        - app_name: Application class name (optional)

Example:
    >>> storage = ActivityStorage()
    >>> screenshot_id = storage.save_screenshot(
    ...     "/path/to/screenshot.webp", 
    ...     "a1b2c3d4e5f67890",
    ...     "Firefox - Activity Tracker",
    ...     "firefox"
    ... )
    >>> screenshots = storage.get_screenshots(start_time, end_time)
"""

import sqlite3
import os
from contextlib import contextmanager
from typing import List, Dict, Optional
from pathlib import Path


class ActivityStorage:
    """SQLite database interface for Activity Tracker metadata storage.
    
    Manages screenshot metadata including timestamps, file paths, perceptual hashes,
    and window context information. Provides efficient querying capabilities for
    the web interface and handles database schema management.
    
    The class automatically initializes the database schema on first use and
    ensures proper indexing for time-based and hash-based queries.
    
    Attributes:
        db_path (str): Absolute path to the SQLite database file
        
    Example:
        >>> storage = ActivityStorage()
        >>> # Save a screenshot
        >>> id = storage.save_screenshot("/path/to/img.webp", "abc123", "Firefox")
        >>> 
        >>> # Query by time range
        >>> screenshots = storage.get_screenshots(start_ts, end_ts)
    """
    
    def __init__(self, db_path: str = None):
        """Initialize ActivityStorage with database connection.
        
        Sets up the database path and ensures the database schema exists.
        If no path is provided, uses the default location in the user's home
        directory at ~/activity-tracker-data/activity.db.
        
        Args:
            db_path (str, optional): Path to SQLite database file. If None,
                uses ~/activity-tracker-data/activity.db (default)
                
        Raises:
            RuntimeError: If directory creation fails due to permission issues
            sqlite3.Error: If database initialization fails
        """
        if db_path is None:
            data_dir = Path.home() / "activity-tracker-data"
            # TODO: Permission errors - handle case where data directory creation fails
            # Should check write permissions to home directory
            try:
                data_dir.mkdir(exist_ok=True)
            except PermissionError as e:
                raise RuntimeError(f"Permission denied creating data directory {data_dir}: {e}") from e
            db_path = data_dir / "activity.db"
        
        self.db_path = str(db_path)
        self.init_db()
    
    @contextmanager
    def get_connection(self):
        """Context manager for SQLite database connections.
        
        Provides a database connection with proper row factory and automatic
        cleanup. Uses Row factory for dictionary-like access to query results.
        
        Yields:
            sqlite3.Connection: Database connection with Row factory enabled
            
        Raises:
            RuntimeError: If database connection fails due to permission or
                file access issues
                
        Example:
            >>> storage = ActivityStorage()
            >>> with storage.get_connection() as conn:
            ...     cursor = conn.execute("SELECT * FROM screenshots LIMIT 1")
            ...     row = cursor.fetchone()
        """
        # TODO: Permission errors - handle case where database file access fails
        # Should check read/write permissions to database file location
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            try:
                yield conn
            finally:
                conn.close()
        except (sqlite3.OperationalError, PermissionError) as e:
            raise RuntimeError(f"Database access error for {self.db_path}: {e}") from e
    
    def init_db(self):
        """Initialize the database schema with required tables and indexes.
        
        Creates the screenshots table if it doesn't exist and adds performance
        indexes for timestamp and dhash columns. This method is automatically
        called during ActivityStorage initialization.
        
        The schema includes:
        - screenshots table with metadata columns
        - Index on timestamp for time-range queries
        - Index on dhash for duplicate detection
        
        Raises:
            sqlite3.Error: If schema creation fails
            RuntimeError: If database access fails
        """
        with self.get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS screenshots (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    filepath TEXT NOT NULL,
                    dhash TEXT NOT NULL,
                    window_title TEXT,
                    app_name TEXT
                )
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_timestamp ON screenshots(timestamp)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_dhash ON screenshots(dhash)
            """)
            
            conn.commit()
    
    def save_screenshot(self, filepath: str, dhash: str, window_title: str = None, app_name: str = None) -> int:
        """Save screenshot metadata to the database.
        
        Stores screenshot information including file path, perceptual hash, and
        optional window context. Uses file modification time as timestamp, falling
        back to current time if file access fails.
        
        Args:
            filepath (str): Absolute path to the screenshot file
            dhash (str): Perceptual hash (dhash) as hexadecimal string
            window_title (str, optional): Active window title when screenshot taken
            app_name (str, optional): Application class name when screenshot taken
            
        Returns:
            int: Database ID of the inserted screenshot record
            
        Raises:
            sqlite3.Error: If database insertion fails
            RuntimeError: If database connection fails
            
        Example:
            >>> storage = ActivityStorage()
            >>> screenshot_id = storage.save_screenshot(
            ...     "/path/to/screenshot.webp",
            ...     "a1b2c3d4e5f67890", 
            ...     "Firefox - Activity Tracker",
            ...     "firefox"
            ... )
        """
        # TODO: Edge case - handle case where file doesn't exist or permission denied when getting mtime
        try:
            timestamp = int(os.path.getmtime(filepath))
        except (OSError, PermissionError) as e:
            # Fallback to current timestamp if file access fails
            import time
            timestamp = int(time.time())
        
        with self.get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO screenshots (timestamp, filepath, dhash, window_title, app_name)
                VALUES (?, ?, ?, ?, ?)
            """, (timestamp, filepath, dhash, window_title, app_name))
            
            conn.commit()
            return cursor.lastrowid
    
    def get_screenshots(self, start_time: int, end_time: int) -> List[Dict]:
        """Retrieve screenshots within a time range.
        
        Queries the database for all screenshots taken between start_time and
        end_time (inclusive), ordered by timestamp in descending order (newest first).
        
        Args:
            start_time (int): Unix timestamp for range start (inclusive)
            end_time (int): Unix timestamp for range end (inclusive)
            
        Returns:
            List[Dict]: List of screenshot dictionaries containing:
                - id (int): Database record ID
                - timestamp (int): Unix timestamp
                - filepath (str): Path to screenshot file
                - dhash (str): Perceptual hash
                - window_title (str|None): Window title
                - app_name (str|None): Application name
                
        Raises:
            sqlite3.Error: If database query fails
            RuntimeError: If database connection fails
            
        Example:
            >>> storage = ActivityStorage()
            >>> import time
            >>> start = int(time.time()) - 3600  # Last hour
            >>> end = int(time.time())
            >>> screenshots = storage.get_screenshots(start, end)
            >>> print(f"Found {len(screenshots)} screenshots")
        """
        with self.get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, filepath, dhash, window_title, app_name
                FROM screenshots
                WHERE timestamp BETWEEN ? AND ?
                ORDER BY timestamp DESC
            """, (start_time, end_time))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_screenshot(self, screenshot_id: int) -> Optional[Dict]:
        """Retrieve a single screenshot by database ID.
        
        Fetches metadata for a specific screenshot record by its primary key.
        
        Args:
            screenshot_id (int): Database ID of the screenshot record
            
        Returns:
            Optional[Dict]: Screenshot dictionary with all fields, or None if not found.
                Dictionary contains same fields as get_screenshots() method.
                
        Raises:
            sqlite3.Error: If database query fails
            RuntimeError: If database connection fails
            
        Example:
            >>> storage = ActivityStorage() 
            >>> screenshot = storage.get_screenshot(123)
            >>> if screenshot:
            ...     print(f"Found: {screenshot['filepath']}")
            ... else:
            ...     print("Screenshot not found")
        """
        with self.get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, filepath, dhash, window_title, app_name
                FROM screenshots
                WHERE id = ?
            """, (screenshot_id,))
            
            row = cursor.fetchone()
            return dict(row) if row else None