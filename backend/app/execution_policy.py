from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk

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
    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        ...


def _validate_request(request: ExecutionRequest) -> tuple[str, ...]:
    reasons: list[str] = []
    if not request.client_order_id.strip():
        reasons.append("missing_client_order_id")
    if not request.signal_id.strip():
        reasons.append("missing_signal_id")
    if not request.symbol.strip():
        reasons.append("missing_symbol")
    if request.side not in SUPPORTED_SIDES:
        reasons.append("unsupported_side")
    if request.quantity <= Decimal("0"):
        reasons.append("invalid_quantity")
    if request.mode not in ALLOWED_EXECUTION_MODES:
        reasons.append("unsupported_execution_mode")
    return tuple(reasons)


def authorize_execution(request: ExecutionRequest) -> RiskDecision:
    """Single mandatory authorization point before any adapter submission."""
    validation_reasons = _validate_request(request)
    if validation_reasons:
        return RiskDecision(False, validation_reasons)

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
            status="REJECTED_BY_POLICY",
            reason=",".join(decision.reasons),
        )
    return adapter.submit(request)
