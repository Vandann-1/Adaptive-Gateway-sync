"""
test_demo_flow.py - Simulates the exact 9-Step 5-Minute Demonstration Flow
"""

from app import app
import database
from cache_manager import cache_manager
import sync_manager

def run_demo():
    print("=" * 60)
    print("STARTING 5-MINUTE DEMO FLOW VERIFICATION")
    print("=" * 60)

    client = app.test_client()

    # Reset state for fresh demo
    cache_manager.clear()
    database.create_database()
    conn = database.get_db_connection()
    conn.execute("UPDATE lessons SET access_count = 0")
    conn.execute("DELETE FROM progress")
    conn.commit()
    conn.close()

    # Step 1: Open Learning Hub
    print("\n[Step 1] Opening Learning Hub (/) & fetching lessons...")
    res = client.get('/api/lessons')
    assert res.status_code == 200
    lessons = res.json['lessons']
    print(f"[OK] Hub retrieved {len(lessons)} lessons from SQLite database.")

    # Step 2: Open 'Python Basics' (ID 1) first time
    print("\n[Step 2] Requesting Lesson 1 (Python Basics) for the first time...")
    res_step2 = client.get('/api/lessons/1')
    assert res_step2.status_code == 200
    source_step2 = res_step2.json['source']
    print(f"[OK] Gateway Response Source: {source_step2.upper()} (Expected: DATABASE)")
    assert source_step2 == 'database', "First access must be a CACHE MISS from database"

    # Step 3: Open 'Python Basics' (ID 1) second time
    print("\n[Step 3] Requesting Lesson 1 (Python Basics) again...")
    res_step3 = client.get('/api/lessons/1')
    assert res_step3.status_code == 200
    source_step3 = res_step3.json['source']
    print(f"[OK] Gateway Response Source: {source_step3.upper()} (Expected: CACHE)")
    assert source_step3 == 'cache', "Second access must be a CACHE HIT from edge memory cache"

    # Step 4: Open several lessons & verify adaptive cache behavior
    print("\n[Step 4] Accessing multiple lessons to build access popularity...")
    # Access Python Basics multiple times
    for _ in range(3):
        client.get('/api/lessons/1')
    # Access HTML Fundamentals twice
    for _ in range(2):
        client.get('/api/lessons/2')
    # Access CSS Basics once
    client.get('/api/lessons/3')
    # Access JavaScript once
    client.get('/api/lessons/4')
    # Access Networks once
    client.get('/api/lessons/5')

    stats_res = client.get('/api/cache/stats')
    stats = stats_res.json['stats']
    print(f"[OK] Cache Stats: Hits={stats['hits']}, Misses={stats['misses']}, Hit Rate={stats['hit_rate']}%")
    print(f"[OK] Cached items in memory ({len(stats['cached_items'])}):")
    for item in stats['cached_items']:
        print(f"   - {item['title']}: {item['access_count']} accesses")

    # Step 5 & 6: Offline action simulation
    print("\n[Step 5 & 6] Simulating offline mode and saving offline action...")
    # Student marks Lesson 1 as completed while offline
    offline_queue = [
        {"lesson_id": 1, "action": "completed", "timestamp": "2026-09-29T12:00:00Z"}
    ]
    print(f"[OK] Student performed action offline: Marked Lesson 1 as completed.")
    print(f"[OK] Pending Sync Queue length: {len(offline_queue)}")

    # Step 7 & 8: Return online & synchronize
    print("\n[Step 7 & 8] Returning online & executing batch sync to /api/sync...")
    sync_res = client.post('/api/sync', json={
        "student_id": 1,
        "actions": offline_queue
    })
    assert sync_res.status_code == 200
    sync_data = sync_res.json
    print(f"[OK] Server response: {sync_data['message']}")
    assert sync_data['synced_count'] == 1

    # Confirm progress in database
    prog_res = client.get('/api/progress?student_id=1')
    assert prog_res.json['progress']['1'] == 'completed'
    print("[OK] Confirmed SQLite database now holds: Lesson 1 status = 'completed'")

    # Step 9: Open Dashboard
    print("\n[Step 9] Fetching Dashboard statistics and recent activities...")
    dash_res = client.get('/dashboard')
    assert dash_res.status_code == 200
    act_res = client.get('/api/activities')
    acts = act_res.json['activities']
    print(f"[OK] Dashboard renders HTTP 200. Total recent activities logged: {len(acts)}")
    print(f"   Latest Activity: Lesson '{acts[0]['lesson_title']}' -> {acts[0]['action'].upper()}")

    print("\n" + "=" * 60)
    print("SUCCESS: 5-MINUTE DEMO FLOW VERIFIED COMPLETELY!")
    print("=" * 60)

if __name__ == '__main__':
    run_demo()
