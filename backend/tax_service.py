"""
Yearly capital gains report for the Spanish income tax (IRPF, common regime).

Hacienda treats units of the same coin as interchangeable and matches each sale
against the oldest units still held (FIFO), whatever the app shows as average
cost. Gains and losses go to the "base del ahorro", taxed by brackets.
This is an estimate to prepare the return, not tax advice.
"""
import csv
import io
from collections import defaultdict, deque
from datetime import datetime
from typing import List, Optional

from backend.db import trades_col

# State scale of the savings base. (upper limit of the bracket, rate)
_SCALE_2021 = [(6_000, 0.19), (50_000, 0.21), (200_000, 0.23), (None, 0.26)]
_SCALE_2023 = [(6_000, 0.19), (50_000, 0.21), (200_000, 0.23), (300_000, 0.27), (None, 0.28)]
_SCALE_2025 = [(6_000, 0.19), (50_000, 0.21), (200_000, 0.23), (300_000, 0.27), (None, 0.30)]

EPS = 1e-9


def savings_scale(year: int):
    if year >= 2025:
        return _SCALE_2025
    if year >= 2023:
        return _SCALE_2023
    return _SCALE_2021


def estimate_tax(net_gain: float, year: int) -> dict:
    """Tax on a positive net gain, bracket by bracket, assuming no other savings income."""
    brackets, remaining, lower, total = [], max(net_gain, 0.0), 0.0, 0.0
    for upper, rate in savings_scale(year):
        if remaining <= 0:
            break
        width = remaining if upper is None else min(remaining, upper - lower)
        tax = width * rate
        brackets.append({"from": lower, "to": upper, "rate": rate, "base": round(width, 2), "tax": round(tax, 2)})
        total += tax
        remaining -= width
        lower = upper or lower
    return {
        "brackets": brackets,
        "total": round(total, 2),
        "effective_rate": round(total / net_gain, 4) if net_gain > 0 else 0.0,
    }


def _cost(t: dict) -> float:
    q = float(t.get("quantity") or 0)
    return float(t.get("total_cost_fiat") or (float(t.get("price_fiat") or 0) * q) or 0)


def tax_report(user_id: str, year: Optional[int] = None) -> dict:
    trades = [t for t in trades_col().find({"user_id": user_id}).sort("timestamp", 1) if isinstance(t.get("timestamp"), datetime)]
    years = sorted({t["timestamp"].year for t in trades if (t.get("side") or "BUY").upper() == "SELL"}, reverse=True)
    if year is None:
        year = years[0] if years else datetime.utcnow().year

    lots = defaultdict(deque)  # asset -> [qty, unit cost, date], oldest first
    sales: List[dict] = []
    warnings = []

    for t in trades:
        asset = (t.get("base_asset") or "").upper()
        qty = float(t.get("quantity") or 0)
        if qty <= 0 or not asset:
            continue
        if (t.get("side") or "BUY").upper() == "BUY":
            lots[asset].append([qty, _cost(t) / qty, t["timestamp"]])
            continue

        # A sale: take the oldest units first
        left, cost, used = qty, 0.0, []
        while left > EPS and lots[asset]:
            lot = lots[asset][0]
            take = min(left, lot[0])
            cost += take * lot[1]
            used.append({"date": lot[2].isoformat(), "quantity": take, "unit_cost": lot[1], "cost": round(take * lot[1], 2)})
            lot[0] -= take
            left -= take
            if lot[0] <= EPS:
                lots[asset].popleft()

        if t["timestamp"].year != year:
            continue
        proceeds = _cost(t)
        sale = {
            "date": t["timestamp"].isoformat(),
            "asset": asset,
            "quantity": qty,
            "proceeds": round(proceeds, 2),
            "cost": round(cost, 2),
            "gain": round(proceeds - cost, 2),
            "lots": used,
            "unmatched": round(left, 10) if left > EPS else 0,
        }
        if sale["unmatched"]:
            warnings.append(
                f"La venta de {asset} del {t['timestamp']:%d/%m/%Y} es mayor que las compras registradas antes ({sale['unmatched']:g} sin compra). "
                "Esa parte cuenta con coste 0: registra la compra que falta."
            )
        sales.append(sale)

    by_asset = defaultdict(lambda: {"proceeds": 0.0, "cost": 0.0, "gains": 0.0, "losses": 0.0})
    for s in sales:
        a = by_asset[s["asset"]]
        a["proceeds"] += s["proceeds"]
        a["cost"] += s["cost"]
        if s["gain"] >= 0:
            a["gains"] += s["gain"]
        else:
            a["losses"] += -s["gain"]

    gains = sum(a["gains"] for a in by_asset.values())
    losses = sum(a["losses"] for a in by_asset.values())
    net = gains - losses
    return {
        "year": year,
        "years": years,
        "sales": sales,
        "by_asset": [
            {"asset": k, **{f: round(v, 2) for f, v in a.items()}, "net": round(a["gains"] - a["losses"], 2)} for k, a in sorted(by_asset.items())
        ],
        "totals": {
            "proceeds": round(sum(s["proceeds"] for s in sales), 2),
            "cost": round(sum(s["cost"] for s in sales), 2),
            "gains": round(gains, 2),
            "losses": round(losses, 2),
            "net": round(net, 2),
        },
        "tax": estimate_tax(net, year),
        "warnings": warnings,
    }


def _es(n: float, decimals: int = 2) -> str:
    """Spanish decimal comma, which is what Excel expects here."""
    return f"{n:.{decimals}f}".replace(".", ",")


def _es_qty(n: float) -> str:
    return f"{n:.10f}".rstrip("0").rstrip(".").replace(".", ",")


def tax_report_csv(user_id: str, year: int) -> str:
    report = tax_report(user_id, year)
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow(["fecha_venta", "activo", "cantidad", "valor_transmision_eur", "valor_adquisicion_eur", "ganancia_perdida_eur", "compras_fifo"])
    for s in report["sales"]:
        lots = " | ".join(f"{l['date'][:10]}: {_es_qty(l['quantity'])} a {_es(l['unit_cost'])}" for l in s["lots"])
        w.writerow([s["date"][:10], s["asset"], _es_qty(s["quantity"]), _es(s["proceeds"]), _es(s["cost"]), _es(s["gain"]), lots])
    t = report["totals"]
    w.writerow([])
    w.writerow(["total", "", "", _es(t["proceeds"]), _es(t["cost"]), _es(t["net"]), ""])
    # Excel in Spain expects ";" and opens UTF-8 properly only with a BOM
    return "﻿" + out.getvalue()
