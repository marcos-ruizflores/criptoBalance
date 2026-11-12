from datetime import datetime
import io
import csv
from typing import Optional
from bson import ObjectId
from backend.db import trades_col
from backend.binance_client import get_price_for_asset
from backend.config import DEFAULT_QUOTE_ASSET, FIAT_RATE, FIAT_CURRENCY


def register_trade(
    user_id: str,
    base_symbol: str,
    quantity: float,
    price_fiat: float,
    total_cost_fiat: Optional[float] = None,
    timestamp=None,
    side: str = "BUY",
):
    """
    Records a crypto trade (BUY/SELL) in EUR.
    """
    timestamp = timestamp or datetime.utcnow()
    side = side.upper()
    base_symbol = base_symbol.upper()
    total_cost_fiat = total_cost_fiat if total_cost_fiat is not None else quantity * price_fiat
    price_quote = price_fiat / FIAT_RATE
    total_cost_quote = total_cost_fiat / FIAT_RATE

    trade = {
        "user_id": user_id,
        "symbol": f"{base_symbol}{DEFAULT_QUOTE_ASSET}",
        "base_asset": base_symbol,
        "quote_asset": DEFAULT_QUOTE_ASSET,
        "side": side,
        "quantity": float(quantity),
        "price_quote": float(price_quote),
        "price_fiat": float(price_fiat),
        "timestamp": timestamp,
        "fiat_currency": FIAT_CURRENCY,
        "fiat_rate_at_trade": float(FIAT_RATE),
        "total_cost_quote": float(total_cost_quote),
        "total_cost_fiat": float(total_cost_fiat),
    }

    result = trades_col().insert_one(trade)
    return result.inserted_id


def list_trades(user_id: str):
    return list(trades_col().find({"user_id": user_id}).sort("timestamp", 1))


def get_trade(user_id: str, trade_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(trade_id)
    except Exception:
        return None
    return trades_col().find_one({"_id": oid, "user_id": user_id})


def delete_trade(user_id: str, trade_id: str) -> bool:
    """
    Deletes one of the user's trades by _id. Returns True if one was deleted.
    """
    try:
        oid = ObjectId(trade_id)
    except Exception:
        return False
    res = trades_col().delete_one({"_id": oid, "user_id": user_id})
    return res.deleted_count > 0


def enrich_trade_with_market(trade: dict) -> dict:
    """
    Returns the trade enriched with the current price and PnL in fiat.
    """
    symbol = trade.get("symbol", "")
    base_asset = trade.get("base_asset") or symbol.removesuffix(DEFAULT_QUOTE_ASSET)
    quantity = float(trade.get("quantity", 0))
    fx_rate = float(trade.get("fiat_rate_at_trade") or FIAT_RATE)
    total_cost_fiat = float(
        trade.get("total_cost_fiat")
        or trade.get("total_cost_quote", 0) * fx_rate
        or 0
    )
    price_fiat = float(
        trade.get("price_fiat")
        or trade.get("price_quote", 0) * fx_rate
        or 0
    )
    current_price_quote, quote_used = get_price_for_asset(base_asset)
    conversion_rate = 1.0 if quote_used.upper() == FIAT_CURRENCY.upper() else float(FIAT_RATE)
    current_price_fiat = current_price_quote * conversion_rate
    current_value_fiat = current_price_fiat * quantity
    pnl_fiat = current_value_fiat - total_cost_fiat
    pnl_pct = (pnl_fiat / total_cost_fiat * 100) if total_cost_fiat else 0.0

    return {
        **trade,
        "base_asset": base_asset,
        "symbol": f"{base_asset}{quote_used}",
        "price_fiat": price_fiat,
        "total_cost_fiat": total_cost_fiat,
        "current_price_fiat": current_price_fiat,
        "current_value_fiat": current_value_fiat,
        "pnl_fiat": pnl_fiat,
        "pnl_pct": pnl_pct,
    }


def list_trades_with_market(user_id: str):
    return [enrich_trade_with_market(t) for t in list_trades(user_id)]


def to_public_trade(trade: dict) -> dict:
    """
    Turns _id into a str for JSON responses.
    """
    if not trade:
        return trade
    trade = {**trade}
    if "_id" in trade:
        trade["_id"] = str(trade["_id"])
    return trade


def export_trades_csv(user_id: str) -> str:
    """
    Exports the user's trades to CSV, in the same format the import reads.
    """
    trades = list_trades(user_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "base_symbol",
            "quantity",
            "price_fiat",
            "total_cost_fiat",
            "side",
            "timestamp",
        ]
    )
    for t in trades:
        writer.writerow(
            [
                t.get("base_asset") or t.get("symbol", "").removesuffix(DEFAULT_QUOTE_ASSET),
                t.get("quantity"),
                t.get("price_fiat") or "",
                t.get("total_cost_fiat") or "",
                t.get("side", "BUY"),
                t.get("timestamp").isoformat() if isinstance(t.get("timestamp"), datetime) else t.get("timestamp"),
            ]
        )
    return output.getvalue()


def import_trades_csv(user_id: str, csv_text: str, max_rows: int = 5000) -> int:
    """
    Imports trades from a CSV with header base_symbol, quantity, price_fiat, total_cost_fiat, side (BUY/SELL), timestamp (optional).
    Returns the number of trades created.
    """
    reader = csv.DictReader(io.StringIO(csv_text))
    created = 0
    for i, row in enumerate(reader):
        if i >= max_rows:
            break
        base_symbol = row.get("base_symbol") or row.get("symbol")
        try:
            quantity = float(row.get("quantity", 0) or 0)
            price_fiat = float(row.get("price_fiat", 0) or 0)
            total_cost_fiat_val = row.get("total_cost_fiat")
            total_cost_fiat = float(total_cost_fiat_val) if total_cost_fiat_val not in (None, "",) else None
        except ValueError:
            continue
        side_val = (row.get("side") or "BUY").upper()
        if side_val not in ("BUY", "SELL"):
            continue
        ts_val = row.get("timestamp")
        timestamp = None
        if ts_val:
            try:
                timestamp = datetime.fromisoformat(ts_val)
            except Exception:
                timestamp = None
        if not base_symbol or quantity <= 0 or price_fiat <= 0:
            continue
        register_trade(user_id, base_symbol.strip()[:20], quantity, price_fiat, total_cost_fiat, timestamp, side=side_val)
        created += 1
    return created
