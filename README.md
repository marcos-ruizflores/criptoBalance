# criptoBalance
App to record crypto buys (precio y coste en EUR) y consultar PnL con precios en vivo de Binance (par USDT -> se convierte a EUR con `FIAT_RATE`).

## Uso rápido
1. Define variables si no usas los valores por defecto: `MONGO_URI`, `MONGO_DB_NAME`, `DEFAULT_QUOTE_ASSET` (por defecto USDT), `FIAT_RATE` (ej. USDT/EUR) y `FIAT_CURRENCY` (por defecto EUR).
2. Instala dependencias: `pip install pymongo requests`.
3. Arranca MongoDB.
4. Ejecuta `python main.py` y registra compras introduciendo solo el ticker de la criptomoneda (BTC, ADA…), cantidad, precio unitario en EUR y coste total en EUR (se calcula automáticamente si lo dejas vacío).
5. Consulta el PnL por operación o agregado desde el menú, y elimina operaciones usando el ID mostrado.
