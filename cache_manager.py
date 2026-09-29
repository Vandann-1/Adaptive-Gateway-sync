"""
cache_manager.py - Adaptive Edge In-Memory Cache Manager
Implements popularity-based adaptive caching with LFU (Least Frequently Used) eviction.
"""

from datetime import datetime, timezone
import database

# Cache Configuration
DEFAULT_CAPACITY = 5

class AdaptiveCacheManager:
    """
    Manages an in-memory cache of educational lessons.
    Tracks hits, misses, and evicts the least frequently accessed item
    when capacity is exceeded.
    """
    def __init__(self, capacity=DEFAULT_CAPACITY):
        self.capacity = capacity
        # Dictionary structure:
        # {
        #    lesson_id: {
        #        "lesson_id": id,
        #        "lesson_data": {...},
        #        "cached_at": iso_str,
        #        "access_count": int
        #    }
        # }
        self.cache = {}
        self.cache_hits = 0
        self.cache_misses = 0

    def get_lesson(self, lesson_id):
        """
        Retrieves a lesson.
        Returns a tuple: (lesson_data, source) where source is 'cache' or 'database'.
        Returns (None, None) if the lesson does not exist.
        """
        # Check if lesson is in memory cache (CACHE HIT)
        if lesson_id in self.cache:
            self.cache_hits += 1
            # Increment access count in database and in cache
            new_count = database.increment_access_count(lesson_id)
            self.cache[lesson_id]["access_count"] = new_count
            self.cache[lesson_id]["lesson_data"]["access_count"] = new_count
            
            return self.cache[lesson_id]["lesson_data"], "cache"

        # Lesson is NOT in cache (CACHE MISS)
        self.cache_misses += 1
        lesson_data = database.get_lesson(lesson_id)
        if not lesson_data:
            return None, None

        # Increment access count in DB
        new_count = database.increment_access_count(lesson_id)
        lesson_data["access_count"] = new_count

        # Put into cache using adaptive eviction logic
        self.put_into_cache(lesson_id, lesson_data, new_count)

        return lesson_data, "database"

    def put_into_cache(self, lesson_id, lesson_data, access_count):
        """
        Adds a lesson into the cache. If cache capacity is reached,
        evicts the least frequently accessed lesson (adaptive eviction).
        """
        # If already cached, just update
        if lesson_id in self.cache:
            self.cache[lesson_id]["lesson_data"] = lesson_data
            self.cache[lesson_id]["access_count"] = access_count
            return None

        # If cache is full, evict the item with the minimum access_count (popularity)
        evicted_item = None
        if len(self.cache) >= self.capacity:
            # Find lesson_id with lowest access_count
            least_popular_id = min(
                self.cache.keys(),
                key=lambda k: (self.cache[k]["access_count"], self.cache[k]["cached_at"])
            )
            evicted_item = {
                "lesson_id": least_popular_id,
                "title": self.cache[least_popular_id]["lesson_data"].get("title", ""),
                "access_count": self.cache[least_popular_id]["access_count"]
            }
            del self.cache[least_popular_id]

        now_str = datetime.now(timezone.utc).isoformat()
        self.cache[lesson_id] = {
            "lesson_id": lesson_id,
            "lesson_data": dict(lesson_data),
            "cached_at": now_str,
            "access_count": access_count
        }

        return evicted_item

    def get_stats(self):
        """
        Returns statistics regarding cache hits, misses, hit rate,
        and list of currently cached lessons sorted by popularity.
        """
        total_requests = self.cache_hits + self.cache_misses
        hit_rate = (self.cache_hits / total_requests * 100) if total_requests > 0 else 0.0

        # Sort cached items by access_count descending (popularity)
        cached_items = []
        for lid, entry in self.cache.items():
            cached_items.append({
                "lesson_id": lid,
                "title": entry["lesson_data"].get("title", f"Lesson {lid}"),
                "category": entry["lesson_data"].get("category", "General"),
                "access_count": entry["access_count"],
                "cached_at": entry["cached_at"]
            })
        cached_items.sort(key=lambda x: x["access_count"], reverse=True)

        return {
            "hits": self.cache_hits,
            "misses": self.cache_misses,
            "total_requests": total_requests,
            "hit_rate": round(hit_rate, 1),
            "capacity": self.capacity,
            "current_size": len(self.cache),
            "cached_items": cached_items
        }

    def clear(self):
        """Resets the cache and stats."""
        self.cache.clear()
        self.cache_hits = 0
        self.cache_misses = 0


# Global singleton instance of AdaptiveCacheManager
cache_manager = AdaptiveCacheManager(capacity=DEFAULT_CAPACITY)
