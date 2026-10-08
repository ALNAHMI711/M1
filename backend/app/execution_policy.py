from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk


@dataclass(frozen=True)
class ExecutionRequest:
    client_order_id: str
    signal_id: str
    symbol: str
    side: str
    quantity: Decimal
    mode: str
    risk: RiskInput


@dataclass(frozen=True)
class ExecutionResult:
    accepted: bool
    status: str
    reason: str | None = None


class ExecutionAdapter(Protocol):
    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        ...


def authorize_execution(request: ExecutionRequest) -> RiskDecision:
    """Single mandatory authorization point before any adapter submission."""
    if request.mode == "LIVE":
        # LIVE stays explicitly blocked until a production adapter is wired
        # with authenticated exchange calls, recovery, audit, and deployment gates.
        return RiskDecision(False, ("live_execution_not_enabled",))
    return evaluate_trade_risk(request.risk)


def submit_authorized(
    adapter: ExecutionAdapter,
    request: ExecutionRequest,
) -> ExecutionResult:
    decision = authorize_execution(request)
    if not decision.allowed:
        return ExecutionResult(
            accepted=False,
            status="REJECTED_BY_RISK",
            reason=",".join(decision.reasons),
        )
    return adapter.submit(request)
