import logging
import time
from datetime import datetime, timezone
from threading import Lock
from typing import Optional

import requests
from backend.config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY, FIAT_RATE

log = logging.getLogger("criptobalance")

# data-api.binance.vision is Binance's public market-data host, meant for servers.
# api.binance.com refuses requests from many cloud IPs (Render's included), so it's
# only the fallback.
BINANCE_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"]

# Prices are reused for a short while: a page load asks for the same coins many times
# (once per trade plus the portfolio), and Binance rate-limits bursts.
PRICE_TTL_S = 20
_price_cache = {}
_price_lock = Lock()


# Stablecoins and plain dollars all count as USDT for the exchange rate
_DOLLARS = {"USD": "USDT", "BUSD": "USDT", "FDUSD": "USDT"}
FX_TTL_S = 300
_fx_cache = {}


def _day_close(symbol: str, when: datetime) -> float:
    day = when.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=timezone.utc)
    rows = _binance_get("/api/v3/klines", {"symbol": symbol, "interval": "1d", "startTime": int(day.timestamp() * 1000), "limit": 1})
    if not rows:
        raise ValueError(f"No hay datos de {symbol} para {day.date()}")
    return float(rows[0][4])


def get_fiat_rate(quote: str, when: Optional[datetime] = None) -> float:
    """
    How many FIAT_CURRENCY you get for 1 unit of `quote` (USDT -> about 0.92 EUR),
    now or on the day of `when`. Never raises: falls back to FIAT_RATE from the config.
    """
    quote = _DOLLARS.get(quote.upper(), quote.upper())
    fiat = FIAT_CURRENCY.upper()
    if quote == fiat:
        return 1.0
    if when is not None and when.date() >= datetime.utcnow().date():
        when = None
    key = (quote, when.date() if when else None)
    with _price_lock:
        hit = _fx_cache.get(key)
    # Past days never change, today's rate is refreshed every few minutes
    if hit and (when is not None or time.monotonic() - hit[0] < FX_TTL_S):
        return hit[1]

    rate = None
    for symbol, invert in ((f"{fiat}{quote}", True), (f"{quote}{fiat}", False)):
        try:
            if when is None:
                raw = float(_binance_get("/api/v3/ticker/price", {"symbol": symbol})["price"])
            else:
                raw = _day_close(symbol, when)
            rate = 1 / raw if invert else raw
            break
        except Exception as exc:
            last_error = exc
    if rate is None:
        log.warning("no %s/%s rate, using FIAT_RATE=%s: %s", quote, fiat, FIAT_RATE, last_error)
        return float(FIAT_RATE)
    with _price_lock:
        _fx_cache[key] = (time.monotonic(), rate)
    return rate


def to_fiat(amount: float, quote: str, when: Optional[datetime] = None) -> float:
    return amount * get_fiat_rate(quote, when)


def _binance_get(path: str, params: dict, timeout: float = 8):
    """GET against Binance, moving to the next host if one is blocked or down."""
    last_error = None
    for host in BINANCE_HOSTS:
        try:
            res = requests.get(f"{host}{path}", params=params, timeout=timeout)
        except requests.RequestException as exc:
            last_error = exc
            continue
        # 400 means the pair doesn't exist: the other host would say the same
        if res.ok or res.status_code == 400:
            res.raise_for_status()
            return res.json()
        last_error = requests.HTTPError(f"{res.status_code} from {host}", response=res)
    raise last_error


def get_spot_price(symbol: str) -> float:
    """
    Current price of a Binance spot symbol.
    Example: 'BTCUSDT'
    """
    return float(_binance_get("/api/v3/ticker/price", {"symbol": symbol})["price"])


def _symbol_candidates(base_asset: str):
    """
    Candidate trading pairs for an asset, DEFAULT_QUOTE_ASSET first.
    """
    base = base_asset.upper()
    # Prefer the fiat (EUR) pair so we always use BTCEUR, ETHEUR, etc.
    quotes = [
        FIAT_CURRENCY.upper(),
        DEFAULT_QUOTE_ASSET.upper(),
        "EUR",
        "USDT",
        "BUSD",
        "USDC",
    ]
    seen = set()
    for q in quotes:
        if not q or base == q:
            continue
        symbol = f"{base}{q}"
        if symbol in seen:
            continue
        seen.add(symbol)
        yield symbol, q


def get_price_for_asset(base_asset: str):
    """
    Returns (price, quote) for an asset (e.g. BTC -> (BTC/USDT price, 'USDT')).
    Tries a few common pairs until one works. Results are cached for PRICE_TTL_S.
    """
    key = base_asset.upper()
    with _price_lock:
        hit = _price_cache.get(key)
    if hit and time.monotonic() - hit[0] < PRICE_TTL_S:
        return hit[1]
    result = _fetch_price_for_asset(key)
    with _price_lock:
        _price_cache[key] = (time.monotonic(), result)
    return result


def _fetch_price_for_asset(base_asset: str):
    last_error = None
    for symbol, quote in _symbol_candidates(base_asset):
        try:
            price = get_spot_price(symbol)
            return price, quote
        except Exception as exc:  # pragma: no cover - fallback silencioso
            last_error = exc
            continue
    raise ValueError(f"No se encontró precio para {base_asset}: {last_error}")


def get_asset_history(base_asset: str, interval: str = "1d", limit: int = 90):
    """
    Fetches historical candles for an asset.
    Returns a list of dicts with open, high, low, close and the quote_asset used.
    """
    last_error = None
    for symbol, quote in _symbol_candidates(base_asset):
        try:
            data = _binance_get("/api/v3/klines", {"symbol": symbol, "interval": interval, "limit": limit}, timeout=10)
            return [
                {
                    "open_time": c[0],
                    "open": float(c[1]),
                    "high": float(c[2]),
                    "low": float(c[3]),
                    "close": float(c[4]),
                    "volume": float(c[5]),
                    "close_time": c[6],
                    "quote_asset": quote,
                }
                for c in data
            ]
        except Exception as exc:  # pragma: no cover - fallback silencioso
            last_error = exc
            continue
    raise ValueError(f"No se pudo obtener histórico para {base_asset}: {last_error}")


def get_top_market_caps(limit: int = 15):
    """
    Top N crypto assets by market cap (in EUR).
    Source: CoinGecko (no API key needed).
    """
    url = "https://api.coingecko.com/api/v3/coins/markets"
    res = requests.get(
        url,
        params={
            "vs_currency": FIAT_CURRENCY.lower(),
            "order": "market_cap_desc",
            "per_page": limit,
            "page": 1,
            "sparkline": "false",
            "price_change_percentage": "24h",
        },
        timeout=10,
    )
    res.raise_for_status()
    data = res.json()
    return [
        {
            "name": item.get("name"),
            "symbol": (item.get("symbol") or "").upper(),
            "price": float(item.get("current_price") or 0),
            "change_24h": float(item.get("price_change_percentage_24h") or 0),
            "market_cap": float(item.get("market_cap") or 0),
        }
        for item in data
    ]
