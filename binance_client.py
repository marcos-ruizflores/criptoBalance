import requests
from config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY

BINANCE_BASE_URL = "https://api.binance.com"


def get_spot_price(symbol: str) -> float:
    """
    Devuelve el precio actual de un símbolo spot de Binance.
    Ejemplo: 'BTCUSDT'
    """
    url = f"{BINANCE_BASE_URL}/api/v3/ticker/price"
    response = requests.get(url, params={"symbol": symbol})
    response.raise_for_status()
    data = response.json()
    return float(data["price"])


def _symbol_candidates(base_asset: str):
    """
    Genera pares candidatos para un activo dado, priorizando DEFAULT_QUOTE_ASSET.
    """
    base = base_asset.upper()
    # Prioriza el par en moneda fiat (EUR) para usar siempre BTCEUR, ETHEUR, etc.
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
    Devuelve (precio, quote) para un activo (ej. BTC -> (precio BTC/USDT, 'USDT')).
    Intenta varios pares comunes hasta encontrar uno válido.
    """
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
    Recupera velas históricas para un activo.
    Devuelve una lista de dicts con open, high, low, close y quote_asset usado.
    """
    last_error = None
    for symbol, quote in _symbol_candidates(base_asset):
        try:
            url = f"{BINANCE_BASE_URL}/api/v3/klines"
            res = requests.get(
                url,
                params={"symbol": symbol, "interval": interval, "limit": limit},
                timeout=10,
            )
            res.raise_for_status()
            data = res.json()
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
    Devuelve top N criptoactivos por capitalización de mercado (en EUR).
    Fuente: CoinGecko (sin API key).
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
