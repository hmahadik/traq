#!/usr/bin/env python3

import os
import sqlite3
from datetime import datetime, date, timedelta
from pathlib import Path

from flask import Flask, render_template, send_file, jsonify, request, abort

app = Flask(__name__)

DATA_DIR = Path.home() / "activity-tracker-data"
DB_PATH = DATA_DIR / "activity.db"
SCREENSHOTS_DIR = DATA_DIR / "screenshots"


def get_db_connection():
    """Get a database connection."""
    if not DB_PATH.exists():
        abort(500, "Database not found. Is the tracker service running?")
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_screenshots_for_date(target_date):
    """Get all screenshots for a specific date."""
    conn = get_db_connection()
    
    # Get timestamps for the target date (start of day to start of next day)
    start_timestamp = int(datetime.combine(target_date, datetime.min.time()).timestamp())
    end_timestamp = int(datetime.combine(target_date + timedelta(days=1), datetime.min.time()).timestamp())
    
    cursor = conn.execute("""
        SELECT id, timestamp, file_path, file_hash
        FROM screenshots
        WHERE timestamp >= ? AND timestamp < ?
        ORDER BY timestamp ASC
    """, (start_timestamp, end_timestamp))
    
    screenshots = cursor.fetchall()
    conn.close()
    
    # Convert to list of dicts and add formatted time
    result = []
    for row in screenshots:
        screenshot = dict(row)
        screenshot['formatted_time'] = datetime.fromtimestamp(screenshot['timestamp']).strftime('%H:%M:%S')
        result.append(screenshot)
    
    return result


@app.route('/')
def index():
    """Show today's screenshots."""
    today = date.today()
    screenshots = get_screenshots_for_date(today)
    return render_template('day.html', screenshots=screenshots, date=today, today=today, timedelta=timedelta)


@app.route('/day/<date_string>')
def day_view(date_string):
    """Show screenshots for a specific day (YYYY-MM-DD format)."""
    try:
        target_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        abort(400, "Invalid date format. Use YYYY-MM-DD.")
    
    screenshots = get_screenshots_for_date(target_date)
    today = date.today()
    return render_template('day.html', screenshots=screenshots, date=target_date, today=today, timedelta=timedelta)


@app.route('/screenshot/<int:screenshot_id>')
def serve_screenshot(screenshot_id):
    """Serve the actual screenshot image file."""
    conn = get_db_connection()
    
    cursor = conn.execute("""
        SELECT file_path FROM screenshots WHERE id = ?
    """, (screenshot_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        abort(404, "Screenshot not found")
    
    file_path = SCREENSHOTS_DIR / row['file_path']
    
    if not file_path.exists():
        abort(404, "Screenshot file not found on disk")
    
    return send_file(file_path, mimetype='image/webp')


@app.route('/api/screenshots')
def api_screenshots():
    """JSON API for screenshots in a time range."""
    start_param = request.args.get('start')
    end_param = request.args.get('end')
    
    if not start_param or not end_param:
        return jsonify({"error": "Both 'start' and 'end' parameters required"}), 400
    
    try:
        start_timestamp = int(start_param)
        end_timestamp = int(end_param)
    except ValueError:
        return jsonify({"error": "Start and end must be valid Unix timestamps"}), 400
    
    if start_timestamp >= end_timestamp:
        return jsonify({"error": "Start timestamp must be before end timestamp"}), 400
    
    conn = get_db_connection()
    
    cursor = conn.execute("""
        SELECT id, timestamp, file_path, file_hash
        FROM screenshots
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp ASC
    """, (start_timestamp, end_timestamp))
    
    screenshots = []
    for row in cursor.fetchall():
        screenshot = dict(row)
        screenshot['iso_time'] = datetime.fromtimestamp(screenshot['timestamp']).isoformat()
        screenshots.append(screenshot)
    
    conn.close()
    
    return jsonify({
        "screenshots": screenshots,
        "count": len(screenshots),
        "start": start_timestamp,
        "end": end_timestamp
    })


if __name__ == '__main__':
    app.run(debug=True, host='localhost', port=5000)