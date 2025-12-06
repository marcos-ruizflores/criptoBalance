from db import trades_col
from binance_client import get_price_for_asset
from config import DEFAULT_QUOTE_ASSET, FIAT_RATE, FIAT_CURRENCY


def compute_portfolio():
    """
    Calcula posiciones por activo con PnL realizado y no realizado.
    Todos los importes en la moneda fiat configurada.
    """
    trades = list(trades_col().find().sort("timestamp", 1))
    if not trades:
        return []

    holdings = {}
    for trade in trades:
        symbol = trade.get("symbol", "")
        base_asset = trade.get("base_asset") or symbol.removesuffix(DEFAULT_QUOTE_ASSET)
        if not base_asset:
            continue

        quantity = float(trade.get("quantity", 0))
        if quantity <= 0:
            continue

        fx_rate_at_trade = float(trade.get("fiat_rate_at_trade") or FIAT_RATE)
        total_cost_fiat = float(
            trade.get("total_cost_fiat")
            or trade.get("total_cost_quote", 0) * fx_rate_at_trade
            or 0
        )
        side = trade.get("side", "BUY").upper()

        entry = holdings.setdefault(
            base_asset,
            {
                "base_asset": base_asset,
                "quantity": 0.0,
                "cost_basis_fiat": 0.0,
                "realized_pnl_fiat": 0.0,
                "total_buys_fiat": 0.0,
                "total_sells_fiat": 0.0,
            },
        )
        if side == "BUY":
            entry["total_buys_fiat"] += total_cost_fiat
            entry["cost_basis_fiat"] += total_cost_fiat
            entry["quantity"] += quantity
        elif side == "SELL":
            entry["total_sells_fiat"] += total_cost_fiat
            qty_to_sell = min(quantity, entry["quantity"])
            avg_cost = entry["cost_basis_fiat"] / entry["quantity"] if entry["quantity"] > 0 else 0
            entry["realized_pnl_fiat"] += (trade.get("price_fiat", 0) - avg_cost) * qty_to_sell
            entry["cost_basis_fiat"] -= avg_cost * qty_to_sell
            entry["quantity"] -= qty_to_sell
        else:
            continue

    portfolio = []
    for base_asset, data in sorted(holdings.items()):
        total_quantity = data["quantity"]
        cost_basis_fiat = data["cost_basis_fiat"]
        realized_pnl_fiat = data["realized_pnl_fiat"]
        total_buys_fiat = data["total_buys_fiat"]

        avg_price_fiat = cost_basis_fiat / total_quantity if total_quantity else 0.0

        current_price_quote, quote_used = get_price_for_asset(base_asset)
        conversion_rate = 1.0 if quote_used.upper() == FIAT_CURRENCY.upper() else float(FIAT_RATE)
        current_price_fiat = current_price_quote * conversion_rate
        current_value_fiat = current_price_fiat * total_quantity
        unrealized_pnl_fiat = current_value_fiat - cost_basis_fiat
        total_pnl_fiat = realized_pnl_fiat + unrealized_pnl_fiat
        pnl_pct = (total_pnl_fiat / total_buys_fiat * 100) if total_buys_fiat else 0.0

        portfolio.append(
            {
                "symbol": f"{base_asset}{quote_used}",
                "base_asset": base_asset,
                "total_quantity": total_quantity,
                "avg_price_fiat": avg_price_fiat,
                "current_price_fiat": current_price_fiat,
                "current_value_fiat": current_value_fiat,
                "unrealized_pnl_fiat": unrealized_pnl_fiat,
                "realized_pnl_fiat": realized_pnl_fiat,
                "pnl_fiat": total_pnl_fiat,
                "pnl_pct": pnl_pct,
                "fiat_currency": FIAT_CURRENCY,
            }
        )

    return portfolio


def portfolio_summary():
    items = compute_portfolio()
    totals = {
        "total_value_fiat": sum(i["current_value_fiat"] for i in items),
        "total_unrealized_pnl_fiat": sum(i["unrealized_pnl_fiat"] for i in items),
        "total_realized_pnl_fiat": sum(i["realized_pnl_fiat"] for i in items),
        "total_pnl_fiat": sum(i["pnl_fiat"] for i in items),
    }
    top_gainers = sorted(items, key=lambda x: x["pnl_pct"], reverse=True)[:3]
    top_losers = sorted(items, key=lambda x: x["pnl_pct"])[:3]
    return {"items": items, "totals": totals, "top_gainers": top_gainers, "top_losers": top_losers}


__all__ = ["compute_portfolio", "portfolio_summary"]
