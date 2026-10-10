from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk
from .operations import kill_switch_active


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
    """Exchange boundary. Only the risk-gated service should call submit."""

    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        ...


def authorize_execution(
    request: ExecutionRequest,
    *,
    risk_decision: RiskDecision,
    live_enabled: bool = False,
) -> None:
    """Fail closed before an adapter receives an order request."""
    if not isinstance(request, ExecutionRequest):
        raise ValueError("invalid_execution_request")
    if not request.client_order_id or not request.symbol:
        raise ValueError("missing_execution_identity")
    if request.side not in {"BUY", "SELL"}:
        raise ValueError("invalid_execution_side")
    if not isinstance(request.quantity, Decimal) or not request.quantity.is_finite() or request.quantity <= 0:
        raise ValueError("invalid_execution_quantity")
    if request.mode not in {"DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"}:
        raise ValueError("invalid_execution_mode")
    if request.mode == "LIVE":
        raise PermissionError("execution_blocked:live_disabled")
    if kill_switch_active():
        raise PermissionError("execution_blocked:kill_switch")

    # Recompute the decision from the request at the boundary. A caller
    # cannot bypass risk by supplying a forged RiskDecision(True, ()).
    actual_decision = evaluate_trade_risk(request.risk)
    if not actual_decision.allowed:
        reason = ",".join(actual_decision.reasons) or "risk_rejected"
        raise PermissionError(f"execution_blocked:{reason}")
    if not risk_decision.allowed:
        reason = ",".join(risk_decision.reasons) or "risk_rejected"
        raise PermissionError(f"execution_blocked:{reason}")


def submit_after_risk(
    adapter: ExecutionAdapter,
    request: ExecutionRequest,
    *,
    risk_decision: RiskDecision,
    live_enabled: bool = False,
) -> ExecutionResult:
    authorize_execution(
        request,
        risk_decision=risk_decision,
        live_enabled=live_enabled,
    )
    if request.mode != "TESTNET":
        return ExecutionResult(False, request.client_order_id, status="NOT_SUBMITTED", reason="non_execution_mode")
    if getattr(adapter, "execution_mode", getattr(adapter, "mode", None)) != "TESTNET":
        raise PermissionError("execution_blocked:testnet_adapter_required")
    return adapter.submit(request)
