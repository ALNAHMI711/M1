from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk
from .operations import kill_switch_active

ALLOWED_EXECUTION_MODES = frozenset(
    {"DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"}
)
SUPPORTED_SIDES = frozenset({"BUY", "SELL"})


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
    execution_mode: str

    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        ...


def _validate_request(request: ExecutionRequest) -> tuple[str, ...]:
    if not isinstance(request, ExecutionRequest):
        return ("invalid_execution_request",)
    reasons: list[str] = []
    if not isinstance(request.client_order_id, str) or not request.client_order_id.strip():
        reasons.append("missing_client_order_id")
    if not isinstance(request.signal_id, str) or not request.signal_id.strip():
        reasons.append("missing_signal_id")
    if not isinstance(request.symbol, str) or not request.symbol.strip():
        reasons.append("missing_symbol")
    if not isinstance(request.side, str) or request.side not in SUPPORTED_SIDES:
        reasons.append("unsupported_side")
    if (
        not isinstance(request.quantity, Decimal)
        or not request.quantity.is_finite()
        or request.quantity <= Decimal("0")
    ):
        reasons.append("invalid_quantity")
    if not isinstance(request.mode, str) or request.mode not in ALLOWED_EXECUTION_MODES:
        reasons.append("unsupported_execution_mode")
    return tuple(reasons)


def authorize_execution(request: ExecutionRequest) -> RiskDecision:
    """Single mandatory authorization point before any adapter submission."""
    validation_reasons = _validate_request(request)
    if validation_reasons:
        return RiskDecision(False, validation_reasons)
    if kill_switch_active():
        return RiskDecision(False, ("kill_switch",))

    if request.mode in {"LIVE", "TESTNET"}:
        # These modes remain blocked until their authenticated adapters,
        # reconciliation/recovery, audit and deployment gates are validated.
        return RiskDecision(False, (f"{request.mode.lower()}_execution_not_enabled",))

    return evaluate_trade_risk(request.risk)


def submit_authorized(
    adapter: ExecutionAdapter,
    request: ExecutionRequest,
) -> ExecutionResult:
    if not callable(getattr(adapter, "submit", None)):
        return ExecutionResult(False, "ADAPTER_FAILURE", "invalid_execution_adapter")

    decision = authorize_execution(request)
    if not decision.allowed:
        return ExecutionResult(
            accepted=False,
            status="REJECTED_BY_POLICY",
            reason=",".join(decision.reasons),
        )

    adapter_mode = getattr(adapter, "execution_mode", None)
    if adapter_mode != request.mode:
        return ExecutionResult(
            accepted=False,
            status="REJECTED_BY_POLICY",
            reason="execution_mode_adapter_mismatch",
        )

    try:
        result = adapter.submit(request)
    except Exception:
        # Do not expose exchange response bodies, credentials, or internal errors.
        return ExecutionResult(
            accepted=False,
            status="ADAPTER_FAILURE",
            reason="adapter_submission_failed",
        )
    if not isinstance(result, ExecutionResult):
        return ExecutionResult(
            accepted=False,
            status="ADAPTER_FAILURE",
            reason="invalid_adapter_result",
        )
    return result
