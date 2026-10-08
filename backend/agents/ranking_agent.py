import asyncio
import logging
import re
from functools import lru_cache
from typing import Any
from urllib.parse import parse_qs, urlparse

import torch
from langchain_huggingface import HuggingFaceEmbeddings
from sentence_transformers.util import cos_sim

logger = logging.getLogger(__name__)

_TOKEN_PATTERN = re.compile(r"[a-z0-9]+(?:[+#][a-z0-9+#]*)?", re.IGNORECASE)
_STOP_WORDS = {
    "about", "beginner", "beginners", "course", "guide", "how", "learn",
    "learning", "of", "the", "to", "tutorial", "understanding", "with",
}
_LANGUAGE_ALIASES = (
    "javascript", "typescript", "golang", "python", "kotlin", "swift",
    "scala", "java", "rust", "ruby", "php", "c++", "c#", "golang",
)
_VIDEO_HOSTS = {"youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"}
_BLOCKED_ARTICLE_HOSTS = (
    "youtube.com", "youtu.be", "vimeo.com", "dailymotion.com", "tiktok.com",
    "twitch.tv", "facebook.com", "instagram.com", "indeed.com", "glassdoor.com",
    "linkedin.com", "ziprecruiter.com", "monster.com", "careerbuilder.com",
)
_JOB_PATTERN = re.compile(r"\b(jobs?|careers?|hiring|vacancies|employment)\b", re.I)


@lru_cache(maxsize=1)
def _get_embeddings() -> HuggingFaceEmbeddings:
    """Create the CPU-backed embedding model once per process."""
    return HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def _domain_anchor(target_domain: str) -> str:
    normalized = target_domain.casefold()
    for language in sorted(_LANGUAGE_ALIASES, key=len, reverse=True):
        if re.search(rf"(?<![a-z0-9]){re.escape(language)}(?![a-z0-9])", normalized):
            return language
    tokens = [
        token.casefold()
        for token in _TOKEN_PATTERN.findall(target_domain)
        if token.casefold() not in _STOP_WORDS and len(token) > 1
    ]
    return tokens[0] if tokens else ""


def _matches_domain(resource: dict[str, Any], anchor: str) -> bool:
    if not anchor:
        return True
    text = " ".join(
        str(resource.get(field, ""))
        for field in ("title", "description")
    )
    return bool(
        re.search(
            rf"(?<![a-z0-9]){re.escape(anchor)}(?![a-z0-9])",
            text,
            re.IGNORECASE,
        )
    )


def _prepare_candidates(
    youtube_results: list[dict[str, Any]],
    web_results: list[dict[str, Any]],
    anchor: str,
) -> list[dict[str, Any]]:
    candidates = []
    for items, default_type in (
        (youtube_results, "youtube_video"),
        (web_results, "web_resource"),
    ):
        for resource in items:
            if not isinstance(resource, dict) or not resource.get("title"):
                continue
            try:
                parsed = urlparse(str(resource.get("url", "")))
                host = (parsed.hostname or "").lower()
            except ValueError:
                continue
            if parsed.scheme not in {"http", "https"} or not host:
                continue
            if default_type == "youtube_video":
                if host not in _VIDEO_HOSTS:
                    continue
                video_id = (
                    parse_qs(parsed.query).get("v", [""])[0]
                    if host != "youtu.be"
                    else parsed.path.strip("/").split("/")[0]
                )
                if not video_id:
                    continue
            else:
                if any(host == blocked or host.endswith(f".{blocked}") for blocked in _BLOCKED_ARTICLE_HOSTS):
                    continue
                if _JOB_PATTERN.search(" ".join(str(resource.get(k, "")) for k in ("title", "description", "url"))):
                    continue
            if not _matches_domain(resource, anchor):
                continue
            candidate = dict(resource)
            candidate["type"] = default_type
            candidates.append(candidate)
    return candidates


def _rank_resources(
    target_domain: str,
    youtube_results: list[dict[str, Any]],
    web_results: list[dict[str, Any]],
    limit: int,
) -> list[dict[str, Any]]:
    limit = min(max(limit, 0), 4)
    anchor = _domain_anchor(target_domain)
    candidates = _prepare_candidates(youtube_results, web_results, anchor)
    if not candidates:
        return []

    texts = [
        f"{item.get('title', '')} {item.get('description', '')}".strip()
        for item in candidates
    ]
    embedder = _get_embeddings()
    query_vector = embedder.embed_query(target_domain)
    resource_vectors = embedder.embed_documents(texts)
    similarities = cos_sim(
        torch.tensor(query_vector, dtype=torch.float32),
        torch.tensor(resource_vectors, dtype=torch.float32),
    ).squeeze(0)
    ranked = sorted(
        zip(candidates, similarities.tolist()),
        key=lambda item: item[1],
        reverse=True,
    )
    return [
        {**resource, "relevance_score": float(score)}
        for resource, score in ranked[:max(limit, 0)]
    ]


def rank_and_filter_resources_sync(
    target_domain: str,
    youtube_results: list[dict[str, Any]],
    web_results: list[dict[str, Any]],
    limit: int = 4,
) -> list[dict[str, Any]]:
    """Rank resources by cosine similarity while preserving the domain gate."""
    limit = min(max(limit, 0), 4)
    candidates = _prepare_candidates(
        youtube_results,
        web_results,
        _domain_anchor(target_domain),
    )
    try:
        return _rank_resources(target_domain, youtube_results, web_results, limit)
    except Exception:
        logger.exception("Embedding-based resource ranking failed; using filtered results.")
        return candidates[:max(limit, 0)]


async def rank_and_filter_resources(
    target_domain: str,
    youtube_results: list[dict[str, Any]],
    web_results: list[dict[str, Any]],
    limit: int = 4,
) -> list[dict[str, Any]]:
    """Async resource-ranking entry point for asynchronous callers."""
    return await asyncio.to_thread(
        rank_and_filter_resources_sync,
        target_domain,
        youtube_results,
        web_results,
        limit,
    )
