"""
Day-by-day value of a portfolio, rebuilt from its trades and Binance daily candles.
No snapshots needed: for every day we know what was held and what each coin closed at.
"""
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from threading import Lock
from typing import Dict, Optional

from backend.binance_client import _binance_get, _symbol_candidates
from backend.config import FIAT_CURRENCY
from backend.db import trades_col

RANGES = {"1m": 30, "3m": 90, "1y": 365, "all": None}
CACHE_TTL_S = 3600
DAY_MS = 86_400_000

_series_cache: Dict[str, tuple] = {}
_cache_lock = Lock()


def _daily_closes(symbol: str, start: date) -> Dict[date, float]:
    """Daily closes of a Binance pair from `start` to today, paging past the 1000-candle cap."""
    key = symbol
    with _cache_lock:
        hit = _series_cache.get(key)
    if hit and hit[1] <= start and time.monotonic() - hit[0] < CACHE_TTL_S:
        return hit[2]

    closes: Dict[date, float] = {}
    cursor = int(datetime(start.year, start.month, start.day, tzinfo=timezone.utc).timestamp() * 1000)
    now_ms = int(time.time() * 1000)
    while cursor <= now_ms:
        rows = _binance_get("/api/v3/klines", {"symbol": symbol, "interval": "1d", "startTime": cursor, "limit": 1000}, timeout=10)
        if not rows:
            break
        for r in rows:
            closes[datetime.fromtimestamp(r[0] / 1000, timezone.utc).date()] = float(r[4])
        if len(rows) < 1000:
            break
        cursor = rows[-1][0] + DAY_MS

    with _cache_lock:
        _series_cache[key] = (time.monotonic(), start, closes)
    return closes


def _fiat_closes(asset: str, start: date) -> Optional[Dict[date, float]]:
    """Daily closes of `asset` in FIAT_CURRENCY, converting through the quote's own rate if needed."""
    fiat = FIAT_CURRENCY.upper()
    for symbol, quote in _symbol_candidates(asset):
        try:
            closes = _daily_closes(symbol, start)
        except Exception:
            # Remember pairs that don't exist, or every request would ask Binance again
            with _cache_lock:
                _series_cache[symbol] = (time.monotonic(), start, {})
            continue
        if not closes:
            continue
        if quote.upper() == fiat:
            return closes
        try:
            # EURUSDT is USDT per EUR, so divide to get EUR
            fx = _daily_closes(f"{fiat}{quote.upper()}", start)
        except Exception:
            continue
        out, last_fx = {}, None
        for d in sorted(closes):
            last_fx = fx.get(d, last_fx)
            if last_fx:
                out[d] = closes[d] / last_fx
        return out
    return None


def portfolio_history(user_id: str, range_key: str = "all") -> dict:
    trades = list(trades_col().find({"user_id": user_id}).sort("timestamp", 1))
    trades = [t for t in trades if isinstance(t.get("timestamp"), datetime)]
    if not trades:
        return {"points": [], "missing": []}

    today = datetime.now(timezone.utc).date()
    first = trades[0]["timestamp"].date()
    days = RANGES.get(range_key)
    window_start = max(first, today - timedelta(days=days)) if days else first

    assets = sorted({(t.get("base_asset") or "").upper() for t in trades if t.get("base_asset")})
    # A week of slack so the first day of the window can forward-fill from a recent close
    since = min(window_start, first) - timedelta(days=7)
    with ThreadPoolExecutor(max_workers=6) as pool:
        closes = dict(zip(assets, pool.map(lambda a: _fiat_closes(a, since), assets)))
    missing = [a for a, c in closes.items() if not c]

    by_day = defaultdict(list)
    for t in trades:
        by_day[t["timestamp"].date()].append(t)

    qty = defaultdict(float)
    cost = defaultdict(float)
    last_close: Dict[str, float] = {}
    points = []
    d = first
    while d <= today:
        for t in by_day.get(d, []):
            a = (t.get("base_asset") or "").upper()
            q = float(t.get("quantity") or 0)
            total = float(t.get("total_cost_fiat") or (float(t.get("price_fiat") or 0) * q))
            if (t.get("side") or "BUY").upper() == "BUY":
                qty[a] += q
                cost[a] += total
            else:
                # Same weighted-average basis as portfolio_summary
                avg = cost[a] / qty[a] if qty[a] > 0 else 0.0
                qty[a] -= q
                cost[a] -= avg * q
                if qty[a] <= 1e-12:
                    qty[a], cost[a] = 0.0, 0.0

        for a in assets:
            c = closes.get(a)
            if c and d in c:
                last_close[a] = c[d]

        if d >= window_start:
            value = sum(qty[a] * last_close[a] for a in assets if qty[a] > 0 and a in last_close)
            invested = sum(cost[a] for a in assets if qty[a] > 0 and a in last_close)
            points.append({"date": d.isoformat(), "value": round(value, 2), "invested": round(invested, 2)})
        d += timedelta(days=1)

    return {"points": points, "missing": missing}
