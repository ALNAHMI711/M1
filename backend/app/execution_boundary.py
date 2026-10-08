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
    """Hard boundary between risk validation and exchange submission.

    Risk is evaluated immediately before adapter submission. LIVE is
    disabled by default and cannot be enabled by this service alone.
    """

    def __init__(
        self,
        adapter: ExecutionAdapter | None = None,
        *,
        live_enabled: bool = False,
    ) -> None:
        self._adapter = adapter
        self._live_enabled = live_enabled

    def evaluate(self, request: ExecutionRequest) -> RiskDecision:
        return evaluate_trade_risk(request.risk)

    def submit(self, request: ExecutionRequest) -> ExecutionResult:
        decision = self.evaluate(request)
        if not decision.allowed:
            return ExecutionResult(False, "risk_rejected", decision)

        if request.quantity <= 0:
            raise ValueError("invalid_quantity")
        if not request.symbol or not request.side:
            raise ValueError("invalid_execution_request")

        if request.mode is ExecutionMode.LIVE and not self._live_enabled:
            return ExecutionResult(False, "live_execution_disabled", decision)

        if self._adapter is None:
            return ExecutionResult(False, "execution_adapter_not_configured", decision)

        self._adapter.submit(request)
        return ExecutionResult(True, "submitted", decision)
