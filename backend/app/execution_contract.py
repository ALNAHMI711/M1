from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
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
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    risk: RiskInput
    mode: ExecutionMode


@dataclass(frozen=True)
class ExecutionResult:
    accepted: bool
    client_order_id: str
    reason: str | None = None


class ExecutionAdapter(Protocol):
    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        ...


class RiskFirstExecutionService:
    def __init__(self, adapter: ExecutionAdapter, *, allow_live: bool = False) -> None:
        self._adapter = adapter
        self._allow_live = allow_live

    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        decision: RiskDecision = evaluate_trade_risk(request.risk)
        if not decision.allowed:
            return ExecutionResult(
                accepted=False,
                client_order_id=request.client_order_id,
                reason=";".join(decision.reasons),
            )
        if request.mode is ExecutionMode.LIVE and not self._allow_live:
            return ExecutionResult(
                accepted=False,
                client_order_id=request.client_order_id,
                reason="live_execution_disabled",
            )
        return self._adapter.submit(request)
