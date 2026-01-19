#!/usr/bin/env python3
"""
Migration script to recover Session 94 data from v1 database.
"""
import sqlite3
import os
from datetime import datetime

V1_DB = os.path.expanduser("~/activity-tracker-data/activity.db")
V2_DB = os.path.expanduser("~/.local/share/traq/data.db")
V2_SCREENSHOTS_DIR = os.path.expanduser("~/.local/share/traq/screenshots")

# Session 94 time range (from v1 session 493)
SESSION_START = "2026-01-14 10:38:03"
SESSION_END = "2026-01-14 13:17:37"

def main():
    v1_conn = sqlite3.connect(V1_DB)
    v2_conn = sqlite3.connect(V2_DB)
    v1_conn.row_factory = sqlite3.Row
    v2_conn.row_factory = sqlite3.Row

    # Convert session times to unix timestamps
    start_ts = int(datetime.strptime(SESSION_START, "%Y-%m-%d %H:%M:%S").timestamp())
    end_ts = int(datetime.strptime(SESSION_END, "%Y-%m-%d %H:%M:%S").timestamp())

    print(f"Session time range: {SESSION_START} to {SESSION_END}")
    print(f"Unix timestamps: {start_ts} to {end_ts}")

    # Step 1: Create new session in v2
    print("\n=== Step 1: Creating new session ===")
    v2_cur = v2_conn.cursor()
    v2_cur.execute("""
        INSERT INTO sessions (start_time, end_time, duration_seconds, screenshot_count, created_at)
        VALUES (?, ?, ?, 0, strftime('%s', 'now'))
    """, (start_ts, end_ts, end_ts - start_ts))
    new_session_id = v2_cur.lastrowid
    print(f"Created session {new_session_id}")

    # Step 2: Import focus events from v1
    print("\n=== Step 2: Importing focus events ===")
    v1_cur = v1_conn.cursor()
    v1_cur.execute("""
        SELECT window_title, app_name, window_class, start_time, end_time, duration_seconds
        FROM window_focus_events
        WHERE session_id = 493
    """)
    focus_events = v1_cur.fetchall()
    print(f"Found {len(focus_events)} focus events in v1")

    imported_focus = 0
    for event in focus_events:
        # v1 stores timestamps as ISO strings, convert to unix
        start = int(datetime.fromisoformat(event['start_time']).timestamp())
        end = int(datetime.fromisoformat(event['end_time']).timestamp())

        v2_cur.execute("""
            INSERT INTO window_focus_events
            (window_title, app_name, window_class, start_time, end_time, duration_seconds, session_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        """, (
            event['window_title'],
            event['app_name'],
            event['window_class'],
            start,
            end,
            event['duration_seconds'],
            new_session_id
        ))
        imported_focus += 1
    print(f"Imported {imported_focus} focus events")

    # Step 3: Match v2 orphan files with v1 metadata and create screenshot records
    print("\n=== Step 3: Recovering screenshots ===")

    # Get list of orphan v2 files in the session time range
    screenshot_dir = os.path.join(V2_SCREENSHOTS_DIR, "2026/01/14")
    orphan_files = []
    for fname in os.listdir(screenshot_dir):
        if fname.endswith('.webp') and '_thumb' not in fname:
            # Parse timestamp from filename (HHMMSS_m0.webp)
            time_part = fname.split('_')[0]
            hour = int(time_part[0:2])
            minute = int(time_part[2:4])
            second = int(time_part[4:6])

            # Check if in session range (10:38 to 13:17)
            file_time = hour * 3600 + minute * 60 + second
            start_time = 10 * 3600 + 38 * 60
            end_time = 13 * 3600 + 18 * 60

            if start_time <= file_time <= end_time:
                filepath = os.path.join(screenshot_dir, fname)
                # Build full timestamp
                ts = datetime(2026, 1, 14, hour, minute, second).timestamp()
                orphan_files.append((int(ts), filepath, fname))

    orphan_files.sort()
    print(f"Found {len(orphan_files)} orphan v2 screenshot files")

    # Get v1 screenshots with metadata
    v1_cur.execute("""
        SELECT timestamp, dhash, window_title, app_name,
               window_x, window_y, window_width, window_height,
               monitor_name, monitor_width, monitor_height
        FROM screenshots
        WHERE datetime(timestamp, 'unixepoch', 'localtime') >= ?
          AND datetime(timestamp, 'unixepoch', 'localtime') < ?
        ORDER BY timestamp
    """, (SESSION_START, SESSION_END.replace("13:17", "13:18")))
    v1_screenshots = v1_cur.fetchall()
    print(f"Found {len(v1_screenshots)} v1 screenshots with metadata")

    # Build lookup dict for v1 screenshots by rounded timestamp
    v1_lookup = {}
    for ss in v1_screenshots:
        # Round to nearest 30 seconds for matching
        ts_rounded = (ss['timestamp'] // 30) * 30
        v1_lookup[ts_rounded] = ss

    # Match and insert
    imported_screenshots = 0
    unmatched = 0
    for ts, filepath, fname in orphan_files:
        # Try to find matching v1 metadata
        ts_rounded = (ts // 30) * 30
        v1_meta = v1_lookup.get(ts_rounded)

        if v1_meta:
            dhash = v1_meta['dhash']
            window_title = v1_meta['window_title']
            app_name = v1_meta['app_name']
            window_x = v1_meta['window_x']
            window_y = v1_meta['window_y']
            window_width = v1_meta['window_width']
            window_height = v1_meta['window_height']
            monitor_name = v1_meta['monitor_name']
            monitor_width = v1_meta['monitor_width']
            monitor_height = v1_meta['monitor_height']
        else:
            # No match, use defaults
            dhash = "0" * 16
            window_title = "Unknown"
            app_name = "unknown"
            window_x = window_y = window_width = window_height = None
            monitor_name = monitor_width = monitor_height = None
            unmatched += 1

        v2_cur.execute("""
            INSERT INTO screenshots
            (timestamp, filepath, dhash, window_title, app_name,
             window_x, window_y, window_width, window_height,
             monitor_name, monitor_width, monitor_height,
             session_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
        """, (
            ts, filepath, dhash, window_title, app_name,
            window_x, window_y, window_width, window_height,
            monitor_name, monitor_width, monitor_height,
            new_session_id
        ))
        imported_screenshots += 1

    # Update session screenshot count
    v2_cur.execute("""
        UPDATE sessions SET screenshot_count = ? WHERE id = ?
    """, (imported_screenshots, new_session_id))

    print(f"Imported {imported_screenshots} screenshots ({unmatched} without v1 metadata)")

    # Commit
    v2_conn.commit()
    print(f"\n=== Migration complete! ===")
    print(f"New session ID: {new_session_id}")
    print(f"Focus events: {imported_focus}")
    print(f"Screenshots: {imported_screenshots}")

    v1_conn.close()
    v2_conn.close()

if __name__ == "__main__":
    main()
