"""Tests specifically for dhash (difference hash) functionality."""

import pytest
from PIL import Image
import math

from tracker.capture import ScreenCapture


class TestDHash:
    """Test cases specifically for dhash implementation and comparison logic."""
    
    def test_dhash_empty_image(self, tmp_path):
        """Test dhash generation for completely black image."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create a solid black image
        img = Image.new('RGB', (100, 100), color='black')
        dhash = capture._generate_dhash(img)
        
        # All pixels same = no differences = hash should be all zeros
        assert dhash == "0000000000000000"
    
    def test_dhash_solid_color_images(self, tmp_path):
        """Test dhash generation for solid color images."""
        capture = ScreenCapture(str(tmp_path))
        
        # Different solid colors should all produce the same hash (all zeros)
        colors = ['black', 'white', 'red', 'green', 'blue']
        hashes = []
        
        for color in colors:
            img = Image.new('RGB', (100, 100), color=color)
            dhash = capture._generate_dhash(img)
            hashes.append(dhash)
        
        # All solid colors should have same hash (no gradient differences)
        assert all(h == "0000000000000000" for h in hashes)
    
    def test_dhash_horizontal_gradient(self, tmp_path):
        """Test dhash with horizontal gradient."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create image with horizontal gradient (left dark, right light)
        img = Image.new('RGB', (100, 100))
        pixels = img.load()
        
        for x in range(100):
            for y in range(100):
                brightness = int((x / 99) * 255)  # 0 to 255
                pixels[x, y] = (brightness, brightness, brightness)
        
        dhash = capture._generate_dhash(img)
        
        # Should have consistent pattern (all bits set because left < right)
        assert dhash != "0000000000000000"
        assert dhash == "ffffffffffffffff"  # All bits set
    
    def test_dhash_vertical_gradient_no_effect(self, tmp_path):
        """Test that vertical gradients don't affect dhash (only horizontal differences matter)."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create image with vertical gradient
        img = Image.new('RGB', (100, 100))
        pixels = img.load()
        
        for x in range(100):
            for y in range(100):
                brightness = int((y / 99) * 255)  # Vertical gradient
                pixels[x, y] = (brightness, brightness, brightness)
        
        dhash = capture._generate_dhash(img)
        
        # Should be all zeros since there are no horizontal differences
        assert dhash == "0000000000000000"
    
    def test_dhash_checkerboard_pattern(self, tmp_path):
        """Test dhash with checkerboard pattern."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create checkerboard pattern
        img = Image.new('RGB', (100, 100))
        pixels = img.load()
        
        for x in range(100):
            for y in range(100):
                if (x + y) % 2 == 0:
                    pixels[x, y] = (255, 255, 255)  # White
                else:
                    pixels[x, y] = (0, 0, 0)  # Black
        
        dhash = capture._generate_dhash(img)
        
        # Should have specific pattern based on checkerboard
        assert dhash != "0000000000000000"
        assert dhash != "ffffffffffffffff"
    
    def test_dhash_different_hash_sizes(self, tmp_path):
        """Test dhash generation with different hash sizes."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create simple gradient image
        img = Image.new('RGB', (100, 100))
        pixels = img.load()
        for x in range(100):
            for y in range(100):
                brightness = int((x / 99) * 255)
                pixels[x, y] = (brightness, brightness, brightness)
        
        # Test different hash sizes
        hash_4 = capture._generate_dhash(img, hash_size=4)
        hash_8 = capture._generate_dhash(img, hash_size=8)
        hash_16 = capture._generate_dhash(img, hash_size=16)
        
        # Different sizes should produce different length hashes
        assert len(hash_4) == 4   # 16 bits = 4 hex chars
        assert len(hash_8) == 16  # 64 bits = 16 hex chars
        assert len(hash_16) == 64  # 256 bits = 64 hex chars
        
        # But all should be consistent for same input
        assert hash_4 == capture._generate_dhash(img, hash_size=4)
        assert hash_8 == capture._generate_dhash(img, hash_size=8)
        assert hash_16 == capture._generate_dhash(img, hash_size=16)
    
    def test_hamming_distance_calculation(self, tmp_path):
        """Test Hamming distance calculation for known bit patterns."""
        capture = ScreenCapture(str(tmp_path))
        
        # Test cases with known Hamming distances
        test_cases = [
            ("0000", "0000", 0),  # Identical
            ("0000", "0001", 1),  # 1 bit difference
            ("0000", "0003", 2),  # 2 bit difference (0011 binary)
            ("0000", "000f", 4),  # 4 bit difference (1111 binary)
            ("0000", "ffff", 16), # All bits different
            ("5555", "aaaa", 16), # Alternating pattern: 0101 vs 1010
            ("1234", "1234", 0),  # Identical complex pattern
            ("1234", "1235", 1),  # 1 bit difference in last nibble
        ]
        
        for hash1, hash2, expected_distance in test_cases:
            distance = capture.compare_hashes(hash1, hash2)
            assert distance == expected_distance, f"Hash1: {hash1}, Hash2: {hash2}, Expected: {expected_distance}, Got: {distance}"
    
    def test_hamming_distance_symmetry(self, tmp_path):
        """Test that Hamming distance is symmetric."""
        capture = ScreenCapture(str(tmp_path))
        
        hash_pairs = [
            ("1234567890abcdef", "fedcba0987654321"),
            ("0000000000000000", "ffffffffffffffff"),
            ("5a5a5a5a5a5a5a5a", "a5a5a5a5a5a5a5a5"),
        ]
        
        for hash1, hash2 in hash_pairs:
            distance1 = capture.compare_hashes(hash1, hash2)
            distance2 = capture.compare_hashes(hash2, hash1)
            assert distance1 == distance2
    
    def test_similarity_threshold_behavior(self, tmp_path):
        """Test similarity function with various thresholds."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create hashes with known distances
        base_hash = "0000000000000000"
        test_hashes = [
            ("0000000000000001", 1),   # 1 bit different
            ("0000000000000003", 2),   # 2 bits different
            ("000000000000000f", 4),   # 4 bits different
            ("00000000000000ff", 8),   # 8 bits different
            ("0000000000001fff", 12),  # 12 bits different
        ]
        
        for test_hash, expected_distance in test_hashes:
            # Test various thresholds
            assert capture.are_similar(base_hash, test_hash, threshold=expected_distance) is True
            assert capture.are_similar(base_hash, test_hash, threshold=expected_distance - 1) is False
            
            if expected_distance > 0:
                assert capture.are_similar(base_hash, test_hash, threshold=expected_distance + 1) is True
    
    def test_dhash_rotation_sensitivity(self, tmp_path):
        """Test that dhash is sensitive to image rotation."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create an asymmetric image (rectangle on left side)
        img = Image.new('RGB', (100, 100), color='black')
        pixels = img.load()
        
        # Draw rectangle on left side
        for x in range(20, 40):
            for y in range(30, 70):
                pixels[x, y] = (255, 255, 255)
        
        # Generate hash for original
        hash_original = capture._generate_dhash(img)
        
        # Rotate image 90 degrees
        img_rotated = img.rotate(90)
        hash_rotated = capture._generate_dhash(img_rotated)
        
        # Should be different (dhash is not rotation-invariant)
        assert hash_original != hash_rotated
        
        # But should still be somewhat similar
        distance = capture.compare_hashes(hash_original, hash_rotated)
        assert distance > 0
        assert distance < 64  # Not completely different
    
    def test_dhash_scale_invariance(self, tmp_path):
        """Test dhash with different image scales."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create pattern that should be scale-invariant
        def create_gradient_image(size):
            img = Image.new('RGB', (size, size))
            pixels = img.load()
            for x in range(size):
                for y in range(size):
                    brightness = int((x / (size - 1)) * 255)
                    pixels[x, y] = (brightness, brightness, brightness)
            return img
        
        # Test different scales
        img_small = create_gradient_image(50)
        img_medium = create_gradient_image(100)
        img_large = create_gradient_image(200)
        
        hash_small = capture._generate_dhash(img_small)
        hash_medium = capture._generate_dhash(img_medium)
        hash_large = capture._generate_dhash(img_large)
        
        # All should be identical (gradient pattern preserved)
        assert hash_small == hash_medium
        assert hash_medium == hash_large
    
    def test_dhash_noise_resistance(self, tmp_path):
        """Test dhash resistance to minor noise."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create base image with gradient
        img = Image.new('RGB', (100, 100))
        pixels = img.load()
        for x in range(100):
            for y in range(100):
                brightness = int((x / 99) * 255)
                pixels[x, y] = (brightness, brightness, brightness)
        
        hash_original = capture._generate_dhash(img)
        
        # Add minor noise (change a few pixels)
        img_noisy = img.copy()
        noisy_pixels = img_noisy.load()
        
        # Change 5 random pixels slightly
        import random
        random.seed(42)  # Deterministic for testing
        for _ in range(5):
            x = random.randint(0, 99)
            y = random.randint(0, 99)
            current = noisy_pixels[x, y][0]
            # Add small random noise
            new_brightness = max(0, min(255, current + random.randint(-20, 20)))
            noisy_pixels[x, y] = (new_brightness, new_brightness, new_brightness)
        
        hash_noisy = capture._generate_dhash(img_noisy)
        
        # Should be similar but not identical
        distance = capture.compare_hashes(hash_original, hash_noisy)
        assert distance <= 5  # Should be very similar despite noise
        assert capture.are_similar(hash_original, hash_noisy, threshold=10) is True
    
    def test_dhash_extreme_contrast(self, tmp_path):
        """Test dhash with extreme contrast patterns."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create high contrast patterns
        patterns = []
        
        # Pattern 1: Vertical stripes
        img1 = Image.new('RGB', (100, 100))
        pixels1 = img1.load()
        for x in range(100):
            for y in range(100):
                color = 255 if x % 2 == 0 else 0
                pixels1[x, y] = (color, color, color)
        patterns.append(("vertical_stripes", img1))
        
        # Pattern 2: Horizontal stripes (should give different dhash)
        img2 = Image.new('RGB', (100, 100))
        pixels2 = img2.load()
        for x in range(100):
            for y in range(100):
                color = 255 if y % 2 == 0 else 0
                pixels2[x, y] = (color, color, color)
        patterns.append(("horizontal_stripes", img2))
        
        # Generate hashes
        hashes = []
        for name, img in patterns:
            dhash = capture._generate_dhash(img)
            hashes.append((name, dhash))
        
        # Vertical stripes should create alternating pattern
        # Horizontal stripes should create all-zeros pattern
        vertical_hash = next(h for n, h in hashes if n == "vertical_stripes")
        horizontal_hash = next(h for n, h in hashes if n == "horizontal_stripes")
        
        # Horizontal stripes have no horizontal gradient
        assert horizontal_hash == "0000000000000000"
        
        # Vertical stripes have maximum horizontal gradient
        assert vertical_hash != "0000000000000000"
        
        # They should be completely different
        distance = capture.compare_hashes(vertical_hash, horizontal_hash)
        assert distance == 64  # Maximum possible distance for 64-bit hash
    
    def test_dhash_bit_precision(self, tmp_path):
        """Test that dhash uses full bit precision correctly."""
        capture = ScreenCapture(str(tmp_path))
        
        # Create images that should set specific bit patterns
        img = Image.new('RGB', (9, 8))  # 9x8 for 8x8 hash
        pixels = img.load()
        
        # Fill with pattern that should create specific hash
        # Row 0: alternating pattern (01010101)
        for x in range(8):
            pixels[x, 0] = (0, 0, 0)      # Left pixel dark
            pixels[x + 1, 0] = (255, 255, 255)  # Right pixel light
        
        # Other rows: all same (should contribute 0 bits)
        for y in range(1, 8):
            for x in range(9):
                pixels[x, y] = (128, 128, 128)
        
        dhash = capture._generate_dhash(img)
        
        # First 8 bits should be 11111111 (0xFF)
        # Remaining bits should be 00000000
        expected = "ff00000000000000"
        assert dhash == expected
    
    def test_dhash_edge_cases(self, tmp_path):
        """Test dhash with edge cases and boundary conditions."""
        capture = ScreenCapture(str(tmp_path))
        
        # Very small image
        tiny_img = Image.new('RGB', (1, 1), color='red')
        hash_tiny = capture._generate_dhash(tiny_img, hash_size=1)
        assert len(hash_tiny) == 1
        assert hash_tiny == "0"  # No gradient possible
        
        # Very large image
        large_img = Image.new('RGB', (1000, 1000))
        large_pixels = large_img.load()
        # Create gradient
        for x in range(1000):
            for y in range(1000):
                brightness = int((x / 999) * 255)
                large_pixels[x, y] = (brightness, brightness, brightness)
        
        hash_large = capture._generate_dhash(large_img)
        assert len(hash_large) == 16
        assert hash_large == "ffffffffffffffff"  # Should still be consistent gradient