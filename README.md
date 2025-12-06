# criptoBalance
App to record crypto buys (precio y coste en EUR) y consultar PnL con precios en vivo de Binance (par USDT -> se convierte a EUR con `FIAT_RATE`).

## Backend (Python)
1. Define variables si no usas los valores por defecto: `MONGO_URI`, `MONGO_DB_NAME`, `DEFAULT_QUOTE_ASSET` (por defecto USDT), `FIAT_RATE` (ej. USDT/EUR) y `FIAT_CURRENCY` (por defecto EUR).
2. Instala dependencias: `pip install -r requirements.txt`.
3. Arranca MongoDB.
4. CLI: `python main.py` para registrar, ver PnL y borrar operaciones.
5. API (FastAPI): `uvicorn api:app --reload --port 8000`
   - `GET /trades?with_pnl=true`
   - `POST /trades` `{ base_symbol, quantity, price_fiat, total_cost_fiat? }`
   - `DELETE /trades/{id}`
   - `GET /portfolio`
   - `GET /history?base_asset=BTC&interval=1d&limit=90`
   - `GET /health`

## Frontend (React + Vite)
1. Ve a `frontend/` y ejecuta `npm install`.
2. Ejecuta `npm run dev` (usa `VITE_API_URL` si tu backend no está en `http://localhost:8000`).
3. Interfaz con registro de compras en EUR, tabla de operaciones con PnL en vivo y tarjetas del portfolio.
