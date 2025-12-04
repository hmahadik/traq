"""Shared test fixtures for activity tracker tests."""

import pytest
import tempfile
from pathlib import Path
from PIL import Image
import sqlite3
import time
import os
from unittest.mock import Mock, patch


@pytest.fixture
def temp_dir(tmp_path):
    """Provide a temporary directory for test data."""
    return tmp_path


@pytest.fixture
def test_db_path(tmp_path):
    """Provide a temporary database path for testing."""
    return str(tmp_path / "test_activity.db")


@pytest.fixture
def sample_image():
    """Create a sample PIL Image for testing."""
    # Create a 100x100 RGB image with some pattern
    img = Image.new('RGB', (100, 100), color='red')
    # Add some pattern to make dhash meaningful
    pixels = img.load()
    for i in range(50, 100):
        for j in range(50, 100):
            pixels[i, j] = (0, 255, 0)  # Green square in bottom right
    return img


@pytest.fixture
def sample_image_similar():
    """Create a similar image with slight variations for dhash testing."""
    img = Image.new('RGB', (100, 100), color='red')
    pixels = img.load()
    # Similar pattern but slightly different
    for i in range(50, 95):  # Slightly smaller green area
        for j in range(50, 95):
            pixels[i, j] = (0, 255, 0)
    return img


@pytest.fixture
def sample_image_different():
    """Create a completely different image for dhash testing."""
    img = Image.new('RGB', (100, 100), color='blue')
    pixels = img.load()
    # Different pattern - horizontal stripes
    for i in range(0, 100, 10):
        for j in range(100):
            pixels[j, i] = (255, 255, 255)  # White stripes
    return img


@pytest.fixture
def mock_mss_screenshot():
    """Mock MSS screenshot object."""
    mock_screenshot = Mock()
    mock_screenshot.size = (1920, 1080)
    mock_screenshot.rgb = b'\x00' * (1920 * 1080 * 3)  # Black screen
    return mock_screenshot


@pytest.fixture
def mock_mss():
    """Mock MSS context manager."""
    mock_sct = Mock()
    mock_sct.monitors = [
        {'left': 0, 'top': 0, 'width': 3840, 'height': 1080},  # All monitors
        {'left': 0, 'top': 0, 'width': 1920, 'height': 1080},  # Primary monitor
    ]
    
    with patch('mss.mss') as mock_mss_class:
        mock_mss_class.return_value.__enter__.return_value = mock_sct
        mock_mss_class.return_value.__exit__.return_value = None
        yield mock_sct


@pytest.fixture
def sample_file_with_mtime(tmp_path):
    """Create a sample file with controlled modification time."""
    test_file = tmp_path / "test_screenshot.webp"
    test_file.write_text("fake webp data")
    
    # Set a specific modification time
    test_timestamp = 1700000000  # Nov 14, 2023
    os.utime(test_file, (test_timestamp, test_timestamp))
    
    return str(test_file), test_timestamp


@pytest.fixture
def populated_storage(test_db_path, tmp_path):
    """Create a storage instance with some test data."""
    from tracker.storage import ActivityStorage
    
    storage = ActivityStorage(test_db_path)
    
    # Add some test screenshots
    test_files = []
    for i in range(3):
        test_file = tmp_path / f"test_{i}.webp"
        test_file.write_text(f"fake webp data {i}")
        
        # Set different timestamps
        timestamp = 1700000000 + i * 3600  # 1 hour apart
        os.utime(test_file, (timestamp, timestamp))
        
        storage.save_screenshot(
            filepath=str(test_file),
            dhash=f"000000000000000{i:1x}",
            window_title=f"Test Window {i}",
            app_name=f"TestApp{i}"
        )
        test_files.append((str(test_file), timestamp))
    
    return storage, test_files