import io
from contextlib import asynccontextmanager
from typing import Literal, Optional

from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from backend.alerts_service import create_alert, delete_alert, evaluate_alerts, list_alerts
from backend.auth_service import LoginLimiter, authenticate_user, create_user, issue_token, user_from_token
from backend.binance_client import get_asset_history, get_top_market_caps
from backend.config import ALLOWED_ORIGINS
from backend.db import ensure_indexes
from backend.portfolio_service import portfolio_summary
from backend.snapshot_service import delete_snapshot, list_snapshots, take_snapshot
from backend.trades_service import (
    delete_trade,
    export_trades_csv,
    get_trade,
    import_trades_csv,
    list_trades,
    list_trades_with_market,
    register_trade,
    to_public_trade,
)

MAX_CSV_BYTES = 1_000_000


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    yield


app = FastAPI(title="CriptoBalance API", version="1.1.0", lifespan=lifespan)

# Tokens travel in the Authorization header, so no cookies and no credentials needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

bearer = HTTPBearer(auto_error=False)
login_limiter = LoginLimiter()


def current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)) -> dict:
    user = user_from_token(creds.credentials) if creds else None
    if not user:
        raise HTTPException(status_code=401, detail="Sesión no válida o caducada", headers={"WWW-Authenticate": "Bearer"})
    return user


def uid(user: dict = Depends(current_user)) -> str:
    return user["_id"]


class TradeIn(BaseModel):
    base_symbol: str = Field(..., min_length=1, max_length=20, description="Ticker de la cripto, ej: BTC")
    quantity: float = Field(..., gt=0)
    price_fiat: float = Field(..., gt=0, description="Precio unitario en moneda fiat")
    total_cost_fiat: Optional[float] = Field(None, gt=0, description="Coste total en fiat (opcional, se calcula si falta)")
    side: Literal["BUY", "SELL"] = "BUY"


class AlertIn(BaseModel):
    base_asset: str = Field(..., min_length=1, max_length=20)
    kind: Literal["price", "pnl_pct"]
    direction: Literal["above", "below"]
    threshold: float


class SignupIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=200)
    name: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)


class LoginIn(BaseModel):
    email: str = Field(..., max_length=254)
    password: str = Field(..., max_length=200)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/signup", status_code=201)
def signup(payload: SignupIn):
    try:
        user = create_user(payload.email, payload.password, payload.name, payload.phone)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"user": user, "token": issue_token(user)}


@app.post("/auth/login")
def login(payload: LoginIn, request: Request):
    ip = request.client.host if request.client else "unknown"
    if login_limiter.blocked(ip):
        raise HTTPException(status_code=429, detail="Demasiados intentos. Espera unos minutos.")
    user = authenticate_user(payload.email, payload.password)
    if not user:
        login_limiter.fail(ip)
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    login_limiter.reset(ip)
    return {"user": user, "token": issue_token(user)}


@app.get("/auth/me")
def me(user: dict = Depends(current_user)):
    return user


@app.get("/trades")
def get_trades(with_pnl: bool = True, user_id: str = Depends(uid)):
    trades = list_trades_with_market(user_id) if with_pnl else list_trades(user_id)
    return [to_public_trade(t) for t in trades]


@app.post("/trades", status_code=201)
def create_trade(payload: TradeIn, user_id: str = Depends(uid)):
    trade_id = register_trade(
        user_id,
        payload.base_symbol.strip(),
        payload.quantity,
        payload.price_fiat,
        payload.total_cost_fiat,
        side=payload.side,
    )
    trade = get_trade(user_id, str(trade_id))
    if not trade:
        raise HTTPException(status_code=404, detail="No se pudo recuperar la operación")
    return to_public_trade(trade)


@app.delete("/trades/{trade_id}")
def remove_trade(trade_id: str, user_id: str = Depends(uid)):
    if not delete_trade(user_id, trade_id):
        raise HTTPException(status_code=404, detail="Operación no encontrada")
    return {"deleted": True}


@app.get("/trades/export")
def export_trades(user_id: str = Depends(uid)):
    buf = io.BytesIO(export_trades_csv(user_id).encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="trades.csv"'},
    )


@app.post("/trades/import")
def import_trades(file: UploadFile = File(...), user_id: str = Depends(uid)):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Sube un archivo CSV")
    raw = file.file.read(MAX_CSV_BYTES + 1)
    if len(raw) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="El CSV no puede pasar de 1 MB")
    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="El CSV tiene que estar en UTF-8")
    return {"imported": import_trades_csv(user_id, content)}


@app.get("/portfolio")
def get_portfolio(user_id: str = Depends(uid)):
    return portfolio_summary(user_id)


@app.get("/history")
def get_history(
    base_asset: str = Query(..., min_length=1, max_length=20),
    interval: Literal["1h", "4h", "1d", "1w"] = "1d",
    limit: int = Query(90, ge=1, le=1000),
    _: dict = Depends(current_user),
):
    try:
        return get_asset_history(base_asset, interval=interval, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/market/top")
def market_top(limit: int = Query(15, ge=1, le=50), _: dict = Depends(current_user)):
    try:
        return get_top_market_caps(limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/snapshots", status_code=201)
def create_snapshot(user_id: str = Depends(uid)):
    return take_snapshot(user_id)


@app.get("/snapshots")
def get_snapshots(limit: int = Query(30, ge=1, le=200), user_id: str = Depends(uid)):
    return list_snapshots(user_id, limit)


@app.delete("/snapshots/{snapshot_id}")
def remove_snapshot(snapshot_id: str, user_id: str = Depends(uid)):
    if not delete_snapshot(user_id, snapshot_id):
        raise HTTPException(status_code=404, detail="Snapshot no encontrado")
    return {"deleted": True}


@app.get("/alerts")
def alerts(user_id: str = Depends(uid)):
    return list_alerts(user_id)


@app.post("/alerts", status_code=201)
def add_alert(payload: AlertIn, user_id: str = Depends(uid)):
    return create_alert(user_id, payload.base_asset.strip(), payload.kind, payload.direction, payload.threshold)


@app.delete("/alerts/{alert_id}")
def remove_alert(alert_id: str, user_id: str = Depends(uid)):
    if not delete_alert(user_id, alert_id):
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return {"deleted": True}


@app.post("/alerts/evaluate")
def eval_alerts(user: dict = Depends(current_user)):
    return {"triggered": evaluate_alerts(user)}
