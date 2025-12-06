from datetime import datetime
from typing import Optional
from bson import ObjectId
from db import trades_col
from binance_client import get_price_for_asset
from config import DEFAULT_QUOTE_ASSET, FIAT_RATE, FIAT_CURRENCY


def register_trade(base_symbol: str, quantity: float, price_fiat: float, total_cost_fiat: Optional[float] = None, timestamp=None):
    """
    Registra una compra de criptomoneda (precio y coste en EUR).
    """
    timestamp = timestamp or datetime.utcnow()

    base_symbol = base_symbol.upper()
    total_cost_fiat = total_cost_fiat if total_cost_fiat is not None else quantity * price_fiat
    price_quote = price_fiat / FIAT_RATE
    total_cost_quote = total_cost_fiat / FIAT_RATE

    trade = {
        "symbol": f"{base_symbol}{DEFAULT_QUOTE_ASSET}",
        "base_asset": base_symbol,
        "quote_asset": DEFAULT_QUOTE_ASSET,
        "side": "BUY",
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


def list_trades():
    return list(trades_col().find())


def get_trade(trade_id: str) -> Optional[dict]:
    try:
        oid = ObjectId(trade_id)
    except Exception as exc:
        raise ValueError("ID de operación no válido") from exc
    return trades_col().find_one({"_id": oid})


def delete_trade(trade_id: str) -> bool:
    """
    Elimina una operación por su _id. Devuelve True si se borró una.
    """
    try:
        oid = ObjectId(trade_id)
    except Exception as exc:
        raise ValueError("ID de operación no válido") from exc
    res = trades_col().delete_one({"_id": oid})
    return res.deleted_count > 0


def enrich_trade_with_market(trade: dict) -> dict:
    """
    Devuelve el trade con datos de precio actual y PnL en moneda fiat.
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


def list_trades_with_market():
    return [enrich_trade_with_market(t) for t in list_trades()]


def to_public_trade(trade: dict) -> dict:
    """
    Convierte _id a str para respuestas JSON.
    """
    if not trade:
        return trade
    trade = {**trade}
    if "_id" in trade:
        trade["_id"] = str(trade["_id"])
    return trade
