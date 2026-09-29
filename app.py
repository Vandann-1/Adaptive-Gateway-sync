"""
Adaptive Edge Cache and Offline Learning Content Synchronization Gateway
app.py - Main Flask Application Server
"""

import os
from datetime import datetime, timezone
from flask import Flask, render_template, jsonify, send_from_directory, request

import database
import sync_manager
from cache_manager import cache_manager

app = Flask(__name__, template_folder='templates', static_folder='static')

# Serve service worker from the root directory with correct MIME type
@app.route('/service-worker.js')
def service_worker():
    return send_from_directory(os.path.abspath(os.path.dirname(__file__)),
                               'service-worker.js',
                               mimetype='application/javascript')

# Route: Home / Learning Hub
@app.route('/')
def home():
    return render_template('index.html')

# Route: Lesson Viewer
@app.route('/lesson/<int:lesson_id>')
def lesson_view(lesson_id):
    return render_template('lesson.html', lesson_id=lesson_id)

# Route: Cache & Sync Dashboard
@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

# Route: Offline Lessons Hub (Module 12)
@app.route('/offline')
def offline_page():
    return render_template('offline.html')

# ==========================================
# REST API Endpoints
# ==========================================

@app.route('/api/lessons', methods=['GET'])
def api_get_lessons():
    """
    Returns list of all lessons with access statistics and current progress.
    """
    try:
        lessons = database.get_all_lessons()
        progress = database.get_student_progress(student_id=1)
        for lesson in lessons:
            lesson['status'] = progress.get(lesson['id'], 'not_started')
            # Check if currently present in server memory cache
            lesson['in_cache'] = lesson['id'] in cache_manager.cache

        return jsonify({
            "success": True,
            "count": len(lessons),
            "lessons": lessons
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/lessons/<path:lesson_id_raw>', methods=['GET'])
def api_get_lesson(lesson_id_raw):
    """
    Retrieves a single lesson through the Adaptive Cache Gateway.
    Reports whether the item was served from 'cache' or 'database'.
    """
    try:
        try:
            lesson_id = int(lesson_id_raw)
            if lesson_id <= 0:
                return jsonify({"success": False, "error": "Invalid lesson ID"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Invalid lesson ID"}), 400

        lesson, source = cache_manager.get_lesson(lesson_id)
        if not lesson:
            return jsonify({"success": False, "error": f"Lesson {lesson_id} not found"}), 404

        # Attach progress status
        progress = database.get_student_progress(student_id=1)
        lesson_copy = dict(lesson)
        lesson_copy['status'] = progress.get(lesson_id, 'not_started')

        return jsonify({
            "success": True,
            "source": source,
            "lesson": lesson_copy
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/lessons/<path:lesson_id_raw>/access', methods=['POST'])
def api_record_access(lesson_id_raw):
    """
    Manually increments access count for a lesson.
    """
    try:
        try:
            lesson_id = int(lesson_id_raw)
            if lesson_id <= 0:
                return jsonify({"success": False, "error": "Invalid lesson ID"}), 400
        except ValueError:
            return jsonify({"success": False, "error": "Invalid lesson ID"}), 400

        lesson = database.get_lesson(lesson_id)
        if not lesson:
            return jsonify({"success": False, "error": "Lesson not found"}), 404

        new_count = database.increment_access_count(lesson_id)
        if lesson_id in cache_manager.cache:
            cache_manager.cache[lesson_id]["access_count"] = new_count
            cache_manager.cache[lesson_id]["lesson_data"]["access_count"] = new_count

        return jsonify({
            "success": True,
            "lesson_id": lesson_id,
            "access_count": new_count
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/cache/stats', methods=['GET'])
def api_cache_stats():
    """
    Returns edge cache statistics: hits, misses, hit rate, and cached lessons.
    """
    try:
        stats = cache_manager.get_stats()
        return jsonify({
            "success": True,
            "stats": stats
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/cache/clear', methods=['POST'])
def api_cache_clear():
    """
    Resets the in-memory cache and stats (useful for demos and testing).
    """
    try:
        cache_manager.clear()
        return jsonify({
            "success": True,
            "message": "Cache successfully cleared"
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/progress', methods=['GET'])
def api_get_progress():
    """
    Retrieves progress map for the student.
    """
    try:
        student_id = request.args.get('student_id', 1, type=int)
        progress = database.get_student_progress(student_id=student_id)
        return jsonify({
            "success": True,
            "student_id": student_id,
            "progress": progress
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/progress', methods=['POST'])
def api_update_progress():
    """
    Updates progress for a lesson directly when online.
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"success": False, "error": "Invalid JSON body"}), 400

        lesson_id = data.get('lesson_id')
        status = data.get('status', 'in_progress')
        student_id = data.get('student_id', 1)

        if not lesson_id:
            return jsonify({"success": False, "error": "lesson_id is required"}), 400

        # Validate lesson exists
        lesson = database.get_lesson(int(lesson_id))
        if not lesson:
            return jsonify({"success": False, "error": "Lesson not found"}), 404

        database.update_student_progress(student_id, int(lesson_id), status)

        # Log into activities
        now_iso = datetime.now(timezone.utc).isoformat()
        sync_manager.recent_sync_activities.insert(0, {
            "student_id": student_id,
            "lesson_id": int(lesson_id),
            "lesson_title": lesson["title"],
            "action": status,
            "client_timestamp": now_iso,
            "synced_at": now_iso
        })

        return jsonify({
            "success": True,
            "message": f"Lesson {lesson_id} progress updated to {status}"
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

@app.route('/api/sync', methods=['POST'])
def api_sync():
    """
    Synchronizes offline action batches when network returns.
    """
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"success": False, "error": "Empty or invalid sync request"}), 400

        student_id = data.get('student_id', 1)
        actions = data.get('actions', [])

        if not isinstance(actions, list):
            return jsonify({"success": False, "error": "Actions field must be a list"}), 400

        if len(actions) == 0:
            return jsonify({
                "success": True,
                "synced_count": 0,
                "message": "0 actions to synchronize"
            }), 200

        result = sync_manager.process_sync_batch(actions, student_id=student_id)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Failed to process synchronization"}), 500

@app.route('/api/activities', methods=['GET'])
def api_activities():
    """
    Returns recent activity stream (both online and synced).
    """
    try:
        return jsonify({
            "success": True,
            "activities": sync_manager.get_recent_activities()
        }), 200
    except Exception as e:
        return jsonify({"success": False, "error": "Internal server error"}), 500

# Error Handlers (Module 15)
@app.errorhandler(404)
def handle_404(e):
    if request.path.startswith('/api/'):
        return jsonify({"success": False, "error": "API route not found"}), 404
    return render_template('index.html'), 404

@app.errorhandler(500)
def handle_500(e):
    if request.path.startswith('/api/'):
        return jsonify({"success": False, "error": "Server internal error"}), 500
    return "<h1>500 - Internal Server Error</h1>", 500

if __name__ == '__main__':
    # Initialize DB upon start
    database.create_database()
    database.seed_lessons()
    print("Adaptive Cache Gateway running on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000, debug=True)
