from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk


class ExecutionMode(StrEnum):
    DEVELOPMENT = "DEVELOPMENT"
    BACKTEST = "BACKTEST"
    DRY_RUN = "DRY_RUN"
    PAPER = "PAPER"
    TESTNET = "TESTNET"
    LIVE = "LIVE"


@dataclass(frozen=True)
class ExecutionRequest:
    symbol: str
    side: str
    quantity: str
    mode: ExecutionMode
    risk: RiskInput


@dataclass(frozen=True)
class ExecutionDecision:
    allowed: bool
    risk: RiskDecision
    reason: str | None = None


class OrderExecutor(Protocol):
    def execute(self, request: ExecutionRequest) -> object:
        ...


def _positive_decimal(value: str) -> bool:
    if not isinstance(value, str):
        return False
    try:
        number = Decimal(value)
    except (InvalidOperation, ValueError):
        return False
    return number.is_finite() and number > 0


def authorize_execution(
    request: ExecutionRequest,
    *,
    live_enabled: bool = False,
) -> ExecutionDecision:
    """Single pre-execution authorization boundary.

    No caller can turn a rejected risk decision into an exchange request.
    LIVE additionally requires an explicit server-side enablement flag.
    """
    if not request.symbol or request.symbol != request.symbol.upper():
        risk = RiskDecision(False, ("invalid_symbol",))
        return ExecutionDecision(False, risk, "invalid_symbol")
    if request.side.upper() not in {"BUY", "SELL"}:
        risk = RiskDecision(False, ("invalid_side",))
        return ExecutionDecision(False, risk, "invalid_side")
    if not _positive_decimal(request.quantity):
        risk = RiskDecision(False, ("invalid_quantity",))
        return ExecutionDecision(False, risk, "invalid_quantity")

    risk = evaluate_trade_risk(request.risk)
    if not risk.allowed:
        return ExecutionDecision(False, risk, "risk_rejected")

    if request.mode is ExecutionMode.LIVE and not live_enabled:
        return ExecutionDecision(False, risk, "live_execution_disabled")

    return ExecutionDecision(True, risk)
