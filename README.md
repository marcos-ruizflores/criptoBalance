# criptoBalance
App to record crypto buys (precio y coste en EUR) y consultar PnL con precios en vivo de Binance (par USDT -> se convierte a EUR con `FIAT_RATE`).

## Backend (Python)
1. Define variables si no usas los valores por defecto: `MONGO_URI`, `MONGO_DB_NAME`, `DEFAULT_QUOTE_ASSET` (por defecto USDT), `FIAT_RATE` (ej. USDT/EUR) y `FIAT_CURRENCY` (por defecto EUR).
2. Instala dependencias: `pip install -r requirements.txt`.
3. Arranca MongoDB.
4. CLI: `python main.py` para registrar, ver PnL y borrar operaciones.
5. API (FastAPI): `uvicorn api:app --reload --port 8000`
   - `GET /trades?with_pnl=true`
   - `POST /trades` `{ base_symbol, quantity, price_fiat, total_cost_fiat?, side }`
   - `DELETE /trades/{id}`
   - `GET /trades/export` (CSV)
   - `POST /trades/import` (multipart/form-data con CSV)
   - `GET /portfolio` (resumen con PnL realizado/no realizado y top ganadores/perdedores)
   - `POST /snapshots` / `GET /snapshots`
   - `POST /alerts` / `GET /alerts` / `DELETE /alerts/{id}` / `POST /alerts/evaluate`
   - `GET /history?base_asset=BTC&interval=1d&limit=90`
   - `GET /health`

## Frontend (React + Vite)
1. Ve a `frontend/` y ejecuta `npm install`.
2. Ejecuta `npm run dev` (usa `VITE_API_URL` si tu backend no está en `http://localhost:8000`).
3. Interfaz con registro de compras/ventas en EUR, PnL en vivo, import/export CSV, snapshots y alertas básicas.

## Pasos rápidos tras clonar el repo
Backend:
- Crea y activa tu venv (opcional): `python -m venv .venv && source .venv/bin/activate`
- Instala dependencias: `pip install -r requirements.txt`
- Arranca MongoDB (local o remoto) y ajusta variables de entorno si hace falta: `MONGO_URI`, `MONGO_DB_NAME`, `DEFAULT_QUOTE_ASSET`, `FIAT_RATE`, `FIAT_CURRENCY`.
- O usa Docker para Mongo: `docker-compose up -d` (MONGO_URI para la app: `mongodb://localhost:27017/criptoBalance`).
- Para alertas por email, define `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `ALERT_EMAIL_TO`.
- Ejecuta la API: `uvicorn api:app --reload --port 8000`
- CLI opcional: `python main.py`

Frontend:
- `cd frontend && npm install`
- `npm run dev` (si el backend no está en `http://localhost:8000`, exporta `VITE_API_URL` con la URL correcta)

Uso:
- Panel: registrar BUY/SELL, ver portfolio con PnL realizado/no realizado, top ganadores/perdedores.
- Operaciones: listar, borrar, importar/exportar CSV.
- Gráfico: histórico de precio por ticker.
- MyCriptos: distribución por valor actual.
- Alertas: crea/evalúa alertas de precio o PnL%; si hay SMTP configurado, envía correo a `ALERT_EMAIL_TO` cuando se disparan.
