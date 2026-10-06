import sqlite3
import json
import os
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterator, Optional, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "sessions.db")


@contextmanager
def _connection() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def init_db():
    """Initializes SQLite tables for sessions and resource caching."""
    with _connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                context TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS session_activity (
                session_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                active_date TEXT NOT NULL,
                PRIMARY KEY (session_id, active_date)
            )
        """)

def save_context(session_id: str, user_id: str, context: Dict[str, Any]):
    """Saves or updates the session context dictionary."""
    init_db()
    context_str = json.dumps(context)
    with _connection() as conn:
        conn.execute("""
            INSERT INTO sessions (session_id, user_id, context, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                user_id = excluded.user_id,
                context = excluded.context,
                updated_at = CURRENT_TIMESTAMP
        """, (session_id, user_id, context_str))
        active_date = datetime.now(timezone.utc).date().isoformat()
        conn.execute(
            """
            INSERT OR IGNORE INTO session_activity (session_id, user_id, active_date)
            VALUES (?, ?, ?)
            """,
            (session_id, user_id, active_date),
        )

def load_context(session_id: str) -> Optional[Dict[str, Any]]:
    """Loads a session context dictionary by session_id."""
    if not os.path.exists(DB_PATH):
        return None
    with _connection() as conn:
        row = conn.execute(
            "SELECT context FROM sessions WHERE session_id = ?",
            (session_id,),
        ).fetchone()
    if row and row[0]:
        return json.loads(row[0])
    return None