"""
Reads trades out of a screenshot (an exchange's order history, a bank app...).
Nothing is saved here: the browser shows what was found, the user fixes or
drops rows, and only then each one goes through POST /trades like any other.
"""
import base64
import json
import logging
from datetime import datetime
from typing import Optional

import anthropic

from backend.chat_service import get_client
from backend.binance_client import get_fiat_rate
from backend.config import CHAT_MODEL, FIAT_CURRENCY
from backend.trades_service import list_trades

log = logging.getLogger("criptobalance")

MAX_IMAGE_BYTES = 5 * 1024 * 1024
IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif"}
# Quotes we can turn into EUR with the app's own rate. Anything else (BTC pairs, GBP...) needs a human.
DOLLAR_LIKE = {"USD", "USDT", "USDC", "BUSD", "FDUSD"}

PROMPT = f"""Esta imagen es una captura de un historial de operaciones de criptomonedas (un exchange, un banco o una app). Extrae cada compra o venta ejecutada que se vea.

Reglas:
- asset: el ticker de la cripto comprada o vendida (BTC, ETH...). En un par como ETH/USDT es ETH.
- side: BUY si se compra la cripto, SELL si se vende.
- quantity: cantidad de la cripto. Respeta los decimales tal como aparecen; fíjate en si la captura usa coma o punto como separador decimal.
- price: precio unitario en la moneda de cotización. total: importe total pagado o recibido, sin comisiones si se distinguen.
- currency: la moneda de price y total (EUR, USDT, USD...).
- date: fecha y hora en formato YYYY-MM-DDTHH:MM si se ven; si solo hay fecha, YYYY-MM-DDT12:00. null si no aparece.
- Usa null en cualquier campo que no se vea con claridad. No inventes valores ni los deduzcas de otros salvo el total o el precio cuando la otra cifra y la cantidad estén claras.
- Ignora órdenes canceladas, pendientes o no ejecutadas, depósitos, retiradas y transferencias.
- En notes escribe en español, en una frase, cualquier cosa que el usuario deba revisar (cifras dudosas, filas cortadas, comisiones). Cadena vacía si no hay nada.
- Si la imagen no contiene operaciones, devuelve trades vacío y explícalo en notes.

La app trabaja en {FIAT_CURRENCY}."""

NUM_OR_NULL = {"type": ["number", "null"]}
SCHEMA = {
    "type": "object",
    "properties": {
        "trades": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "asset": {"type": "string"},
                    "side": {"type": "string", "enum": ["BUY", "SELL"]},
                    "quantity": NUM_OR_NULL,
                    "price": NUM_OR_NULL,
                    "total": NUM_OR_NULL,
                    "currency": {"type": ["string", "null"]},
                    "date": {"type": ["string", "null"]},
                },
                "required": ["asset", "side", "quantity", "price", "total", "currency", "date"],
                "additionalProperties": False,
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["trades", "notes"],
    "additionalProperties": False,
}


class ExtractionError(Exception):
    pass


def _positive(v) -> Optional[float]:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f > 0 else None


def _parse_date(v) -> Optional[str]:
    if not isinstance(v, str):
        return None
    try:
        dt = datetime.fromisoformat(v.strip()[:16])
    except ValueError:
        return None
    # A date in the future is a misread
    if dt > datetime.utcnow():
        return None
    return dt.strftime("%Y-%m-%dT%H:%M")


def _is_duplicate(row: dict, existing: list) -> bool:
    for t in existing:
        if (t.get("base_asset") or "").upper() != row["asset"] or (t.get("side") or "BUY").upper() != row["side"]:
            continue
        qty = float(t.get("quantity") or 0)
        if not row["quantity"] or abs(qty - row["quantity"]) > max(1e-9, row["quantity"] * 1e-6):
            continue
        ts = t.get("timestamp")
        # Same coin, side and amount: a duplicate unless both dates are known and differ
        if row["date"] and isinstance(ts, datetime) and ts.strftime("%Y-%m-%d") != row["date"][:10]:
            continue
        return True
    return False


def _clean(raw: dict, existing: list) -> dict:
    rows = []
    for t in raw.get("trades") or []:
        asset = (t.get("asset") or "").strip().upper()[:20]
        if not asset:
            continue
        row = {
            "asset": asset,
            "side": t.get("side") if t.get("side") in ("BUY", "SELL") else "BUY",
            "quantity": _positive(t.get("quantity")),
            "price": _positive(t.get("price")),
            "total": _positive(t.get("total")),
            "date": _parse_date(t.get("date")),
            "flags": [],
        }
        if row["price"] is None and row["total"] and row["quantity"]:
            row["price"] = row["total"] / row["quantity"]
        if row["total"] is None and row["price"] and row["quantity"]:
            row["total"] = row["price"] * row["quantity"]

        currency = (t.get("currency") or FIAT_CURRENCY).strip().upper()
        if currency in DOLLAR_LIKE and currency != FIAT_CURRENCY:
            # Use the rate of the trade's own day when we know it
            when = datetime.fromisoformat(row["date"]) if row["date"] else None
            rate = get_fiat_rate(currency, when)
            row["price"] = row["price"] * rate if row["price"] else None
            row["total"] = row["total"] * rate if row["total"] else None
            row["flags"].append(f"converted:{currency}")
        elif currency != FIAT_CURRENCY:
            # e.g. ETH bought with BTC: we can't price it in EUR on our own
            row["price"] = row["total"] = None
            row["flags"].append(f"unsupported:{currency}")

        if not (row["quantity"] and row["price"]):
            row["flags"].append("incomplete")
        if _is_duplicate(row, existing):
            row["flags"].append("duplicate")
        rows.append(row)
    return {"trades": rows, "notes": (raw.get("notes") or "").strip()[:300]}


def extract_trades(user_id: str, image: bytes, media_type: str) -> dict:
    response = get_client().messages.create(
        model=CHAT_MODEL,
        max_tokens=8000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": base64.standard_b64encode(image).decode()},
                    },
                    {"type": "text", "text": PROMPT},
                ],
            }
        ],
        output_config={"effort": "medium", "format": {"type": "json_schema", "schema": SCHEMA}},
    )
    if response.stop_reason == "refusal":
        raise ExtractionError("No he podido procesar esa imagen.")
    if response.stop_reason == "max_tokens":
        raise ExtractionError("La captura tiene demasiadas operaciones. Recórtala en varias.")
    text = next((b.text for b in response.content if b.type == "text"), "")
    try:
        raw = json.loads(text)
    except ValueError:
        log.warning("screenshot extraction returned invalid JSON")
        raise ExtractionError("No he entendido la captura. Prueba con otra más nítida.")
    return _clean(raw, list_trades(user_id))
