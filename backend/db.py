from pymongo import ASCENDING, DESCENDING, MongoClient
from backend.config import MONGO_URI, MONGO_DB_NAME

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

def trades_col():
    return db["trades"]


def snapshots_col():
    return db["snapshots"]


def alerts_col():
    return db["alerts"]


def users_col():
    return db["users"]


def ensure_indexes():
    # Every query filters by user, so index on it. Safe to run on each start.
    users_col().create_index("email", unique=True)
    trades_col().create_index([("user_id", ASCENDING), ("timestamp", ASCENDING)])
    snapshots_col().create_index([("user_id", ASCENDING), ("timestamp", DESCENDING)])
    alerts_col().create_index([("user_id", ASCENDING), ("created_at", DESCENDING)])
