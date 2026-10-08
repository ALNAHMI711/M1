import hashlib
import hmac
import os
from decimal import Decimal, InvalidOperation
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, Security
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field

from .auth import Token, authenticate, create_access_token, current_user, revoke
from .binance_spot import BinanceAPIError, BinanceSpotClient, BinanceSpotConfig
from .execution_boundary import ExecutionMode
from .execution_pipeline import (
    BinanceSpotAdapter,
    ExecutionPipeline,
    OrderIntent,
    Outcome,
    PaperAdapter,
    RiskLimits,
    binance_quote_provider,
    ledger_account_state,
)
from .recovery import recover_spot_orders
from .store import (
    close_position,
    get_risk_position,
    open_risk_positions,
    record_execution_audit,
    record_signal,
    recent_execution_audit,
    signal_seen,
)
from .telegram import parse_telegram_signal
from .trade_plan import (
    DEFAULT_ALLOCATIONS,
    DEFAULT_R_MULTIPLES,
    atr_stop_reasons,
    build_take_profit_ladder,
    size_position,
)

app = FastAPI(title="ALNAHMI M1 Trading Control Plane", version="0.5.0")

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
    mode: Literal["DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"] = "PAPER"
    signal_id: str = Field(min_length=8, max_length=128)


class BinanceSpotOrderTest(BaseModel):
    signal: Signal
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    quantity: str = Field(min_length=1, max_length=32)
    price: str | None = Field(default=None, min_length=1, max_length=32)
    time_in_force: Literal["GTC", "IOC", "FOK"] | None = None
    client_order_id: str | None = Field(default=None, min_length=1, max_length=36)


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


class ExecutionSubmit(BaseModel):
    signal: Signal
    order_type: Literal["MARKET", "LIMIT"] = "MARKET"
    quantity: str = Field(min_length=1, max_length=32)
    price: str | None = Field(default=None, min_length=1, max_length=32)
    time_in_force: Literal["GTC", "IOC", "FOK"] | None = None


def risk_check(signal: Signal) -> tuple[bool, list[str]]:
    reasons = signal_reasons(signal)
    if signal.mode == "LIVE":
        reasons.append("live_execution_not_implemented")
    return not reasons, reasons


def signal_reasons(signal: Signal) -> list[str]:
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
    return reasons


def build_execution_pipeline(mode: ExecutionMode) -> ExecutionPipeline:
    """LIVE stays blocked here: readiness and account-risk tracking are not
    wired yet, so no live client or adapter is ever constructed."""
    limits = RiskLimits.from_env()
    account_state = ledger_account_state(limits.account_equity)
    if mode is ExecutionMode.TESTNET:
        client = BinanceSpotClient(BinanceSpotConfig.from_env(testnet=True))
        return ExecutionPipeline(
            adapter=BinanceSpotAdapter(client),
            quote_provider=binance_quote_provider(client),
            limits=limits,
            account_state=account_state,
        )
    market_data = BinanceSpotClient(BinanceSpotConfig.from_env(testnet=False))
    quotes = binance_quote_provider(market_data)
    adapter = PaperAdapter(quotes) if mode is ExecutionMode.PAPER else None
    return ExecutionPipeline(
        adapter=adapter, quote_provider=quotes, limits=limits, account_state=account_state
    )


LEDGER_MODES = Literal["DRY_RUN", "PAPER", "TESTNET", "LIVE"]


class PositionClose(BaseModel):
    realized_pnl: str = Field(min_length=1, max_length=32, pattern=r"^-?\d+(\.\d+)?$")


DECIMAL_PATTERN = r"^\d+(\.\d+)?$"


class TradePlanRequest(BaseModel):
    side: Literal["LONG", "SHORT"]
    entry: str = Field(max_length=32, pattern=DECIMAL_PATTERN)
    stop_loss: str = Field(max_length=32, pattern=DECIMAL_PATTERN)
    risk_pct: str = Field(default="0.5", max_length=8, pattern=DECIMAL_PATTERN)
    step_size: str = Field(max_length=32, pattern=DECIMAL_PATTERN)
    min_qty: str = Field(default="0", max_length=32, pattern=DECIMAL_PATTERN)
    min_notional: str = Field(default="0", max_length=32, pattern=DECIMAL_PATTERN)
    atr: str | None = Field(default=None, max_length=32, pattern=DECIMAL_PATTERN)
    r_multiples: list[str] | None = Field(default=None, min_length=1, max_length=7)
    allocations: list[str] | None = Field(default=None, min_length=1, max_length=7)


MAX_PLAN_RISK_PCT = Decimal("2")


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


@app.get("/v1/control/audit")
def control_audit(limit: int = 100, user=Security(current_user, scopes=["control:read"])):
    return {"items": recent_execution_audit(limit), "user": user.username}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "paper-first", "live_enabled": False}


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
        raise HTTPException(status_code=502, detail="binance_testnet_request_failed") from exc
    return {"accepted": True, "mode": "TESTNET", "result": result, "user": user.username}


@app.post("/v1/execution/submit")
def execution_submit(
    request: ExecutionSubmit,
    response: Response,
    user=Security(current_user, scopes=["control:write"]),
):
    signal = request.signal
    reasons = signal_reasons(signal)
    if reasons:
        raise HTTPException(status_code=422, detail={"outcome": "REJECTED", "reasons": reasons})

    mode = ExecutionMode(signal.mode)
    intent = OrderIntent(
        signal_id=signal.signal_id,
        symbol=signal.symbol,
        side="BUY" if signal.side == "LONG" else "SELL",
        order_type=request.order_type,
        quantity=request.quantity,
        mode=mode,
        score=int(signal.score),
        entry=Decimal(str(signal.entry)),
        stop_loss=Decimal(str(signal.stop_loss)),
        take_profit=Decimal(str(signal.take_profit)),
        price=request.price,
        time_in_force=request.time_in_force,
    )
    try:
        pipeline = build_execution_pipeline(mode)
    except (InvalidOperation, ValueError) as exc:
        raise HTTPException(status_code=500, detail="execution_config_invalid") from exc
    outcome = pipeline.execute(intent)

    body = {
        "outcome": outcome.outcome.value,
        "accepted": outcome.accepted,
        "mode": mode.value,
        "client_order_id": outcome.client_order_id,
        "status": outcome.status,
        "order_id": outcome.order_id,
        "reasons": list(outcome.reasons),
        "metrics": outcome.metrics,
        "user": user.username,
    }
    if outcome.outcome is Outcome.REJECTED:
        raise HTTPException(status_code=422, detail=body)
    if outcome.outcome is Outcome.UNCERTAIN:
        response.status_code = 202
    return body


@app.get("/v1/risk/state")
def risk_state(
    mode: LEDGER_MODES = "PAPER",
    user=Security(current_user, scopes=["control:read"]),
):
    try:
        limits = RiskLimits.from_env()
    except (InvalidOperation, ValueError) as exc:
        raise HTTPException(status_code=500, detail="execution_config_invalid") from exc
    state = ledger_account_state(limits.account_equity)(ExecutionMode(mode))
    return {
        "mode": mode,
        "tracked": state.tracked,
        "daily_loss_pct": str(state.daily_loss_pct),
        "max_daily_loss_pct": str(limits.max_daily_loss_pct),
        "open_risk_pct": str(state.open_risk_pct),
        "max_open_risk_pct": str(limits.max_open_risk_pct),
        "kill_switch": limits.kill_switch,
        "open_positions": open_risk_positions(mode),
        "user": user.username,
    }


@app.post("/v1/risk/plan")
def risk_plan(
    request: TradePlanRequest,
    user=Security(current_user, scopes=["control:read"]),
):
    """Preview sizing, TP1-TP7 and stop rules. Never places an order."""
    try:
        limits = RiskLimits.from_env()
        side = "BUY" if request.side == "LONG" else "SELL"
        entry = Decimal(request.entry)
        stop = Decimal(request.stop_loss)
        risk_pct = Decimal(request.risk_pct)
        step = Decimal(request.step_size)
        min_qty = Decimal(request.min_qty)
        atr = Decimal(request.atr) if request.atr is not None else None
        r_multiples = (
            tuple(Decimal(v) for v in request.r_multiples)
            if request.r_multiples is not None
            else DEFAULT_R_MULTIPLES
        )
        allocations = (
            tuple(Decimal(v) for v in request.allocations)
            if request.allocations is not None
            else DEFAULT_ALLOCATIONS
        )
    except (InvalidOperation, ValueError) as exc:
        raise HTTPException(status_code=422, detail="invalid_plan_inputs") from exc

    if limits.account_equity is None or limits.account_equity <= 0:
        raise HTTPException(status_code=422, detail="account_equity_not_configured")
    if risk_pct > MAX_PLAN_RISK_PCT:
        raise HTTPException(status_code=422, detail="risk_pct_above_maximum")

    sizing = size_position(
        side=side,
        equity=limits.account_equity,
        risk_pct=risk_pct,
        entry=entry,
        stop=stop,
        max_notional=limits.max_notional,
        step_size=step,
        min_qty=min_qty,
        min_notional=Decimal(request.min_notional),
    )
    reasons = list(sizing.reasons) + atr_stop_reasons(entry=entry, stop=stop, atr=atr)
    ladder = (
        build_take_profit_ladder(
            side=side,
            entry=entry,
            stop=stop,
            quantity=sizing.quantity,
            step_size=step,
            min_qty=min_qty,
            r_multiples=r_multiples,
            allocations=allocations,
        )
        if sizing.ok
        else None
    )
    if ladder is not None:
        reasons += list(ladder.reasons)
        if ladder.ok and ladder.weighted_reward_risk < Decimal("2"):
            reasons.append("weighted_reward_risk_below_threshold")

    return {
        "accepted": not reasons,
        "reasons": reasons,
        "side": request.side,
        "quantity": str(sizing.quantity),
        "notional": str(sizing.notional),
        "risk_amount": str(sizing.risk_amount),
        "risk_pct": f"{sizing.risk_pct:.4f}",
        "capped_by": sizing.capped_by,
        "weighted_reward_risk": f"{ladder.weighted_reward_risk:.4f}" if ladder else None,
        "targets": [
            {
                "tp": t.index,
                "price": str(t.price),
                "r_multiple": str(t.r_multiple),
                "quantity": str(t.quantity),
            }
            for t in (ladder.targets if ladder else ())
        ],
        "stop_rules": {"breakeven_after_tp": 1, "trail_after_tp": 2, "trail_atr_multiple": "2"},
        "user": user.username,
    }


@app.post("/v1/risk/positions/{client_order_id}/close")
def risk_close_position(
    client_order_id: str,
    request: PositionClose,
    user=Security(current_user, scopes=["control:write"]),
):
    """Record realized PnL for a position. Never sends an exchange order."""
    position = get_risk_position(client_order_id)
    if position is None:
        raise HTTPException(status_code=404, detail="position_not_found")
    if not close_position(client_order_id, Decimal(request.realized_pnl)):
        raise HTTPException(status_code=409, detail="position_not_open")
    record_execution_audit(
        event="POSITION_CLOSED",
        status="CLOSED",
        detail=f"realized_pnl={request.realized_pnl};by={user.username}",
        client_order_id=client_order_id,
    )
    return {"client_order_id": client_order_id, "status": "CLOSED", "user": user.username}


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
