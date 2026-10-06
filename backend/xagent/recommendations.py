import hashlib
import math
import os
import re
from datetime import datetime, timezone
from typing import Any, NotRequired, TypedDict

import httpx
from langgraph.graph import END, START, StateGraph
from pymongo.errors import PyMongoError

from services.mongo_db import ensure_mongo_indexes, get_mongo_database

MAX_SEARCH_TOPICS = 5
MAX_SAVED_RECOMMENDATIONS = 15
EMBEDDING_DIMENSIONS = 384


class RecommendationServiceError(RuntimeError):
    """A search provider or recommendation persistence service is unavailable."""


class RecommendationState(TypedDict):
    user_id: str
    email: str
    profile: dict[str, Any]
    topics: list[str]
    sources: list[dict[str, Any]]
    recommendations: list[dict[str, Any]]
    generated_at: NotRequired[str]


def _profile_topics(profile: dict[str, Any]) -> list[str]:
    topics: list[str] = []
    for field in ("projects", "skills", "education"):
        values = profile.get(field, [])
        if not isinstance(values, list):
            continue
        for value in values:
            if isinstance(value, str):
                cleaned = " ".join(value.split())[:180]
                if cleaned and cleaned.casefold() not in {item.casefold() for item in topics}:
                    topics.append(cleaned)
            if len(topics) >= MAX_SEARCH_TOPICS:
                return topics
    return topics


def _search_youtube(client: httpx.Client, topic: str, api_key: str) -> list[dict[str, Any]]:
    try:
        response = client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": f"{topic} tutorial",
                "type": "video",
                "maxResults": 4,
                "key": api_key,
            },
        )
        response.raise_for_status()
        items = response.json().get("items", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise RecommendationServiceError("YouTube search failed.") from exc

    results = []
    for item in items:
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {})
        if not video_id:
            continue
        thumbnails = snippet.get("thumbnails", {})
        thumbnail = (
            thumbnails.get("high")
            or thumbnails.get("medium")
            or thumbnails.get("default")
            or {}
        )
        results.append(
            {
                "id": f"youtube:{video_id}",
                "type": "youtube",
                "title": snippet.get("title", "YouTube tutorial"),
                "description": snippet.get("description", ""),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "thumbnail_url": thumbnail.get("url"),
                "published_at": snippet.get("publishedAt"),
                "topic": topic,
            }
        )
    return results


def _search_web(client: httpx.Client, topic: str, api_key: str) -> list[dict[str, Any]]:
    try:
        response = client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": api_key,
                "query": f"{topic} learning tutorial documentation articles",
                "max_results": 4,
                "search_depth": "basic",
            },
        )
        response.raise_for_status()
        items = response.json().get("results", [])
    except (httpx.HTTPError, ValueError) as exc:
        raise RecommendationServiceError("Web article search failed.") from exc

    results = []
    for item in items:
        url = item.get("url")
        if not url:
            continue
        results.append(
            {
                "id": f"web:{url}",
                "type": "web",
                "title": item.get("title") or url,
                "description": item.get("content", ""),
                "url": url,
                "thumbnail_url": None,
                "published_at": None,
                "topic": topic,
            }
        )
    return results


def _collect_recommendation_sources(state: RecommendationState) -> dict[str, Any]:
    youtube_key = os.getenv("YOUTUBE_API_KEY")
    tavily_key = os.getenv("TAVILY_API_KEY")
    missing = [
        name
        for name, key in (("YOUTUBE_API_KEY", youtube_key), ("TAVILY_API_KEY", tavily_key))
        if not key
    ]
    if missing:
        raise RecommendationServiceError(
            f"Missing required recommendation provider configuration: {', '.join(missing)}."
        )

    topics = state["topics"]
    if not topics:
        raise RecommendationServiceError(
            "Add at least one education, skill, or project to your profile before generating recommendations."
        )

    sources: list[dict[str, Any]] = []
    try:
        with httpx.Client(timeout=15.0) as client:
            for topic in topics:
                sources.extend(_search_youtube(client, topic, youtube_key))
                sources.extend(_search_web(client, topic, tavily_key))
    except httpx.HTTPError as exc:
        raise RecommendationServiceError("Recommendation search request failed.") from exc

    unique: dict[str, dict[str, Any]] = {}
    for source in sources:
        unique[source["id"]] = source
    return {"sources": list(unique.values())}


def _text_embedding(text: str) -> list[float]:
    """Build a deterministic, normalized hashing-vector embedding without a model download."""
    vector = [0.0] * EMBEDDING_DIMENSIONS
    normalized = text.casefold()
    tokens = re.findall(r"[a-z0-9+#.]{2,}", normalized)
    features = tokens + [
        normalized[index : index + 3]
        for index in range(max(0, len(normalized) - 2))
        if not normalized[index : index + 3].isspace()
    ]
    for feature in features:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        feature_index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSIONS
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[feature_index] += sign
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude:
        vector = [value / magnitude for value in vector]
    return vector


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _rank_recommendations(state: RecommendationState) -> dict[str, Any]:
    profile = state["profile"]
    profile_text = " ".join(
        str(value)
        for field in ("education", "skills", "projects")
        for value in profile.get(field, [])
        if isinstance(value, str)
    )
    profile_embedding = _text_embedding(profile_text)

    ranked = []
    for source in state["sources"]:
        content_text = " ".join(
            str(source.get(field, ""))
            for field in ("title", "description", "topic")
        )
        similarity = _cosine_similarity(profile_embedding, _text_embedding(content_text))
        ranked.append({**source, "relevance_score": round(similarity, 4)})

    ranked.sort(key=lambda result: result["relevance_score"], reverse=True)
    return {"recommendations": ranked[:MAX_SAVED_RECOMMENDATIONS]}


def _save_recommendations(state: RecommendationState) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc)
    document = {
        "user_id": state["user_id"],
        "email": state["email"],
        "recommendations": state["recommendations"],
        "generated_at": generated_at,
    }
    try:
        ensure_mongo_indexes()
        get_mongo_database().recommendations.update_one(
            {"user_id": state["user_id"]},
            {"$set": document},
            upsert=True,
        )
    except (PyMongoError, RuntimeError) as exc:
        raise RecommendationServiceError(
            "Could not save recommendations to MongoDB."
        ) from exc

    return {
        "recommendations": state["recommendations"],
        "generated_at": generated_at.isoformat(),
    }


def _build_recommendation_graph():
    builder = StateGraph(RecommendationState)
    builder.add_node("search", _collect_recommendation_sources)
    builder.add_node("rank", _rank_recommendations)
    builder.add_node("save", _save_recommendations)
    builder.add_edge(START, "search")
    builder.add_edge("search", "rank")
    builder.add_edge("rank", "save")
    builder.add_edge("save", END)
    return builder.compile()


recommendation_graph = _build_recommendation_graph()


def run_a2a_recommendations(
    user_id: str,
    email: str,
    profile: dict[str, Any],
) -> dict[str, Any]:
    """Run the personalized search, embedding-rank, and persistence graph."""
    topics = _profile_topics(profile)
    result = recommendation_graph.invoke(
        {
            "user_id": user_id,
            "email": email,
            "profile": profile,
            "topics": topics,
            "sources": [],
            "recommendations": [],
        }
    )
    return {
        "recommendations": result.get("recommendations", []),
        "generated_at": result.get("generated_at"),
    }


def get_saved_recommendations(user_id: str) -> dict[str, Any]:
    try:
        ensure_mongo_indexes()
        saved = get_mongo_database().recommendations.find_one(
            {"user_id": user_id},
            {"_id": 0, "recommendations": 1, "generated_at": 1},
        )
    except (PyMongoError, RuntimeError) as exc:
        raise RecommendationServiceError(
            "Could not retrieve recommendations from MongoDB."
        ) from exc

    if not saved:
        return {"recommendations": [], "generated_at": None}
    generated_at = saved.get("generated_at")
    return {
        "recommendations": saved.get("recommendations", []),
        "generated_at": generated_at.isoformat() if generated_at else None,
    }
