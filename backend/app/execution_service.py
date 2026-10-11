from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk
from .operations import kill_switch_active


@dataclass(frozen=True)
class ExecutionIntent:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    risk: RiskInput


@dataclass(frozen=True)
class ExecutionResult:
    accepted: bool
    client_order_id: str
    status: str
    reasons: tuple[str, ...] = ()


class ExecutionAdapter(Protocol):
    """Transport contract. Implementations must not bypass ExecutionService."""

    def submit(self, intent: ExecutionIntent) -> ExecutionResult:
        if kill_switch_active():
            return ExecutionResult(False, intent.client_order_id, "rejected", ("kill_switch",))
        ...


class ExecutionService:
    """Fail-closed orchestration boundary; adapter is called only after risk approval."""

    def __init__(
        self,
        adapter: ExecutionAdapter,
        *,
        live_enabled: bool = False,
    ) -> None:
        self._adapter = adapter
        self._live_enabled = live_enabled

    def submit(self, intent: ExecutionIntent) -> ExecutionResult:
        if not intent.client_order_id.strip():
            return ExecutionResult(False, intent.client_order_id, "rejected", ("invalid_client_order_id",))
        if not intent.symbol.strip() or intent.side not in {"BUY", "SELL"}:
            return ExecutionResult(False, intent.client_order_id, "rejected", ("invalid_order_parameters",))
        if not intent.quantity.is_finite() or intent.quantity <= 0:
            return ExecutionResult(False, intent.client_order_id, "rejected", ("invalid_quantity",))

        decision: RiskDecision = evaluate_trade_risk(intent.risk)
        if not decision.allowed:
            return ExecutionResult(False, intent.client_order_id, "rejected", decision.reasons)

        # No exchange transport is reachable unless explicitly enabled.
        if not self._live_enabled:
            return ExecutionResult(False, intent.client_order_id, "blocked", ("live_execution_disabled",))

        # A boolean is not a security/readiness certificate. This legacy entry
        # point cannot identify a verified TESTNET adapter, so it never submits.
        return ExecutionResult(False, intent.client_order_id, "blocked", ("live_readiness_verifier_required",))
