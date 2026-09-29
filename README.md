# Adaptive Edge Cache and Offline Learning Content Synchronization Gateway

A prototype educational content delivery gateway demonstrating how modern web architectures deliver fast learning content and maintain full offline resilience in bandwidth-constrained environments.

---

## 1. Project Overview

The **Adaptive Edge Cache and Offline Learning Gateway** is designed for educational environments where network connectivity is intermittent, slow, or costly. It bridges the gap between a central learning database and students by combining:
1. **Server-Side Adaptive Edge Caching:** Accelerating access to popular learning lessons by keeping frequently viewed materials in memory.
2. **Browser Offline Capabilities:** Leveraging Service Workers, the Cache API, and LocalStorage so students can continue reading lessons and marking progress even when disconnected.
3. **Automatic Synchronization:** Seamlessly recording student actions locally in an offline queue and uploading them automatically when network connectivity returns.

---

## 2. The Problem

In many parts of the world or during travel, learners encounter severe digital barriers:
* **Unstable or Intermittent Internet:** Connections drop frequently, interrupting study sessions.
* **Slow Content Delivery:** Reading static educational content from a remote database on every request introduces unnecessary latency and server load.
* **Loss of Student Progress:** Actions taken while offline (e.g., finishing a lesson) are often lost if the system requires a constant connection.
* **Lack of Transparency:** Students and administrators rarely have visibility into whether their content is served from cache, fetched from disk, or stored locally.

---

## 3. The Solution

This system introduces a dual-layer caching and queuing architecture:

```text
Central Database (SQLite)
          │
          ▼
Server In-Memory Edge Cache (Adaptive LFU: Popular lessons stay cached)
          │
          ▼
HTTP / REST Gateway (Flask)
          │
          ▼
Browser Storage (Service Worker + Cache API + LocalStorage)
          │
          ▼
Offline Action Queue ──(Network Returns)──► Automatic Batch Synchronization
```

* **Adaptive Cache:** Uses access frequency (popularity score) to retain frequently requested modules and automatically evicts cold content when capacity is reached.
* **Offline Storage:** Students can click **"Save for Offline"** to store entire lessons in their browser.
* **Offline Activity Queue:** Any progress marked while offline is captured in LocalStorage and synchronized as soon as the student reconnects.

---

## 4. Technology Stack

This project strictly adheres to fundamental technologies without complex third-party frameworks:

### Backend
* **Python 3.12 / 3.13**
* **Flask** (Lightweight WSGI web server)
* **SQLite 3** (Embedded relational database)
* Python standard library (`sqlite3`, `datetime`, `json`, `os`, `unittest`)

### Frontend
* **Semantic HTML5**
* **Modern Vanilla CSS3** (Responsive design, custom properties, status badges)
* **Vanilla JavaScript (ES6+)** (No React/Next/Vue dependencies)

### Client-Side Storage
* **Service Worker** (Network-first with Cache API fallback)
* **Cache API** (Full offline HTML and API response persistence)
* **LocalStorage** (Offline lesson records, sync queue, and demo simulation state)

---

## 5. System Architecture

```text
                    STUDENT
                       │
                       ▼
              ┌─────────────────┐
              │ HTML/CSS/JS UI  │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Flask Gateway   │
              ├─────────────────┤
              │ Cache Manager   │
              │ Content API     │
              │ Sync API        │
              │ Statistics      │
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
      ┌──────────────┐    ┌──────────────┐
      │ Memory Cache │    │ SQLite DB    │
      └──────────────┘    └──────────────┘

Browser Environment
   ├── LocalStorage (Offline lesson meta & queue)
   ├── Cache API (Pre-cached shells & lesson routes)
   └── Offline Sync Queue (Unsynced student actions)
```

---

## 6. How to Run

### Step 1: Clone or Open the Repository
Ensure you are in the project root directory:
```bash
cd v:\Projects\personal-project\sync-off
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```
*(Or if using Python 3.13 / py launcher: `py -3.13 -m pip install -r requirements.txt`)*

### Step 3: Start the Application Server
```bash
python app.py
```
*(Or: `py -3.13 app.py`)*

### Step 4: Open in Your Browser
Navigate to:
```text
http://127.0.0.1:5000
```

---

## 7. Key Features

| Feature | Description |
| :--- | :--- |
| **Adaptive Edge Cache** | In-memory popularity-based caching with Least Frequently Used (LFU) eviction when capacity (5 items) is exceeded. |
| **Cache Hit / Miss Badging** | Visual feedback banner on each lesson showing whether it was served from memory (`CACHE HIT`) or database (`CACHE MISS`). |
| **Live Statistics Dashboard** | Real-time tracking of hits, misses, hit rate %, capacity usage, cached items, and recent sync events. |
| **Service Worker & Cache API** | Enables students to download lessons locally and view them even without network access. |
| **Network Status Detection** | Automatically detects connection changes (`navigator.onLine`) and updates UI instantly. |
| **Simulated Offline Mode** | Interactive demo button to simulate offline conditions without physically disconnecting your Wi-Fi. |
| **Offline Action Queue** | Queues actions (completed, in-progress, viewed) in LocalStorage while offline. |
| **Automatic Synchronization** | Automatically transmits all queued actions to `/api/sync` once connectivity is restored. |
| **Atomic Sync Guarantee** | Never deletes offline actions from client storage until server confirms 200 OK update. |
| **Progress Tracking** | Tracks individual student progress states (`not_started`, `in_progress`, `completed`). |

---

## 8. Limitations

As an educational prototype, the system has the following deliberate simplifications:
1. **In-Memory Cache:** The server cache resides in the Python process memory. Restarting the Flask server resets the cache.
2. **Single Demo Student:** Configured for `student_id = 1` without production multi-tenant authentication.
3. **Browser Storage Scope:** Offline lessons and queued actions are stored per-browser profile in LocalStorage and Cache API.
4. **Local Deployment:** Designed for local development and edge simulation on `http://127.0.0.1:5000`.

---

## 9. Automated Testing

To run the automated test suite covering all modules:
```bash
python test_suite.py
```
*(Or: `py -3.13 test_suite.py`)*

All tests should report: `Ran 4 tests ... OK`.
