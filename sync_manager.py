"""
sync_manager.py - Offline Activity Synchronization Processor
Processes queued actions sent by the client when returning online,
updates SQLite database, and maintains a synchronized activity log.
"""

from datetime import datetime, timezone
import database

# In-memory recent sync history for dashboard display
recent_sync_activities = []

def process_sync_batch(actions, student_id=1):
    """
    Processes a list of offline queued action dictionaries.
    Each action dictionary is expected to have:
        - lesson_id: int
        - action: str ('viewed', 'completed', 'in_progress')
        - timestamp: str (ISO format)
    
    Returns a dict summarizing the sync outcome.
    """
    if not isinstance(actions, list):
        return {"success": False, "error": "Actions must be a list", "synced_count": 0}

    synced_count = 0
    now_iso = datetime.now(timezone.utc).isoformat()

    for item in actions:
        if not isinstance(item, dict):
            continue

        lesson_id = item.get("lesson_id")
        action_type = item.get("action", "").lower().strip()
        action_time = item.get("timestamp", now_iso)

        if not lesson_id:
            continue

        try:
            lesson_id = int(lesson_id)
        except (ValueError, TypeError):
            continue

        # Process based on action type
        if action_type in ("completed", "in_progress", "not_started"):
            database.update_student_progress(student_id, lesson_id, action_type)
            synced_count += 1
        elif action_type == "viewed":
            database.increment_access_count(lesson_id)
            synced_count += 1
        else:
            # Generic action logged
            database.update_student_progress(student_id, lesson_id, action_type)
            synced_count += 1

        # Retrieve lesson title for human-readable activity log
        lesson = database.get_lesson(lesson_id)
        lesson_title = lesson["title"] if lesson else f"Lesson {lesson_id}"

        # Record into recent activities log (kept to last 20 events)
        recent_sync_activities.insert(0, {
            "student_id": student_id,
            "lesson_id": lesson_id,
            "lesson_title": lesson_title,
            "action": action_type,
            "client_timestamp": action_time,
            "synced_at": now_iso
        })

    # Trim activity log to top 20
    if len(recent_sync_activities) > 20:
        del recent_sync_activities[20:]

    return {
        "success": True,
        "synced_count": synced_count,
        "message": f"{synced_count} action{'s' if synced_count != 1 else ''} synchronized successfully"
    }

def get_recent_activities():
    """
    Returns the list of recently synced offline and online activities.
    """
    return list(recent_sync_activities)
