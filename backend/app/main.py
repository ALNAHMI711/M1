from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
import hashlib
import hmac

app = FastAPI(title="ALNAHMI M1 Trading Control Plane", version="0.2.0")

WEBHOOK_SECRET = "disabled-until-configured"
_seen: set[str] = set()

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

MIN_SCORE = 85.0
MIN_RR = 2.0

def risk_check(signal: Signal) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if signal.score < MIN_SCORE:
        reasons.append("score_below_85")
    if signal.rr < MIN_RR:
        reasons.append("rr_below_2")
    if signal.side == "LONG" and not (signal.stop_loss < signal.entry < signal.take_profit):
        reasons.append("invalid_long_levels")
    if signal.side == "SHORT" and not (signal.take_profit < signal.entry < signal.stop_loss):
        reasons.append("invalid_short_levels")
    if signal.mode == "LIVE":
        reasons.append("live_execution_not_implemented")
    return not reasons, reasons

def valid_signature(raw: bytes, signature: str | None) -> bool:
    if not signature or WEBHOOK_SECRET == "disabled-until-configured":
        return False
    expected = hmac.new(WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)

@app.get("/health")
def health():
    return {"status": "ok", "mode": "paper-first"}

@app.post("/v1/signals/validate")
def validate_signal(signal: Signal):
    accepted, reasons = risk_check(signal)
    return {"accepted": accepted, "reasons": reasons}

@app.post("/v1/webhooks/tradingview")
def tradingview_webhook(signal: Signal, x_signature: str | None = Header(default=None)):
    if not valid_signature(signal.model_dump_json().encode(), x_signature):
        raise HTTPException(status_code=401, detail="invalid webhook signature")
    if signal.signal_id in _seen:
        return {"accepted": False, "reasons": ["duplicate_signal"]}
    accepted, reasons = risk_check(signal)
    if accepted:
        _seen.add(signal.signal_id)
    return {"accepted": accepted, "reasons": reasons}
