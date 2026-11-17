import logging
from collections import defaultdict
from backend.db import trades_col
from backend.binance_client import get_price_for_asset
from backend.config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY, FIAT_RATE

log = logging.getLogger("criptobalance")


def _base_asset_from_trade(trade: dict) -> str:
    symbol = trade.get("symbol", "")
    return trade.get("base_asset") or symbol.removesuffix(DEFAULT_QUOTE_ASSET)


def portfolio_summary(user_id: str):
    """
    Summary of open positions and PnL (realized/unrealized).
    Uses a weighted average to work out the remaining cost basis after sells.
    """
    trades = list(trades_col().find({"user_id": user_id}).sort("timestamp", 1))

    positions = defaultdict(lambda: {"quantity": 0.0, "cost_fiat": 0.0})
    total_realized = 0.0

    for t in trades:
        base = _base_asset_from_trade(t)
        side = (t.get("side") or "BUY").upper()
        qty = float(t.get("quantity", 0) or 0)
        cost_fiat = float(t.get("total_cost_fiat") or (float(t.get("price_fiat") or 0) * qty) or 0)
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
    missing_prices = []
    for base, pos in positions.items():
        qty = pos["quantity"]
        if qty <= 0:
            continue
        try:
            current_price_quote, quote_used = get_price_for_asset(base)
        except Exception as exc:
            # Keep the position (what you hold and what it cost) even without a live price
            log.warning("no price for %s: %s", base, exc)
            missing_prices.append(base)
            items.append(
                {
                    "base_asset": base,
                    "symbol": base,
                    "total_quantity": qty,
                    "avg_price_fiat": pos["cost_fiat"] / qty,
                    "current_price_fiat": None,
                    "current_value_fiat": None,
                    "total_cost_fiat": pos["cost_fiat"],
                    "pnl_fiat": None,
                    "pnl_pct": None,
                }
            )
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

    priced = [i for i in items if i["current_value_fiat"] is not None]
    total_value = sum(i["current_value_fiat"] for i in priced)
    total_unrealized = sum(i["pnl_fiat"] for i in priced)
    totals = {
        "total_value_fiat": total_value,
        "total_pnl_fiat": total_realized + total_unrealized,
        "total_realized_pnl_fiat": total_realized,
        "total_unrealized_pnl_fiat": total_unrealized,
    }

    sorted_items = sorted(priced, key=lambda i: i["pnl_pct"])
    top_gainers = list(reversed(sorted_items))[:3]
    top_losers = sorted_items[:3]

    return {
        "items": items,
        "totals": totals,
        "top_gainers": top_gainers,
        "top_losers": top_losers,
        "missing_prices": missing_prices,
    }


def compute_portfolio(user_id: str):
    """
    Just the list of positions (CLI mode).
    """
    return portfolio_summary(user_id).get("items", [])
