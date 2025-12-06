from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

from trades_service import (
    register_trade,
    list_trades,
    list_trades_with_market,
    delete_trade,
    get_trade,
    to_public_trade,
)
from portfolio_service import compute_portfolio
from binance_client import get_asset_history


app = FastAPI(title="CriptoBalance API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TradeIn(BaseModel):
    base_symbol: str = Field(..., description="Ticker de la cripto, ej: BTC")
    quantity: float = Field(..., gt=0)
    price_fiat: float = Field(..., gt=0, description="Precio unitario en moneda fiat")
    total_cost_fiat: Optional[float] = Field(
        None, description="Coste total en fiat (opcional, se calcula si falta)"
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/trades")
def get_trades(with_pnl: bool = True):
    trades = list_trades_with_market() if with_pnl else list_trades()
    return [to_public_trade(t) for t in trades]


@app.post("/trades", status_code=201)
def create_trade(payload: TradeIn):
    trade_id = register_trade(
        payload.base_symbol,
        payload.quantity,
        payload.price_fiat,
        payload.total_cost_fiat,
    )
    trade = get_trade(str(trade_id))
    if not trade:
        raise HTTPException(status_code=404, detail="No se pudo recuperar la operación")
    return to_public_trade(trade)


@app.delete("/trades/{trade_id}")
def remove_trade(trade_id: str):
    deleted = delete_trade(trade_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Operación no encontrada")
    return {"deleted": True}


@app.get("/portfolio")
def get_portfolio():
    return compute_portfolio()


@app.get("/history")
def get_history(base_asset: str, interval: str = "1d", limit: int = 90):
    if not base_asset:
        raise HTTPException(status_code=400, detail="base_asset requerido")
    try:
        data = get_asset_history(base_asset, interval=interval, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return data
