"""Screenshot capture module with perceptual hashing."""

import hashlib
import os
from pathlib import Path
from typing import Optional, Tuple
import mss
from PIL import Image
import logging

logger = logging.getLogger(__name__)


class ScreenCaptureError(Exception):
    """Custom exception for screen capture errors."""
    pass


class ScreenCapture:
    """Handles screenshot capture and perceptual hashing."""
    
    def __init__(self, output_dir: str = "~/activity-tracker-data/screenshots"):
        """Initialize the screen capture.
        
        Args:
            output_dir: Directory to save screenshots
        """
        self.output_dir = Path(output_dir).expanduser()
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
    def capture_screen(self, filename: Optional[str] = None) -> Tuple[str, str]:
        """Capture screenshot and return filepath and dhash.
        
        Args:
            filename: Optional custom filename (without extension)
            
        Returns:
            Tuple of (filepath, dhash_hex)
            
        Raises:
            ScreenCaptureError: If capture fails
        """
        try:
            with mss.mss() as sct:
                # Get primary monitor
                monitor = sct.monitors[1]  # monitors[0] is all monitors combined
                
                # Capture screenshot
                screenshot = sct.grab(monitor)
                
                # Convert to PIL Image
                img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)
                
                # Generate dhash before saving
                dhash = self._generate_dhash(img)
                
                # Create timestamped filepath if no filename provided
                if filename is None:
                    from datetime import datetime
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    filename = f"{timestamp}_{dhash[:8]}"
                
                # Ensure directory structure exists (YYYY/MM/DD)
                from datetime import datetime
                now = datetime.now()
                date_dir = self.output_dir / f"{now.year:04d}" / f"{now.month:02d}" / f"{now.day:02d}"
                date_dir.mkdir(parents=True, exist_ok=True)
                
                # Save as WebP with 80% quality
                filepath = date_dir / f"{filename}.webp"
                img.save(filepath, "WEBP", quality=80, method=6)
                
                logger.info(f"Screenshot saved: {filepath}")
                return str(filepath), dhash
                
        except OSError as e:
            if "cannot connect to display" in str(e).lower():
                raise ScreenCaptureError("Cannot connect to display server. Is X11 running?") from e
            else:
                raise ScreenCaptureError(f"Display server error: {e}") from e
        except Exception as e:
            raise ScreenCaptureError(f"Failed to capture screenshot: {e}") from e
    
    def _generate_dhash(self, img: Image.Image, hash_size: int = 8) -> str:
        """Generate difference hash (dhash) for perceptual comparison.
        
        Args:
            img: PIL Image to hash
            hash_size: Size of the hash grid (default 8x8)
            
        Returns:
            Hexadecimal string representation of dhash
        """
        # Resize to hash_size+1 x hash_size for difference calculation
        img = img.resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
        
        # Convert to grayscale
        img = img.convert("L")
        
        # Calculate horizontal gradient
        pixels = list(img.getdata())
        difference = []
        
        for row in range(hash_size):
            row_start = row * (hash_size + 1)
            for col in range(hash_size):
                pixel_left = pixels[row_start + col]
                pixel_right = pixels[row_start + col + 1]
                difference.append(pixel_left > pixel_right)
        
        # Convert boolean array to hex string
        decimal_value = 0
        for i, bit in enumerate(difference):
            if bit:
                decimal_value |= (1 << i)
        
        return f"{decimal_value:016x}"
    
    def compare_hashes(self, hash1: str, hash2: str) -> int:
        """Compare two dhashes using Hamming distance.
        
        Args:
            hash1: First hash as hex string
            hash2: Second hash as hex string
            
        Returns:
            Hamming distance (number of differing bits)
        """
        if len(hash1) != len(hash2):
            raise ValueError("Hash lengths must be equal")
        
        # Convert hex to int and XOR
        int1 = int(hash1, 16)
        int2 = int(hash2, 16)
        xor_result = int1 ^ int2
        
        # Count set bits (Hamming distance)
        return bin(xor_result).count('1')
    
    def are_similar(self, hash1: str, hash2: str, threshold: int = 10) -> bool:
        """Check if two images are similar based on dhash comparison.
        
        Args:
            hash1: First hash as hex string
            hash2: Second hash as hex string
            threshold: Maximum Hamming distance for similarity (default 10)
            
        Returns:
            True if images are similar, False otherwise
        """
        return self.compare_hashes(hash1, hash2) <= threshold