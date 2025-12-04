"""Integration tests for the activity tracker system."""

import pytest
from pathlib import Path
import os
import time
from unittest.mock import Mock, patch
from PIL import Image

from tracker.capture import ScreenCapture
from tracker.storage import ActivityStorage


class TestIntegration:
    """Integration tests that verify components work together correctly."""
    
    def test_capture_and_store_workflow(self, tmp_path, mock_mss, mock_mss_screenshot):
        """Test the complete workflow of capturing and storing a screenshot."""
        # Setup
        capture_dir = tmp_path / "screenshots"
        db_path = str(tmp_path / "test.db")
        
        capture = ScreenCapture(str(capture_dir))
        storage = ActivityStorage(db_path)
        
        # Mock screenshot capture
        mock_mss.grab.return_value = mock_mss_screenshot
        
        with patch('PIL.Image.frombytes') as mock_frombytes:
            # Create a realistic mock image
            mock_img = Mock(spec=Image.Image)
            mock_img.resize.return_value.convert.return_value.getdata.return_value = (
                [100] * 40 + [200] * 41  # Create a gradient pattern
            )
            mock_frombytes.return_value = mock_img
            
            # Capture screenshot
            filepath, dhash = capture.capture_screen("integration_test")
            
            # Store in database
            screenshot_id = storage.save_screenshot(
                filepath=filepath,
                dhash=dhash,
                window_title="Integration Test Window",
                app_name="pytest"
            )
            
            # Verify workflow completed successfully
            assert screenshot_id > 0
            assert Path(filepath).exists()
            
            # Verify data integrity
            stored_screenshot = storage.get_screenshot(screenshot_id)
            assert stored_screenshot is not None
            assert stored_screenshot['filepath'] == filepath
            assert stored_screenshot['dhash'] == dhash
            assert stored_screenshot['window_title'] == "Integration Test Window"
            assert stored_screenshot['app_name'] == "pytest"
    
    def test_multiple_captures_with_similarity_detection(self, tmp_path):
        """Test capturing multiple screenshots and detecting similar ones."""
        capture_dir = tmp_path / "screenshots"
        db_path = str(tmp_path / "test.db")
        
        capture = ScreenCapture(str(capture_dir))
        storage = ActivityStorage(db_path)
        
        # Create test images with known similarity
        def create_test_image(pattern_offset=0):
            img = Image.new('RGB', (100, 100), color='black')
            pixels = img.load()
            
            # Create a pattern that can be slightly modified
            for x in range(20 + pattern_offset, 40 + pattern_offset):
                for y in range(30, 70):
                    pixels[x % 100, y] = (255, 255, 255)
            return img
        
        # Generate dhashes for test images
        img1 = create_test_image(0)
        img2 = create_test_image(2)  # Slightly different
        img3 = create_test_image(20)  # Very different
        
        hash1 = capture._generate_dhash(img1)
        hash2 = capture._generate_dhash(img2)
        hash3 = capture._generate_dhash(img3)
        
        # Create fake file paths and store
        files = []
        hashes = [hash1, hash2, hash3]
        
        for i, dhash in enumerate(hashes):
            fake_file = tmp_path / f"fake_screenshot_{i}.webp"
            fake_file.write_text(f"fake data {i}")
            
            screenshot_id = storage.save_screenshot(
                filepath=str(fake_file),
                dhash=dhash,
                window_title=f"Test Window {i}",
                app_name="test_app"
            )
            files.append((screenshot_id, str(fake_file), dhash))
        
        # Test similarity detection
        assert capture.are_similar(hash1, hash2, threshold=15) is True
        assert capture.are_similar(hash1, hash3, threshold=15) is False
        assert capture.are_similar(hash2, hash3, threshold=15) is False
        
        # Verify all stored correctly
        all_screenshots = storage.get_screenshots(0, 9999999999)
        assert len(all_screenshots) == 3
    
    def test_storage_retrieval_with_time_ranges(self, tmp_path):
        """Test storing and retrieving screenshots with realistic time ranges."""
        db_path = str(tmp_path / "time_test.db")
        storage = ActivityStorage(db_path)
        
        # Create files with specific timestamps (simulate real usage over time)
        base_time = 1700000000  # Nov 14, 2023
        time_intervals = [0, 300, 600, 3600, 7200]  # 0, 5min, 10min, 1hr, 2hr later
        
        screenshot_ids = []
        for i, interval in enumerate(time_intervals):
            test_file = tmp_path / f"timed_screenshot_{i}.webp"
            test_file.write_text(f"screenshot data {i}")
            
            # Set specific modification time
            file_time = base_time + interval
            os.utime(test_file, (file_time, file_time))
            
            screenshot_id = storage.save_screenshot(
                filepath=str(test_file),
                dhash=f"hash_{i:04d}",
                window_title=f"Window at {interval}s",
                app_name=f"app_{i}"
            )
            screenshot_ids.append(screenshot_id)
        
        # Test various time range queries
        
        # Get all screenshots
        all_screenshots = storage.get_screenshots(base_time - 1, base_time + 10000)
        assert len(all_screenshots) == 5
        
        # Get only first hour
        first_hour = storage.get_screenshots(base_time, base_time + 3600)
        assert len(first_hour) == 4  # 0, 5min, 10min, 1hr
        
        # Get only first 10 minutes
        first_ten_min = storage.get_screenshots(base_time, base_time + 600)
        assert len(first_ten_min) == 3  # 0, 5min, 10min
        
        # Get only last screenshot (2hr mark)
        last_screenshot = storage.get_screenshots(base_time + 7200, base_time + 7200)
        assert len(last_screenshot) == 1
        assert last_screenshot[0]['window_title'] == "Window at 7200s"
        
        # Verify ordering (should be DESC by timestamp)
        timestamps = [s['timestamp'] for s in all_screenshots]
        assert timestamps == sorted(timestamps, reverse=True)
    
    def test_dhash_comparison_with_real_patterns(self, tmp_path):
        """Test dhash comparison with realistic image patterns."""
        capture = ScreenCapture(str(tmp_path))
        
        def create_desktop_like_image(window_positions):
            """Create an image that simulates a desktop with windows."""
            img = Image.new('RGB', (200, 150), color=(50, 50, 100))  # Desktop background
            pixels = img.load()
            
            # Add "windows" at specified positions
            for x, y, w, h in window_positions:
                for px in range(x, min(x + w, 200)):
                    for py in range(y, min(y + h, 150)):
                        if 0 <= px < 200 and 0 <= py < 150:
                            pixels[px, py] = (200, 200, 200)  # Window content
            
            return img
        
        # Simulate different desktop states
        
        # State 1: Single window
        desktop1 = create_desktop_like_image([(20, 20, 80, 60)])
        hash1 = capture._generate_dhash(desktop1)
        
        # State 2: Same window moved slightly
        desktop2 = create_desktop_like_image([(25, 25, 80, 60)])
        hash2 = capture._generate_dhash(desktop2)
        
        # State 3: Additional window opened
        desktop3 = create_desktop_like_image([(20, 20, 80, 60), (100, 30, 60, 40)])
        hash3 = capture._generate_dhash(desktop3)
        
        # State 4: Completely different layout
        desktop4 = create_desktop_like_image([(10, 100, 180, 40)])
        hash4 = capture._generate_dhash(desktop4)
        
        # Test similarity relationships
        # Small window movement should be similar
        distance_1_2 = capture.compare_hashes(hash1, hash2)
        assert distance_1_2 <= 20  # Should be reasonably similar
        
        # Adding window should be moderately different
        distance_1_3 = capture.compare_hashes(hash1, hash3)
        assert distance_1_3 > distance_1_2  # More different than slight move
        assert distance_1_3 <= 40  # But not completely different
        
        # Completely different layout should be very different
        distance_1_4 = capture.compare_hashes(hash1, hash4)
        assert distance_1_4 > distance_1_3  # Most different
    
    def test_error_handling_integration(self, tmp_path):
        """Test error handling across integrated components."""
        capture_dir = tmp_path / "screenshots"
        db_path = str(tmp_path / "error_test.db")
        
        capture = ScreenCapture(str(capture_dir))
        storage = ActivityStorage(db_path)
        
        # Test storage with invalid file path
        with pytest.raises(Exception):
            storage.save_screenshot(
                filepath="/nonexistent/path/file.webp",
                dhash="valid_hash"
            )
        
        # Test hash comparison with invalid inputs
        with pytest.raises(ValueError):
            capture.compare_hashes("short", "much_longer_hash")
        
        # Test storage retrieval with invalid ID
        result = storage.get_screenshot(999999)
        assert result is None
    
    def test_concurrent_capture_and_storage(self, tmp_path):
        """Test that concurrent operations don't interfere with each other."""
        capture_dir = tmp_path / "concurrent"
        db_path = str(tmp_path / "concurrent.db")
        
        # Create multiple instances (simulating concurrent usage)
        capture1 = ScreenCapture(str(capture_dir))
        capture2 = ScreenCapture(str(capture_dir))
        
        storage1 = ActivityStorage(db_path)
        storage2 = ActivityStorage(db_path)
        
        # Create test data
        test_files = []
        for i in range(5):
            test_file = tmp_path / f"concurrent_{i}.webp"
            test_file.write_text(f"concurrent data {i}")
            test_files.append(str(test_file))
        
        # Simulate concurrent operations
        screenshot_ids = []
        
        # Alternating between instances
        for i, filepath in enumerate(test_files):
            if i % 2 == 0:
                current_storage = storage1
            else:
                current_storage = storage2
            
            screenshot_id = current_storage.save_screenshot(
                filepath=filepath,
                dhash=f"concurrent_hash_{i}",
                window_title=f"Concurrent Window {i}"
            )
            screenshot_ids.append(screenshot_id)
        
        # Verify all data accessible from both instances
        all_from_1 = storage1.get_screenshots(0, 9999999999)
        all_from_2 = storage2.get_screenshots(0, 9999999999)
        
        assert len(all_from_1) == 5
        assert len(all_from_2) == 5
        
        # Verify data consistency
        for screenshot_id in screenshot_ids:
            data1 = storage1.get_screenshot(screenshot_id)
            data2 = storage2.get_screenshot(screenshot_id)
            assert data1 == data2