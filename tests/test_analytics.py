"""Tests for analytics functionality.

TDD tests for fixing analytics page issues:
- Break time calculation
- Start/end time detection
- Productivity score formula
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock
import sys
import os

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from tracker.storage import ActivityStorage


class TestAnalyticsFixtures:
    """Test fixtures and infrastructure for analytics tests."""

    @pytest.fixture
    def analytics_storage(self, test_db_path):
        """Create storage instance with analytics test data."""
        storage = ActivityStorage(test_db_path)
        return storage

    @pytest.fixture
    def storage_with_sessions(self, test_db_path):
        """Create storage with realistic session data for testing.

        Creates sessions with known gaps for break time testing:
        - Session 1: 9:00 AM - 10:30 AM (1.5 hours)
        - Gap: 15 minutes (break)
        - Session 2: 10:45 AM - 12:00 PM (1.25 hours)
        - Gap: 1 hour (lunch - should be counted)
        - Session 3: 1:00 PM - 3:00 PM (2 hours)
        - Gap: 30 seconds (too short - not a break)
        - Session 4: 3:00:30 PM - 5:00 PM (almost 2 hours)

        Total active: ~6.75 hours
        Total breaks: 15 min + 60 min = 75 min (1.25 hours)
        """
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 0, 0, 0)

        with storage.get_connection() as conn:
            # Create sessions
            sessions = [
                (base_date.replace(hour=9, minute=0),
                 base_date.replace(hour=10, minute=30)),
                (base_date.replace(hour=10, minute=45),
                 base_date.replace(hour=12, minute=0)),
                (base_date.replace(hour=13, minute=0),
                 base_date.replace(hour=15, minute=0)),
                (base_date.replace(hour=15, minute=0, second=30),
                 base_date.replace(hour=17, minute=0)),
            ]

            for start, end in sessions:
                conn.execute(
                    """
                    INSERT INTO activity_sessions (start_time, end_time)
                    VALUES (?, ?)
                    """,
                    (start.isoformat(), end.isoformat())
                )

            # Create corresponding focus events
            for i, (start, end) in enumerate(sessions):
                duration = int((end - start).total_seconds())
                conn.execute(
                    """
                    INSERT INTO window_focus_events
                    (app_name, window_title, start_time, end_time,
                     duration_seconds, session_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (f'TestApp{i}', f'Window {i}', start.isoformat(),
                     end.isoformat(), duration, i + 1)
                )

            conn.commit()

        return storage, base_date

    @pytest.fixture
    def storage_with_apps(self, test_db_path):
        """Create storage with app focus data for productivity testing.

        Creates focus events with known productive/neutral/distracting apps:
        - Code (productive): 4 hours
        - Firefox (neutral): 2 hours
        - Slack (distracting): 1 hour
        - Terminal (productive): 1 hour

        Total: 8 hours
        Productive: 5 hours (62.5%)
        Neutral: 2 hours (25%)
        Distracting: 1 hour (12.5%)
        """
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 9, 0, 0)

        with storage.get_connection() as conn:
            # Create a session
            conn.execute(
                """
                INSERT INTO activity_sessions (start_time, end_time)
                VALUES (?, ?)
                """,
                (base_date.isoformat(),
                 (base_date + timedelta(hours=8)).isoformat())
            )

            # Create focus events with different apps
            apps = [
                ('code', 'project.py - VS Code', 4 * 3600),  # productive
                ('firefox', 'Google Search', 2 * 3600),      # neutral
                ('Slack', 'General Channel', 1 * 3600),      # distracting
                ('gnome-terminal', 'bash', 1 * 3600),        # productive
            ]

            current_time = base_date
            for app, title, duration in apps:
                end_time = current_time + timedelta(seconds=duration)
                conn.execute(
                    """
                    INSERT INTO window_focus_events
                    (app_name, window_title, start_time, end_time,
                     duration_seconds, session_id)
                    VALUES (?, ?, ?, ?, ?, 1)
                    """,
                    (app, title, current_time.isoformat(),
                     end_time.isoformat(), duration)
                )
                current_time = end_time

            conn.commit()

        return storage, base_date

    def test_fixture_creates_storage(self, analytics_storage):
        """Verify the analytics storage fixture creates a valid storage."""
        assert analytics_storage is not None
        assert hasattr(analytics_storage, 'get_connection')

    def test_fixture_creates_sessions(self, storage_with_sessions):
        """Verify session fixture creates expected session data."""
        storage, base_date = storage_with_sessions

        with storage.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM activity_sessions")
            count = cursor.fetchone()[0]
            assert count == 4

    def test_fixture_creates_apps(self, storage_with_apps):
        """Verify app fixture creates expected focus event data."""
        storage, base_date = storage_with_apps

        with storage.get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM window_focus_events")
            count = cursor.fetchone()[0]
            assert count == 4


# Import the functions we're testing from web.app
# We import them here to test them in isolation
import importlib.util
spec = importlib.util.spec_from_file_location(
    "web_app",
    os.path.join(os.path.dirname(__file__), '..', 'web', 'app.py')
)
web_app = importlib.util.module_from_spec(spec)

# We need to mock Flask app creation to avoid side effects
with patch.dict('sys.modules', {'flask': MagicMock()}):
    # Import specific functions we need to test
    pass


class TestBreakTimeCalculation:
    """Tests for break time calculation in analytics.

    Break time should use storage.get_work_break_balance() which counts
    gaps between sessions that are 1 minute to 2 hours as breaks.
    """

    @pytest.fixture
    def storage_with_sessions(self, test_db_path):
        """Create storage with realistic session data for testing.

        Creates sessions with known gaps for break time testing:
        - Session 1: 9:00 AM - 10:30 AM (1.5 hours)
        - Gap: 15 minutes (break - should be counted)
        - Session 2: 10:45 AM - 12:00 PM (1.25 hours)
        - Gap: 1 hour (lunch - should be counted)
        - Session 3: 1:00 PM - 3:00 PM (2 hours)
        - Gap: 30 seconds (too short - NOT a break)
        - Session 4: 3:00:30 PM - 5:00 PM (almost 2 hours)

        Total breaks: 15 min + 60 min = 75 min = 4500 seconds
        """
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 0, 0, 0)

        with storage.get_connection() as conn:
            sessions = [
                (base_date.replace(hour=9, minute=0),
                 base_date.replace(hour=10, minute=30)),
                (base_date.replace(hour=10, minute=45),
                 base_date.replace(hour=12, minute=0)),
                (base_date.replace(hour=13, minute=0),
                 base_date.replace(hour=15, minute=0)),
                (base_date.replace(hour=15, minute=0, second=30),
                 base_date.replace(hour=17, minute=0)),
            ]

            for start, end in sessions:
                conn.execute(
                    """
                    INSERT INTO activity_sessions (start_time, end_time)
                    VALUES (?, ?)
                    """,
                    (start.isoformat(), end.isoformat())
                )

            for i, (start, end) in enumerate(sessions):
                duration = int((end - start).total_seconds())
                conn.execute(
                    """
                    INSERT INTO window_focus_events
                    (app_name, window_title, start_time, end_time,
                     duration_seconds, session_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (f'code', f'Window {i}', start.isoformat(),
                     end.isoformat(), duration, i + 1)
                )

            conn.commit()

        return storage, base_date

    def test_break_time_uses_work_break_balance(self, storage_with_sessions):
        """Break time should use storage.get_work_break_balance().

        The _get_day_data() function should call get_work_break_balance()
        and use its break_seconds value, not a formula based on goal time.
        """
        storage, base_date = storage_with_sessions

        # The correct break time from get_work_break_balance
        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        # Expected: 15 min + 60 min = 75 min = 4500 seconds
        # (30 second gap is < 1 min so not counted)
        assert work_break['break_seconds'] == 4500, \
            f"Expected 4500 seconds (75 min), got {work_break['break_seconds']}"

    def test_break_time_counts_valid_gaps(self, storage_with_sessions):
        """Break time should count gaps between 1 minute and 2 hours."""
        storage, base_date = storage_with_sessions

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        # Should count 2 breaks: 15 min and 60 min
        assert work_break['break_count'] == 2, \
            f"Expected 2 breaks, got {work_break['break_count']}"

    def test_break_time_ignores_short_gaps(self, test_db_path):
        """Gaps < 1 minute should not be counted as breaks."""
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 9, 0, 0)

        with storage.get_connection() as conn:
            # Two sessions with 30-second gap (should NOT be a break)
            sessions = [
                (base_date, base_date + timedelta(hours=1)),
                (base_date + timedelta(hours=1, seconds=30),
                 base_date + timedelta(hours=2)),
            ]

            for start, end in sessions:
                conn.execute(
                    "INSERT INTO activity_sessions (start_time, end_time) VALUES (?, ?)",
                    (start.isoformat(), end.isoformat())
                )
            conn.commit()

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        assert work_break['break_count'] == 0, \
            f"Expected 0 breaks (gap too short), got {work_break['break_count']}"
        assert work_break['break_seconds'] == 0, \
            f"Expected 0 seconds, got {work_break['break_seconds']}"

    def test_break_time_ignores_long_gaps(self, test_db_path):
        """Gaps > 2 hours should not be counted as breaks."""
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 9, 0, 0)

        with storage.get_connection() as conn:
            # Two sessions with 3-hour gap (should NOT be a break)
            sessions = [
                (base_date, base_date + timedelta(hours=1)),
                (base_date + timedelta(hours=4),
                 base_date + timedelta(hours=5)),
            ]

            for start, end in sessions:
                conn.execute(
                    "INSERT INTO activity_sessions (start_time, end_time) VALUES (?, ?)",
                    (start.isoformat(), end.isoformat())
                )
            conn.commit()

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        assert work_break['break_count'] == 0, \
            f"Expected 0 breaks (gap too long), got {work_break['break_count']}"


class TestStartEndTimeDetection:
    """Tests for start/end time detection in analytics.

    Start time should be the actual first session start time,
    not midnight or some default value.
    """

    @pytest.fixture
    def storage_with_known_times(self, test_db_path):
        """Create storage with sessions at known times.

        First session starts at 8:45 AM
        Last session ends at 5:30 PM
        """
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 0, 0, 0)

        with storage.get_connection() as conn:
            sessions = [
                (base_date.replace(hour=8, minute=45),
                 base_date.replace(hour=10, minute=0)),
                (base_date.replace(hour=14, minute=0),
                 base_date.replace(hour=17, minute=30)),
            ]

            for start, end in sessions:
                conn.execute(
                    "INSERT INTO activity_sessions (start_time, end_time) VALUES (?, ?)",
                    (start.isoformat(), end.isoformat())
                )
            conn.commit()

        return storage, base_date

    def test_start_time_uses_first_session_start(self, storage_with_known_times):
        """Start time should come from get_work_break_balance().first_session_start."""
        storage, base_date = storage_with_known_times

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        expected_start = base_date.replace(hour=8, minute=45).isoformat()
        assert work_break['first_session_start'] == expected_start, \
            f"Expected {expected_start}, got {work_break['first_session_start']}"

    def test_end_time_uses_last_session_end(self, storage_with_known_times):
        """End time should come from get_work_break_balance().last_session_end."""
        storage, base_date = storage_with_known_times

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        expected_end = base_date.replace(hour=17, minute=30).isoformat()
        assert work_break['last_session_end'] == expected_end, \
            f"Expected {expected_end}, got {work_break['last_session_end']}"

    def test_start_time_formats_correctly(self, storage_with_known_times):
        """Start time should format as '8:45 AM' not '12:00 AM'."""
        storage, base_date = storage_with_known_times

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        # Parse and format the start time
        start_dt = datetime.fromisoformat(work_break['first_session_start'])
        formatted = start_dt.strftime('%I:%M %p').lstrip('0')

        assert formatted == '8:45 AM', \
            f"Expected '8:45 AM', got '{formatted}'"
        assert formatted != '12:00 AM', \
            "Start time should not be midnight"

    def test_start_time_none_when_no_data(self, test_db_path):
        """Start time should be None when no sessions exist."""
        storage = ActivityStorage(test_db_path)
        base_date = datetime(2026, 1, 6, 0, 0, 0)

        start = base_date.replace(hour=0, minute=0, second=0)
        end = base_date.replace(hour=23, minute=59, second=59)
        work_break = storage.get_work_break_balance(start, end)

        assert work_break['first_session_start'] is None, \
            f"Expected None, got {work_break['first_session_start']}"


class TestProductivityScore:
    """Tests for productivity score calculation.

    Score should be 0-100 based on productive percentage,
    not -100 to +100 based on (productive - distracting).
    """

    def test_productivity_score_is_0_to_100(self):
        """Score should be in the 0-100 range, not -100 to +100."""
        # Import the function to test
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'web'))

        from app import _calculate_productivity_breakdown

        # Test with mixed apps
        apps = [
            {'app_name': 'code', 'total_seconds': 3600},      # productive
            {'app_name': 'firefox', 'total_seconds': 3600},   # neutral
            {'app_name': 'slack', 'total_seconds': 3600},     # distracting
        ]

        result = _calculate_productivity_breakdown(apps)
        score = result['score']

        assert 0 <= score <= 100, \
            f"Score should be 0-100, got {score}"

    def test_productivity_score_equals_productive_pct(self):
        """Score should equal the productive percentage."""
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'web'))

        from app import _calculate_productivity_breakdown

        # 50% productive (code), 50% neutral (firefox)
        apps = [
            {'app_name': 'code', 'total_seconds': 3600},
            {'app_name': 'firefox', 'total_seconds': 3600},
        ]

        result = _calculate_productivity_breakdown(apps)

        assert result['score'] == result['productive_pct'], \
            f"Score ({result['score']}) should equal productive_pct ({result['productive_pct']})"

    def test_productivity_score_100_when_all_productive(self):
        """Score should be 100 when all time is productive."""
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'web'))

        from app import _calculate_productivity_breakdown

        apps = [
            {'app_name': 'code', 'total_seconds': 3600},
            {'app_name': 'terminal', 'total_seconds': 3600},
        ]

        result = _calculate_productivity_breakdown(apps)

        assert result['score'] == 100, \
            f"Expected score 100, got {result['score']}"

    def test_productivity_score_0_when_none_productive(self):
        """Score should be 0 when no time is productive."""
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'web'))

        from app import _calculate_productivity_breakdown

        # All neutral or distracting
        apps = [
            {'app_name': 'firefox', 'total_seconds': 3600},   # neutral
            {'app_name': 'slack', 'total_seconds': 3600},     # distracting
        ]

        result = _calculate_productivity_breakdown(apps)

        assert result['score'] == 0, \
            f"Expected score 0, got {result['score']}"

    def test_productivity_score_with_mixed_categories(self):
        """Score should correctly reflect productive percentage with all categories."""
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'web'))

        from app import _calculate_productivity_breakdown

        # 5 hours productive (code + terminal), 2 hours neutral, 1 hour distracting
        # Productive: 62.5% = 62 (integer)
        apps = [
            {'app_name': 'code', 'total_seconds': 4 * 3600},
            {'app_name': 'terminal', 'total_seconds': 1 * 3600},
            {'app_name': 'firefox', 'total_seconds': 2 * 3600},
            {'app_name': 'slack', 'total_seconds': 1 * 3600},
        ]

        result = _calculate_productivity_breakdown(apps)

        # productive_pct = 62 (5/8 hours = 62.5%, truncated to 62)
        assert result['productive_pct'] == 62, \
            f"Expected productive_pct 62, got {result['productive_pct']}"
        assert result['score'] == 62, \
            f"Expected score 62, got {result['score']}"
