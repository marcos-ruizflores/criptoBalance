from datetime import datetime
from db import snapshots_col
from bson import ObjectId
from portfolio_service import portfolio_summary


def take_snapshot():
    summary = portfolio_summary()
    doc = {
        "timestamp": datetime.utcnow(),
        "totals": summary["totals"],
    }
    snapshots_col().insert_one(doc)
    return to_public(doc)


def list_snapshots(limit: int = 30):
    return [to_public(s) for s in snapshots_col().find().sort("timestamp", -1).limit(limit)]


def to_public(doc: dict) -> dict:
    d = {**doc}
    if "_id" in d:
        d["_id"] = str(d["_id"])
    return d


def delete_snapshot(snapshot_id: str) -> bool:
    try:
        oid = ObjectId(snapshot_id)
    except Exception:
        return False
    res = snapshots_col().delete_one({"_id": oid})
    return res.deleted_count > 0


__all__ = ["take_snapshot", "list_snapshots"]
