"""Single production execution path.

Signal (already validated) -> market quote -> risk gate -> live gate ->
idempotent claim -> adapter -> persistence + audit.

Every exchange call goes through ``ExecutionPipeline.execute``. The risk
decision is computed here from server-side data, so callers cannot supply a
pre-approved decision, spread, or notional.
"""

from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Callable, Protocol

from . import store
from .binance_spot import BinanceAPIError
from .execution_boundary import ExecutionMode, LiveExecutionRequirements
from .risk_gate import RiskInput, evaluate_trade_risk

BPS = Decimal("10000")
HUNDRED = Decimal("100")


class Outcome(StrEnum):
    VALIDATED = "VALIDATED"
    SUBMITTED = "SUBMITTED"
    DUPLICATE = "DUPLICATE"
    REJECTED = "REJECTED"
    UNCERTAIN = "UNCERTAIN"


@dataclass(frozen=True)
class OrderIntent:
    signal_id: str
    symbol: str
    side: str
    order_type: str
    quantity: str
    mode: ExecutionMode
    score: int
    entry: Decimal
    stop_loss: Decimal
    take_profit: Decimal
    price: str | None = None
    time_in_force: str | None = None


@dataclass(frozen=True)
class MarketQuote:
    bid: Decimal
    ask: Decimal

    @property
    def mid(self) -> Decimal:
        return (self.bid + self.ask) / 2

    @property
    def spread_bps(self) -> Decimal:
        return (self.ask - self.bid) / self.mid * BPS


@dataclass(frozen=True)
class RiskLimits:
    account_equity: Decimal | None
    max_notional: Decimal = Decimal("100")
    max_daily_loss_pct: Decimal = Decimal("2")
    max_open_risk_pct: Decimal = Decimal("3")
    max_entry_drift_bps: Decimal = Decimal("50")
    kill_switch: bool = False

    @classmethod
    def from_env(cls) -> "RiskLimits":
        def dec(name: str, default: str) -> Decimal:
            return Decimal(os.getenv(name, default))

        equity_raw = os.getenv("M1_ACCOUNT_EQUITY", "").strip()
        return cls(
            account_equity=Decimal(equity_raw) if equity_raw else None,
            max_notional=dec("M1_MAX_NOTIONAL", "100"),
            max_daily_loss_pct=dec("M1_MAX_DAILY_LOSS_PCT", "2"),
            max_open_risk_pct=dec("M1_MAX_OPEN_RISK_PCT", "3"),
            max_entry_drift_bps=dec("M1_MAX_ENTRY_DRIFT_BPS", "50"),
            kill_switch=os.getenv("M1_KILL_SWITCH", "false").lower() == "true",
        )


@dataclass(frozen=True)
class AccountRiskState:
    daily_loss_pct: Decimal
    open_risk_pct: Decimal
    tracked: bool


def untracked_account_state(mode: ExecutionMode | None = None) -> AccountRiskState:
    """Fallback with no data source.

    ``tracked=False`` keeps LIVE blocked: zeros here must never authorize
    real money.
    """
    return AccountRiskState(Decimal("0"), Decimal("0"), tracked=False)


def utc_day_start(now: datetime | None = None) -> str:
    current = now or datetime.now(timezone.utc)
    return current.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def ledger_account_state(
    equity: Decimal | None,
) -> Callable[[ExecutionMode], AccountRiskState]:
    """Account risk from the persisted ledger, scoped per execution mode.

    Paper and testnet history never count against LIVE limits, and vice
    versa. Daily loss is the net realized loss since 00:00 UTC.
    """

    def state(mode: ExecutionMode) -> AccountRiskState:
        if equity is None or equity <= 0:
            return untracked_account_state(mode)
        open_risk, realized = store.risk_totals(mode.value, utc_day_start())
        daily_loss = max(Decimal("0"), -realized)
        return AccountRiskState(
            daily_loss_pct=daily_loss / equity * HUNDRED,
            open_risk_pct=open_risk / equity * HUNDRED,
            tracked=True,
        )

    return state


@dataclass(frozen=True)
class AdapterAck:
    status: str
    order_id: str | None = None
    executed_quantity: str = "0"
    price: str | None = None


class AdapterRejected(Exception):
    """The venue definitively refused the order; nothing is open."""


class AdapterUncertain(Exception):
    """The venue outcome is unknown; recovery must reconcile by client id."""


class ExecutionAdapter(Protocol):
    def submit(self, intent: OrderIntent, client_order_id: str) -> AdapterAck:
        ...


@dataclass(frozen=True)
class ExecutionOutcome:
    outcome: Outcome
    client_order_id: str | None
    reasons: tuple[str, ...] = ()
    status: str | None = None
    order_id: str | None = None
    metrics: dict[str, str] = field(default_factory=dict)

    @property
    def accepted(self) -> bool:
        return self.outcome in {Outcome.VALIDATED, Outcome.SUBMITTED, Outcome.DUPLICATE}


def client_order_id_for(signal_id: str, mode: ExecutionMode) -> str:
    digest = hashlib.sha256(f"{mode.value}:{signal_id}".encode("utf-8")).hexdigest()
    return f"m1{digest[:30]}"


def _positive_decimal(value: str | None) -> Decimal | None:
    if value is None:
        return None
    try:
        number = Decimal(value)
    except (InvalidOperation, ValueError):
        return None
    return number if number.is_finite() and number > 0 else None


def _reward_risk(intent: OrderIntent, reference: Decimal) -> Decimal | None:
    if intent.side == "BUY":
        risk = reference - intent.stop_loss
        reward = intent.take_profit - reference
    else:
        risk = intent.stop_loss - reference
        reward = reference - intent.take_profit
    if risk <= 0 or reward <= 0:
        return None
    return reward / risk


class PaperAdapter:
    """Simulated fills at the reference price. Never touches the network."""

    def __init__(self, quote_provider: Callable[[str], MarketQuote]) -> None:
        self._quotes = quote_provider

    def submit(self, intent: OrderIntent, client_order_id: str) -> AdapterAck:
        quote = self._quotes(intent.symbol)
        fill = intent.price or str(quote.ask if intent.side == "BUY" else quote.bid)
        return AdapterAck(
            status="SIMULATED",
            order_id=f"paper-{client_order_id}",
            executed_quantity=intent.quantity,
            price=fill,
        )


class BinanceSpotAdapter:
    def __init__(self, client) -> None:
        self._client = client

    def submit(self, intent: OrderIntent, client_order_id: str) -> AdapterAck:
        try:
            payload = self._client.new_order(
                symbol=intent.symbol,
                side=intent.side,
                order_type=intent.order_type,
                quantity=intent.quantity,
                client_order_id=client_order_id,
                price=intent.price,
                time_in_force=intent.time_in_force,
            )
        except BinanceAPIError as exc:
            if exc.outcome_unknown:
                raise AdapterUncertain("binance_outcome_unknown") from exc
            raise AdapterRejected("binance_rejected") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("status"), str):
            raise AdapterUncertain("binance_response_unparseable")
        return AdapterAck(
            status=payload["status"],
            order_id=str(payload["orderId"]) if payload.get("orderId") is not None else None,
            executed_quantity=str(payload.get("executedQty", "0")),
            price=str(payload["price"]) if payload.get("price") is not None else intent.price,
        )


def binance_quote_provider(client) -> Callable[[str], MarketQuote]:
    def provide(symbol: str) -> MarketQuote:
        payload = client.book_ticker(symbol)
        return MarketQuote(bid=Decimal(payload["bidPrice"]), ask=Decimal(payload["askPrice"]))

    return provide


EXECUTABLE_MODES = {
    ExecutionMode.DRY_RUN,
    ExecutionMode.PAPER,
    ExecutionMode.TESTNET,
    ExecutionMode.LIVE,
}


class ExecutionPipeline:
    def __init__(
        self,
        *,
        adapter: ExecutionAdapter | None,
        quote_provider: Callable[[str], MarketQuote],
        limits: RiskLimits,
        account_state: Callable[[ExecutionMode], AccountRiskState] = untracked_account_state,
        live_requirements: LiveExecutionRequirements | None = None,
        live_enabled: bool = False,
    ) -> None:
        self._adapter = adapter
        self._quotes = quote_provider
        self._limits = limits
        self._account_state = account_state
        self._live_requirements = live_requirements or LiveExecutionRequirements()
        self._live_enabled = live_enabled

    def _reject(
        self,
        intent: OrderIntent,
        reasons: list[str] | tuple[str, ...],
        *,
        client_order_id: str | None = None,
        metrics: dict[str, str] | None = None,
    ) -> ExecutionOutcome:
        store.record_execution_audit(
            event="EXECUTION_REJECTED",
            status="REJECTED",
            detail=";".join(reasons),
            client_order_id=client_order_id,
            signal_id=intent.signal_id,
        )
        return ExecutionOutcome(
            Outcome.REJECTED, client_order_id, tuple(reasons), metrics=metrics or {}
        )

    def _validate_shape(self, intent: OrderIntent) -> list[str]:
        reasons: list[str] = []
        if intent.mode not in EXECUTABLE_MODES:
            reasons.append("mode_not_executable")
        if not intent.symbol or intent.symbol != intent.symbol.upper():
            reasons.append("invalid_symbol")
        if intent.side not in {"BUY", "SELL"}:
            reasons.append("invalid_side")
        if intent.order_type not in {"MARKET", "LIMIT"}:
            reasons.append("invalid_order_type")
        if _positive_decimal(intent.quantity) is None:
            reasons.append("invalid_quantity")
        if intent.order_type == "LIMIT":
            if _positive_decimal(intent.price) is None or intent.time_in_force is None:
                reasons.append("limit_requires_price_and_time_in_force")
        elif intent.price is not None:
            reasons.append("market_order_must_not_set_price")
        return reasons

    def _live_block_reasons(self, account: AccountRiskState) -> list[str]:
        reasons: list[str] = []
        if not self._live_enabled:
            reasons.append("live_execution_disabled")
        if not self._live_requirements.ready:
            reasons.append("live_readiness_incomplete")
        if not account.tracked:
            reasons.append("account_risk_untracked")
        return reasons

    def execute(self, intent: OrderIntent) -> ExecutionOutcome:
        shape = self._validate_shape(intent)
        if shape:
            return self._reject(intent, shape)

        if self._limits.account_equity is None or self._limits.account_equity <= 0:
            return self._reject(intent, ["account_equity_not_configured"])

        try:
            quote = self._quotes(intent.symbol)
            if quote.bid <= 0 or quote.ask < quote.bid:
                raise ValueError("crossed_or_empty_book")
        except (BinanceAPIError, KeyError, ValueError, TypeError, InvalidOperation):
            return self._reject(intent, ["market_quote_unavailable"])

        quantity = Decimal(intent.quantity)
        if intent.order_type == "LIMIT":
            reference = Decimal(intent.price)  # validated above
            slippage_bps = Decimal("0")
        else:
            reference = quote.ask if intent.side == "BUY" else quote.bid
            slippage_bps = abs(reference - quote.mid) / quote.mid * BPS

        notional = quantity * reference
        equity = self._limits.account_equity
        trade_risk_amount = quantity * abs(reference - intent.stop_loss)
        trade_risk_pct = trade_risk_amount / equity * HUNDRED
        account = self._account_state(intent.mode)
        reward_risk = _reward_risk(intent, reference)
        drift_bps = abs(reference - intent.entry) / intent.entry * BPS

        metrics = {
            "reference_price": str(reference),
            "notional": str(notional),
            "spread_bps": f"{quote.spread_bps:.4f}",
            "slippage_bps": f"{slippage_bps:.4f}",
            "entry_drift_bps": f"{drift_bps:.4f}",
            "trade_risk_pct": f"{trade_risk_pct:.4f}",
            "reward_risk": f"{reward_risk:.4f}" if reward_risk is not None else "invalid",
        }

        pre_reasons: list[str] = []
        if reward_risk is None:
            pre_reasons.append("invalid_levels_at_market")
        if drift_bps > self._limits.max_entry_drift_bps:
            pre_reasons.append("entry_price_drift")

        decision = evaluate_trade_risk(
            RiskInput(
                score=intent.score,
                reward_risk=reward_risk if reward_risk is not None else Decimal("0"),
                spread_bps=quote.spread_bps,
                estimated_slippage_bps=slippage_bps,
                daily_loss_pct=account.daily_loss_pct,
                max_daily_loss_pct=self._limits.max_daily_loss_pct,
                open_risk_pct=account.open_risk_pct + trade_risk_pct,
                max_open_risk_pct=self._limits.max_open_risk_pct,
                notional=notional,
                max_notional=self._limits.max_notional,
                kill_switch=self._limits.kill_switch,
            )
        )
        reasons = pre_reasons + list(decision.reasons)
        if reasons:
            return self._reject(intent, reasons, metrics=metrics)

        if intent.mode is ExecutionMode.LIVE:
            live_reasons = self._live_block_reasons(account)
            if live_reasons:
                return self._reject(intent, live_reasons, metrics=metrics)

        client_order_id = client_order_id_for(intent.signal_id, intent.mode)

        if intent.mode is ExecutionMode.DRY_RUN:
            store.record_execution_audit(
                event="EXECUTION_DRY_RUN",
                status="VALIDATED",
                detail="all_gates_passed_no_order_placed",
                client_order_id=client_order_id,
                signal_id=intent.signal_id,
            )
            return ExecutionOutcome(Outcome.VALIDATED, client_order_id, metrics=metrics)

        if self._adapter is None:
            return self._reject(
                intent, ["execution_adapter_not_configured"], metrics=metrics
            )

        claimed = store.claim_execution_order(
            client_order_id=client_order_id,
            signal_id=intent.signal_id,
            symbol=intent.symbol,
            side=intent.side,
            mode=intent.mode.value,
            quantity=intent.quantity,
            price=intent.price,
            risk_amount=str(trade_risk_amount),
            reference_price=str(reference),
            stop_loss=str(intent.stop_loss),
        )
        if not claimed:
            existing = store.get_execution_order(client_order_id) or {}
            store.record_execution_audit(
                event="EXECUTION_DUPLICATE",
                status=str(existing.get("status", "UNKNOWN")),
                detail="client_order_id_already_claimed_no_resubmit",
                client_order_id=client_order_id,
                signal_id=intent.signal_id,
            )
            return ExecutionOutcome(
                Outcome.DUPLICATE,
                client_order_id,
                ("duplicate_signal",),
                status=existing.get("status"),
                order_id=existing.get("order_id"),
                metrics=metrics,
            )

        store.record_execution_audit(
            event="EXECUTION_CLAIMED",
            status="PENDING_SUBMIT",
            detail=f"mode={intent.mode.value};notional={notional}",
            client_order_id=client_order_id,
            signal_id=intent.signal_id,
        )

        try:
            ack = self._adapter.submit(intent, client_order_id)
        except AdapterRejected as exc:
            store.update_execution_order(client_order_id, status="REJECTED")
            store.record_execution_audit(
                event="EXECUTION_SUBMIT",
                status="REJECTED",
                detail=str(exc),
                client_order_id=client_order_id,
                signal_id=intent.signal_id,
            )
            return ExecutionOutcome(
                Outcome.REJECTED, client_order_id, (str(exc),), status="REJECTED", metrics=metrics
            )
        except AdapterUncertain as exc:
            store.record_execution_audit(
                event="EXECUTION_SUBMIT",
                status="PENDING_SUBMIT",
                detail=f"{exc};awaiting_recovery",
                client_order_id=client_order_id,
                signal_id=intent.signal_id,
            )
            return ExecutionOutcome(
                Outcome.UNCERTAIN,
                client_order_id,
                (str(exc),),
                status="PENDING_SUBMIT",
                metrics=metrics,
            )

        store.update_execution_order(
            client_order_id,
            status=ack.status,
            order_id=ack.order_id,
            executed_quantity=ack.executed_quantity,
            price=ack.price,
        )
        store.record_execution_audit(
            event="EXECUTION_SUBMIT",
            status=ack.status,
            detail=f"order_id={ack.order_id}",
            client_order_id=client_order_id,
            signal_id=intent.signal_id,
        )
        return ExecutionOutcome(
            Outcome.SUBMITTED,
            client_order_id,
            status=ack.status,
            order_id=ack.order_id,
            metrics=metrics,
        )
