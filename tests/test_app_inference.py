"""Tests for Application Name Inference Module.

This test suite verifies that the app name inference logic correctly
identifies applications from window titles.
"""

import pytest
from tracker.app_inference import infer_app_name, get_app_name_with_inference


class TestInferAppName:
    """Test the infer_app_name function."""

    def test_visual_studio_code(self):
        """Test Visual Studio Code window title patterns."""
        assert infer_app_name("device_approval.go - acusight (Workspace) - Visual Studio Code") == "Code"
        assert infer_app_name("README.md - project - Visual Studio Code") == "Code"
        assert infer_app_name("main.py - Visual Studio Code") == "Code"

    def test_google_chrome(self):
        """Test Google Chrome window title patterns."""
        assert infer_app_name("Acusight API Documentation - Google Chrome") == "Google-chrome"
        assert infer_app_name("Activity Timeline - Activity Tracker - Google Chrome") == "Google-chrome"
        assert infer_app_name("Rick (DM) - Arcturus in Slackspace - Google Chrome") == "Google-chrome"

    def test_slack(self):
        """Test Slack window title patterns."""
        assert infer_app_name("Rick (DM) - Arcturus in Slackspace - Slack") == "Slack"
        assert infer_app_name("JL (DM) - Arcturus in Slackspace - Slack") == "Slack"
        assert infer_app_name("703-evans-ave (Channel) - Arcturus in Slackspace - Slack") == "Slack"

    def test_tilix(self):
        """Test Tilix terminal window title patterns."""
        assert infer_app_name("Tilix: harshad@kraken: ~") == "Tilix"
        assert infer_app_name("Tilix: user@host: /var/log") == "Tilix"

    def test_gnome_shell(self):
        """Test GNOME Shell window title."""
        assert infer_app_name("gnome-shell") == "Gjs"

    def test_obs(self):
        """Test OBS Studio window title patterns."""
        assert infer_app_name("OBS 27.2.4 (linux)") == "obs"
        assert infer_app_name("OBS Studio") == "obs"

    def test_nautilus(self):
        """Test GNOME Files (Nautilus) window title patterns."""
        assert infer_app_name("Files") == "org.gnome.Nautilus"
        assert infer_app_name("Documents - Files") == "org.gnome.Nautilus"

    def test_firefox(self):
        """Test Firefox window title patterns."""
        assert infer_app_name("Activity Tracker - Mozilla Firefox") == "firefox"
        assert infer_app_name("GitHub - Firefox") == "firefox"

    def test_no_match(self):
        """Test window titles that don't match any pattern."""
        assert infer_app_name("Unknown Application Window") is None
        assert infer_app_name("DevTools - 192.168.100.139") is None
        assert infer_app_name("Some Random Title") is None

    def test_null_or_empty_title(self):
        """Test handling of NULL or empty window titles."""
        assert infer_app_name(None) is None
        assert infer_app_name("") is None
        assert infer_app_name("   ") is None

    def test_case_insensitive(self):
        """Test that pattern matching is case-insensitive."""
        assert infer_app_name("README.md - visual studio code") == "Code"
        assert infer_app_name("test - GOOGLE CHROME") == "Google-chrome"


class TestGetAppNameWithInference:
    """Test the get_app_name_with_inference function."""

    def test_app_name_already_available(self):
        """When app_name is already set, use it without inference."""
        result = get_app_name_with_inference("Google-chrome", "Some Page - Firefox")
        assert result == "Google-chrome"  # Original app_name is kept

    def test_app_name_null_infer_from_title(self):
        """When app_name is NULL, infer from window_title."""
        result = get_app_name_with_inference(None, "README.md - Visual Studio Code")
        assert result == "Code"

    def test_app_name_empty_string_infer_from_title(self):
        """When app_name is empty string, treat as NULL and infer."""
        result = get_app_name_with_inference("", "Activity Tracker - Google Chrome")
        assert result == "Google-chrome"  # Empty string is falsy in Python, so inference happens

    def test_both_null(self):
        """When both app_name and window_title are NULL."""
        result = get_app_name_with_inference(None, None)
        assert result is None

    def test_app_name_null_no_inference_possible(self):
        """When app_name is NULL and window_title doesn't match patterns."""
        result = get_app_name_with_inference(None, "Unknown Window Title")
        assert result is None
