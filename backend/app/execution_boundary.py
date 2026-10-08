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
    symbol: str
    side: str
    quantity: Decimal
    risk: RiskInput
    mode: ExecutionMode = ExecutionMode.DEVELOPMENT


@dataclass(frozen=True)
class ExecutionResult:
    accepted: bool
    reason: str
    risk: RiskDecision


class ExecutionAdapter(Protocol):
    def submit(self, request: ExecutionRequest) -> None:
        """Submit only through a configured, authenticated exchange adapter."""


class GuardedExecutionService:
    """Single application boundary between validated risk and order submission.

    The risk decision is mandatory and evaluated immediately before adapter
    submission. Rejected requests never reach the adapter. This service does
    not create simulated or exchange orders itself.
    """

    def __init__(self, adapter: ExecutionAdapter | None = None) -> None:
        self._adapter = adapter

    def evaluate(self, request: ExecutionRequest) -> RiskDecision:
        return evaluate_trade_risk(request.risk)

    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        decision = self.evaluate(request)
        if not decision.allowed:
            return ExecutionResult(
                accepted=False,
                reason="risk_rejected",
                risk=decision,
            )

        if self._adapter is None:
            return ExecutionResult(
                accepted=False,
                reason="execution_adapter_not_configured",
                risk=decision,
            )

        if request.quantity <= 0:
            raise ValueError("invalid_quantity")
        if not request.symbol or not request.side:
            raise ValueError("invalid_execution_request")

        self._adapter.submit(request)
        return ExecutionResult(
            accepted=True,
            reason="submitted",
            risk=decision,
        )
