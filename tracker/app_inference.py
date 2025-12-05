"""Application Name Inference Module.

This module provides functionality to infer application names from window titles
when the app_name is not available from X11 window properties (WM_CLASS).

Common patterns:
- "Something - Google Chrome" → Google-chrome
- "file.py - project (Workspace) - Visual Studio Code" → Code
- "User (DM) - Workspace - Slack" → Slack
- "Tilix: user@host: ~" → Tilix
- etc.

The inference is pattern-based and covers common applications.
"""

import re
from typing import Optional


def infer_app_name(window_title: Optional[str]) -> Optional[str]:
    """Infer application name from window title when app_name is NULL.

    Uses pattern matching to extract application names from common window
    title formats. This is a fallback for when X11 WM_CLASS property is
    not available or returns NULL.

    Args:
        window_title (Optional[str]): The window title string

    Returns:
        Optional[str]: Inferred application name matching WM_CLASS format,
                      or None if inference fails

    Example:
        >>> infer_app_name("README.md - project (Workspace) - Visual Studio Code")
        'Code'
        >>> infer_app_name("Rick (DM) - Arcturus in Slackspace - Slack")
        'Slack'
        >>> infer_app_name("Activity Tracker - Google Chrome")
        'Google-chrome'
    """
    if not window_title:
        return None

    # Pattern mapping: regex pattern → app_name
    # Order matters - more specific patterns first
    patterns = [
        # Visual Studio Code (various formats)
        (r'- Visual Studio Code$', 'Code'),

        # Browsers
        (r'- Google Chrome$', 'Google-chrome'),
        (r'- Mozilla Firefox$', 'firefox'),
        (r'- Firefox$', 'firefox'),
        (r'- Chromium$', 'Chromium'),

        # Slack
        (r'- Slack$', 'Slack'),

        # Terminal emulators
        (r'^Tilix:', 'Tilix'),
        (r'^gnome-terminal', 'Gnome-terminal'),
        (r'^konsole', 'konsole'),
        (r'^xterm', 'xterm'),

        # File managers
        (r'^Files$', 'org.gnome.Nautilus'),  # GNOME Files
        (r'- Files$', 'org.gnome.Nautilus'),

        # Image viewers
        (r'^Image Viewer', 'Eog'),  # Eye of GNOME
        (r'- eog$', 'Eog'),

        # OBS Studio
        (r'^OBS ', 'obs'),

        # PDF viewers
        (r'- Evince$', 'Evince'),
        (r'- Okular$', 'Okular'),

        # Text editors
        (r'- gedit$', 'Gedit'),
        (r'- Sublime Text$', 'Sublime_text'),
        (r'- Atom$', 'Atom'),

        # IDEs
        (r'- IntelliJ IDEA$', 'jetbrains-idea'),
        (r'- PyCharm$', 'jetbrains-pycharm'),

        # LibreOffice
        (r'- LibreOffice Writer$', 'libreoffice-writer'),
        (r'- LibreOffice Calc$', 'libreoffice-calc'),

        # Email clients
        (r'- Thunderbird$', 'Thunderbird'),
        (r'- Evolution$', 'Evolution'),

        # Communication
        (r'- Discord$', 'discord'),
        (r'- Zoom Meeting', 'zoom'),
        (r'- Microsoft Teams', 'teams'),

        # Development tools
        (r'- DBeaver$', 'DBeaver'),
        (r'- Postman$', 'Postman'),
        (r'- GitKraken$', 'GitKraken'),

        # GNOME Shell (for overview/activities)
        (r'^gnome-shell$', 'Gjs'),
    ]

    # Try each pattern
    for pattern, app_name in patterns:
        if re.search(pattern, window_title, re.IGNORECASE):
            return app_name

    # If no pattern matches, return None
    return None


def get_app_name_with_inference(app_name: Optional[str], window_title: Optional[str]) -> Optional[str]:
    """Get app_name, using inference from window_title if app_name is NULL.

    This is the main function to use in the application. It returns the
    provided app_name if available, otherwise attempts to infer it from
    the window_title.

    Args:
        app_name (Optional[str]): The app_name from WM_CLASS (may be NULL)
        window_title (Optional[str]): The window title to infer from

    Returns:
        Optional[str]: The app_name (original or inferred), or None if both fail

    Example:
        >>> # app_name is available - use it directly
        >>> get_app_name_with_inference("Google-chrome", "Some Page - Google Chrome")
        'Google-chrome'
        >>>
        >>> # app_name is NULL - infer from window title
        >>> get_app_name_with_inference(None, "README.md - Visual Studio Code")
        'Code'
    """
    # If app_name is already available, use it
    if app_name:
        return app_name

    # Otherwise, try to infer from window title
    return infer_app_name(window_title)
