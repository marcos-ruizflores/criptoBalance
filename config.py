import os

# Valores de configuración básicos. Sobrescribir mediante variables de entorno si es necesario.
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "criptoBalance")

# Operamos siempre contra el par con esta divisa de cotización.
DEFAULT_QUOTE_ASSET = os.getenv("DEFAULT_QUOTE_ASSET", "USDT")

# Conversión aproximada de USDT a moneda fiat para mostrar métricas.
FIAT_CURRENCY = os.getenv("FIAT_CURRENCY", "EUR")
FIAT_RATE = float(os.getenv("FIAT_RATE", "0.92"))

__all__ = [
    "MONGO_URI",
    "MONGO_DB_NAME",
    "DEFAULT_QUOTE_ASSET",
    "FIAT_CURRENCY",
    "FIAT_RATE",
]
