"""Shared utilities for Activity Tracker.

This module provides common helper functions used across multiple modules
to reduce code duplication and ensure consistent behavior.
"""

from datetime import datetime
from typing import Union


def parse_timestamp(ts: Union[int, float, datetime, str]) -> datetime:
    """Parse timestamp from various formats to datetime.

    Args:
        ts: Timestamp as unix timestamp (int/float), datetime object,
            or ISO format string.

    Returns:
        datetime object.

    Raises:
        ValueError: If timestamp format is not recognized.

    Examples:
        >>> parse_timestamp(1735500000)
        datetime.datetime(2024, 12, 29, 16, 0)
        >>> parse_timestamp("2024-12-29T16:00:00")
        datetime.datetime(2024, 12, 29, 16, 0)
    """
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts)
    elif isinstance(ts, datetime):
        return ts
    elif isinstance(ts, str):
        # Handle ISO format with optional timezone
        return datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
    else:
        raise ValueError(f"Cannot parse timestamp of type {type(ts)}: {ts}")


def format_timestamp(ts: Union[int, float, datetime, str], fmt: str = '%Y-%m-%d %H:%M:%S') -> str:
    """Format any timestamp type to string.

    Args:
        ts: Timestamp in any supported format (int, datetime, str).
        fmt: strftime format string. Default: '%Y-%m-%d %H:%M:%S'.

    Returns:
        Formatted timestamp string.

    Examples:
        >>> format_timestamp(1735500000, '%I:%M %p')
        '04:00 PM'
    """
    dt = parse_timestamp(ts)
    return dt.strftime(fmt)


def format_duration(seconds: Union[int, float]) -> str:
    """Format duration in seconds to human-readable string.

    Args:
        seconds: Duration in seconds.

    Returns:
        Human-readable duration string (e.g., "2h 30m", "45m", "30s").

    Examples:
        >>> format_duration(9000)
        '2h 30m'
        >>> format_duration(120)
        '2m'
        >>> format_duration(45)
        '45s'
    """
    if seconds < 0:
        return "0s"

    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours}h {mins}m"
    elif mins > 0:
        return f"{mins}m"
    else:
        return f"{secs}s"


def format_duration_long(seconds: Union[int, float]) -> str:
    """Format duration to longer human-readable string.

    Args:
        seconds: Duration in seconds.

    Returns:
        Human-readable duration (e.g., "2 hours 30 minutes").

    Examples:
        >>> format_duration_long(9000)
        '2 hours 30 minutes'
        >>> format_duration_long(3600)
        '1 hour'
    """
    if seconds < 0:
        return "0 seconds"

    hours = int(seconds // 3600)
    mins = int((seconds % 3600) // 60)

    parts = []
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if mins > 0:
        parts.append(f"{mins} minute{'s' if mins != 1 else ''}")

    return " ".join(parts) if parts else "less than a minute"
