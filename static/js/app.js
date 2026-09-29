/**
 * app.js - Main Application Client-Side Logic
 * Connects UI, Cache Gateway, Offline Storage, and Synchronization
 */

// Shared Toast Notification Helper
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Global UI State & Status Bar Updater
function updateGlobalStatusUI() {
    const isOnline = SyncManager.isOnline();
    const isSimulated = SyncManager.isSimulatedOffline();
    const queue = SyncManager.getQueue();
    const offlineLessons = OfflineManager.getOfflineLessons();

    // 1. Update Navbar status pill
    const statusPill = document.getElementById('nav-status-pill');
    if (statusPill) {
        if (isSimulated) {
            statusPill.className = 'status-pill simulated';
            statusPill.innerHTML = '🔶 Demo Offline Mode';
        } else if (isOnline) {
            statusPill.className = 'status-pill online';
            statusPill.innerHTML = '🟢 Online';
        } else {
            statusPill.className = 'status-pill offline';
            statusPill.innerHTML = '🔴 Offline';
        }
    }

    // 2. Update Simulate Offline button
    const demoBtn = document.getElementById('btn-toggle-demo');
    if (demoBtn) {
        if (isSimulated) {
            demoBtn.className = 'btn btn-warning btn-sm';
            demoBtn.innerHTML = '↩ Return Online';
        } else {
            demoBtn.className = 'btn btn-outline btn-sm';
            demoBtn.innerHTML = '⚡ Simulate Offline Mode';
        }
    }

    // 3. Update Sync badge
    const syncBadge = document.getElementById('nav-sync-badge');
    if (syncBadge) {
        if (queue.length > 0) {
            syncBadge.className = 'sync-badge';
            syncBadge.innerHTML = `Pending Sync: ${queue.length}`;
            syncBadge.title = 'Click to synchronize queued actions';
        } else {
            syncBadge.className = 'sync-badge empty';
        }
    }

    // 4. Update System Status Bar (Module 13)
    const sysInternet = document.getElementById('sys-status-internet');
    const sysServer = document.getElementById('sys-status-server');
    const sysCache = document.getElementById('sys-status-cache');
    const sysQueue = document.getElementById('sys-status-queue');

    if (sysInternet) {
        sysInternet.innerHTML = isOnline ? '🟢 Online' : '🔴 Offline';
    }
    if (sysServer) {
        sysServer.innerHTML = isOnline ? '🟢 Connected' : '⚪ Unavailable';
    }
    if (sysCache) {
        sysCache.innerHTML = '🟢 Active';
    }
    if (sysQueue) {
        sysQueue.innerHTML = `${queue.length}`;
    }
}

// Listen to network and sync events
window.addEventListener('connection-status-changed', (e) => {
    updateGlobalStatusUI();
    if (e.detail.simulated) {
        showToast('Demo Offline Mode enabled. Server calls will now be simulated offline.', 'warning');
    } else if (e.detail.online) {
        showToast('Connected back online. Checking for pending sync...', 'info');
    } else {
        showToast('Internet connection lost. You are now offline.', 'danger');
    }
});

window.addEventListener('sync-queue-changed', (e) => {
    updateGlobalStatusUI();
});

window.addEventListener('sync-completed', (e) => {
    showToast(`✓ ${e.detail.message || (e.detail.count + ' actions synchronized')}`, 'success');
    updateGlobalStatusUI();
    // If on dashboard, reload stats
    if (window.location.pathname === '/dashboard' && typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
});

window.addEventListener('sync-failed', (e) => {
    showToast(`Sync failed: ${e.detail.error}. Actions remain in queue.`, 'danger');
    updateGlobalStatusUI();
});

window.addEventListener('offline-storage-changed', () => {
    updateGlobalStatusUI();
});

// Setup top navbar interactions
document.addEventListener('DOMContentLoaded', () => {
    updateGlobalStatusUI();

    const demoBtn = document.getElementById('btn-toggle-demo');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            SyncManager.toggleSimulatedOffline();
        });
    }

    const syncBadge = document.getElementById('nav-sync-badge');
    if (syncBadge) {
        syncBadge.addEventListener('click', () => {
            if (SyncManager.isOnline()) {
                SyncManager.syncPendingActions();
            } else {
                showToast('Cannot sync while offline. Return online first.', 'warning');
            }
        });
    }
});

// ==========================================
// Page: Learning Hub (index.html)
// ==========================================
async function initLearningHub() {
    const cardsContainer = document.getElementById('lessons-grid');
    const searchInput = document.getElementById('search-input');
    const countLabel = document.getElementById('lesson-count-label');

    if (!cardsContainer) return;

    let allLessons = [];

    async function loadLessons() {
        if (SyncManager.isOnline()) {
            try {
                const response = await fetch('/api/lessons');
                if (response.ok) {
                    const data = await response.json();
                    allLessons = data.lessons || [];
                } else {
                    throw new Error('Server returned non-200');
                }
            } catch (err) {
                console.warn('Online fetch failed, falling back to offline storage:', err);
                allLessons = OfflineManager.getOfflineLessons();
            }
        } else {
            // Offline - read from client offline storage
            allLessons = OfflineManager.getOfflineLessons();
        }

        renderCards(allLessons);
    }

    function renderCards(lessonsToRender) {
        cardsContainer.innerHTML = '';
        if (lessonsToRender.length === 0) {
            cardsContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #64748b;">
                    <h3>No lessons found</h3>
                    <p>Try searching for a different keyword or check offline saved lessons.</p>
                </div>
            `;
            if (countLabel) countLabel.textContent = '0 lessons';
            return;
        }

        if (countLabel) countLabel.textContent = `${lessonsToRender.length} lessons`;

        lessonsToRender.forEach(lesson => {
            const isOffline = OfflineManager.isLessonOffline(lesson.id);
            const statusClass = `status-${lesson.status || 'not_started'}`;
            const statusLabel = (lesson.status || 'not_started').replace('_', ' ').toUpperCase();

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div>
                    <div class="card-header">
                        <span class="badge-category">${escapeHtml(lesson.category || 'General')}</span>
                        <div style="display:flex; gap: 0.35rem; align-items:center;">
                            ${lesson.in_cache ? '<span class="badge-in-cache">In Cache</span>' : ''}
                            <span class="badge-status ${statusClass}">${statusLabel}</span>
                        </div>
                    </div>
                    <h3 class="card-title">${escapeHtml(lesson.title)}</h3>
                    <p class="card-description">${escapeHtml(lesson.description)}</p>
                </div>
                <div>
                    <div class="card-meta">
                        <span>Accesses: <strong>${lesson.access_count || 0}</strong></span>
                        ${isOffline ? '<span class="badge-offline">✓ Available Offline</span>' : '<span style="color:#94a3b8; font-size:0.75rem;">Online Only</span>'}
                    </div>
                    <a href="/lesson/${lesson.id}" class="btn btn-primary" style="width: 100%;">Open Lesson</a>
                </div>
            `;
            cardsContainer.appendChild(card);
        });
    }

    // Search filter
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const filtered = allLessons.filter(l =>
                l.title.toLowerCase().includes(term) ||
                l.description.toLowerCase().includes(term) ||
                l.category.toLowerCase().includes(term)
            );
            renderCards(filtered);
        });
    }

    await loadLessons();

    // Re-render when offline storage changes
    window.addEventListener('offline-storage-changed', () => {
        renderCards(allLessons);
    });
}

// ==========================================
// Page: Lesson Viewer (lesson.html)
// ==========================================
async function initLessonViewer(lessonId) {
    const titleEl = document.getElementById('lesson-title');
    const categoryEl = document.getElementById('lesson-category');
    const countEl = document.getElementById('lesson-access-count');
    const contentEl = document.getElementById('lesson-content');
    const bannerEl = document.getElementById('cache-banner');
    const saveOfflineBtn = document.getElementById('btn-save-offline');
    const markCompleteBtn = document.getElementById('btn-mark-complete');
    const markProgressBtn = document.getElementById('btn-mark-progress');
    const statusBadge = document.getElementById('lesson-status-badge');

    let currentLesson = null;

    async function fetchLessonData() {
        if (SyncManager.isOnline()) {
            try {
                const response = await fetch(`/api/lessons/${lessonId}`);
                if (!response.ok) {
                    throw new Error(`Lesson not found (HTTP ${response.status})`);
                }
                const data = await response.json();
                currentLesson = data.lesson;
                
                // Show Cache Hit or Miss Banner
                if (data.source === 'cache') {
                    bannerEl.className = 'cache-source-banner hit';
                    bannerEl.innerHTML = `
                        <span>⚡ <strong>CACHE HIT</strong> — Served from Server Memory Cache</span>
                        <span style="font-size: 0.8rem; font-weight: normal;">Fast delivery</span>
                    `;
                } else {
                    bannerEl.className = 'cache-source-banner miss';
                    bannerEl.innerHTML = `
                        <span>💾 <strong>CACHE MISS</strong> — Retrieved from SQLite Database & Added to Cache</span>
                        <span style="font-size: 0.8rem; font-weight: normal;">Database Query</span>
                    `;
                }
            } catch (err) {
                console.warn('Network fetch error, trying offline fallback:', err);
                loadFromOfflineStore();
            }
        } else {
            loadFromOfflineStore();
        }

        renderLesson();
    }

    function loadFromOfflineStore() {
        const offlineLesson = OfflineManager.getOfflineLessonById(lessonId);
        if (offlineLesson) {
            currentLesson = offlineLesson;
            bannerEl.className = 'cache-source-banner offline';
            bannerEl.innerHTML = `
                <span>📱 <strong>OFFLINE STORAGE</strong> — Served from Local Browser Cache</span>
                <span style="font-size: 0.8rem; font-weight: normal;">No network connection needed</span>
            `;
            // Queue a 'viewed' action offline
            SyncManager.queueAction(lessonId, 'viewed');
        } else {
            bannerEl.className = 'cache-source-banner offline';
            bannerEl.innerHTML = `
                <span>⚠️ Lesson not saved for offline learning. Please connect to the internet to load this lesson.</span>
            `;
            currentLesson = {
                title: 'Lesson Unavailable Offline',
                category: 'Notice',
                access_count: 0,
                content: 'This lesson was not saved for offline use while you had an active network connection.\n\nTo view this content, please reconnect to the network or return online, then click "Save for Offline".'
            };
        }
    }

    function renderLesson() {
        if (!currentLesson) return;

        titleEl.textContent = currentLesson.title;
        categoryEl.textContent = currentLesson.category;
        countEl.textContent = currentLesson.access_count || 0;
        contentEl.textContent = currentLesson.content;

        // Offline button state
        const isSaved = OfflineManager.isLessonOffline(lessonId);
        if (isSaved) {
            saveOfflineBtn.className = 'btn btn-outline btn-sm';
            saveOfflineBtn.innerHTML = '✓ Saved Offline (Click to remove)';
        } else {
            saveOfflineBtn.className = 'btn btn-primary btn-sm';
            saveOfflineBtn.innerHTML = '📥 Save for Offline';
        }

        // Status badge
        updateStatusBadge(currentLesson.status || 'not_started');
    }

    function updateStatusBadge(status) {
        if (!statusBadge) return;
        statusBadge.className = `badge-status status-${status}`;
        statusBadge.textContent = status.replace('_', ' ').toUpperCase();
    }

    // "Save for Offline" Click Handler
    if (saveOfflineBtn) {
        saveOfflineBtn.addEventListener('click', async () => {
            if (!currentLesson || !currentLesson.id) return;

            const isSaved = OfflineManager.isLessonOffline(lessonId);
            if (isSaved) {
                await OfflineManager.removeLessonOffline(lessonId);
                showToast('Removed lesson from offline storage', 'info');
            } else {
                await OfflineManager.saveLessonOffline(currentLesson);
                showToast('✓ Lesson saved for offline learning!', 'success');
            }
            renderLesson();
        });
    }

    // "Mark as Completed" Click Handler
    if (markCompleteBtn) {
        markCompleteBtn.addEventListener('click', async () => {
            await handleProgressUpdate('completed');
        });
    }

    // "Mark as In Progress" Click Handler
    if (markProgressBtn) {
        markProgressBtn.addEventListener('click', async () => {
            await handleProgressUpdate('in_progress');
        });
    }

    async function handleProgressUpdate(status) {
        if (SyncManager.isOnline()) {
            try {
                const res = await fetch('/api/progress', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lesson_id: lessonId, status: status, student_id: 1 })
                });
                if (res.ok) {
                    showToast(`✓ Marked as ${status.replace('_', ' ')}`, 'success');
                    if (currentLesson) currentLesson.status = status;
                    updateStatusBadge(status);
                } else {
                    throw new Error('Server update failed');
                }
            } catch (e) {
                console.warn('Online update failed, queuing offline:', e);
                queueActionOffline(status);
            }
        } else {
            queueActionOffline(status);
        }
    }

    function queueActionOffline(status) {
        SyncManager.queueAction(lessonId, status);
        if (currentLesson) {
            currentLesson.status = status;
            // Also update in offline storage if saved
            if (OfflineManager.isLessonOffline(lessonId)) {
                OfflineManager.saveLessonOffline(currentLesson);
            }
        }
        updateStatusBadge(status);
        showToast(`Offline: Action saved locally. Pending sync: ${SyncManager.getQueue().length}`, 'warning');
    }

    await fetchLessonData();
}

// ==========================================
// Page: Cache Dashboard (dashboard.html)
// ==========================================
async function loadDashboardData() {
    try {
        const statsRes = await fetch('/api/cache/stats');
        const statsData = await statsRes.json();
        const stats = statsData.stats;

        // Metric values
        const hitsEl = document.getElementById('stat-hits');
        const missesEl = document.getElementById('stat-misses');
        const rateEl = document.getElementById('stat-hit-rate');
        const rateBar = document.getElementById('stat-hit-rate-bar');
        const capEl = document.getElementById('stat-capacity');
        const capBar = document.getElementById('stat-capacity-bar');

        if (hitsEl) hitsEl.textContent = stats.hits;
        if (missesEl) missesEl.textContent = stats.misses;
        if (rateEl) rateEl.textContent = `${stats.hit_rate}%`;
        if (rateBar) rateBar.style.width = `${Math.min(stats.hit_rate, 100)}%`;
        if (capEl) capEl.textContent = `${stats.current_size} / ${stats.capacity}`;
        if (capBar) {
            const usagePct = (stats.current_size / stats.capacity) * 100;
            capBar.style.width = `${Math.min(usagePct, 100)}%`;
        }

        // Render Cached Lessons Table
        const cachedTableBody = document.getElementById('cached-lessons-tbody');
        if (cachedTableBody) {
            cachedTableBody.innerHTML = '';
            if (stats.cached_items.length === 0) {
                cachedTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 2rem;">No lessons currently cached in server memory.</td></tr>`;
            } else {
                stats.cached_items.forEach((item, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><strong>#${index + 1}</strong></td>
                        <td><a href="/lesson/${item.lesson_id}" style="color: #2563eb; text-decoration: none; font-weight:600;">${escapeHtml(item.title)}</a></td>
                        <td><span class="badge-category">${escapeHtml(item.category)}</span></td>
                        <td><span style="font-weight:700; color:#0f172a;">${item.access_count}</span> accesses</td>
                    `;
                    cachedTableBody.appendChild(row);
                });
            }
        }

        // Render Offline Content List
        const offlineListContainer = document.getElementById('offline-items-tbody');
        if (offlineListContainer) {
            const offlineLessons = OfflineManager.getOfflineLessons();
            offlineListContainer.innerHTML = '';
            if (offlineLessons.length === 0) {
                offlineListContainer.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a3b8; padding: 2rem;">No lessons saved in browser offline cache.</td></tr>`;
            } else {
                offlineLessons.forEach(l => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><a href="/lesson/${l.id}" style="color:#2563eb; text-decoration:none; font-weight:600;">✓ ${escapeHtml(l.title)}</a></td>
                        <td><span class="badge-category">${escapeHtml(l.category)}</span></td>
                        <td>
                            <button class="btn btn-outline btn-sm" onclick="removeAndRefresh(${l.id})">Remove</button>
                        </td>
                    `;
                    offlineListContainer.appendChild(row);
                });
            }
        }

        // Render Pending Queue
        const pendingQueueBody = document.getElementById('pending-queue-tbody');
        const queue = SyncManager.getQueue();
        if (pendingQueueBody) {
            pendingQueueBody.innerHTML = '';
            if (queue.length === 0) {
                pendingQueueBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 2rem;">No pending actions in offline queue.</td></tr>`;
            } else {
                queue.forEach(item => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>Lesson #${item.lesson_id}</td>
                        <td><span class="badge-status status-${item.action}">${escapeHtml(item.action).toUpperCase()}</span></td>
                        <td style="color:#64748b; font-size:0.8rem;">${new Date(item.timestamp).toLocaleTimeString()}</td>
                        <td><span class="badge-status status-in_progress">Pending Sync</span></td>
                    `;
                    pendingQueueBody.appendChild(row);
                });
            }
        }

        // Render Recent Activity Log
        const activitiesRes = await fetch('/api/activities');
        if (activitiesRes.ok) {
            const actData = await activitiesRes.json();
            const actBody = document.getElementById('recent-activity-tbody');
            if (actBody) {
                actBody.innerHTML = '';
                const acts = actData.activities || [];
                if (acts.length === 0) {
                    actBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; padding: 2rem;">No recent activity logged yet.</td></tr>`;
                } else {
                    acts.forEach(a => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><strong>${escapeHtml(a.lesson_title)}</strong></td>
                            <td><span class="badge-status status-${a.action}">${escapeHtml(a.action).toUpperCase()}</span></td>
                            <td style="color:#64748b; font-size:0.8rem;">${new Date(a.synced_at).toLocaleTimeString()}</td>
                            <td><span class="badge-status status-completed">Synchronized</span></td>
                        `;
                        actBody.appendChild(row);
                    });
                }
            }
        }

    } catch (e) {
        console.error('Failed to load dashboard data:', e);
    }
}

async function removeAndRefresh(lessonId) {
    await OfflineManager.removeLessonOffline(lessonId);
    showToast('Lesson removed from offline storage', 'info');
    loadDashboardData();
}

// Clear Cache handler for demo
async function handleClearCache() {
    if (!confirm('Are you sure you want to clear the server-side memory cache?')) return;
    try {
        const res = await fetch('/api/cache/clear', { method: 'POST' });
        if (res.ok) {
            showToast('Edge memory cache cleared successfully!', 'info');
            loadDashboardData();
        }
    } catch (e) {
        showToast('Failed to clear cache', 'danger');
    }
}

// ==========================================
// Page: Offline Lessons (offline.html)
// ==========================================
function initOfflinePage() {
    const listContainer = document.getElementById('offline-lessons-grid');
    const countLabel = document.getElementById('offline-count-label');

    function renderOfflinePage() {
        const lessons = OfflineManager.getOfflineLessons();
        if (countLabel) countLabel.textContent = `${lessons.length} offline lessons available`;

        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (lessons.length === 0) {
            listContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: white; border-radius: 8px; border: 1px dashed #cbd5e1;">
                    <h3>No Offline Lessons Yet</h3>
                    <p style="color: #64748b; margin-top: 0.5rem;">
                        Visit any lesson in the <a href="/" style="color:#2563eb;">Learning Hub</a> and click 
                        <strong>"Save for Offline"</strong> to make it accessible without internet.
                    </p>
                </div>
            `;
            return;
        }

        lessons.forEach(l => {
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div>
                    <div class="card-header">
                        <span class="badge-category">${escapeHtml(l.category)}</span>
                        <span class="badge-offline">✓ Available Offline</span>
                    </div>
                    <h3 class="card-title">${escapeHtml(l.title)}</h3>
                    <p class="card-description">${escapeHtml(l.description)}</p>
                </div>
                <div style="margin-top: 1rem;">
                    <a href="/lesson/${l.id}" class="btn btn-primary" style="width: 100%; margin-bottom: 0.5rem;">Open Offline</a>
                    <button class="btn btn-outline btn-sm" style="width: 100%;" onclick="removeLessonFromPage(${l.id})">Remove from Storage</button>
                </div>
            `;
            listContainer.appendChild(card);
        });
    }

    renderOfflinePage();
    window.addEventListener('offline-storage-changed', renderOfflinePage);
}

async function removeLessonFromPage(id) {
    await OfflineManager.removeLessonOffline(id);
    showToast('Removed from offline storage', 'info');
}

// Utility: HTML Sanitizer
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
