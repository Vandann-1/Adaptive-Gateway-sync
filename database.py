"""
database.py - SQLite Learning Content & Progress Database Manager
Provides functions to create, seed, query, and update learning lessons.
"""

import os
import sqlite3
from datetime import datetime, timezone

# Ensure the database directory exists
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_DIR = os.path.join(BASE_DIR, 'database')
os.makedirs(DB_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, 'learning.db')

def get_db_connection():
    """
    Returns a connection to the SQLite database with Row factory
    so columns can be accessed by name like dictionaries.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def create_database():
    """
    Creates the 'lessons' and 'progress' tables if they do not exist.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Table: lessons
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT NOT NULL,
            created_at TEXT NOT NULL,
            access_count INTEGER DEFAULT 0,
            last_accessed TEXT
        )
    ''')

    # Table: progress (for student tracking)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL DEFAULT 1,
            lesson_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'not_started',
            updated_at TEXT NOT NULL,
            UNIQUE(student_id, lesson_id)
        )
    ''')

    conn.commit()
    conn.close()

def seed_lessons():
    """
    Populates the lessons table with at least 8 structured learning lessons
    if the table is currently empty.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS cnt FROM lessons")
    row = cursor.fetchone()
    if row and row['cnt'] > 0:
        conn.close()
        return

    now_str = datetime.now(timezone.utc).isoformat()

    sample_lessons = [
        (
            "Python Basics",
            "Learn Python fundamentals including variables, data types, and control flow.",
            "Python is an interpreted, high-level, general-purpose programming language. Its design philosophy emphasizes code readability with the use of significant indentation.\n\nKey Concepts:\n1. Variables and Dynamic Typing\n2. Conditional Statements (if, elif, else)\n3. Loops (for, while)\n4. Functions (def keyword)\n\nExample:\nprint('Hello, Python Learner!')",
            "Programming",
            now_str,
            0,
            None
        ),
        (
            "HTML Fundamentals",
            "Master HTML tags, semantic elements, and modern web document structure.",
            "HyperText Markup Language (HTML) is the standard markup language for documents designed to be displayed in a web browser.\n\nKey Concepts:\n1. Document Type Declaration (<!DOCTYPE html>)\n2. Semantic Tags (<header>, <main>, <article>, <footer>)\n3. Forms, Inputs, and Buttons\n4. Accessibility and Alt Attributes",
            "Web Development",
            now_str,
            0,
            None
        ),
        (
            "CSS Basics",
            "Understand styling, selectors, box model, and responsive layouts.",
            "Cascading Style Sheets (CSS) is a style sheet language used for describing the presentation of a document written in a markup language like HTML.\n\nKey Concepts:\n1. The Box Model (content, padding, border, margin)\n2. Display Properties (block, inline-block, flex, grid)\n3. Media Queries for Mobile Responsiveness\n4. CSS Custom Properties (Variables)",
            "Web Development",
            now_str,
            0,
            None
        ),
        (
            "JavaScript Introduction",
            "Explore DOM manipulation, asynchronous events, and modern ES6 features.",
            "JavaScript is a lightweight, interpreted programming language with first-class functions, famous as the scripting language for web pages.\n\nKey Concepts:\n1. let, const, and Variable Scope\n2. Event Listeners and Event Loops\n3. Fetch API and Promises (async/await)\n4. Client-side storage (LocalStorage & Cache API)",
            "Programming",
            now_str,
            0,
            None
        ),
        (
            "Computer Networks",
            "Study TCP/IP protocols, DNS resolution, and HTTP request-response cycles.",
            "A computer network is a set of computers sharing resources located on or provided by network nodes.\n\nKey Concepts:\n1. OSI 7-Layer and TCP/IP 4-Layer Models\n2. DNS and IP Addressing (IPv4 vs IPv6)\n3. HTTP/1.1 vs HTTP/2 vs HTTP/3\n4. Client-Server Architecture and Edge Caches",
            "Systems",
            now_str,
            0,
            None
        ),
        (
            "Database Fundamentals",
            "Learn relational concepts, ACID guarantees, SQL queries, and indexing.",
            "A database is an organized collection of data generally stored and accessed electronically from a computer system.\n\nKey Concepts:\n1. Relational Tables, Primary and Foreign Keys\n2. SQL Queries (SELECT, INSERT, UPDATE, DELETE, JOIN)\n3. ACID Transactions (Atomicity, Consistency, Isolation, Durability)\n4. Indexing for Query Optimization",
            "Data Engineering",
            now_str,
            0,
            None
        ),
        (
            "Operating Systems",
            "Understand processes, threads, virtual memory, and I/O scheduling.",
            "An operating system (OS) is system software that manages computer hardware, software resources, and provides common services for computer programs.\n\nKey Concepts:\n1. Process Management and Context Switching\n2. CPU Scheduling Algorithms (Round Robin, Priority)\n3. Virtual Memory, Paging, and Swapping\n4. File Systems and I/O Device Drivers",
            "Systems",
            now_str,
            0,
            None
        ),
        (
            "Data Structures",
            "Analyze arrays, linked lists, stacks, queues, hash maps, and trees.",
            "A data structure is a specialized format for organizing, processing, retrieving, and storing data.\n\nKey Concepts:\n1. Arrays and Linked Lists (Time complexity trade-offs)\n2. Stacks (LIFO) and Queues (FIFO)\n3. Hash Tables with O(1) Average Lookup\n4. Binary Search Trees and Big-O Asymptotic Notation",
            "Computer Science",
            now_str,
            0,
            None
        )
    ]

    cursor.executemany('''
        INSERT INTO lessons (title, description, content, category, created_at, access_count, last_accessed)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', sample_lessons)

    conn.commit()
    conn.close()

def get_all_lessons():
    """
    Fetches all lessons from the database ordered by id.
    Returns a list of dicts.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, title, description, content, category, created_at, access_count, last_accessed
        FROM lessons
        ORDER BY id ASC
    ''')
    rows = cursor.fetchall()
    lessons = [dict(row) for row in rows]
    conn.close()
    return lessons

def get_lesson(lesson_id):
    """
    Fetches a single lesson by its ID.
    Returns dict or None if not found.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, title, description, content, category, created_at, access_count, last_accessed
        FROM lessons
        WHERE id = ?
    ''', (lesson_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def increment_access_count(lesson_id):
    """
    Increments access_count for a lesson and updates last_accessed timestamp in SQLite.
    Returns the updated access_count.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute('''
        UPDATE lessons
        SET access_count = access_count + 1,
            last_accessed = ?
        WHERE id = ?
    ''', (now_str, lesson_id))
    conn.commit()

    cursor.execute("SELECT access_count FROM lessons WHERE id = ?", (lesson_id,))
    row = cursor.fetchone()
    conn.close()
    return row['access_count'] if row else 0

def get_student_progress(student_id=1):
    """
    Retrieves progress for all lessons for a specific student.
    Returns dictionary mapping lesson_id to status.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT lesson_id, status, updated_at
        FROM progress
        WHERE student_id = ?
    ''', (student_id,))
    rows = cursor.fetchall()
    progress_map = {row['lesson_id']: row['status'] for row in rows}
    conn.close()
    return progress_map

def update_student_progress(student_id, lesson_id, status):
    """
    Inserts or updates the progress status for a student on a lesson.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute('''
        INSERT INTO progress (student_id, lesson_id, status, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(student_id, lesson_id) DO UPDATE SET
            status = excluded.status,
            updated_at = excluded.updated_at
    ''', (student_id, lesson_id, status, now_str))
    conn.commit()
    conn.close()
    return True

# Initialize database when module is imported
create_database()
seed_lessons()
