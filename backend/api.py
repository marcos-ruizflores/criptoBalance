from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

from backend.trades_service import (
    register_trade,
    list_trades,
    list_trades_with_market,
    delete_trade,
    get_trade,
    to_public_trade,
    export_trades_csv,
    import_trades_csv,
)
from backend.portfolio_service import compute_portfolio, portfolio_summary
from backend.binance_client import get_asset_history, get_top_market_caps
from backend.snapshot_service import take_snapshot, list_snapshots, delete_snapshot
from backend.alerts_service import create_alert, list_alerts, delete_alert, evaluate_alerts
from fastapi.responses import StreamingResponse
import io


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
    side: str = Field("BUY", description="BUY o SELL")


class AlertIn(BaseModel):
    base_asset: str
    kind: str = Field(..., description="price o pnl_pct")
    direction: str = Field(..., description="above o below")
    threshold: float


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
        side=payload.side,
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
    return portfolio_summary()


@app.get("/history")
def get_history(base_asset: str, interval: str = "1d", limit: int = 90):
    if not base_asset:
        raise HTTPException(status_code=400, detail="base_asset requerido")
    try:
        data = get_asset_history(base_asset, interval=interval, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return data


@app.get("/trades/export")
def export_trades():
    csv_text = export_trades_csv()
    buf = io.BytesIO(csv_text.encode("utf-8"))
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="trades.csv"'},
    )


@app.post("/trades/import")
def import_trades(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Sube un archivo CSV")
    content = file.file.read().decode("utf-8")
    created = import_trades_csv(content)
    return {"imported": created}


@app.post("/snapshots", status_code=201)
def create_snapshot():
    return take_snapshot()


@app.get("/snapshots")
def get_snapshots(limit: int = 30):
    return list_snapshots(limit)

@app.delete("/snapshots/{snapshot_id}")
def remove_snapshot(snapshot_id: str):
    deleted = delete_snapshot(snapshot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Snapshot no encontrado")
    return {"deleted": True}


@app.get("/alerts")
def alerts():
    return list_alerts()


@app.post("/alerts", status_code=201)
def add_alert(payload: AlertIn):
    return create_alert(payload.base_asset, payload.kind, payload.direction, payload.threshold)


@app.delete("/alerts/{alert_id}")
def remove_alert(alert_id: str):
    deleted = delete_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return {"deleted": True}


@app.post("/alerts/evaluate")
def eval_alerts():
    triggered = evaluate_alerts()
    return {"triggered": triggered}


@app.get("/market/top")
def market_top(limit: int = 15):
    try:
        data = get_top_market_caps(limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return data
