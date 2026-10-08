from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput


@dataclass(frozen=True)
class ExecutionRequest:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    mode: str
    risk: RiskInput


@dataclass(frozen=True)
class ExecutionResult:
    accepted: bool
    client_order_id: str
    order_id: str | None = None
    status: str = "REJECTED"
    reason: str | None = None


class ExecutionAdapter(Protocol):
    """Exchange boundary. Implementations must not bypass risk authorization."""

    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        ...


def authorize_execution(
    request: ExecutionRequest,
    *,
    risk_decision: RiskDecision,
) -> None:
    """Hard authorization boundary before an adapter receives a request."""
    if not risk_decision.allowed:
        reason = ",".join(risk_decision.reasons) or "risk_rejected"
        raise PermissionError(f"execution_blocked:{reason}")
    if request.quantity <= 0:
        raise ValueError("invalid_execution_quantity")


def submit_after_risk(
    adapter: ExecutionAdapter,
    request: ExecutionRequest,
    *,
    risk_decision: RiskDecision,
) -> ExecutionResult:
    authorize_execution(request, risk_decision=risk_decision)
    return adapter.submit(request)
