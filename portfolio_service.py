from db import trades_col
from binance_client import get_price_for_asset
from config import DEFAULT_QUOTE_ASSET, FIAT_RATE, FIAT_CURRENCY


def compute_portfolio():
    """
    Calcula cantidades, precio medio y PnL actual consultando el precio en Binance.
    Todos los importes se devuelven en la moneda fiat configurada.
    """
    trades = list(trades_col().find())
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

        entry = holdings.setdefault(
            base_asset,
            {"base_asset": base_asset, "total_quantity": 0.0, "total_cost_fiat": 0.0},
        )
        entry["total_quantity"] += quantity
        entry["total_cost_fiat"] += total_cost_fiat

    portfolio = []
    for base_asset, data in sorted(holdings.items()):
        total_quantity = data["total_quantity"]
        total_cost_fiat = data["total_cost_fiat"]
        avg_price_fiat = total_cost_fiat / total_quantity if total_quantity else 0.0

        current_price_quote, quote_used = get_price_for_asset(base_asset)
        conversion_rate = 1.0 if quote_used.upper() == FIAT_CURRENCY.upper() else float(FIAT_RATE)
        current_price_fiat = current_price_quote * conversion_rate
        current_value_fiat = current_price_fiat * total_quantity
        pnl_fiat = current_value_fiat - total_cost_fiat
        pnl_pct = (pnl_fiat / total_cost_fiat * 100) if total_cost_fiat else 0.0

        portfolio.append(
            {
                "symbol": f"{base_asset}{quote_used}",
                "base_asset": base_asset,
                "total_quantity": total_quantity,
                "avg_price_fiat": avg_price_fiat,
                "current_price_fiat": current_price_fiat,
                "current_value_fiat": current_value_fiat,
                "pnl_fiat": pnl_fiat,
                "pnl_pct": pnl_pct,
                "fiat_currency": FIAT_CURRENCY,
            }
        )

    return portfolio


__all__ = ["compute_portfolio"]
