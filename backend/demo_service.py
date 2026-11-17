"""
Shared demo account, so someone visiting the portfolio can try the app without
signing up. It holds a believable set of trades (prices are the real Binance
closes at each time) and goes back to that state at most once an hour.
"""
from datetime import datetime, timedelta

from pymongo import ReturnDocument

from backend.config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY
from backend.db import alerts_col, snapshots_col, trades_col, users_col

DEMO_EMAIL = "demo@criptobalance.invalid"
RESET_EVERY = timedelta(hours=1)

# (asset, side, quantity, unit price in EUR, UTC time)
TRADES = [
    ("BTC", "BUY", 0.01612, 93035.32, "2025-01-14 09:30"),
    ("ETH", "BUY", 0.2963, 3037.48, "2025-01-28 18:10"),
    ("SOL", "BUY", 3.637, 164.97, "2025-02-19 11:45"),
    ("BTC", "BUY", 0.01051, 76111.78, "2025-03-11 20:05"),
    ("ADA", "BUY", 751.5, 0.5323, "2025-04-08 10:20"),
    ("ETH", "BUY", 0.3363, 1486.65, "2025-04-22 19:40"),
    ("XRP", "BUY", 248.2, 2.01, "2025-05-27 08:55"),
    ("SOL", "SELL", 1.819, 168.08, "2025-07-21 17:30"),
    ("BTC", "BUY", 0.00703, 99511.22, "2025-08-05 12:15"),
    ("ETH", "SELL", 0.253, 4036.08, "2025-08-23 21:00"),
    ("ADA", "BUY", 484.6, 0.6191, "2025-10-13 09:05"),
    ("BTC", "BUY", 0.00766, 78281.56, "2025-12-02 16:50"),
    ("XRP", "SELL", 148.9, 1.7, "2026-01-19 13:25"),
    ("ETH", "BUY", 0.2974, 1681.47, "2026-03-03 10:00"),
    ("SOL", "BUY", 5.58, 71.68, "2026-04-15 18:35"),
    ("BTC", "SELL", 0.01033, 54232.76, "2026-06-09 11:10"),
    ("ADA", "BUY", 1798.6, 0.139, "2026-07-28 20:45"),
    ("BTC", "BUY", 0.00915, 65570.3, "2026-09-16 09:40"),
    ("ETH", "BUY", 0.1818, 2200.15, "2026-10-21 15:20"),
]

ALERTS = [
    ("BTC", "price", "above", 75000.0),
    ("ETH", "pnl_pct", "below", -20.0),
]


def _seed(user_id: str):
    trades_col().delete_many({"user_id": user_id})
    alerts_col().delete_many({"user_id": user_id})
    snapshots_col().delete_many({"user_id": user_id})
    docs = []
    for asset, side, qty, price, when in TRADES:
        total = round(qty * price, 2)
        docs.append(
            {
                "user_id": user_id,
                "symbol": f"{asset}{DEFAULT_QUOTE_ASSET}",
                "base_asset": asset,
                "quote_asset": DEFAULT_QUOTE_ASSET,
                "side": side,
                "quantity": qty,
                "price_fiat": price,
                "total_cost_fiat": total,
                "timestamp": datetime.strptime(when, "%Y-%m-%d %H:%M"),
                "fiat_currency": FIAT_CURRENCY,
            }
        )
    trades_col().insert_many(docs)
    now = datetime.utcnow()
    alerts_col().insert_many(
        [
            {"user_id": user_id, "base_asset": a, "kind": k, "direction": d, "threshold": t, "created_at": now, "last_triggered_at": None}
            for a, k, d, t in ALERTS
        ]
    )


def demo_user() -> dict:
    """The demo user, freshly reset if the last reset is over an hour old."""
    users_col().update_one(
        {"email": DEMO_EMAIL},
        # No password hash: nobody can log in to it with a password
        {"$setOnInsert": {"email": DEMO_EMAIL, "name": "Cuenta demo", "demo": True, "password_hash": "", "created_at": datetime.utcnow()}},
        upsert=True,
    )
    # Only the request that wins this update reseeds, so two visitors at once don't both do it
    cutoff = datetime.utcnow() - RESET_EVERY
    claimed = users_col().find_one_and_update(
        {"email": DEMO_EMAIL, "$or": [{"demo_reset_at": {"$lt": cutoff}}, {"demo_reset_at": {"$exists": False}}]},
        {"$set": {"demo_reset_at": datetime.utcnow()}},
        return_document=ReturnDocument.AFTER,
    )
    if claimed:
        _seed(str(claimed["_id"]))
    user = claimed or users_col().find_one({"email": DEMO_EMAIL})
    user = {k: v for k, v in user.items() if k != "password_hash"}
    user["_id"] = str(user["_id"])
    return user
