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
    Intenta obtener el precio del activo probando primero DEFAULT_QUOTE_ASSET y
    luego FIAT_CURRENCY. Devuelve (precio, quote_asset_usada).
    """
    base_asset = base_asset.upper()
    quotes = []
    if DEFAULT_QUOTE_ASSET:
        quotes.append(DEFAULT_QUOTE_ASSET.upper())
    if FIAT_CURRENCY and FIAT_CURRENCY.upper() not in quotes:
        quotes.append(FIAT_CURRENCY.upper())

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
