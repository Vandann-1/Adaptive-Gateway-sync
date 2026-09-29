"""
test_suite.py - Automated Comprehensive Test Suite
Validates all requirements of Module 18:
  - Cache Hit & Miss behavior
  - Adaptive LFU eviction when exceeding capacity
  - Offline sync batch processing
  - Error handling (invalid ID, bad request, empty sync)
  - Student progress persistence
"""

import unittest
from app import app
import database
from cache_manager import cache_manager, AdaptiveCacheManager
import sync_manager

class AdaptiveGatewayTestSuite(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        # Ensure clean state for every test
        cache_manager.clear()
        database.create_database()
        conn = database.get_db_connection()
        conn.execute("UPDATE lessons SET access_count = 0")
        conn.execute("DELETE FROM progress")
        conn.commit()
        conn.close()

    def test_01_cache_miss_then_hit(self):
        """1 & 2 & 3 & 4: First open is MISS from DB, second is HIT from memory."""
        # First request -> CACHE MISS
        r1 = self.client.get('/api/lessons/1')
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r1.json['source'], 'database')

        # Second request -> CACHE HIT
        r2 = self.client.get('/api/lessons/1')
        self.assertEqual(r2.status_code, 200)
        self.assertEqual(r2.json['source'], 'cache')

        stats = self.client.get('/api/cache/stats').json['stats']
        self.assertEqual(stats['hits'], 1)
        self.assertEqual(stats['misses'], 1)
        self.assertEqual(stats['hit_rate'], 50.0)

    def test_02_adaptive_cache_eviction(self):
        """5 & 6 & 7: Open multiple lessons, exceed capacity, verify least popular evicted."""
        test_cache = AdaptiveCacheManager(capacity=3)
        # Put lessons 1, 2, 3 into cache
        test_cache.get_lesson(1) # access 1
        test_cache.get_lesson(1) # access 2 (popular)
        test_cache.get_lesson(2) # access 1
        test_cache.get_lesson(2) # access 2 (popular)
        test_cache.get_lesson(3) # access 1 (least popular)

        self.assertEqual(len(test_cache.cache), 3)
        self.assertIn(1, test_cache.cache)
        self.assertIn(2, test_cache.cache)
        self.assertIn(3, test_cache.cache)

        # Now request lesson 4 -> exceeds capacity 3. Lesson 3 should be evicted!
        test_cache.get_lesson(4)
        self.assertEqual(len(test_cache.cache), 3)
        self.assertIn(1, test_cache.cache, "Popular lesson 1 should be retained")
        self.assertIn(2, test_cache.cache, "Popular lesson 2 should be retained")
        self.assertIn(4, test_cache.cache, "New lesson 4 should enter cache")
        self.assertNotIn(3, test_cache.cache, "Least popular lesson 3 should be evicted")

    def test_03_offline_synchronization(self):
        """Synchronization: Offline completed lesson sent in batch to /api/sync."""
        offline_actions = [
            {"lesson_id": 2, "action": "completed", "timestamp": "2026-09-29T10:00:00Z"},
            {"lesson_id": 3, "action": "in_progress", "timestamp": "2026-09-29T10:05:00Z"},
            {"lesson_id": 1, "action": "viewed", "timestamp": "2026-09-29T10:10:00Z"}
        ]

        res = self.client.post('/api/sync', json={
            "student_id": 1,
            "actions": offline_actions
        })
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json['success'])
        self.assertEqual(res.json['synced_count'], 3)

        # Confirm SQLite progress table was updated
        progress_res = self.client.get('/api/progress?student_id=1')
        self.assertEqual(progress_res.status_code, 200)
        progress = progress_res.json['progress']
        self.assertEqual(progress.get('2'), 'completed')
        self.assertEqual(progress.get('3'), 'in_progress')

    def test_04_error_handling(self):
        """Error handling: 404 for missing lesson, 400 for bad ID, 400 for bad sync payload."""
        # Non-existent lesson
        r_not_found = self.client.get('/api/lessons/99999')
        self.assertEqual(r_not_found.status_code, 404)
        self.assertFalse(r_not_found.json['success'])

        # Invalid lesson ID (negative)
        r_bad_id = self.client.get('/api/lessons/-10')
        self.assertEqual(r_bad_id.status_code, 400)

        # Invalid lesson ID (letters)
        r_bad_id_str = self.client.get('/api/lessons/invalid_text')
        self.assertEqual(r_bad_id_str.status_code, 400)

        # Empty sync request
        r_empty_sync = self.client.post('/api/sync', json={"student_id": 1, "actions": []})
        self.assertEqual(r_empty_sync.status_code, 200)
        self.assertEqual(r_empty_sync.json['synced_count'], 0)

        # Malformed sync request (actions not a list)
        r_bad_sync = self.client.post('/api/sync', json={"actions": "not_a_list"})
        self.assertEqual(r_bad_sync.status_code, 400)

if __name__ == '__main__':
    unittest.main()
