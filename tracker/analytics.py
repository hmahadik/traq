"""Activity Analytics Module for Activity Tracker.

This module provides comprehensive analytics functionality for querying and analyzing
screenshot metadata from the SQLite database. It builds on the ActivityStorage class
to provide high-level analytics including daily summaries, hourly breakdowns, calendar
heatmap data, and weekly statistics.

The analytics include:
- Daily activity summaries with top applications
- Hourly breakdowns showing activity patterns
- Calendar data for heatmap visualization
- Weekly statistics and trends
- Application usage tracking

Key Features:
- Time-based aggregation (daily, hourly, weekly)
- Application usage analytics
- Activity intensity calculations for heatmaps
- Top applications ranking
- Active hours detection
- Configurable time ranges

Dependencies:
- tracker.storage: Database access via ActivityStorage
- sqlite3: Direct SQL queries for complex analytics
- datetime: Time range calculations

Example:
    >>> from tracker.analytics import ActivityAnalytics
    >>> from datetime import date
    >>>
    >>> analytics = ActivityAnalytics()
    >>>
    >>> # Get daily summary
    >>> summary = analytics.get_daily_summary(date.today())
    >>> print(f"Total screenshots: {summary['total_screenshots']}")
    >>> print(f"Top app: {summary['top_apps'][0]}")
    >>>
    >>> # Get calendar heatmap data
    >>> calendar = analytics.get_calendar_data(2024, 12)
    >>> for day in calendar:
    ...     print(f"{day['date']}: {day['screenshot_count']} screenshots")
"""

import sqlite3
from datetime import datetime, date, timedelta
from typing import Dict, List, Tuple, Optional
from pathlib import Path
from collections import Counter
from functools import lru_cache

from .storage import ActivityStorage


class ActivityAnalytics:
    """Provides analytics and aggregation queries for activity tracking data.

    This class offers high-level analytics methods for analyzing screenshot metadata
    stored in the SQLite database. It provides daily summaries, hourly breakdowns,
    calendar heatmap data, and weekly statistics.

    All methods use the existing ActivityStorage class for database access and
    provide additional aggregation and analysis capabilities.

    Attributes:
        storage (ActivityStorage): Database storage instance for data access

    Example:
        >>> analytics = ActivityAnalytics()
        >>> today_summary = analytics.get_daily_summary(date.today())
        >>> print(f"Active hours: {len(today_summary['active_hours'])}")
    """

    def __init__(self, storage: Optional[ActivityStorage] = None):
        """Initialize ActivityAnalytics with database storage.

        Args:
            storage (ActivityStorage, optional): Storage instance to use. If None,
                creates a new ActivityStorage instance with default database path.

        Example:
            >>> # Use default storage
            >>> analytics = ActivityAnalytics()
            >>>
            >>> # Or provide custom storage
            >>> custom_storage = ActivityStorage("/custom/path/activity.db")
            >>> analytics = ActivityAnalytics(custom_storage)
        """
        self.storage = storage if storage else ActivityStorage()

    def get_daily_summary(self, target_date: date) -> Dict:
        """Get comprehensive daily activity summary for a specific date.

        Analyzes all screenshots captured on the given date and returns statistics
        including total count, active hours, time range, and top applications.

        Args:
            target_date (date): The date to analyze

        Returns:
            Dict: Daily summary containing:
                - total_screenshots (int): Total number of screenshots captured
                - active_hours (List[int]): List of hours (0-23) with activity
                - first_capture (int|None): Unix timestamp of first screenshot, None if no data
                - last_capture (int|None): Unix timestamp of last screenshot, None if no data
                - top_apps (List[Tuple[str, int]]): Top 10 apps as (app_name, count) tuples,
                  sorted by count descending. Apps with None name are labeled "Unknown".

        Example:
            >>> from datetime import date
            >>> analytics = ActivityAnalytics()
            >>> summary = analytics.get_daily_summary(date(2024, 12, 2))
            >>> print(f"Screenshots: {summary['total_screenshots']}")
            >>> print(f"Active hours: {summary['active_hours']}")
            >>> print(f"Top app: {summary['top_apps'][0][0]} ({summary['top_apps'][0][1]} captures)")

        Note:
            - active_hours are sorted in ascending order (0-23)
            - top_apps are sorted by count in descending order
            - If no screenshots exist for the date, returns zeros/empty lists
        """
        # Calculate timestamp range for the target date
        start_timestamp = int(datetime.combine(target_date, datetime.min.time()).timestamp())
        end_timestamp = int(datetime.combine(target_date + timedelta(days=1), datetime.min.time()).timestamp())

        # Get all screenshots for the date
        screenshots = self.storage.get_screenshots(start_timestamp, end_timestamp)

        # Calculate basic stats
        total_screenshots = len(screenshots)

        if total_screenshots == 0:
            return {
                'total_screenshots': 0,
                'active_hours': [],
                'first_capture': None,
                'last_capture': None,
                'top_apps': []
            }

        # Extract hours with activity
        hours_set = set()
        app_counter = Counter()

        for screenshot in screenshots:
            # Extract hour from timestamp
            dt = datetime.fromtimestamp(screenshot['timestamp'])
            hours_set.add(dt.hour)

            # Count app occurrences
            app_name = screenshot.get('app_name') or 'Unknown'
            app_counter[app_name] += 1

        # Get first and last capture timestamps
        timestamps = [s['timestamp'] for s in screenshots]
        first_capture = min(timestamps)
        last_capture = max(timestamps)

        # Get top 10 apps
        top_apps = app_counter.most_common(10)

        return {
            'total_screenshots': total_screenshots,
            'active_hours': sorted(list(hours_set)),
            'first_capture': first_capture,
            'last_capture': last_capture,
            'top_apps': top_apps
        }

    def get_hourly_breakdown(self, target_date: date) -> List[Dict]:
        """Get hourly activity breakdown for a specific date.

        Returns detailed statistics for each hour of the day (0-23), including
        screenshot counts and per-application breakdowns.

        Args:
            target_date (date): The date to analyze

        Returns:
            List[Dict]: List of 24 dictionaries (one per hour), each containing:
                - hour (int): Hour of day (0-23)
                - screenshot_count (int): Number of screenshots in this hour
                - app_breakdown (Dict[str, int]): Dictionary mapping app names to counts.
                  Apps with None name are labeled "Unknown".

        Example:
            >>> from datetime import date
            >>> analytics = ActivityAnalytics()
            >>> hourly = analytics.get_hourly_breakdown(date(2024, 12, 2))
            >>>
            >>> # Find most active hour
            >>> most_active = max(hourly, key=lambda h: h['screenshot_count'])
            >>> print(f"Most active: {most_active['hour']}:00 with {most_active['screenshot_count']} screenshots")
            >>>
            >>> # Show app breakdown for 9 AM
            >>> morning = hourly[9]
            >>> print(f"9 AM apps: {morning['app_breakdown']}")

        Note:
            - Always returns 24 entries (one per hour)
            - Hours with no activity have screenshot_count=0 and empty app_breakdown
            - Hours are in 24-hour format (0=midnight, 23=11 PM)
        """
        # Calculate timestamp range for the target date
        start_timestamp = int(datetime.combine(target_date, datetime.min.time()).timestamp())
        end_timestamp = int(datetime.combine(target_date + timedelta(days=1), datetime.min.time()).timestamp())

        # Get all screenshots for the date
        screenshots = self.storage.get_screenshots(start_timestamp, end_timestamp)

        # Initialize 24-hour structure
        hourly_data = [
            {
                'hour': hour,
                'screenshot_count': 0,
                'app_breakdown': {}
            }
            for hour in range(24)
        ]

        # Populate hourly data
        for screenshot in screenshots:
            dt = datetime.fromtimestamp(screenshot['timestamp'])
            hour = dt.hour
            app_name = screenshot.get('app_name') or 'Unknown'

            hourly_data[hour]['screenshot_count'] += 1

            if app_name in hourly_data[hour]['app_breakdown']:
                hourly_data[hour]['app_breakdown'][app_name] += 1
            else:
                hourly_data[hour]['app_breakdown'][app_name] = 1

        return hourly_data

    def get_calendar_data(self, year: int, month: int) -> List[Dict]:
        """Get calendar heatmap data for a specific month.

        Returns daily activity statistics for every day in the specified month,
        including screenshot counts, active hours, and intensity values for
        heatmap visualization.

        Args:
            year (int): Year (e.g., 2024)
            month (int): Month (1-12)

        Returns:
            List[Dict]: List of dictionaries (one per day in month), each containing:
                - date (str): Date in "YYYY-MM-DD" format
                - screenshot_count (int): Total screenshots for this day
                - active_hours (int): Count of unique hours with activity (0-24)
                - intensity (float): Normalized intensity value (0.0-1.0) for heatmap
                  coloring, based on screenshot count relative to max day in month.
                  Returns 0.0 if no screenshots in entire month.

        Example:
            >>> from datetime import date
            >>> analytics = ActivityAnalytics()
            >>> calendar = analytics.get_calendar_data(2024, 12)
            >>>
            >>> # Display as heatmap data
            >>> for day in calendar:
            ...     intensity = day['intensity']
            ...     color = f"rgba(0, 255, 0, {intensity})"  # Green with varying opacity
            ...     print(f"{day['date']}: {day['screenshot_count']} shots, color={color}")
            >>>
            >>> # Find most active day
            >>> most_active = max(calendar, key=lambda d: d['screenshot_count'])
            >>> print(f"Most active: {most_active['date']} with {most_active['screenshot_count']} screenshots")

        Note:
            - Returns entries for all days in the month (28-31 depending on month)
            - Days with no activity have screenshot_count=0, active_hours=0, intensity=0.0
            - Intensity is relative to the maximum day in the month (max day = 1.0)
            - If entire month has no screenshots, all intensities are 0.0
        """
        # Calculate the number of days in the month
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)

        first_day = date(year, month, 1)
        days_in_month = (next_month - first_day).days

        # Get data for each day
        calendar_data = []
        max_screenshots = 0

        for day in range(1, days_in_month + 1):
            target_date = date(year, month, day)

            # Get daily summary
            start_timestamp = int(datetime.combine(target_date, datetime.min.time()).timestamp())
            end_timestamp = int(datetime.combine(target_date + timedelta(days=1), datetime.min.time()).timestamp())

            screenshots = self.storage.get_screenshots(start_timestamp, end_timestamp)
            screenshot_count = len(screenshots)

            # Calculate active hours
            hours_set = set()
            for screenshot in screenshots:
                dt = datetime.fromtimestamp(screenshot['timestamp'])
                hours_set.add(dt.hour)

            active_hours = len(hours_set)

            # Track max for intensity calculation
            if screenshot_count > max_screenshots:
                max_screenshots = screenshot_count

            calendar_data.append({
                'date': target_date.strftime('%Y-%m-%d'),
                'screenshot_count': screenshot_count,
                'active_hours': active_hours,
                'intensity': 0.0  # Will be calculated after we know max
            })

        # Calculate intensity values (0.0 to 1.0)
        if max_screenshots > 0:
            for day_data in calendar_data:
                day_data['intensity'] = day_data['screenshot_count'] / max_screenshots

        return calendar_data

    def get_weekly_stats(self, start_date: date) -> Dict:
        """Get weekly activity statistics starting from a specific date.

        Analyzes activity for a 7-day period starting from start_date and returns
        aggregated statistics including totals, averages, peak activity times, and
        application usage.

        Args:
            start_date (date): First day of the week to analyze

        Returns:
            Dict: Weekly statistics containing:
                - total_screenshots (int): Total screenshots across all 7 days
                - daily_average (float): Average screenshots per day (rounded to 1 decimal)
                - most_active_day (str): Date of most active day in "YYYY-MM-DD" format,
                  or None if no activity
                - most_active_hour (int|None): Hour (0-23) with most activity across the week,
                  or None if no activity
                - app_totals (Dict[str, int]): Dictionary mapping app names to total counts
                  across the week. Apps with None name are labeled "Unknown".

        Example:
            >>> from datetime import date
            >>> analytics = ActivityAnalytics()
            >>>
            >>> # Get stats for current week
            >>> week_stats = analytics.get_weekly_stats(date.today())
            >>> print(f"Total this week: {week_stats['total_screenshots']}")
            >>> print(f"Daily average: {week_stats['daily_average']}")
            >>> print(f"Most active day: {week_stats['most_active_day']}")
            >>> print(f"Peak hour: {week_stats['most_active_hour']}:00")
            >>>
            >>> # Show top apps
            >>> sorted_apps = sorted(week_stats['app_totals'].items(), key=lambda x: x[1], reverse=True)
            >>> print(f"Top app: {sorted_apps[0][0]} with {sorted_apps[0][1]} captures")

        Note:
            - Week is always exactly 7 days starting from start_date
            - daily_average is calculated even if some days have no activity
            - most_active_day returns None if entire week has no screenshots
            - most_active_hour is based on total across all days in the week
        """
        end_date = start_date + timedelta(days=7)

        # Calculate timestamp range
        start_timestamp = int(datetime.combine(start_date, datetime.min.time()).timestamp())
        end_timestamp = int(datetime.combine(end_date, datetime.min.time()).timestamp())

        # Get all screenshots for the week
        screenshots = self.storage.get_screenshots(start_timestamp, end_timestamp)

        total_screenshots = len(screenshots)

        if total_screenshots == 0:
            return {
                'total_screenshots': 0,
                'daily_average': 0.0,
                'most_active_day': None,
                'most_active_hour': None,
                'app_totals': {}
            }

        # Calculate daily counts to find most active day
        daily_counts = Counter()
        hourly_counts = Counter()
        app_totals = Counter()

        for screenshot in screenshots:
            dt = datetime.fromtimestamp(screenshot['timestamp'])

            # Track daily counts
            day_str = dt.date().strftime('%Y-%m-%d')
            daily_counts[day_str] += 1

            # Track hourly counts
            hourly_counts[dt.hour] += 1

            # Track app totals
            app_name = screenshot.get('app_name') or 'Unknown'
            app_totals[app_name] += 1

        # Find most active day and hour
        most_active_day = daily_counts.most_common(1)[0][0] if daily_counts else None
        most_active_hour = hourly_counts.most_common(1)[0][0] if hourly_counts else None

        # Calculate daily average
        daily_average = round(total_screenshots / 7, 1)

        return {
            'total_screenshots': total_screenshots,
            'daily_average': daily_average,
            'most_active_day': most_active_day,
            'most_active_hour': most_active_hour,
            'app_totals': dict(app_totals)
        }
