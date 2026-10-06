import json
import os
import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from services.sqlite_store import DB_PATH

router = APIRouter(prefix="/api/analytics", tags=["learning analytics"])


def _empty_analytics() -> dict[str, Any]:
    return {
        "timezone": "UTC",
        "total_sessions": 0,
        "total_roadmaps": 0,
        "completed_sessions": 0,
        "average_score": None,
        "recent_scores": [],
        "current_streak_days": 0,
        "longest_streak_days": 0,
        "active_days": 0,
    }


def _streaks(active_days: set[date], today: date) -> tuple[int, int]:
    if not active_days:
        return 0, 0

    longest = 0
    run = 0
    previous: date | None = None
    for active_date in sorted(active_days):
        if previous is not None and active_date == previous + timedelta(days=1):
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        previous = active_date

    most_recent = max(active_days)
    if most_recent < today - timedelta(days=1):
        return 0, longest

    current = 0
    streak_date = most_recent
    while streak_date in active_days:
        current += 1
        streak_date -= timedelta(days=1)
    return current, longest


def get_user_analytics(user_id: str) -> dict[str, Any]:
    if not os.path.exists(DB_PATH):
        return _empty_analytics()

    try:
        with closing(sqlite3.connect(DB_PATH)) as conn:
            conn.row_factory = sqlite3.Row
            table_exists = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sessions'"
            ).fetchone()
            if table_exists is None:
                return _empty_analytics()

            rows = conn.execute(
                """
                SELECT session_id, context, updated_at
                FROM sessions
                WHERE user_id = ?
                ORDER BY updated_at DESC
                """,
                (user_id,),
            ).fetchall()

            activity_table_exists = conn.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'session_activity'"
            ).fetchone()
            if activity_table_exists:
                activity_rows = conn.execute(
                    "SELECT DISTINCT active_date FROM session_activity WHERE user_id = ?",
                    (user_id,),
                ).fetchall()
                activity_dates = {
                    date.fromisoformat(row["active_date"])
                    for row in activity_rows
                }
            else:
                activity_dates = set()
            for row in rows:
                timestamp = row["updated_at"]
                if not timestamp:
                    continue
                try:
                    activity_dates.add(datetime.fromisoformat(timestamp).date())
                except (TypeError, ValueError):
                    continue
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Learning analytics storage is unavailable.",
        ) from exc

    completed_scores: list[dict[str, Any]] = []
    total_roadmaps = 0
    completed_sessions = 0
    for row in rows:
        try:
            context = json.loads(row["context"])
        except (TypeError, json.JSONDecodeError) as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stored learning session data is invalid.",
            ) from exc

        if not isinstance(context, dict):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stored learning session data is invalid.",
            )
        if context.get("stage") != "completed" or not isinstance(context.get("roadmap"), list):
            continue
        total_roadmaps += 1
        completed_sessions += 1

        evaluation = context.get("difficulty")
        if not isinstance(evaluation, dict):
            continue
        score = evaluation.get("score")
        total = evaluation.get("total")
        percentage = evaluation.get("percentage")
        if (
            isinstance(score, bool)
            or not isinstance(score, (int, float))
            or isinstance(total, bool)
            or not isinstance(total, (int, float))
            or total <= 0
        ):
            continue
        if isinstance(percentage, bool) or not isinstance(percentage, (int, float)):
            percentage = score / total * 100

        timestamp = row["updated_at"]
        completed_scores.append(
            {
                "session_id": row["session_id"],
                "date": timestamp,
                "score": score,
                "total": total,
                "percentage": round(float(percentage), 1),
            }
        )

    score_values = [score["percentage"] for score in completed_scores]
    today = datetime.now(timezone.utc).date()
    activity_dates = {active_date for active_date in activity_dates if active_date <= today}
    current_streak, longest_streak = _streaks(activity_dates, today)
    return {
        "timezone": "UTC",
        "total_sessions": len(rows),
        "total_roadmaps": total_roadmaps,
        "completed_sessions": completed_sessions,
        "average_score": round(sum(score_values) / len(score_values), 1)
        if score_values
        else None,
        "recent_scores": completed_scores[:10],
        "current_streak_days": current_streak,
        "longest_streak_days": longest_streak,
        "active_days": len(activity_dates),
    }


@router.get("")
def read_analytics(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    return get_user_analytics(user["id"])
