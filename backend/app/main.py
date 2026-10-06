import hashlib
import hmac
import os
from typing import Literal

from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from .store import record_signal, signal_seen

app = FastAPI(title="ALNAHMI M1 Trading Control Plane", version="0.3.0")

WEBHOOK_SECRET = os.getenv("TRADINGVIEW_WEBHOOK_SECRET", "")
MIN_SCORE = 85.0
MIN_RR = 2.0


class Signal(BaseModel):
    symbol: str = Field(pattern=r"^[A-Z0-9._-]{3,20}$")
    side: Literal["LONG", "SHORT"]
    entry: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    take_profit: float = Field(gt=0)
    score: float = Field(ge=0, le=100)
    rr: float = Field(gt=0)
    source: Literal["TRADINGVIEW", "TELEGRAM", "STRATEGY", "MANUAL"]
    mode: Literal["DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "LIVE"] = "PAPER"
    signal_id: str = Field(min_length=8, max_length=128)


def calculated_rr(signal: Signal) -> float | None:
    if signal.side == "LONG":
        risk = signal.entry - signal.stop_loss
        reward = signal.take_profit - signal.entry
    else:
        risk = signal.stop_loss - signal.entry
        reward = signal.entry - signal.take_profit
    if risk <= 0 or reward <= 0:
        return None
    return reward / risk


def risk_check(signal: Signal) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if signal.score < MIN_SCORE:
        reasons.append("score_below_85")
    actual_rr = calculated_rr(signal)
    if actual_rr is None:
        reasons.append("invalid_risk_reward_levels")
    elif actual_rr < MIN_RR:
        reasons.append("rr_below_2")
    elif abs(actual_rr - signal.rr) > 0.05:
        reasons.append("rr_mismatch")
    if signal.side == "LONG" and not (signal.stop_loss < signal.entry < signal.take_profit):
        reasons.append("invalid_long_levels")
    if signal.side == "SHORT" and not (signal.take_profit < signal.entry < signal.stop_loss):
        reasons.append("invalid_short_levels")
    if signal.mode == "LIVE":
        reasons.append("live_execution_not_implemented")
    return not reasons, reasons


def valid_signature(raw: bytes, signature: str | None) -> bool:
    if not WEBHOOK_SECRET or not signature:
        return False
    expected = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"), raw, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


@app.get("/health")
def health():
    return {"status": "ok", "mode": "paper-first", "live_enabled": False}


@app.post("/v1/signals/validate")
def validate_signal(signal: Signal):
    accepted, reasons = risk_check(signal)
    return {"accepted": accepted, "reasons": reasons}


@app.post("/v1/webhooks/tradingview")
async def tradingview_webhook(
    request: Request, x_signature: str | None = Header(default=None)
):
    raw = await request.body()
    if not valid_signature(raw, x_signature):
        raise HTTPException(status_code=401, detail="invalid webhook signature")
    try:
        signal = Signal.model_validate_json(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="invalid signal payload") from exc
    if signal_seen(signal.signal_id):
        raise HTTPException(status_code=409, detail="duplicate signal")
    accepted, reasons = risk_check(signal)
    record_signal(
        signal.signal_id,
        signal.symbol,
        signal.side,
        signal.source,
        signal.mode,
        accepted,
        reasons,
    )
    return {"accepted": accepted, "reasons": reasons, "signal_id": signal.signal_id}
