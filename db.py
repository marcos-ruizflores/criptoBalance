from pymongo import MongoClient
from config import MONGO_URI, MONGO_DB_NAME

client = MongoClient(MONGO_URI)
db = client[MONGO_DB_NAME]

def trades_col():
    return db["trades"]


def snapshots_col():
    return db["snapshots"]


def alerts_col():
    return db["alerts"]
