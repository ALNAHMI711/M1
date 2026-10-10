import hashlib
import hmac
import os
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Security
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.cors import CORSMiddleware

from .auth import Token, authenticate, create_access_token, current_user, revoke
from .binance_spot import BinanceAPIError, BinanceSpotClient, BinanceSpotConfig
from .recovery import recover_spot_orders
from .store import record_signal, recent_execution_audit, record_execution_audit
from .telegram import parse_telegram_signal
from .operations import check_database, kill_switch_active, set_kill_switch
from .http_safety import HTTPSafetyMiddleware

app = FastAPI(title="ALNAHMI M1 Trading Control Plane", version="0.6.0")
app.add_middleware(HTTPSafetyMiddleware)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=os.getenv("M1_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver,backend").split(","),
)
cors_origins = [origin.strip() for origin in os.getenv("M1_CORS_ORIGINS", "").split(",") if origin.strip()]
if cors_origins:
    app.add_middleware(
        CORSMiddleware, allow_origins=cors_origins,
        allow_methods=["GET", "POST", "PUT"], allow_headers=["Authorization", "Content-Type"],
    )

WEBHOOK_SECRET = os.getenv("TRADINGVIEW_WEBHOOK_SECRET", "")
MIN_SCORE = 85.0
MIN_RR = 2.0


class Signal(BaseModel):
    symbol: str = Field(pattern=r"^[A-Z0-9._-]{3,20}$")
    side: Literal["LONG", "SHORT"]
    entry: float = Field(gt=0, allow_inf_nan=False)
    stop_loss: float = Field(gt=0, allow_inf_nan=False)
    take_profit: float = Field(gt=0, allow_inf_nan=False)
    score: float = Field(ge=0, le=100, allow_inf_nan=False)
    rr: float = Field(gt=0, allow_inf_nan=False)
    source: Literal["TRADINGVIEW", "TELEGRAM", "STRATEGY", "MANUAL"]
    mode: Literal["DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"] = "PAPER"
    signal_id: str = Field(min_length=8, max_length=128, pattern=r"^[A-Za-z0-9._:-]+$")


class BinanceSpotOrderTest(BaseModel):
    signal: Signal
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    quantity: str = Field(min_length=1, max_length=32, pattern=r"^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)$")
    price: str | None = Field(default=None, min_length=1, max_length=32, pattern=r"^(?:[1-9]\d*(?:\.\d+)?|0\.\d*[1-9]\d*)$")
    time_in_force: Literal["GTC", "IOC", "FOK"] | None = None
    client_order_id: str | None = Field(default=None, min_length=1, max_length=36, pattern=r"^[A-Za-z0-9._:-]+$")


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
    if kill_switch_active():
        reasons.append("kill_switch")
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
    expected = hmac.new(WEBHOOK_SECRET.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature.strip())


@app.post("/v1/auth/token", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends()):
    role = authenticate(form.username, form.password)
    if role is None:
        raise HTTPException(
            status_code=401,
            detail="invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        return Token(access_token=create_access_token(form.username, role))
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="authentication_not_configured") from exc


@app.post("/v1/auth/logout")
def logout(request: Request, user=Depends(current_user)):
    authorization = request.headers.get("Authorization", "")
    token = authorization.partition(" ")[2].strip()
    if token:
        revoke(token)
    return {"ok": True}


@app.get("/v1/auth/me")
def me(user=Depends(current_user)):
    return {"username": user.username, "role": user.role, "scopes": user.scopes}


@app.get("/v1/control/status")
def control_status(user=Security(current_user, scopes=["control:read"])):
    return {"status": "ready", "mode": "paper-first", "live_enabled": False, "user": user.username}


@app.get("/v1/control/audit")
def control_audit(limit: int = 100, user=Security(current_user, scopes=["control:read"])):
    return {"items": recent_execution_audit(limit), "user": user.username}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "paper-first", "live_enabled": False}


@app.get("/ready")
def ready():
    if not check_database():
        raise HTTPException(status_code=503, detail="persistent_store_unavailable")
    from .auth import _secret
    try:
        _secret()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="authentication_not_configured") from exc
    return {"status": "ready", "mode": "paper-first", "live_enabled": False}


class KillSwitchSetting(BaseModel):
    enabled: bool


@app.get("/v1/control/kill-switch")
def read_kill_switch(user=Security(current_user, scopes=["control:read"])):
    return {"enabled": kill_switch_active(), "live_enabled": False}


@app.put("/v1/control/kill-switch")
def update_kill_switch(setting: KillSwitchSetting, user=Security(current_user, scopes=["admin"])):
    set_kill_switch(setting.enabled, user.username)
    return {"enabled": setting.enabled, "live_enabled": False, "liquidation": False}


@app.post("/v1/signals/validate")
def validate_signal(signal: Signal):
    accepted, reasons = risk_check(signal)
    return {"accepted": accepted, "reasons": reasons}


@app.post("/v1/binance/spot/order-test")
def binance_spot_order_test(
    request: BinanceSpotOrderTest,
    user=Security(current_user, scopes=["control:write"]),
):
    if request.signal.mode != "TESTNET":
        raise HTTPException(status_code=400, detail="binance_order_test_requires_testnet_mode")
    accepted, reasons = risk_check(request.signal)
    if not accepted:
        raise HTTPException(status_code=422, detail={"accepted": False, "reasons": reasons})
    record_execution_audit(
        event="SPOT_ORDER_TEST", status="VALIDATING", detail="testnet_validation_only",
        signal_id=request.signal.signal_id, client_order_id=request.client_order_id,
    )
    if request.order_type == "LIMIT" and (request.price is None or request.time_in_force is None):
        raise HTTPException(status_code=422, detail="limit_order_requires_price_and_time_in_force")
    try:
        client = BinanceSpotClient(BinanceSpotConfig.from_env(testnet=True))
        result = client.order_test(
            symbol=request.signal.symbol,
            side="BUY" if request.signal.side == "LONG" else "SELL",
            order_type=request.order_type,
            quantity=request.quantity,
            price=request.price,
            time_in_force=request.time_in_force,
            client_order_id=request.client_order_id,
        )
    except BinanceAPIError as exc:
        record_execution_audit(event="SPOT_ORDER_TEST", status="FAILED", detail="testnet_request_failed", signal_id=request.signal.signal_id)
        raise HTTPException(status_code=502, detail="binance_testnet_request_failed") from exc
    record_execution_audit(event="SPOT_ORDER_TEST", status="VALIDATED", detail="no_order_placed", signal_id=request.signal.signal_id)
    return {"accepted": True, "mode": "TESTNET", "result": result, "user": user.username}


@app.post("/v1/binance/spot/recover")
def binance_spot_recover(user=Security(current_user, scopes=["control:write"])):
    """Reconcile pending Spot state; this endpoint never places an order."""
    try:
        client = BinanceSpotClient(BinanceSpotConfig.from_env(testnet=True))
        result = recover_spot_orders(client)
    except BinanceAPIError as exc:
        raise HTTPException(status_code=502, detail="binance_recovery_failed") from exc
    return {"mode": "TESTNET", "order_placement": False, "result": result, "user": user.username}


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
    return {"accepted": accepted, "reasons": reasons, "signal": signal.model_dump()}


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
    accepted, reasons = risk_check(signal)
    inserted = record_signal(
        signal.signal_id,
        signal.symbol,
        signal.side,
        signal.source,
        signal.mode,
        accepted,
        reasons,
    )
    if not inserted:
        raise HTTPException(status_code=409, detail="duplicate signal")
    return {"accepted": accepted, "reasons": reasons, "signal_id": signal.signal_id}


@app.get("/v1/control/readiness")
def control_readiness(user=Security(current_user, scopes=["control:read"])):
    """Expose operational readiness without revealing secret values."""
    from .store import database_path

    checks = {
        "authentication": True,
        "persistent_store_healthy": check_database(),
        "durable_sessions": True,
        "tradingview_webhook_secret_configured": bool(WEBHOOK_SECRET),
        "spot_api_key_configured": bool(os.getenv("BINANCE_API_KEY")),
        "spot_api_secret_configured": bool(os.getenv("BINANCE_API_SECRET")),
        "live_execution_enabled": False,
        "usdm_live_execution_enabled": False,
        "coinm_live_execution_enabled": False,
        "cross_margin_live_execution_enabled": False,
        "isolated_margin_live_execution_enabled": False,
        "alpha_live_execution_enabled": False,
        "stocks_live_execution_enabled": False,
    }
    blockers = [
        "real_testnet_end_to_end_not_verified", "independent_security_review_required",
        "live_execution_not_enabled",
    ]
    if not checks["persistent_store_healthy"]:
        blockers.append("persistent_store_unavailable")
    return {
        "overall": "limited" if blockers else "paper_only",
        "mode": "paper-first",
        "live_enabled": False,
        "checks": checks,
        "blockers": blockers,
        "user": user.username,
        "kill_switch": kill_switch_active(),
    }
