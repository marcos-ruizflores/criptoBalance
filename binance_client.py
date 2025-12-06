import requests
from config import DEFAULT_QUOTE_ASSET, FIAT_CURRENCY

BASE_URL = "https://api.binance.com"


def _fetch_symbol_price(symbol: str) -> float:
    resp = requests.get(
        f"{BASE_URL}/api/v3/ticker/price",
        params={"symbol": symbol.upper()},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    try:
        return float(data["price"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"Respuesta de precio inesperada para {symbol}: {data}") from exc


def get_symbol_price(symbol: str) -> float:
    """
    Devuelve el precio actual del símbolo en Binance (ej. BTCUSDT).
    """
    return _fetch_symbol_price(symbol)


def get_price_for_asset(base_asset: str) -> tuple[float, str]:
    """
    Intenta obtener el precio del activo probando primero FIAT_CURRENCY y
    después DEFAULT_QUOTE_ASSET. Devuelve (precio, quote_asset_usada).
    """
    base_asset = base_asset.upper()
    quotes = []
    if FIAT_CURRENCY:
        quotes.append(FIAT_CURRENCY.upper())
    if DEFAULT_QUOTE_ASSET:
        quotes.append(DEFAULT_QUOTE_ASSET.upper())

    tried = []
    for quote in quotes:
        pair = f"{base_asset}{quote}"
        tried.append(pair)
        try:
            price = _fetch_symbol_price(pair)
            return price, quote
        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                continue
            raise
        except Exception:
            continue

    raise ValueError(f"No se pudo obtener precio para {base_asset}; intentos: {', '.join(tried)}")


__all__ = ["get_symbol_price", "get_price_for_asset"]


def get_asset_history(base_asset: str, interval: str = "1d", limit: int = 90):
    """
    Obtiene histórico OHLC de Binance para la cripto dada (prioriza par con FIAT_CURRENCY).
    Devuelve lista de velas con timestamp ms y cierre.
    """
    base_asset = base_asset.upper()
    quotes = []
    if FIAT_CURRENCY:
        quotes.append(FIAT_CURRENCY.upper())
    if DEFAULT_QUOTE_ASSET and DEFAULT_QUOTE_ASSET.upper() not in quotes:
        quotes.append(DEFAULT_QUOTE_ASSET.upper())

    last_error = None
    for quote in quotes:
        symbol = f"{base_asset}{quote}"
        try:
            res = requests.get(
                f"{BASE_URL}/api/v3/klines",
                params={"symbol": symbol, "interval": interval, "limit": limit},
                timeout=10,
            )
            res.raise_for_status()
            raw = res.json()
            candles = [
                {
                    "open_time": c[0],
                    "open": float(c[1]),
                    "high": float(c[2]),
                    "low": float(c[3]),
                    "close": float(c[4]),
                    "volume": float(c[5]),
                    "quote_asset": quote,
                }
                for c in raw
            ]
            return candles
        except Exception as exc:
            last_error = exc
            continue
    raise ValueError(f"No se pudo obtener histórico para {base_asset}") from last_error
