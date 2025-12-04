#!/usr/bin/env python3

import os
import sqlite3
from datetime import datetime, date, timedelta
from pathlib import Path

from flask import Flask, render_template, send_file, jsonify, request, abort

from tracker.analytics import ActivityAnalytics

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
        SELECT id, timestamp, filepath, dhash, window_title, app_name
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
    """Redirect to timeline (primary interface)."""
    from flask import redirect
    return redirect('/timeline')


@app.route('/day/<date_string>')
def day_view(date_string):
    """Show screenshots for a specific day (YYYY-MM-DD format)."""
    try:
        target_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        abort(400, "Invalid date format. Use YYYY-MM-DD.")

    screenshots = get_screenshots_for_date(target_date)
    today = date.today()
    return render_template('day.html',
                         screenshots=screenshots,
                         date=target_date,
                         today=today.strftime('%Y-%m-%d'),
                         page='day',
                         timedelta=timedelta)


@app.route('/timeline')
def timeline():
    """Show the timeline view with calendar heatmap and hourly breakdown."""
    today = date.today()
    return render_template('timeline.html',
                         today=today.strftime('%Y-%m-%d'),
                         page='timeline')


@app.route('/analytics')
def analytics():
    """Show the analytics dashboard with charts and statistics."""
    today = date.today()
    return render_template('analytics.html',
                         today=today.strftime('%Y-%m-%d'),
                         page='analytics')


@app.route('/screenshot/<int:screenshot_id>')
def serve_screenshot(screenshot_id):
    """Serve the actual screenshot image file."""
    conn = get_db_connection()
    
    cursor = conn.execute("""
        SELECT filepath FROM screenshots WHERE id = ?
    """, (screenshot_id,))
    
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        abort(404, "Screenshot not found")

    file_path = SCREENSHOTS_DIR / row['filepath']
    
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
        SELECT id, timestamp, filepath, dhash, window_title, app_name
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


@app.route('/api/calendar/<int:year>/<int:month>')
def api_calendar_data(year, month):
    """JSON API for calendar heatmap data."""
    # Validate month
    if month < 1 or month > 12:
        return jsonify({"error": "Month must be between 1 and 12"}), 400

    # Validate year (reasonable range)
    if year < 2000 or year > 2100:
        return jsonify({"error": "Year must be between 2000 and 2100"}), 400

    try:
        analytics = ActivityAnalytics()
        calendar_data = analytics.get_calendar_data(year, month)

        return jsonify({
            "year": year,
            "month": month,
            "days": calendar_data
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get calendar data: {str(e)}"}), 500


@app.route('/api/day/<date_string>/hourly')
def api_day_hourly(date_string):
    """JSON API for hourly breakdown of a specific day."""
    try:
        target_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        analytics = ActivityAnalytics()
        hourly_data = analytics.get_hourly_breakdown(target_date)

        return jsonify({
            "date": date_string,
            "hourly": hourly_data
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get hourly data: {str(e)}"}), 500


@app.route('/api/day/<date_string>/summary')
def api_day_summary(date_string):
    """JSON API for daily summary statistics."""
    try:
        target_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        analytics = ActivityAnalytics()
        summary = analytics.get_daily_summary(target_date)

        return jsonify({
            "date": date_string,
            "summary": summary
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get daily summary: {str(e)}"}), 500


@app.route('/api/day/<date_string>/screenshots')
def api_day_screenshots(date_string):
    """JSON API for all screenshots on a specific day."""
    try:
        target_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        screenshots_raw = get_screenshots_for_date(target_date)

        # Convert to format expected by frontend
        screenshots = []
        for row in screenshots_raw:
            screenshot = {
                'id': row['id'],
                'timestamp': row['timestamp'],
                'window_title': row['window_title'],
                'app_name': row['app_name']
            }
            screenshots.append(screenshot)

        return jsonify({
            "date": date_string,
            "count": len(screenshots),
            "screenshots": screenshots
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get screenshots: {str(e)}"}), 500


@app.route('/api/week/<date_string>')
def api_week_stats(date_string):
    """JSON API for weekly statistics starting from a specific date."""
    try:
        start_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        analytics = ActivityAnalytics()
        weekly_stats = analytics.get_weekly_stats(start_date)

        return jsonify({
            "start_date": date_string,
            "end_date": (start_date + timedelta(days=7)).strftime('%Y-%m-%d'),
            "stats": weekly_stats
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get weekly stats: {str(e)}"}), 500


@app.route('/api/screenshots/<date_string>/<int:hour>')
def api_screenshots_by_hour(date_string, hour):
    """JSON API for screenshots in a specific hour of a specific day."""
    # Validate hour
    if hour < 0 or hour > 23:
        return jsonify({"error": "Hour must be between 0 and 23"}), 400

    # Parse and validate date
    try:
        target_date = datetime.strptime(date_string, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400

    try:
        # Calculate timestamp range for the specific hour
        hour_start = datetime.combine(target_date, datetime.min.time()) + timedelta(hours=hour)
        hour_end = hour_start + timedelta(hours=1)

        start_timestamp = int(hour_start.timestamp())
        end_timestamp = int(hour_end.timestamp())

        # Query database
        conn = get_db_connection()
        cursor = conn.execute("""
            SELECT id, timestamp, filepath, dhash, window_title, app_name
            FROM screenshots
            WHERE timestamp >= ? AND timestamp < ?
            ORDER BY timestamp ASC
        """, (start_timestamp, end_timestamp))

        screenshots = []
        for row in cursor.fetchall():
            screenshot = {
                'id': row['id'],
                'timestamp': row['timestamp'],
                'filepath': f"/screenshot/{row['id']}",  # URL to serve the image
                'file_hash': row['dhash'],
                'window_title': row['window_title'],
                'app_name': row['app_name'],
                'iso_time': datetime.fromtimestamp(row['timestamp']).isoformat()
            }
            screenshots.append(screenshot)

        conn.close()

        return jsonify({
            "date": date_string,
            "hour": hour,
            "count": len(screenshots),
            "screenshots": screenshots
        })
    except Exception as e:
        return jsonify({"error": f"Failed to get screenshots: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=55555)
