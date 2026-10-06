import re
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from pydantic import BaseModel, EmailStr, Field, field_validator
from pymongo.errors import DuplicateKeyError, PyMongoError

from config import Config
from services.mongo_db import ensure_mongo_indexes, get_mongo_database

router = APIRouter(prefix="/api/auth", tags=["authentication"])
bearer_scheme = HTTPBearer(auto_error=False)
JWT_ALGORITHM = "HS256"


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def validate_bcrypt_password_length(cls, password: str) -> str:
        if len(password.encode("utf-8")) > 72:
            raise ValueError("Password must be no longer than 72 UTF-8 bytes.")
        return password


def _jwt_secret() -> str:
    secret = Config.JWT_SECRET
    if not secret or len(secret) < 32:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT_SECRET must be configured with at least 32 characters.",
        )
    return secret


def _create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=Config.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _auth_response(user: dict[str, Any]) -> dict[str, Any]:
    user_id = str(user["_id"])
    email = user["email"]
    return {
        "access_token": _create_access_token(user_id, email),
        "token_type": "bearer",
        "user": {"id": user_id, "email": email},
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(request: AuthRequest) -> dict[str, Any]:
    _jwt_secret()
    email = str(request.email).strip().lower()
    password_hash = bcrypt.hashpw(
        request.password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    try:
        ensure_mongo_indexes()
        result = get_mongo_database().users.insert_one(
            {
                "email": email,
                "password_hash": password_hash,
                "created_at": datetime.now(timezone.utc),
            }
        )
        user = get_mongo_database().users.find_one({"_id": result.inserted_id})
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication storage is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not load the newly registered account.",
        )
    return _auth_response(user)


@router.post("/login")
def login(request: AuthRequest) -> dict[str, Any]:
    _jwt_secret()
    email = str(request.email).strip().lower()
    try:
        ensure_mongo_indexes()
        user = get_mongo_database().users.find_one({"email": email})
    except (PyMongoError, RuntimeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication storage is unavailable.",
        ) from exc

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        password_matches = bcrypt.checkpw(
            request.password.encode("utf-8"),
            user["password_hash"].encode("utf-8"),
        )
    except (KeyError, ValueError):
        password_matches = False

    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _auth_response(user)


def _resolve_bearer_user(
    credentials: HTTPAuthorizationCredentials | None,
) -> dict[str, str] | None:
    if credentials is None:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            _jwt_secret(),
            algorithms=[JWT_ALGORITHM],
            options={"require": ["sub", "email", "exp"]},
        )
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    email = payload.get("email")
    if not isinstance(user_id, str) or not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        ensure_mongo_indexes()
        user_exists = get_mongo_database().users.find_one(
            {"_id": _object_id(user_id)},
            {"_id": 1},
        )
    except (PyMongoError, RuntimeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication storage is unavailable.",
        ) from exc

    if user_exists is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"id": user_id, "email": email}


def _object_id(value: str):
    from bson import ObjectId

    if not re.fullmatch(r"[0-9a-fA-F]{24}", value):
        raise ValueError("Invalid user identifier.")
    return ObjectId(value)


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, str] | None:
    return _resolve_bearer_user(credentials)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, str]:
    user = _resolve_bearer_user(credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
