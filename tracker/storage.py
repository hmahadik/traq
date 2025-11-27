import sqlite3
import os
from contextlib import contextmanager
from typing import List, Dict, Optional
from pathlib import Path


class ActivityStorage:
    def __init__(self, db_path: str = None):
        if db_path is None:
            data_dir = Path.home() / "activity-tracker-data"
            data_dir.mkdir(exist_ok=True)
            db_path = data_dir / "activity.db"
        
        self.db_path = str(db_path)
        self.init_db()
    
    @contextmanager
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    
    def init_db(self):
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
        timestamp = int(os.path.getmtime(filepath))
        
        with self.get_connection() as conn:
            cursor = conn.execute("""
                INSERT INTO screenshots (timestamp, filepath, dhash, window_title, app_name)
                VALUES (?, ?, ?, ?, ?)
            """, (timestamp, filepath, dhash, window_title, app_name))
            
            conn.commit()
            return cursor.lastrowid
    
    def get_screenshots(self, start_time: int, end_time: int) -> List[Dict]:
        with self.get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, filepath, dhash, window_title, app_name
                FROM screenshots
                WHERE timestamp BETWEEN ? AND ?
                ORDER BY timestamp DESC
            """, (start_time, end_time))
            
            return [dict(row) for row in cursor.fetchall()]
    
    def get_screenshot(self, screenshot_id: int) -> Optional[Dict]:
        with self.get_connection() as conn:
            cursor = conn.execute("""
                SELECT id, timestamp, filepath, dhash, window_title, app_name
                FROM screenshots
                WHERE id = ?
            """, (screenshot_id,))
            
            row = cursor.fetchone()
            return dict(row) if row else None