/**
 * sync.js - Offline Activity Queue & Network Synchronization Manager
 * Detects online/offline states, manages offline action queue in LocalStorage,
 * and handles automatic synchronization with Flask backend.
 */

const SyncManager = (function() {
    const QUEUE_KEY = 'offline_sync_queue';
    const DEMO_OFFLINE_KEY = 'demo_simulated_offline';

    // State
    let isSyncing = false;

    // Simulated Offline Mode check
    function isSimulatedOffline() {
        return localStorage.getItem(DEMO_OFFLINE_KEY) === 'true';
    }

    function setSimulatedOffline(value) {
        localStorage.setItem(DEMO_OFFLINE_KEY, value ? 'true' : 'false');
        triggerConnectionStatusChange();
        if (!value) {
            // Returned to online - trigger auto sync!
            syncPendingActions();
        }
    }

    function toggleSimulatedOffline() {
        const nextState = !isSimulatedOffline();
        setSimulatedOffline(nextState);
        return nextState;
    }

    // Effective online status: physical network online AND not in simulated offline mode
    function isOnline() {
        if (isSimulatedOffline()) {
            return false;
        }
        return navigator.onLine;
    }

    // Read pending actions queue from LocalStorage
    function getQueue() {
        try {
            const data = localStorage.getItem(QUEUE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[SyncManager] Error reading sync queue:', e);
            return [];
        }
    }

    // Save pending actions queue to LocalStorage
    function saveQueue(queue) {
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
            window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: queue.length } }));
        } catch (e) {
            console.error('[SyncManager] Error saving sync queue:', e);
        }
    }

    // Queue an action locally while offline
    function queueAction(lessonId, actionType) {
        const queue = getQueue();
        const newAction = {
            id: Date.now() + Math.random().toString(36).substring(2, 6),
            lesson_id: parseInt(lessonId, 10),
            action: actionType,
            timestamp: new Date().toISOString()
        };

        queue.push(newAction);
        saveQueue(queue);
        console.log(`[SyncManager] Action queued offline: ${actionType} for lesson ${lessonId}. Queue length: ${queue.length}`);
        return newAction;
    }

    // Synchronize pending actions with backend
    async function syncPendingActions() {
        if (!isOnline()) {
            console.log('[SyncManager] Cannot sync: Client is currently offline.');
            return { success: false, reason: 'offline' };
        }

        const queue = getQueue();
        if (queue.length === 0) {
            return { success: true, count: 0 };
        }

        if (isSyncing) {
            console.log('[SyncManager] Sync already in progress.');
            return { success: false, reason: 'in_progress' };
        }

        isSyncing = true;
        window.dispatchEvent(new CustomEvent('sync-started'));

        try {
            console.log(`[SyncManager] Syncing ${queue.length} actions to /api/sync...`);
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    student_id: 1,
                    actions: queue
                })
            });

            if (!response.ok) {
                throw new Error(`Server responded with HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.success) {
                const count = queue.length;
                // NEVER delete offline actions until the server confirms successful synchronization
                localStorage.removeItem(QUEUE_KEY);
                window.dispatchEvent(new CustomEvent('sync-queue-changed', { detail: { count: 0 } }));
                window.dispatchEvent(new CustomEvent('sync-completed', { detail: { count: count, message: data.message } }));
                console.log(`[SyncManager] Successfully synchronized ${count} actions.`);
                return { success: true, count: count };
            } else {
                throw new Error(data.error || 'Sync rejected by server');
            }
        } catch (err) {
            console.error('[SyncManager] Sync failed:', err);
            window.dispatchEvent(new CustomEvent('sync-failed', { detail: { error: err.message } }));
            return { success: false, error: err.message };
        } finally {
            isSyncing = false;
        }
    }

    function triggerConnectionStatusChange() {
        const online = isOnline();
        const simulated = isSimulatedOffline();
        window.dispatchEvent(new CustomEvent('connection-status-changed', {
            detail: {
                online: online,
                simulated: simulated,
                physicalOnline: navigator.onLine
            }
        }));
    }

    // Event listeners for native browser network status
    window.addEventListener('online', () => {
        console.log('[SyncManager] Network online detected');
        triggerConnectionStatusChange();
        syncPendingActions();
    });

    window.addEventListener('offline', () => {
        console.log('[SyncManager] Network offline detected');
        triggerConnectionStatusChange();
    });

    // Run auto-sync periodically if online and pending items exist
    setInterval(() => {
        if (isOnline() && getQueue().length > 0) {
            syncPendingActions();
        }
    }, 15000);

    return {
        isOnline,
        isSimulatedOffline,
        setSimulatedOffline,
        toggleSimulatedOffline,
        getQueue,
        queueAction,
        syncPendingActions,
        triggerConnectionStatusChange
    };
})();
