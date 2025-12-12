# criptoBalance
App to record crypto buys (precio y coste en EUR) y consultar PnL con precios en vivo de Binance (par USDT -> se convierte a EUR con `FIAT_RATE`).

## Backend (Python)
1. Crea tu `.env` copiando `.env.example` y ajusta variables:
   - `MONGO_URI` (para Atlas usa la cadena SRV que te da: `mongodb+srv://.../criptoBalance?retryWrites=true&w=majority`)
   - `MONGO_DB_NAME` (ej. `criptoBalance`)
   - `DEFAULT_QUOTE_ASSET` (USDT), `FIAT_RATE` (ej. USDT/EUR), `FIAT_CURRENCY` (EUR)
2. Instala dependencias: `pip install -r requirements.txt`.
3. Arranca MongoDB (local si no usas Atlas).
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
- Copia `.env.example` a `.env` y rellena `MONGO_URI` con tu cadena de Atlas (incluye usuario/contraseña y DB al final, p. ej. `.../criptoBalance`).
- Instala dependencias: `pip install -r requirements.txt`
- Si no usas Atlas, arranca MongoDB local o vía Docker: `docker-compose up -d` (MONGO_URI: `mongodb://localhost:27017/criptoBalance`).
- Para alertas por email, define `SMTP_HOST`, `SMTP_PORT` (587), `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, `ALERT_EMAIL_TO`.
- Ejecuta la API desde la raíz: `uvicorn backend.api:app --reload --port 8000` (carga .env automáticamente)
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
