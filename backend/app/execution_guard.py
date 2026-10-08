from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Protocol

from .risk_gate import RiskDecision


@dataclass(frozen=True)
class OrderRequest:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    mode: str


@dataclass(frozen=True)
class ExecutionResult:
    accepted: bool
    status: str
    detail: str


class ExecutionAdapter(Protocol):
    def submit(self, request: OrderRequest) -> ExecutionResult:
        ...


class GuardedExecutor:
    """Single choke point between approved risk decisions and an adapter.

    LIVE remains disabled until the production readiness gate is explicitly
    enabled by a future server-side configuration. No adapter is called when
    risk rejects the request or when LIVE is not enabled.
    """

    def __init__(self, adapter: ExecutionAdapter, *, live_enabled: bool = False):
        self._adapter = adapter
        self._live_enabled = live_enabled

    def execute(self, request: OrderRequest, decision: RiskDecision) -> ExecutionResult:
        if not decision.allowed:
            return ExecutionResult(False, "RISK_REJECTED", ",".join(decision.reasons))

        if request.mode == "LIVE" and not self._live_enabled:
            return ExecutionResult(False, "LIVE_DISABLED", "live_execution_not_enabled")

        if request.mode not in {"DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"}:
            return ExecutionResult(False, "MODE_REJECTED", "unsupported_execution_mode")

        return self._adapter.submit(request)
