#!/usr/bin/env python3
"""Migration Script: Backfill NULL app_name values using window_title inference.

This script updates the database to fill in NULL app_name values by inferring
the application name from window titles. It processes all screenshots with
NULL app_name and attempts to infer the application based on common patterns.

Usage:
    python scripts/backfill_app_names.py [--dry-run] [--verbose]

Options:
    --dry-run   Show what would be changed without modifying the database
    --verbose   Show detailed information about each update
"""

import sqlite3
import sys
import argparse
import re
from pathlib import Path
from typing import Optional


def infer_app_name(window_title: Optional[str]) -> Optional[str]:
    """Infer application name from window title when app_name is NULL.

    This is a copy of the inference logic from tracker.app_inference to avoid
    import issues with dependencies during migration.
    """
    if not window_title:
        return None

    # Pattern mapping: regex pattern → app_name
    patterns = [
        # Visual Studio Code
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
        (r'^Files$', 'org.gnome.Nautilus'),
        (r'- Files$', 'org.gnome.Nautilus'),

        # Image viewers
        (r'^Image Viewer', 'Eog'),
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

        # GNOME Shell
        (r'^gnome-shell$', 'Gjs'),
    ]

    for pattern, app_name in patterns:
        if re.search(pattern, window_title, re.IGNORECASE):
            return app_name

    return None


def backfill_app_names(db_path: str, dry_run: bool = False, verbose: bool = False):
    """Backfill NULL app_name values by inferring from window titles.

    Args:
        db_path (str): Path to the SQLite database
        dry_run (bool): If True, only show what would be changed
        verbose (bool): If True, show detailed information
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all screenshots with NULL app_name
    cursor.execute("""
        SELECT id, window_title, app_name
        FROM screenshots
        WHERE app_name IS NULL
        ORDER BY id
    """)

    rows = cursor.fetchall()
    total_null = len(rows)

    print(f"Found {total_null} screenshots with NULL app_name")

    if total_null == 0:
        print("Nothing to backfill!")
        conn.close()
        return

    # Track statistics
    stats = {
        'total': total_null,
        'inferred': 0,
        'unchanged': 0,
        'by_app': {}
    }

    # Process each row
    updates = []
    for row in rows:
        screenshot_id = row['id']
        window_title = row['window_title']

        # Try to infer app_name
        inferred_app = infer_app_name(window_title)

        if inferred_app:
            updates.append((inferred_app, screenshot_id))
            stats['inferred'] += 1
            stats['by_app'][inferred_app] = stats['by_app'].get(inferred_app, 0) + 1

            if verbose:
                print(f"  [{screenshot_id}] {window_title[:60]:60s} → {inferred_app}")
        else:
            stats['unchanged'] += 1
            if verbose:
                print(f"  [{screenshot_id}] {window_title[:60]:60s} → (no inference)")

    # Show summary
    print(f"\n{'='*80}")
    print(f"Summary:")
    print(f"  Total NULL app_name entries: {stats['total']}")
    print(f"  Successfully inferred:       {stats['inferred']} ({stats['inferred']/stats['total']*100:.1f}%)")
    print(f"  Still NULL after inference:  {stats['unchanged']} ({stats['unchanged']/stats['total']*100:.1f}%)")

    if stats['inferred'] > 0:
        print(f"\nInferred applications:")
        for app, count in sorted(stats['by_app'].items(), key=lambda x: x[1], reverse=True):
            print(f"  {app:30s}: {count:4d} screenshots")

    # Apply updates if not dry-run
    if not dry_run:
        print(f"\n{'='*80}")
        print(f"Applying {len(updates)} updates to database...")

        cursor.executemany("""
            UPDATE screenshots
            SET app_name = ?
            WHERE id = ?
        """, updates)

        conn.commit()
        print(f"✓ Database updated successfully!")
    else:
        print(f"\n{'='*80}")
        print(f"DRY RUN - No changes made to database")
        print(f"Run without --dry-run to apply {len(updates)} updates")

    conn.close()


def main():
    """Main entry point for the backfill script."""
    parser = argparse.ArgumentParser(
        description="Backfill NULL app_name values using window_title inference"
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be changed without modifying the database'
    )
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Show detailed information about each update'
    )
    parser.add_argument(
        '--db-path',
        default=str(Path.home() / "activity-tracker-data" / "activity.db"),
        help='Path to the SQLite database (default: ~/activity-tracker-data/activity.db)'
    )

    args = parser.parse_args()

    # Check if database exists
    if not Path(args.db_path).exists():
        print(f"Error: Database not found at {args.db_path}")
        sys.exit(1)

    print(f"Activity Tracker - Backfill App Names")
    print(f"{'='*80}")
    print(f"Database: {args.db_path}")
    print(f"Mode: {'DRY RUN' if args.dry_run else 'LIVE UPDATE'}")
    print(f"{'='*80}\n")

    backfill_app_names(args.db_path, dry_run=args.dry_run, verbose=args.verbose)


if __name__ == "__main__":
    main()
