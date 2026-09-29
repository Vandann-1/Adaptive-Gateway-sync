/**
 * offline.js - Browser Storage & Cache API Management
 * Handles Service Worker registration and client-side lesson caching for offline learning.
 */

const OfflineManager = (function() {
    const STORAGE_KEY = 'offline_lessons';
    const CACHE_NAME = 'learning-hub-cache-v1';

    // Register Service Worker
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then((reg) => {
                        console.log('[OfflineManager] Service Worker registered with scope:', reg.scope);
                    })
                    .catch((err) => {
                        console.warn('[OfflineManager] Service Worker registration failed:', err);
                    });
            });
        }
    }

    // Get all offline saved lessons from LocalStorage
    function getOfflineLessons() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[OfflineManager] Failed to read offline lessons:', e);
            return [];
        }
    }

    // Check if a specific lesson is saved offline
    function isLessonOffline(lessonId) {
        const id = parseInt(lessonId, 10);
        const lessons = getOfflineLessons();
        return lessons.some(item => parseInt(item.id, 10) === id);
    }

    // Save a lesson to LocalStorage and Cache API
    async function saveLessonOffline(lesson) {
        if (!lesson || !lesson.id) return false;

        const id = parseInt(lesson.id, 10);
        let lessons = getOfflineLessons();

        // Update or insert
        const existingIdx = lessons.findIndex(item => parseInt(item.id, 10) === id);
        const lessonRecord = {
            id: id,
            title: lesson.title,
            description: lesson.description || '',
            category: lesson.category || 'General',
            content: lesson.content || '',
            access_count: lesson.access_count || 0,
            status: lesson.status || 'not_started',
            saved_at: new Date().toISOString()
        };

        if (existingIdx >= 0) {
            lessons[existingIdx] = lessonRecord;
        } else {
            lessons.push(lessonRecord);
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
        } catch (e) {
            console.error('[OfflineManager] LocalStorage quota exceeded or error:', e);
            return false;
        }

        // Also cache page & API endpoints in Cache API if supported
        if ('caches' in window) {
            try {
                const cache = await caches.open(CACHE_NAME);
                // Pre-fetch HTML page and API endpoint to store in Cache API
                await Promise.allSettled([
                    cache.add(`/lesson/${id}`),
                    cache.add(`/api/lessons/${id}`)
                ]);
                console.log(`[OfflineManager] Lesson ${id} cached in Cache API`);
            } catch (err) {
                console.warn('[OfflineManager] Cache API store warning:', err);
            }
        }

        window.dispatchEvent(new CustomEvent('offline-storage-changed', { detail: { lessonId: id, saved: true } }));
        return true;
    }

    // Remove a lesson from offline storage
    async function removeLessonOffline(lessonId) {
        const id = parseInt(lessonId, 10);
        let lessons = getOfflineLessons();
        lessons = lessons.filter(item => parseInt(item.id, 10) !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));

        if ('caches' in window) {
            try {
                const cache = await caches.open(CACHE_NAME);
                await cache.delete(`/lesson/${id}`);
                await cache.delete(`/api/lessons/${id}`);
            } catch (e) {
                console.warn('[OfflineManager] Error deleting from Cache API:', e);
            }
        }

        window.dispatchEvent(new CustomEvent('offline-storage-changed', { detail: { lessonId: id, saved: false } }));
        return true;
    }

    // Retrieve single lesson from offline storage
    function getOfflineLessonById(lessonId) {
        const id = parseInt(lessonId, 10);
        const lessons = getOfflineLessons();
        return lessons.find(item => parseInt(item.id, 10) === id) || null;
    }

    // Initialize Service Worker on startup
    initServiceWorker();

    return {
        getOfflineLessons,
        isLessonOffline,
        saveLessonOffline,
        removeLessonOffline,
        getOfflineLessonById
    };
})();
