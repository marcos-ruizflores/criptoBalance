from datetime import datetime
from typing import List
from bson import ObjectId
from backend.db import alerts_col
from backend.binance_client import get_fiat_rate, get_price_for_asset
from backend.config import (
    FIAT_CURRENCY,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    EMAIL_FROM,
)
from backend.portfolio_service import portfolio_summary
import smtplib
from email.message import EmailMessage


def to_public(alert: dict) -> dict:
    a = {**alert}
    if "_id" in a:
        a["_id"] = str(a["_id"])
    return a


def create_alert(user_id: str, base_asset: str, kind: str, direction: str, threshold: float):
    alert = {
        "user_id": user_id,
        "base_asset": base_asset.upper(),
        "kind": kind,
        "direction": direction,
        "threshold": float(threshold),
        "created_at": datetime.utcnow(),
        "last_triggered_at": None,
    }
    alerts_col().insert_one(alert)
    return to_public(alert)


def list_alerts(user_id: str):
    return [to_public(a) for a in alerts_col().find({"user_id": user_id}).sort("created_at", -1)]


def delete_alert(user_id: str, alert_id: str) -> bool:
    try:
        oid = ObjectId(alert_id)
    except Exception:
        return False
    res = alerts_col().delete_one({"_id": oid, "user_id": user_id})
    return res.deleted_count > 0


def evaluate_alerts(user: dict) -> List[dict]:
    alerts = list_alerts(user["_id"])
    summary = portfolio_summary(user["_id"])
    items_by_asset = {i["base_asset"]: i for i in summary["items"]}
    triggered = []
    for alert in alerts:
        base = alert.get("base_asset")
        kind = alert.get("kind")
        direction = alert.get("direction")
        threshold = float(alert.get("threshold", 0))

        value = None
        if kind == "price":
            try:
                price_quote, quote = get_price_for_asset(base)
            except Exception:
                continue
            conversion = get_fiat_rate(quote)
            value = price_quote * conversion
        elif kind == "pnl_pct":
            item = items_by_asset.get(base)
            if item:
                value = item.get("pnl_pct", 0)

        if value is None:
            continue

        hit = (direction == "above" and value >= threshold) or (direction == "below" and value <= threshold)
        if hit:
            alerts_col().update_one(
                {"_id": ObjectId(alert["_id"]), "user_id": user["_id"]},
                {"$set": {"last_triggered_at": datetime.utcnow(), "last_value": value}},
            )
            enriched = {**to_public(alert), "current_value": value}
            triggered.append(enriched)
            send_email_alert(enriched, user.get("email"))
    return triggered


def send_email_alert(alert: dict, to: str):
    if not (SMTP_HOST and EMAIL_FROM and to):
        return
    msg = EmailMessage()
    msg["Subject"] = f"[CriptoBalance] Alerta {alert.get('base_asset')} {alert.get('kind')}"
    msg["From"] = EMAIL_FROM
    msg["To"] = to
    body = (
        f"Activo: {alert.get('base_asset')}\n"
        f"Tipo: {alert.get('kind')} {alert.get('direction')} {alert.get('threshold')}\n"
        f"Valor actual: {alert.get('current_value')}\n"
        f"Disparada: {alert.get('last_triggered_at')}\n"
    )
    msg.set_content(body)
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as smtp:
            smtp.starttls()
            if SMTP_USER and SMTP_PASSWORD:
                smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception:
        # Swallow it so a mail failure doesn't break alert evaluation.
        return


__all__ = ["create_alert", "list_alerts", "delete_alert", "evaluate_alerts"]
