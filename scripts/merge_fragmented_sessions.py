#!/usr/bin/env python3
"""Merge sessions fragmented by daemon restarts (gaps < 60s).

This script identifies consecutive sessions with very short gaps (< 60 seconds)
that are likely caused by daemon restarts rather than actual AFK periods,
and merges them into single logical sessions.

Usage:
    python scripts/merge_fragmented_sessions.py --dry-run  # Preview changes
    python scripts/merge_fragmented_sessions.py            # Apply changes

The script will:
1. Find session pairs with gaps < MERGE_GAP_SECONDS
2. Merge consecutive sessions by:
   - Extending the first session's end_time
   - Moving all FKs (focus_events, screenshots, ocr_cache) to the first session
   - Recalculating session stats
   - Deleting the second session
3. Optionally delete affected summaries (prompts for confirmation)
"""

import argparse
import os
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# Configuration
MERGE_GAP_SECONDS = 60  # Sessions with gaps less than this are merged
DB_PATH = Path.home() / "activity-tracker-data" / "activity.db"


def find_fragmented_pairs_with_threshold(conn: sqlite3.Connection, gap_threshold: int) -> list:
    """Find consecutive session pairs with short gaps.

    Returns list of tuples: (s1_id, s2_id, s1_start, s1_end, s2_start, s2_end, gap_seconds)
    """
    query = """
        SELECT
            s1.id as s1_id,
            s2.id as s2_id,
            s1.start_time as s1_start,
            s1.end_time as s1_end,
            s2.start_time as s2_start,
            s2.end_time as s2_end,
            ROUND((julianday(s2.start_time) - julianday(s1.end_time)) * 86400, 1) as gap_seconds
        FROM activity_sessions s1
        JOIN activity_sessions s2 ON s2.id = s1.id + 1
        WHERE s1.end_time IS NOT NULL
          AND s2.end_time IS NOT NULL
          AND (julianday(s2.start_time) - julianday(s1.end_time)) * 86400 > 0
          AND (julianday(s2.start_time) - julianday(s1.end_time)) * 86400 < ?
        ORDER BY s1.id
    """
    return conn.execute(query, (gap_threshold,)).fetchall()


def build_merge_chains(pairs: list) -> list:
    """Build chains of sessions to merge (handles multiple consecutive restarts).

    Returns list of lists, where each inner list contains session IDs to merge.
    Example: [[101, 102, 103], [200, 201]] means merge 101+102+103 and 200+201
    """
    if not pairs:
        return []

    chains = []
    current_chain = [pairs[0][0], pairs[0][1]]  # Start with first pair's IDs

    for i in range(1, len(pairs)):
        s1_id, s2_id = pairs[i][0], pairs[i][1]

        # If this pair continues the current chain
        if s1_id == current_chain[-1]:
            current_chain.append(s2_id)
        else:
            # Start a new chain
            chains.append(current_chain)
            current_chain = [s1_id, s2_id]

    chains.append(current_chain)
    return chains


def get_session_details(conn: sqlite3.Connection, session_id: int) -> dict:
    """Get details for a single session."""
    row = conn.execute("""
        SELECT id, start_time, end_time, duration_seconds,
               screenshot_count, unique_windows
        FROM activity_sessions WHERE id = ?
    """, (session_id,)).fetchone()

    if row:
        return {
            'id': row[0],
            'start_time': row[1],
            'end_time': row[2],
            'duration_seconds': row[3],
            'screenshot_count': row[4],
            'unique_windows': row[5]
        }
    return None


def merge_chain(conn: sqlite3.Connection, chain: list, dry_run: bool) -> dict:
    """Merge a chain of sessions into the first session.

    Args:
        conn: Database connection
        chain: List of session IDs to merge (first becomes the merged session)
        dry_run: If True, don't make changes

    Returns:
        Dict with merge statistics
    """
    if len(chain) < 2:
        return {'merged': 0}

    keep_id = chain[0]
    delete_ids = chain[1:]

    # Get session details for reporting
    first_session = get_session_details(conn, keep_id)
    last_session = get_session_details(conn, chain[-1])

    if not first_session or not last_session:
        return {'merged': 0, 'error': 'Session not found'}

    # Calculate new values
    new_end_time = last_session['end_time']

    # Calculate duration from start to end
    start_dt = datetime.fromisoformat(first_session['start_time'])
    end_dt = datetime.fromisoformat(new_end_time)
    new_duration = int((end_dt - start_dt).total_seconds())

    stats = {
        'keep_id': keep_id,
        'delete_ids': delete_ids,
        'original_start': first_session['start_time'],
        'original_end': first_session['end_time'],
        'new_end': new_end_time,
        'new_duration_min': round(new_duration / 60, 1),
        'merged_count': len(delete_ids)
    }

    if dry_run:
        return stats

    # Update foreign keys to point to the kept session
    for del_id in delete_ids:
        conn.execute(
            "UPDATE session_screenshots SET session_id = ? WHERE session_id = ?",
            (keep_id, del_id)
        )
        conn.execute(
            "UPDATE window_focus_events SET session_id = ? WHERE session_id = ?",
            (keep_id, del_id)
        )
        # For session_ocr_cache, delete duplicates first to avoid UNIQUE constraint
        # (session_id, window_title is unique - if both sessions have same title, keep the first)
        conn.execute(
            """DELETE FROM session_ocr_cache
               WHERE session_id = ? AND window_title IN (
                   SELECT window_title FROM session_ocr_cache WHERE session_id = ?
               )""",
            (del_id, keep_id)
        )
        conn.execute(
            "UPDATE session_ocr_cache SET session_id = ? WHERE session_id = ?",
            (keep_id, del_id)
        )

    # Update the kept session's end_time and duration
    conn.execute("""
        UPDATE activity_sessions
        SET end_time = ?, duration_seconds = ?
        WHERE id = ?
    """, (new_end_time, new_duration, keep_id))

    # Recalculate screenshot_count and unique_windows
    screenshot_count = conn.execute("""
        SELECT COUNT(*) FROM session_screenshots WHERE session_id = ?
    """, (keep_id,)).fetchone()[0]

    unique_windows = conn.execute("""
        SELECT COUNT(DISTINCT window_title) FROM window_focus_events WHERE session_id = ?
    """, (keep_id,)).fetchone()[0]

    conn.execute("""
        UPDATE activity_sessions
        SET screenshot_count = ?, unique_windows = ?
        WHERE id = ?
    """, (screenshot_count, unique_windows, keep_id))

    # Delete the merged sessions
    for del_id in delete_ids:
        conn.execute("DELETE FROM activity_sessions WHERE id = ?", (del_id,))

    return stats


def get_affected_dates(conn: sqlite3.Connection, chains: list) -> set:
    """Get all dates affected by the merge operations."""
    dates = set()
    for chain in chains:
        for session_id in chain:
            row = conn.execute(
                "SELECT date(start_time) FROM activity_sessions WHERE id = ?",
                (session_id,)
            ).fetchone()
            if row:
                dates.add(row[0])
    return dates


def delete_summaries_for_dates(conn: sqlite3.Connection, dates: set, dry_run: bool) -> int:
    """Delete threshold_summaries for the affected dates."""
    if not dates:
        return 0

    placeholders = ','.join('?' * len(dates))
    query = f"""
        SELECT COUNT(*) FROM threshold_summaries
        WHERE date(start_time) IN ({placeholders})
    """
    count = conn.execute(query, tuple(dates)).fetchone()[0]

    if dry_run or count == 0:
        return count

    delete_query = f"""
        DELETE FROM threshold_summaries
        WHERE date(start_time) IN ({placeholders})
    """
    conn.execute(delete_query, tuple(dates))
    return count


def main():
    parser = argparse.ArgumentParser(
        description='Merge sessions fragmented by daemon restarts'
    )
    parser.add_argument(
        '--dry-run', action='store_true',
        help='Preview changes without modifying the database'
    )
    parser.add_argument(
        '--db', type=str, default=str(DB_PATH),
        help=f'Path to database (default: {DB_PATH})'
    )
    parser.add_argument(
        '--delete-summaries', action='store_true',
        help='Also delete summaries for affected dates (will prompt if not specified)'
    )
    parser.add_argument(
        '--gap-threshold', type=int, default=MERGE_GAP_SECONDS,
        help=f'Gap threshold in seconds (default: {MERGE_GAP_SECONDS})'
    )
    args = parser.parse_args()

    db_path = args.db
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)

    gap_threshold = args.gap_threshold

    print(f"{'DRY RUN - ' if args.dry_run else ''}Merge Fragmented Sessions")
    print(f"Database: {db_path}")
    print(f"Gap threshold: {gap_threshold} seconds")
    print("-" * 60)

    conn = sqlite3.connect(db_path)

    # Find fragmented pairs
    pairs = find_fragmented_pairs_with_threshold(conn, gap_threshold)
    if not pairs:
        print("No fragmented session pairs found.")
        conn.close()
        return

    print(f"Found {len(pairs)} session pairs with gaps < {gap_threshold}s")

    # Build merge chains
    chains = build_merge_chains(pairs)
    print(f"Built {len(chains)} merge chains")
    print()

    # Show summary by chain size
    chain_sizes = {}
    for chain in chains:
        size = len(chain)
        chain_sizes[size] = chain_sizes.get(size, 0) + 1

    print("Chain sizes:")
    for size, count in sorted(chain_sizes.items()):
        print(f"  {size} sessions to merge: {count} chains")
    print()

    # Get affected dates
    affected_dates = get_affected_dates(conn, chains)
    print(f"Affected dates: {len(affected_dates)}")
    for d in sorted(affected_dates):
        print(f"  {d}")
    print()

    # Preview/execute merges
    total_merged = 0
    print("Merge operations:")
    for i, chain in enumerate(chains):
        stats = merge_chain(conn, chain, args.dry_run)
        total_merged += stats.get('merged_count', 0)

        if args.dry_run:
            print(f"  Chain {i+1}: Merge sessions {chain} -> keep {chain[0]}")
            print(f"    Duration: {stats.get('new_duration_min', '?')} min")
        else:
            print(f"  Merged chain {i+1}: {chain} -> {chain[0]}")

    print()
    print(f"Total sessions to delete: {total_merged}")

    # Handle summaries
    summary_count = delete_summaries_for_dates(conn, affected_dates, dry_run=True)
    print(f"Summaries on affected dates: {summary_count}")

    if not args.dry_run and summary_count > 0:
        if args.delete_summaries:
            delete_summaries = True
        else:
            response = input(f"Delete {summary_count} summaries for affected dates? [y/N] ")
            delete_summaries = response.lower() in ('y', 'yes')

        if delete_summaries:
            deleted = delete_summaries_for_dates(conn, affected_dates, dry_run=False)
            print(f"Deleted {deleted} summaries")
        else:
            print("Summaries kept (you can delete them manually later)")

    if not args.dry_run:
        conn.commit()
        print()
        print("Changes committed successfully!")
        print("Run 'Generate Missing' in the UI to regenerate summaries with new boundaries")
    else:
        print()
        print("DRY RUN complete. Run without --dry-run to apply changes.")

    conn.close()


if __name__ == '__main__':
    main()
