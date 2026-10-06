from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from auth import get_current_user
from personal_mongo import get_profile_for_user
from xagent.recommendations import (
    RecommendationServiceError,
    get_saved_recommendations,
    run_a2a_recommendations,
)

router = APIRouter(prefix="/recommendations", tags=["personalized recommendations"])


@router.get("")
def read_recommendations(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    try:
        return get_saved_recommendations(user["id"])
    except RecommendationServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.post("/generate")
def generate_recommendations(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    profile = get_profile_for_user(user["id"])
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Create your learner profile before generating recommendations.",
        )

    try:
        result = run_a2a_recommendations(
            user_id=user["id"],
            email=user["email"],
            profile=profile,
        )
    except RecommendationServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    return result
