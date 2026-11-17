"""
Portfolio assistant. Claude answers questions about the user's own data by
calling a few read-only tools backed by the existing services. The model never
does the maths itself: every number comes from portfolio_summary and friends.
"""
import json
import logging
import time
from collections import defaultdict, deque
from datetime import date, datetime, timezone
from typing import Iterator, List, Optional

import anthropic

from backend.alerts_service import list_alerts
from backend.binance_client import get_asset_history, get_top_market_caps
from backend.config import ANTHROPIC_API_KEY, CHAT_EFFORT, CHAT_MODEL
from backend.portfolio_service import portfolio_summary
from backend.snapshot_service import list_snapshots
from backend.trades_service import list_trades

log = logging.getLogger("criptobalance")

MAX_TOOL_ROUNDS = 6
MAX_TRADES_RETURNED = 100

SYSTEM_PROMPT = """Eres el asistente de CriptoBalance, una app donde el usuario registra sus compras y ventas de criptomonedas en euros y sigue su cartera con precios de Binance.

Responde preguntas sobre la cartera, las operaciones, las alertas y los snapshots del usuario, y sobre precios de mercado. Para cualquier dato concreto usa las herramientas; no inventes cifras ni las calcules de memoria si una herramienta ya las da. Si una herramienta no devuelve lo que hace falta, dilo.

Cómo funcionan los datos:
- Los importes están en EUR. El PnL no realizado sale del precio actual; el realizado, de las ventas, con coste medio ponderado.
- Las operaciones tienen lado BUY o SELL, cantidad, precio unitario y coste total.
- Solo puedes leer. Si te piden registrar, borrar o cambiar algo, explica que se hace desde la app (botón «Nueva operación», pestaña Operaciones o Alertas).
- Para registrar operaciones desde una captura de pantalla, el usuario puede adjuntarla con el clip de este panel o pegarla: la app lee las operaciones y le deja revisarlas antes de guardarlas. Tú no ves las imágenes en esta conversación.

Estilo: español, frases cortas, directo al dato. Formatea los euros como 1.234,56 €. Usa listas solo si hay varias posiciones que comparar. No des recomendaciones de compra o venta ni predicciones de precio; si te las piden, ofrece los datos que ayudan a decidir y recuerda que no es asesoramiento financiero. No respondas a temas que no tengan que ver con criptomonedas o con la cartera."""

TOOLS = [
    {
        "name": "get_portfolio",
        "description": "Resumen actual de la cartera: posiciones abiertas con cantidad, precio medio, precio y valor actuales, coste y PnL (EUR y %), totales de PnL realizado y no realizado, y los mejores y peores activos.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_trades",
        "description": "Operaciones registradas por el usuario, de la más antigua a la más reciente. Se pueden filtrar por activo, lado y rango de fechas.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Ticker del activo, por ejemplo BTC"},
                "side": {"type": "string", "enum": ["BUY", "SELL"]},
                "date_from": {"type": "string", "description": "Fecha inicial YYYY-MM-DD, incluida"},
                "date_to": {"type": "string", "description": "Fecha final YYYY-MM-DD, incluida"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "get_price_history",
        "description": "Velas históricas de Binance para un activo (cierre, máximo, mínimo). Útil para ver cómo ha ido el precio en un periodo.",
        "input_schema": {
            "type": "object",
            "properties": {
                "symbol": {"type": "string", "description": "Ticker del activo, por ejemplo ETH"},
                "interval": {"type": "string", "enum": ["1h", "4h", "1d", "1w"]},
                "limit": {"type": "integer", "minimum": 1, "maximum": 365, "description": "Número de velas"},
            },
            "required": ["symbol"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_market_top",
        "description": "Las mayores criptomonedas por capitalización, con precio en EUR y variación en 24 h.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 50}},
            "additionalProperties": False,
        },
    },
    {
        "name": "list_alerts",
        "description": "Alertas de precio o de PnL% que el usuario tiene configuradas.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "list_snapshots",
        "description": "Fotos guardadas del valor total y el PnL de la cartera en fechas pasadas, de la más reciente a la más antigua. Sirven para ver cómo ha evolucionado.",
        "input_schema": {
            "type": "object",
            "properties": {"limit": {"type": "integer", "minimum": 1, "maximum": 100}},
            "additionalProperties": False,
        },
    },
]
for _tool in TOOLS:
    # Inputs stream as they're generated; we validate them ourselves before running anything
    _tool["eager_input_streaming"] = True


class ChatLimiter:
    """Caps how many questions each user can ask per day. In memory, one instance."""

    def __init__(self, per_day: int):
        self.per_day = per_day
        self._hits = defaultdict(deque)

    def allow(self, user_id: str) -> bool:
        q = self._hits[user_id]
        cutoff = time.monotonic() - 86400
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= self.per_day:
            return False
        q.append(time.monotonic())
        return True


class ToolInputError(ValueError):
    pass


def _to_json(value) -> str:
    def default(o):
        if isinstance(o, (datetime, date)):
            return o.isoformat()
        return str(o)

    return json.dumps(value, default=default, ensure_ascii=False)


def _str_arg(args: dict, key: str, max_len: int = 20) -> Optional[str]:
    val = args.get(key)
    if val is None:
        return None
    if not isinstance(val, str) or not val.strip() or len(val) > max_len:
        raise ToolInputError(f"'{key}' no es válido")
    return val.strip()


def _int_arg(args: dict, key: str, default: int, lo: int, hi: int) -> int:
    val = args.get(key, default)
    if isinstance(val, bool) or not isinstance(val, int):
        raise ToolInputError(f"'{key}' tiene que ser un número entero")
    return max(lo, min(hi, val))


def _date_arg(args: dict, key: str) -> Optional[date]:
    val = _str_arg(args, key, max_len=10)
    if val is None:
        return None
    try:
        return date.fromisoformat(val)
    except ValueError:
        raise ToolInputError(f"'{key}' tiene que ir como YYYY-MM-DD")


def _trades_tool(user_id: str, args: dict) -> dict:
    symbol = _str_arg(args, "symbol")
    side = _str_arg(args, "side")
    if side and side.upper() not in ("BUY", "SELL"):
        raise ToolInputError("'side' tiene que ser BUY o SELL")
    date_from, date_to = _date_arg(args, "date_from"), _date_arg(args, "date_to")

    rows = []
    for t in list_trades(user_id):
        base = t.get("base_asset") or ""
        ts = t.get("timestamp")
        day = ts.date() if isinstance(ts, datetime) else None
        if symbol and base.upper() != symbol.upper():
            continue
        if side and (t.get("side") or "BUY").upper() != side.upper():
            continue
        if date_from and (day is None or day < date_from):
            continue
        if date_to and (day is None or day > date_to):
            continue
        rows.append(
            {
                "date": ts,
                "asset": base,
                "side": t.get("side", "BUY"),
                "quantity": t.get("quantity"),
                "price_eur": t.get("price_fiat"),
                "total_eur": t.get("total_cost_fiat"),
            }
        )

    # Keep the most recent ones if there are too many, the model only needs a sample then
    truncated = len(rows) > MAX_TRADES_RETURNED
    return {"count": len(rows), "truncated": truncated, "trades": rows[-MAX_TRADES_RETURNED:]}


def _history_tool(args: dict) -> dict:
    symbol = _str_arg(args, "symbol")
    if not symbol:
        raise ToolInputError("Falta 'symbol'")
    interval = _str_arg(args, "interval") or "1d"
    if interval not in ("1h", "4h", "1d", "1w"):
        raise ToolInputError("'interval' tiene que ser 1h, 4h, 1d o 1w")
    limit = _int_arg(args, "limit", 30, 1, 365)
    candles = get_asset_history(symbol, interval=interval, limit=limit)
    return {
        "symbol": symbol.upper(),
        "interval": interval,
        "quote": candles[0]["quote_asset"] if candles else None,
        "candles": [
            {"time": datetime.fromtimestamp(c["open_time"] / 1000, timezone.utc), "close": c["close"], "high": c["high"], "low": c["low"]}
            for c in candles
        ],
    }


def run_tool(user_id: str, name: str, args) -> str:
    """Runs one tool for this user. user_id comes from the session, never from the model."""
    if not isinstance(args, dict):
        raise ToolInputError("Los argumentos no son un objeto JSON")
    if name == "get_portfolio":
        return _to_json(portfolio_summary(user_id))
    if name == "list_trades":
        return _to_json(_trades_tool(user_id, args))
    if name == "get_price_history":
        return _to_json(_history_tool(args))
    if name == "get_market_top":
        return _to_json(get_top_market_caps(_int_arg(args, "limit", 10, 1, 50)))
    if name == "list_alerts":
        return _to_json([{k: v for k, v in a.items() if k not in ("_id", "user_id")} for a in list_alerts(user_id)])
    if name == "list_snapshots":
        snaps = list_snapshots(user_id, _int_arg(args, "limit", 20, 1, 100))
        return _to_json([{"date": s.get("timestamp"), "totals": s.get("totals")} for s in snaps])
    raise ToolInputError(f"Herramienta desconocida: {name}")


_client: Optional[anthropic.Anthropic] = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return _client


def chat_enabled() -> bool:
    return bool(ANTHROPIC_API_KEY)


def _event(kind: str, **data) -> str:
    return json.dumps({"type": kind, **data}, ensure_ascii=False) + "\n"


def stream_answer(user_id: str, history: List[dict]) -> Iterator[str]:
    """
    Runs the tool loop and yields NDJSON lines for the browser:
    {"type":"text","text":...}, {"type":"tool","name":...}, {"type":"error","message":...}, {"type":"done"}
    history is plain text turns from the client: [{"role": "user"|"assistant", "content": str}, ...]
    """
    client = get_client()
    messages: list = [{"role": m["role"], "content": m["content"]} for m in history]
    system = [
        # Static part first so it can be cached; the date changes daily so it goes after
        {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": f"Hoy es {date.today().isoformat()}."},
    ]

    try:
        for _ in range(MAX_TOOL_ROUNDS):
            with client.messages.stream(
                model=CHAT_MODEL,
                max_tokens=4096,
                system=system,
                tools=TOOLS,
                messages=messages,
                output_config={"effort": CHAT_EFFORT},
            ) as stream:
                for ev in stream:
                    if ev.type == "text":
                        yield _event("text", text=ev.text)
                response = stream.get_final_message()

            if response.stop_reason == "refusal":
                yield _event("error", message="No puedo ayudarte con esa pregunta. Prueba a formularla de otra forma.")
                break

            tool_uses = [b for b in response.content if b.type == "tool_use"]
            if not tool_uses:
                break
            if response.stop_reason == "max_tokens":
                yield _event("error", message="La respuesta se ha cortado. Prueba con una pregunta más concreta.")
                break

            # Keep the full assistant turn (thinking blocks included) so the next round stays valid
            messages.append({"role": "assistant", "content": response.content})
            results = []
            for block in tool_uses:
                yield _event("tool", name=block.name)
                try:
                    content, is_error = run_tool(user_id, block.name, block.input), False
                except ToolInputError as exc:
                    content, is_error = f"Error en los argumentos: {exc}", True
                except Exception as exc:
                    log.warning("chat tool %s failed: %s", block.name, exc)
                    content, is_error = "Error al obtener los datos (Binance o la base de datos no respondieron).", True
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": content, "is_error": is_error})
            messages.append({"role": "user", "content": results})
        else:
            yield _event("error", message="La pregunta necesitaba demasiados pasos. Prueba a dividirla.")
    except ValueError:
        # The SDK couldn't parse a streamed tool input at all
        yield _event("error", message="Algo ha fallado al preparar la respuesta. Vuelve a intentarlo.")
    except anthropic.RateLimitError:
        yield _event("error", message="El asistente está saturado ahora mismo. Inténtalo en un minuto.")
    except anthropic.APIConnectionError:
        yield _event("error", message="No se pudo conectar con el asistente.")
    except anthropic.APIStatusError as exc:
        log.error("chat API error %s: %s", exc.status_code, exc.message)
        yield _event("error", message="El asistente no está disponible ahora mismo.")

    yield _event("done")
