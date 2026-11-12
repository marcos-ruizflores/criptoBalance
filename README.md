# criptoBalance

Crypto portfolio tracker. You log your buys and sells in EUR and it shows the current
value and profit/loss of each position using live Binance prices.

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)

## Features

- Record BUY/SELL trades in EUR and see realized and unrealized PnL per asset
  (weighted average cost basis after partial sells)
- Live prices from the Binance public API, preferring EUR pairs and falling back to USDT
- Overview with current value, invested amount, realized/unrealized gains, positions and allocation
- Price history chart per ticker (24h, 1w, 1m, 3m, 1y) with hover readout
- Top coins by market cap (CoinGecko)
- Accounts with JWT sessions; every trade, snapshot and alert belongs to its user
- Price and PnL% alerts, with optional email notifications to the account's email over SMTP
- Portfolio snapshots, CSV import/export
- Light and dark theme, following the system setting
- Also usable from the terminal through a small CLI

## Project structure

```
backend/     FastAPI app, MongoDB access and Binance/CoinGecko clients
frontend/    React + Vite single page app
```

## Getting started

Requirements: Python 3.10+, Node 18+ and a MongoDB instance (local, Docker or Atlas).

```bash
# 1. Config
cp .env.example .env            # set MONGO_URI and JWT_SECRET, optionally the SMTP settings

# 2. Database (skip if you use Atlas)
docker compose -f backend/docker-compose.yml up -d

# 3. Backend on http://localhost:8000 (docs at /docs)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.api:app --reload --port 8000

# 4. Frontend on http://localhost:5173
cd frontend
npm install
npm run dev                     # set VITE_API_URL if the API isn't on localhost:8000
```

CLI version: `python -m backend.main` (asks for the same email and password as the web app)

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/auth/signup`, `/auth/login` | Create an account / sign in, both return a JWT |
| GET | `/auth/me` | Current user |
| GET / POST | `/trades` | List trades (`?with_pnl=true`) / create a trade |
| DELETE | `/trades/{id}` | Delete a trade |
| GET / POST | `/trades/export`, `/trades/import` | CSV export / import (multipart) |
| GET | `/portfolio` | Positions with realized/unrealized PnL |
| GET | `/history?base_asset=BTC&interval=1d&limit=90` | Price candles |
| GET / POST / DELETE | `/snapshots` | Portfolio snapshots |
| GET / POST / DELETE | `/alerts`, `POST /alerts/evaluate` | Price and PnL alerts |
| GET | `/market/top` | Top coins by market cap |

Everything except `/health` and `/auth/*` needs an `Authorization: Bearer <token>` header.

## Security notes

- Passwords hashed with bcrypt, sessions are HS256 JWTs signed with `JWT_SECRET` (7 days by default, `JWT_TTL_HOURS`)
- All data queries filter by the user in the token, so one account can't read or delete another's data
- CORS only allows the origins in `ALLOWED_ORIGINS`
- Failed logins are capped per IP, CSV uploads are limited to 1 MB

Example trade:

```json
{ "base_symbol": "BTC", "quantity": 0.01, "price_fiat": 58000, "side": "BUY" }
```
