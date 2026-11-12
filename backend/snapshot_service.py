from datetime import datetime
from backend.db import snapshots_col
from bson import ObjectId
from backend.portfolio_service import portfolio_summary


def take_snapshot(user_id: str):
    summary = portfolio_summary(user_id)
    doc = {
        "user_id": user_id,
        "timestamp": datetime.utcnow(),
        "totals": summary["totals"],
    }
    snapshots_col().insert_one(doc)
    return to_public(doc)


def list_snapshots(user_id: str, limit: int = 30):
    return [to_public(s) for s in snapshots_col().find({"user_id": user_id}).sort("timestamp", -1).limit(limit)]


def to_public(doc: dict) -> dict:
    d = {**doc}
    if "_id" in d:
        d["_id"] = str(d["_id"])
    return d


def delete_snapshot(user_id: str, snapshot_id: str) -> bool:
    try:
        oid = ObjectId(snapshot_id)
    except Exception:
        return False
    res = snapshots_col().delete_one({"_id": oid, "user_id": user_id})
    return res.deleted_count > 0


__all__ = ["take_snapshot", "list_snapshots"]
