"""Tests for screenshot capture functionality."""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch
from PIL import Image
import os
from datetime import datetime

from tracker.capture import ScreenCapture, ScreenCaptureError


class TestScreenCapture:
    """Test cases for ScreenCapture class."""
    
    def test_init_creates_output_directory(self, tmp_path):
        """Test that ScreenCapture creates output directory on initialization."""
        output_dir = tmp_path / "screenshots"
        capture = ScreenCapture(str(output_dir))
        
        assert capture.output_dir == output_dir
        assert output_dir.exists()
        assert output_dir.is_dir()
    
    def test_init_with_existing_directory(self, tmp_path):
        """Test initialization with existing directory."""
        output_dir = tmp_path / "existing"
        output_dir.mkdir(parents=True)
        
        capture = ScreenCapture(str(output_dir))
        assert capture.output_dir == output_dir
        assert output_dir.exists()
    
    def test_init_expands_home_directory(self, tmp_path):
        """Test that ~ is expanded to user home directory."""
        with patch('pathlib.Path.expanduser') as mock_expand:
            mock_expand.return_value = tmp_path / "expanded"
            capture = ScreenCapture("~/test")
            mock_expand.assert_called_once()
    
    def test_capture_screen_success(self, tmp_path, mock_mss, mock_mss_screenshot):
        """Test successful screenshot capture."""
        capture = ScreenCapture(str(tmp_path))
        mock_mss.grab.return_value = mock_mss_screenshot
        
        with patch('PIL.Image.frombytes') as mock_frombytes:
            # Create a mock image for dhash generation
            mock_img = Mock(spec=Image.Image)
            mock_img.resize.return_value.convert.return_value.getdata.return_value = [100] * 81
            mock_frombytes.return_value = mock_img
            
            filepath, dhash = capture.capture_screen("test_screenshot")
            
            # Verify file path structure
            assert "test_screenshot.webp" in filepath
            assert str(tmp_path) in filepath
            
            # Verify dhash is a 16-character hex string
            assert len(dhash) == 16
            assert all(c in '0123456789abcdef' for c in dhash)
            
            # Verify mss was called correctly
            mock_mss.grab.assert_called_once_with(mock_mss.monitors[1])
            mock_frombytes.assert_called_once()
    
    def test_capture_screen_creates_date_directory_structure(self, tmp_path, mock_mss, mock_mss_screenshot):
        """Test that capture creates YYYY/MM/DD directory structure."""
        capture = ScreenCapture(str(tmp_path))
        mock_mss.grab.return_value = mock_mss_screenshot
        
        with patch('PIL.Image.frombytes') as mock_frombytes:
            mock_img = Mock(spec=Image.Image)
            mock_img.resize.return_value.convert.return_value.getdata.return_value = [100] * 81
            mock_frombytes.return_value = mock_img
            
            filepath, _ = capture.capture_screen("test")
            
            # Check that date directory structure was created
            now = datetime.now()
            expected_date_dir = tmp_path / f"{now.year:04d}" / f"{now.month:02d}" / f"{now.day:02d}"
            assert expected_date_dir.exists()
            assert str(expected_date_dir) in filepath
    
    def test_capture_screen_auto_filename(self, tmp_path, mock_mss, mock_mss_screenshot):
        """Test capture with auto-generated filename."""
        capture = ScreenCapture(str(tmp_path))
        mock_mss.grab.return_value = mock_mss_screenshot
        
        with patch('PIL.Image.frombytes') as mock_frombytes:
            mock_img = Mock(spec=Image.Image)
            mock_img.resize.return_value.convert.return_value.getdata.return_value = [100] * 81
            mock_frombytes.return_value = mock_img
            
            filepath, dhash = capture.capture_screen()
            
            # Verify timestamp format in filename
            filename = Path(filepath).stem
            assert len(filename.split('_')) >= 2  # timestamp_hash format
    
    def test_capture_screen_display_connection_error(self, tmp_path, mock_mss):
        """Test handling of display connection errors."""
        capture = ScreenCapture(str(tmp_path))
        mock_mss.grab.side_effect = OSError("cannot connect to display :0")
        
        with pytest.raises(ScreenCaptureError, match="Cannot connect to display server"):
            capture.capture_screen()
    
    def test_capture_screen_generic_os_error(self, tmp_path, mock_mss):
        """Test handling of generic OS errors."""
        capture = ScreenCapture(str(tmp_path))
        mock_mss.grab.side_effect = OSError("Some other OS error")
        
        with pytest.raises(ScreenCaptureError, match="Display server error"):
            capture.capture_screen()
    
    def test_capture_screen_generic_exception(self, tmp_path, mock_mss):
        """Test handling of generic exceptions."""
        capture = ScreenCapture(str(tmp_path))
        mock_mss.grab.side_effect = ValueError("Some error")
        
        with pytest.raises(ScreenCaptureError, match="Failed to capture screenshot"):
            capture.capture_screen()
    
    def test_generate_dhash_basic(self, tmp_path, sample_image):
        """Test basic dhash generation."""
        capture = ScreenCapture(str(tmp_path))
        dhash = capture._generate_dhash(sample_image)
        
        assert len(dhash) == 16
        assert all(c in '0123456789abcdef' for c in dhash)
        assert dhash != "0000000000000000"  # Should not be all zeros
    
    def test_generate_dhash_consistent(self, tmp_path, sample_image):
        """Test that dhash generation is consistent for the same image."""
        capture = ScreenCapture(str(tmp_path))
        dhash1 = capture._generate_dhash(sample_image)
        dhash2 = capture._generate_dhash(sample_image)
        
        assert dhash1 == dhash2
    
    def test_generate_dhash_different_images(self, tmp_path, sample_image, sample_image_different):
        """Test that different images produce different dhashes."""
        capture = ScreenCapture(str(tmp_path))
        dhash1 = capture._generate_dhash(sample_image)
        dhash2 = capture._generate_dhash(sample_image_different)
        
        assert dhash1 != dhash2
    
    def test_generate_dhash_custom_size(self, tmp_path, sample_image):
        """Test dhash generation with custom hash size."""
        capture = ScreenCapture(str(tmp_path))
        dhash = capture._generate_dhash(sample_image, hash_size=4)
        
        # 4x4 grid = 16 bits = 4 hex chars
        assert len(dhash) == 4
    
    def test_compare_hashes_identical(self, tmp_path):
        """Test comparing identical hashes."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "1234567890abcdef"
        hash2 = "1234567890abcdef"
        
        distance = capture.compare_hashes(hash1, hash2)
        assert distance == 0
    
    def test_compare_hashes_different(self, tmp_path):
        """Test comparing different hashes."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "0000000000000000"
        hash2 = "1111111111111111"
        
        distance = capture.compare_hashes(hash1, hash2)
        assert distance > 0
    
    def test_compare_hashes_single_bit_difference(self, tmp_path):
        """Test comparing hashes with single bit difference."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "0000000000000000"
        hash2 = "0000000000000001"
        
        distance = capture.compare_hashes(hash1, hash2)
        assert distance == 1
    
    def test_compare_hashes_invalid_length(self, tmp_path):
        """Test comparing hashes with different lengths."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "1234"
        hash2 = "12345678"
        
        with pytest.raises(ValueError, match="Hash lengths must be equal"):
            capture.compare_hashes(hash1, hash2)
    
    def test_are_similar_true(self, tmp_path):
        """Test similarity check returns True for similar hashes."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "1234567890abcdef"
        hash2 = "1234567890abcdff"  # 1 bit difference
        
        assert capture.are_similar(hash1, hash2, threshold=5) is True
    
    def test_are_similar_false(self, tmp_path):
        """Test similarity check returns False for dissimilar hashes."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "0000000000000000"
        hash2 = "ffffffffffffffff"  # All bits different
        
        assert capture.are_similar(hash1, hash2, threshold=5) is False
    
    def test_are_similar_exact_threshold(self, tmp_path):
        """Test similarity check at exact threshold."""
        capture = ScreenCapture(str(tmp_path))
        hash1 = "0000000000000000"
        hash2 = "000000000000001f"  # 5 bits different
        
        assert capture.are_similar(hash1, hash2, threshold=5) is True
        assert capture.are_similar(hash1, hash2, threshold=4) is False
    
    def test_end_to_end_similar_images(self, tmp_path, sample_image, sample_image_similar):
        """Test end-to-end workflow with similar images."""
        capture = ScreenCapture(str(tmp_path))
        
        dhash1 = capture._generate_dhash(sample_image)
        dhash2 = capture._generate_dhash(sample_image_similar)
        
        # Images should be similar but not identical
        assert dhash1 != dhash2
        assert capture.are_similar(dhash1, dhash2, threshold=15) is True