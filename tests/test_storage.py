"""Tests for storage functionality."""

import pytest
import sqlite3
import os
import tempfile
from pathlib import Path
import time

from tracker.storage import ActivityStorage


class TestActivityStorage:
    """Test cases for ActivityStorage class."""
    
    def test_init_creates_default_directory(self):
        """Test that ActivityStorage creates default directory structure."""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Mock Path.home() to return our temp directory
            with pytest.MonkeyPatch().context() as m:
                m.setattr(Path, "home", lambda: Path(temp_dir))
                
                storage = ActivityStorage()
                
                expected_dir = Path(temp_dir) / "activity-tracker-data"
                expected_db = expected_dir / "activity.db"
                
                assert expected_dir.exists()
                assert Path(storage.db_path) == expected_db
    
    def test_init_with_custom_db_path(self, test_db_path):
        """Test initialization with custom database path."""
        storage = ActivityStorage(test_db_path)
        assert storage.db_path == test_db_path
        assert Path(test_db_path).exists()
    
    def test_init_db_creates_tables(self, test_db_path):
        """Test that init_db creates the required tables and indexes."""
        storage = ActivityStorage(test_db_path)
        
        with storage.get_connection() as conn:
            # Check if screenshots table exists
            cursor = conn.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='screenshots'
            """)
            assert cursor.fetchone() is not None
            
            # Check table structure
            cursor = conn.execute("PRAGMA table_info(screenshots)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            
            expected_columns = {
                'id': 'INTEGER',
                'timestamp': 'INTEGER',
                'filepath': 'TEXT',
                'dhash': 'TEXT',
                'window_title': 'TEXT',
                'app_name': 'TEXT'
            }
            
            for col_name, col_type in expected_columns.items():
                assert col_name in columns
                assert columns[col_name] == col_type
            
            # Check indexes exist
            cursor = conn.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='index' AND name IN ('idx_timestamp', 'idx_dhash')
            """)
            indexes = [row[0] for row in cursor.fetchall()]
            assert 'idx_timestamp' in indexes
            assert 'idx_dhash' in indexes
    
    def test_get_connection_context_manager(self, test_db_path):
        """Test that get_connection works as context manager."""
        storage = ActivityStorage(test_db_path)
        
        with storage.get_connection() as conn:
            assert isinstance(conn, sqlite3.Connection)
            assert conn.row_factory == sqlite3.Row
            
            # Connection should be active
            conn.execute("SELECT 1")
    
    def test_save_screenshot_basic(self, test_db_path, sample_file_with_mtime):
        """Test basic screenshot saving functionality."""
        storage = ActivityStorage(test_db_path)
        filepath, expected_timestamp = sample_file_with_mtime
        
        screenshot_id = storage.save_screenshot(
            filepath=filepath,
            dhash="1234567890abcdef",
            window_title="Test Window",
            app_name="TestApp"
        )
        
        assert isinstance(screenshot_id, int)
        assert screenshot_id > 0
        
        # Verify data in database
        with storage.get_connection() as conn:
            cursor = conn.execute("""
                SELECT timestamp, filepath, dhash, window_title, app_name
                FROM screenshots WHERE id = ?
            """, (screenshot_id,))
            row = cursor.fetchone()
            
            assert row is not None
            assert row['timestamp'] == expected_timestamp
            assert row['filepath'] == filepath
            assert row['dhash'] == "1234567890abcdef"
            assert row['window_title'] == "Test Window"
            assert row['app_name'] == "TestApp"
    
    def test_save_screenshot_minimal(self, test_db_path, sample_file_with_mtime):
        """Test saving screenshot with minimal data."""
        storage = ActivityStorage(test_db_path)
        filepath, expected_timestamp = sample_file_with_mtime
        
        screenshot_id = storage.save_screenshot(
            filepath=filepath,
            dhash="abcdef1234567890"
        )
        
        # Verify data in database
        with storage.get_connection() as conn:
            cursor = conn.execute("""
                SELECT timestamp, filepath, dhash, window_title, app_name
                FROM screenshots WHERE id = ?
            """, (screenshot_id,))
            row = cursor.fetchone()
            
            assert row is not None
            assert row['timestamp'] == expected_timestamp
            assert row['filepath'] == filepath
            assert row['dhash'] == "abcdef1234567890"
            assert row['window_title'] is None
            assert row['app_name'] is None
    
    def test_save_screenshot_uses_file_mtime(self, test_db_path, tmp_path):
        """Test that save_screenshot uses file modification time."""
        storage = ActivityStorage(test_db_path)
        
        # Create test file with specific mtime
        test_file = tmp_path / "test.webp"
        test_file.write_text("test data")
        
        custom_time = 1600000000  # Sep 13, 2020
        os.utime(test_file, (custom_time, custom_time))
        
        screenshot_id = storage.save_screenshot(
            filepath=str(test_file),
            dhash="test_hash"
        )
        
        # Verify timestamp matches file mtime
        with storage.get_connection() as conn:
            cursor = conn.execute("""
                SELECT timestamp FROM screenshots WHERE id = ?
            """, (screenshot_id,))
            row = cursor.fetchone()
            
            assert row['timestamp'] == custom_time
    
    def test_get_screenshots_empty_range(self, test_db_path):
        """Test getting screenshots from empty database."""
        storage = ActivityStorage(test_db_path)
        
        screenshots = storage.get_screenshots(1600000000, 1700000000)
        assert screenshots == []
    
    def test_get_screenshots_with_data(self, populated_storage):
        """Test getting screenshots from populated database."""
        storage, test_files = populated_storage
        
        # Get all screenshots in range
        screenshots = storage.get_screenshots(1699999999, 1700999999)
        
        assert len(screenshots) == 3
        
        # Verify ordering (should be DESC by timestamp)
        timestamps = [s['timestamp'] for s in screenshots]
        assert timestamps == sorted(timestamps, reverse=True)
        
        # Verify data structure
        for screenshot in screenshots:
            assert 'id' in screenshot
            assert 'timestamp' in screenshot
            assert 'filepath' in screenshot
            assert 'dhash' in screenshot
            assert 'window_title' in screenshot
            assert 'app_name' in screenshot
    
    def test_get_screenshots_filtered_range(self, populated_storage):
        """Test getting screenshots with filtered time range."""
        storage, test_files = populated_storage
        
        # Get only first screenshot (earliest timestamp)
        start_time = 1699999999
        end_time = 1700001000  # Between first and second screenshot
        
        screenshots = storage.get_screenshots(start_time, end_time)
        
        assert len(screenshots) == 1
        assert screenshots[0]['timestamp'] == 1700000000
    
    def test_get_screenshots_no_matches(self, populated_storage):
        """Test getting screenshots with no matches in range."""
        storage, test_files = populated_storage
        
        screenshots = storage.get_screenshots(1800000000, 1900000000)
        assert screenshots == []
    
    def test_get_screenshot_by_id_exists(self, populated_storage):
        """Test getting a specific screenshot by ID."""
        storage, test_files = populated_storage
        
        # Get first screenshot ID
        with storage.get_connection() as conn:
            cursor = conn.execute("""
                SELECT id FROM screenshots ORDER BY timestamp LIMIT 1
            """)
            screenshot_id = cursor.fetchone()['id']
        
        screenshot = storage.get_screenshot(screenshot_id)
        
        assert screenshot is not None
        assert screenshot['id'] == screenshot_id
        assert 'timestamp' in screenshot
        assert 'filepath' in screenshot
        assert 'dhash' in screenshot
        assert 'window_title' in screenshot
        assert 'app_name' in screenshot
    
    def test_get_screenshot_by_id_not_exists(self, test_db_path):
        """Test getting a non-existent screenshot by ID."""
        storage = ActivityStorage(test_db_path)
        
        screenshot = storage.get_screenshot(999999)
        assert screenshot is None
    
    def test_database_persistence(self, test_db_path, sample_file_with_mtime):
        """Test that data persists across storage instances."""
        filepath, expected_timestamp = sample_file_with_mtime
        
        # Save data with first instance
        storage1 = ActivityStorage(test_db_path)
        screenshot_id = storage1.save_screenshot(
            filepath=filepath,
            dhash="persistent_test",
            window_title="Persistence Test"
        )
        
        # Retrieve data with new instance
        storage2 = ActivityStorage(test_db_path)
        screenshot = storage2.get_screenshot(screenshot_id)
        
        assert screenshot is not None
        assert screenshot['dhash'] == "persistent_test"
        assert screenshot['window_title'] == "Persistence Test"
    
    def test_concurrent_access(self, test_db_path, tmp_path):
        """Test that multiple storage instances can access database concurrently."""
        # Create test files
        files = []
        for i in range(3):
            test_file = tmp_path / f"concurrent_{i}.webp"
            test_file.write_text(f"data {i}")
            files.append(str(test_file))
        
        # Create multiple storage instances
        storage1 = ActivityStorage(test_db_path)
        storage2 = ActivityStorage(test_db_path)
        
        # Save data from both instances
        id1 = storage1.save_screenshot(files[0], "hash1")
        id2 = storage2.save_screenshot(files[1], "hash2")
        id3 = storage1.save_screenshot(files[2], "hash3")
        
        # Verify all data is accessible from both instances
        screenshots1 = storage1.get_screenshots(0, 9999999999)
        screenshots2 = storage2.get_screenshots(0, 9999999999)
        
        assert len(screenshots1) == 3
        assert len(screenshots2) == 3
        
        # Verify specific records
        assert storage1.get_screenshot(id1) is not None
        assert storage2.get_screenshot(id2) is not None
        assert storage1.get_screenshot(id3) is not None
    
    def test_row_factory_dict_conversion(self, populated_storage):
        """Test that results are properly converted to dictionaries."""
        storage, test_files = populated_storage
        
        screenshots = storage.get_screenshots(0, 9999999999)
        
        for screenshot in screenshots:
            assert isinstance(screenshot, dict)
            # Verify all expected keys are present
            expected_keys = {'id', 'timestamp', 'filepath', 'dhash', 'window_title', 'app_name'}
            assert set(screenshot.keys()) == expected_keys
    
    def test_sql_injection_protection(self, test_db_path, tmp_path):
        """Test protection against SQL injection attacks."""
        storage = ActivityStorage(test_db_path)
        
        test_file = tmp_path / "injection_test.webp"
        test_file.write_text("test data")
        
        # Try to inject SQL through parameters
        malicious_inputs = [
            "'; DROP TABLE screenshots; --",
            "' OR '1'='1",
            "test'; INSERT INTO screenshots VALUES (999, 999, 'evil', 'evil', 'evil', 'evil'); --"
        ]
        
        for malicious_input in malicious_inputs:
            # This should not cause SQL injection
            screenshot_id = storage.save_screenshot(
                filepath=str(test_file),
                dhash=malicious_input,
                window_title=malicious_input,
                app_name=malicious_input
            )
            
            # Verify table still exists and data is stored safely
            screenshot = storage.get_screenshot(screenshot_id)
            assert screenshot is not None
            assert screenshot['dhash'] == malicious_input
            
        # Verify table structure is intact
        with storage.get_connection() as conn:
            cursor = conn.execute("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='screenshots'
            """)
            assert cursor.fetchone() is not None