from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskInput, evaluate_trade_risk
from .operations import kill_switch_active


SUPPORTED_MODES = {"DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"}


@dataclass(frozen=True)
class ExecutionIntent:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    mode: str


@dataclass(frozen=True)
class ExecutionResult:
    status: str
    reasons: tuple[str, ...] = ()
    exchange_order_id: str | None = None


class ExecutionAdapter(Protocol):
    def submit(self, intent: ExecutionIntent) -> str:
        """Submit one validated intent and return the exchange order ID."""


def dispatch_execution(
    intent: ExecutionIntent,
    risk: RiskInput,
    *,
    adapter: ExecutionAdapter | None = None,
) -> ExecutionResult:
    """Single policy boundary before any exchange submission.

    LIVE is intentionally hard-disabled. Non-execution modes never call an
    adapter. TESTNET may submit only after risk approval and only with an
    explicitly supplied adapter. The adapter itself must implement exchange-
    specific authentication, precision, filters, and idempotent client IDs.
    """
    mode = intent.mode.upper()
    if kill_switch_active():
        return ExecutionResult("rejected", ("kill_switch",))
    if mode not in SUPPORTED_MODES:
        return ExecutionResult("rejected", ("unsupported_mode",))
    if not intent.client_order_id or not intent.symbol:
        return ExecutionResult("rejected", ("invalid_intent_identity",))
    if intent.side not in {"BUY", "SELL"}:
        return ExecutionResult("rejected", ("invalid_side",))
    if not intent.quantity.is_finite() or intent.quantity <= Decimal("0"):
        return ExecutionResult("rejected", ("invalid_quantity",))

    decision = evaluate_trade_risk(risk)
    if not decision.allowed:
        return ExecutionResult("rejected", decision.reasons)

    if mode == "LIVE":
        # Enabling LIVE requires a separate reviewed server-side security gate.
        return ExecutionResult("blocked", ("live_execution_not_implemented",))
    if mode != "TESTNET":
        return ExecutionResult("not_submitted", ("non_execution_mode",))
    if adapter is None:
        return ExecutionResult("blocked", ("testnet_adapter_unavailable",))
    if getattr(adapter, "execution_mode", getattr(adapter, "mode", None)) != "TESTNET":
        return ExecutionResult("blocked", ("testnet_adapter_required",))

    exchange_order_id = adapter.submit(intent)
    if not isinstance(exchange_order_id, str) or not exchange_order_id.strip():
        return ExecutionResult("error", ("invalid_adapter_order_id",))
    return ExecutionResult("submitted_testnet", exchange_order_id=exchange_order_id)
