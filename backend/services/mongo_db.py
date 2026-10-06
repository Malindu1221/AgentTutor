from functools import lru_cache

from pymongo import MongoClient

from config import Config


@lru_cache(maxsize=1)
def get_mongo_client() -> MongoClient:
    if not Config.MONGO_URI:
        raise RuntimeError("MONGO_URI is not configured.")
    return MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=5000)


def get_mongo_database():
    return get_mongo_client()[Config.MONGO_DB_NAME]


@lru_cache(maxsize=1)
def ensure_mongo_indexes() -> None:
    database = get_mongo_database()
    database.users.create_index("email", unique=True)
    database.profiles.create_index("user_id", unique=True)
    database.recommendations.create_index("user_id", unique=True)
