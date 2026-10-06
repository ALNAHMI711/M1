from fastapi import FastAPI
from pydantic import BaseModel, Field
from typing import Literal

app = FastAPI(title="ALNAHMI M1 Trading Control Plane", version="0.1.0")

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

@app.get("/health")
def health():
    return {"status": "ok", "mode": "paper-first"}

@app.post("/v1/signals/validate")
def validate_signal(signal: Signal):
    accepted, reasons = risk_check(signal)
    return {"accepted": accepted, "reasons": reasons}
