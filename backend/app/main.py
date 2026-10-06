import hashlib
import hmac
import os
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Security\nfrom fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from .auth import Token, authenticate, create_access_token, current_user, revoke\nfrom .auth import Token, authenticate, create_access_token, current_user, revoke
from .store import record_signal, signal_seen
from .telegram import parse_telegram_signal

app = FastAPI(title="ALNAHMI M1 Trading Control Plane", version="0.4.0")

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


@app.post("/v1/auth/token", response_model=Token)\ndef login(form: OAuth2PasswordRequestForm = Depends()):\n    role = authenticate(form.username, form.password)\n    if role is None:\n        raise HTTPException(status_code=401, detail="invalid credentials", headers={"WWW-Authenticate": "Bearer"})\n    return Token(access_token=create_access_token(form.username, role))\n\n\n@app.post("/v1/auth/logout")\ndef logout(request: Request, user=Depends(current_user)):\n    authorization = request.headers.get("Authorization", "")\n    token = authorization.removeprefix("Bearer ").strip()\n    if token:\n        revoke(token)\n    return {"ok": True}\n\n\n@app.get("/v1/auth/me")\ndef me(user=Depends(current_user)):\n    return {"username": user.username, "role": user.role, "scopes": user.scopes}\n\n\n@app.get("/v1/control/status")\ndef control_status(user=Security(current_user, scopes=["control:read"])):\n    return {"status": "ready", "mode": "paper-first", "live_enabled": False, "user": user.username}\n\n\n@app.post("/v1/auth/token", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    role = authenticate(form.username, form.password)
    if role is None:
        raise HTTPException(status_code=401, detail="invalid credentials", headers={"WWW-Authenticate": "Bearer"})
    return Token(access_token=create_access_token(form.username, role))


@app.post("/v1/auth/logout")
def logout(request: Request, user=Depends(current_user)):
    authorization = request.headers.get("Authorization", "")
    token = authorization.removeprefix("Bearer ").strip()
    if token:
        revoke(token)
    return {"ok": True}


@app.get("/v1/auth/me")
def me(user=Depends(current_user)):
    return {"username": user.username, "role": user.role, "scopes": user.scopes}


@app.get("/v1/control/status")
def control_status(user=Security(current_user, scopes=["control:read"])):
    return {"status": "ready", "mode": "paper-first", "live_enabled": False, "user": user.username}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "paper-first", "live_enabled": False}


@app.post("/v1/signals/validate")
def validate_signal(signal: Signal):
    accepted, reasons = risk_check(signal)
    return {"accepted": accepted, "reasons": reasons}


@app.post("/v1/signals/telegram/parse")
def parse_telegram(text: str):
    try:
        parsed = parse_telegram_signal(text)
        signal = Signal(
            symbol=parsed.symbol,
            side=parsed.side,
            entry=parsed.entry,
            stop_loss=parsed.stop_loss,
            take_profit=parsed.take_profit,
            score=parsed.score,
            rr=parsed.rr,
            source="TELEGRAM",
            mode="PAPER",
            signal_id=f"telegram-preview-{hashlib.sha256(text.encode()).hexdigest()[:24]}",
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="invalid telegram signal") from exc

    accepted, reasons = risk_check(signal)
    return {
        "accepted": accepted,
        "reasons": reasons,
        "signal": signal.model_dump(),
    }


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
