import time
from threading import Lock

import requests
from backend.config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY

# data-api.binance.vision is Binance's public market-data host, meant for servers.
# api.binance.com refuses requests from many cloud IPs (Render's included), so it's
# only the fallback.
BINANCE_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com"]

# Prices are reused for a short while: a page load asks for the same coins many times
# (once per trade plus the portfolio), and Binance rate-limits bursts.
PRICE_TTL_S = 20
_price_cache = {}
_price_lock = Lock()


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
