import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Generator

from services.sqlite_store import DB_PATH


@contextmanager
def _connection() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(DB_PATH)
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def _ensure_table() -> None:
    with _connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pdf_sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                pdf_filename TEXT NOT NULL,
                extracted_text TEXT NOT NULL,
                chat_history TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL
            )
            """
        )


def create_pdf_session(
    session_id: str,
    user_id: str,
    pdf_filename: str,
    extracted_text: str,
) -> dict[str, str]:
    _ensure_table()
    created_at = datetime.now(timezone.utc).isoformat()
    with _connection() as conn:
        conn.execute(
            """
            INSERT INTO pdf_sessions
                (session_id, user_id, pdf_filename, extracted_text, chat_history, created_at)
            VALUES (?, ?, ?, ?, '[]', ?)
            """,
            (session_id, user_id, pdf_filename, extracted_text, created_at),
        )
    return {
        "session_id": session_id,
        "pdf_filename": pdf_filename,
        "created_at": created_at,
    }


def list_pdf_sessions(user_id: str) -> list[dict[str, str]]:
    _ensure_table()
    with _connection() as conn:
        rows = conn.execute(
            """
            SELECT session_id, pdf_filename, created_at
            FROM pdf_sessions
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()
    return [
        {"session_id": row[0], "pdf_filename": row[1], "created_at": row[2]}
        for row in rows
    ]


def get_pdf_session(session_id: str, user_id: str) -> dict[str, Any] | None:
    _ensure_table()
    with _connection() as conn:
        row = conn.execute(
            """
            SELECT session_id, user_id, pdf_filename, extracted_text, chat_history, created_at
            FROM pdf_sessions
            WHERE session_id = ? AND user_id = ?
            """,
            (session_id, user_id),
        ).fetchone()
    if row is None:
        return None
    return {
        "session_id": row[0],
        "user_id": row[1],
        "pdf_filename": row[2],
        "extracted_text": row[3],
        "messages": json.loads(row[4]),
        "created_at": row[5],
    }


def append_pdf_messages(
    session_id: str,
    user_id: str,
    messages: list[dict[str, str]],
) -> bool:
    _ensure_table()
    with _connection() as conn:
        row = conn.execute(
            """
            SELECT chat_history
            FROM pdf_sessions
            WHERE session_id = ? AND user_id = ?
            """,
            (session_id, user_id),
        ).fetchone()
        if row is None:
            return False
        history = json.loads(row[0])
        history.extend(messages)
        conn.execute(
            """
            UPDATE pdf_sessions
            SET chat_history = ?
            WHERE session_id = ? AND user_id = ?
            """,
            (json.dumps(history), session_id, user_id),
        )
    return True
