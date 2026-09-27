import sqlite3
import json
import os
from typing import Optional, Dict, Any

DB_PATH = "sessions.db"

def init_db():
    """Initializes SQLite tables for sessions and resource caching."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Table to store session context between Phase 1 & Phase 2
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            user_id TEXT,
            context TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Table to cache content recommendations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT,
            data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    conn.commit()
    conn.close()

def save_context(session_id: str, user_id: str, context: Dict[str, Any]):
    """Saves or updates the session context dictionary."""
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    context_str = json.dumps(context)
    cursor.execute("""
        INSERT OR REPLACE INTO sessions (session_id, user_id, context, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    """, (session_id, user_id, context_str))
    
    conn.commit()
    conn.close()

def load_context(session_id: str) -> Optional[Dict[str, Any]]:
    """Loads a session context dictionary by session_id."""
    if not os.path.exists(DB_PATH):
        return None
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT context FROM sessions WHERE session_id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row and row[0]:
        return json.loads(row[0])
    return None