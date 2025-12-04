#!/usr/bin/env python3
"""Test runner script for the activity tracker project."""

import subprocess
import sys
from pathlib import Path


def run_tests():
    """Run the test suite with various options."""
    
    # Ensure we're in the project directory
    project_dir = Path(__file__).parent
    
    print("Activity Tracker Test Suite")
    print("=" * 40)
    
    # Basic test run
    print("\n1. Running basic test suite...")
    result = subprocess.run([
        sys.executable, "-m", "pytest", 
        "tests/", 
        "-v"
    ], cwd=project_dir)
    
    if result.returncode != 0:
        print("❌ Basic tests failed!")
        return False
    
    print("✅ Basic tests passed!")
    
    # Run with coverage
    print("\n2. Running tests with coverage...")
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        "tests/",
        "--cov=tracker",
        "--cov-report=term-missing",
        "--cov-report=html:htmlcov",
        "-v"
    ], cwd=project_dir)
    
    if result.returncode == 0:
        print("✅ Coverage tests passed!")
        print("📊 Coverage report generated in htmlcov/index.html")
    else:
        print("❌ Coverage tests failed!")
        return False
    
    # Run specific test categories
    test_categories = [
        ("unit", "Unit tests"),
        ("integration", "Integration tests"),
        ("capture", "Capture functionality tests"),
        ("storage", "Storage functionality tests"),
        ("dhash", "dhash algorithm tests")
    ]
    
    print("\n3. Running categorized tests...")
    for marker, description in test_categories:
        print(f"\n   Testing {description}...")
        result = subprocess.run([
            sys.executable, "-m", "pytest",
            "tests/",
            f"-m", marker,
            "-v", "--tb=short"
        ], cwd=project_dir, capture_output=True, text=True)
        
        if result.returncode == 0:
            test_count = result.stdout.count("PASSED")
            if test_count > 0:
                print(f"   ✅ {test_count} {description.lower()} passed")
            else:
                print(f"   ⚪ No tests found for {description.lower()}")
        else:
            print(f"   ❌ {description} failed")
    
    return True


if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
    
    print("\n🎉 All tests completed successfully!")
    print("\nTo run tests manually:")
    print("  pytest tests/                    # Run all tests")
    print("  pytest tests/test_capture.py     # Run capture tests only")
    print("  pytest -m unit                   # Run unit tests only")
    print("  pytest --cov=tracker             # Run with coverage")