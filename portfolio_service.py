from collections import defaultdict
from db import trades_col
from binance_client import get_price_for_asset
from config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY, FIAT_RATE


def _base_asset_from_trade(trade: dict) -> str:
    symbol = trade.get("symbol", "")
    return trade.get("base_asset") or symbol.removesuffix(DEFAULT_QUOTE_ASSET)


def portfolio_summary():
    """
    Resume posiciones abiertas y PnL (realizado/no realizado).
    Usa promedio ponderado para calcular el coste pendiente tras ventas.
    """
    trades = list(trades_col().find().sort("timestamp", 1))

    positions = defaultdict(lambda: {"quantity": 0.0, "cost_fiat": 0.0})
    total_realized = 0.0

    for t in trades:
        base = _base_asset_from_trade(t)
        side = (t.get("side") or "BUY").upper()
        qty = float(t.get("quantity", 0) or 0)
        cost_fiat = float(t.get("total_cost_fiat") or (t.get("price_fiat", 0) * qty) or 0)
        pos = positions[base]

        if side == "BUY":
            pos["quantity"] += qty
            pos["cost_fiat"] += cost_fiat
        else:
            sell_qty = qty
            if pos["quantity"] > 0:
                avg_cost = pos["cost_fiat"] / pos["quantity"]
            else:
                avg_cost = 0.0
            realized = cost_fiat - avg_cost * sell_qty
            total_realized += realized
            pos["quantity"] -= sell_qty
            pos["cost_fiat"] -= avg_cost * sell_qty

    items = []
    for base, pos in positions.items():
        qty = pos["quantity"]
        if qty <= 0:
            continue
        try:
            current_price_quote, quote_used = get_price_for_asset(base)
        except Exception:
            # Si Binance falla, saltamos el activo para no romper todo el resumen.
            continue
        conversion_rate = 1.0 if quote_used.upper() == FIAT_CURRENCY.upper() else float(FIAT_RATE)
        current_price_fiat = current_price_quote * conversion_rate
        current_value_fiat = current_price_fiat * qty
        total_cost_fiat = pos["cost_fiat"]
        pnl_unrealized = current_value_fiat - total_cost_fiat
        pnl_pct = (pnl_unrealized / total_cost_fiat * 100) if total_cost_fiat else 0.0
        avg_price_fiat = (total_cost_fiat / qty) if qty else 0.0

        items.append(
            {
                "base_asset": base,
                "symbol": f"{base}{quote_used}",
                "total_quantity": qty,
                "avg_price_fiat": avg_price_fiat,
                "current_price_fiat": current_price_fiat,
                "current_value_fiat": current_value_fiat,
                "total_cost_fiat": total_cost_fiat,
                "pnl_fiat": pnl_unrealized,
                "pnl_pct": pnl_pct,
            }
        )

    total_value = sum(i["current_value_fiat"] for i in items)
    total_unrealized = sum(i["pnl_fiat"] for i in items)
    totals = {
        "total_value_fiat": total_value,
        "total_pnl_fiat": total_realized + total_unrealized,
        "total_realized_pnl_fiat": total_realized,
        "total_unrealized_pnl_fiat": total_unrealized,
    }

    sorted_items = sorted(items, key=lambda i: i["pnl_pct"])
    top_gainers = list(reversed(sorted_items))[:3]
    top_losers = sorted_items[:3]

    return {
        "items": items,
        "totals": totals,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
    }


def compute_portfolio():
    """
    Devuelve solo la lista de posiciones (modo CLI).
    """
    return portfolio_summary().get("items", [])
