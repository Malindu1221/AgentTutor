from datetime import datetime, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, HttpUrl
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError, PyMongoError

from auth import get_current_user
from services.mongo_db import ensure_mongo_indexes, get_mongo_database

router = APIRouter(prefix="/api/profile", tags=["user profile"])


class Bookmark(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    url: HttpUrl


ProfileEntry = Annotated[str, Field(max_length=500)]
SkillEntry = Annotated[str, Field(max_length=100)]


class ProfilePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    education: list[ProfileEntry] = Field(default_factory=list, max_length=20)
    work_history: list[ProfileEntry] = Field(default_factory=list, max_length=20)
    projects: list[ProfileEntry] = Field(default_factory=list, max_length=20)
    skills: list[SkillEntry] = Field(default_factory=list, max_length=100)
    bookmarks: list[Bookmark] = Field(default_factory=list, max_length=100)


def _serialize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(profile["_id"]),
        "education": profile.get("education", []),
        "work_history": profile.get("work_history", []),
        "projects": profile.get("projects", []),
        "skills": profile.get("skills", []),
        "bookmarks": profile.get("bookmarks", []),
        "created_at": profile["created_at"].isoformat(),
        "updated_at": profile["updated_at"].isoformat(),
    }


def get_profile_for_user(user_id: str) -> dict[str, Any] | None:
    """Load only profile fields needed by the personalized learning workflow."""
    try:
        ensure_mongo_indexes()
        profile = get_mongo_database().profiles.find_one(
            {"user_id": user_id},
            {
                "_id": 0,
                "education": 1,
                "work_history": 1,
                "projects": 1,
                "skills": 1,
                "bookmarks": 1,
            },
        )
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is unavailable.",
        ) from exc
    if profile is None:
        return None
    profile.pop("user_id", None)
    return profile


@router.get("/me")
def read_profile(user: dict[str, str] = Depends(get_current_user)) -> dict[str, Any]:
    try:
        ensure_mongo_indexes()
        profile = get_mongo_database().profiles.find_one({"user_id": user["id"]})
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is unavailable.",
        ) from exc

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile has not been created yet.",
        )
    return _serialize_profile(profile)


@router.post("/me", status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: ProfilePayload,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    document = {
        "user_id": user["id"],
        "email": user["email"],
        **payload.model_dump(mode="json"),
        "created_at": now,
        "updated_at": now,
    }
    try:
        ensure_mongo_indexes()
        result = get_mongo_database().profiles.insert_one(document)
        profile = get_mongo_database().profiles.find_one({"_id": result.inserted_id})
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A profile already exists for this account.",
        ) from exc
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is unavailable.",
        ) from exc

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load the newly created profile.",
        )
    return _serialize_profile(profile)


@router.put("/me")
def update_profile(
    payload: ProfilePayload,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    fields = payload.model_dump(mode="json")
    try:
        ensure_mongo_indexes()
        profile = get_mongo_database().profiles.find_one_and_update(
            {"user_id": user["id"]},
            {
                "$set": {**fields, "email": user["email"], "updated_at": now},
                "$setOnInsert": {
                    "user_id": user["id"],
                    "created_at": now,
                },
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is unavailable.",
        ) from exc

    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not save the profile.",
        )
    return _serialize_profile(profile)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(user: dict[str, str] = Depends(get_current_user)) -> None:
    try:
        ensure_mongo_indexes()
        result = get_mongo_database().profiles.delete_one({"user_id": user["id"]})
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Profile storage is unavailable.",
        ) from exc

    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile does not exist.",
        )
