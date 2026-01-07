#!/usr/bin/env python3
"""
Generate test summaries for existing sessions to enable tags sidebar testing.
This creates realistic-looking summaries with relevant tags for testing purposes.
"""

import sqlite3
import json
import random
from datetime import datetime

# Database path
DB_PATH = "/home/harshad/.local/share/traq/data.db"

# Sample tags for different types of activities
TAG_CATEGORIES = {
    "development": ["coding", "debugging", "testing", "reviewing", "refactoring"],
    "documentation": ["writing", "documentation", "planning", "design"],
    "research": ["research", "reading", "learning", "exploration"],
    "communication": ["email", "meeting", "discussion", "collaboration"],
    "productivity": ["focused work", "deep work", "productive session"],
    "general": ["web browsing", "break", "multitasking", "context switching"]
}

# Sample summary templates
SUMMARY_TEMPLATES = [
    "Worked on {project} focusing on {activity}. Made progress on {detail}.",
    "Session involved {activity} with some {secondary}. Primarily focused on {project}.",
    "{activity} session for {project}. Spent time on {detail}.",
    "Productive session working on {project}. Main activities: {activity} and {secondary}.",
]

def generate_tags(num_tags=3):
    """Generate a random set of tags"""
    all_tags = []
    for category_tags in TAG_CATEGORIES.values():
        all_tags.extend(category_tags)

    # Select random tags
    selected_tags = random.sample(all_tags, min(num_tags, len(all_tags)))
    return json.dumps(selected_tags)

def generate_summary():
    """Generate a realistic-looking summary"""
    template = random.choice(SUMMARY_TEMPLATES)

    projects = ["Traq v2", "activity tracker", "the application", "this project"]
    activities = ["coding", "debugging", "testing", "documentation", "design work"]
    secondaries = ["research", "planning", "reviewing code", "testing"]
    details = ["new features", "bug fixes", "UI improvements", "backend updates"]

    summary = template.format(
        project=random.choice(projects),
        activity=random.choice(activities),
        secondary=random.choice(secondaries),
        detail=random.choice(details)
    )

    return summary

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all sessions that don't have summaries
    cursor.execute("""
        SELECT s.id, s.start_time, s.duration_seconds
        FROM sessions s
        LEFT JOIN summaries sum ON s.id = sum.session_id
        WHERE sum.id IS NULL
        ORDER BY s.start_time DESC
    """)

    sessions_without_summaries = cursor.fetchall()

    print(f"Found {len(sessions_without_summaries)} sessions without summaries")

    if not sessions_without_summaries:
        print("All sessions already have summaries!")
        conn.close()
        return

    # Generate summaries for each session
    summaries_created = 0
    for session_id, start_time, duration in sessions_without_summaries:
        # Generate random number of tags (2-4)
        num_tags = random.randint(2, 4)
        tags = generate_tags(num_tags)
        summary = generate_summary()

        # Random confidence between 0.6 and 0.95
        confidence = round(random.uniform(0.6, 0.95), 2)

        # Random inference time between 500ms and 3000ms
        inference_time = random.randint(500, 3000)

        # Insert summary
        cursor.execute("""
            INSERT INTO summaries
            (session_id, summary, explanation, confidence, tags, model_used,
             inference_time_ms, screenshot_ids, context_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            summary,
            "Test summary generated for development/testing purposes.",
            str(confidence),
            tags,
            "test-model-v1",
            inference_time,
            json.dumps([]),  # Empty screenshot IDs for test data
            json.dumps({})   # Empty context for test data
        ))

        summaries_created += 1

        # Show timestamp for reference
        dt = datetime.fromtimestamp(start_time)
        print(f"Created summary for session {session_id} ({dt.strftime('%Y-%m-%d %H:%M')})")
        print(f"  Tags: {tags}")
        print(f"  Summary: {summary[:50]}...")

    conn.commit()
    conn.close()

    print(f"\n✅ Successfully created {summaries_created} test summaries!")
    print("Tags sidebar should now display data in the Timeline page.")

if __name__ == "__main__":
    main()
