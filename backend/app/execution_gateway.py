from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum

from .risk_gate import RiskDecision


class ExecutionMode(str, Enum):
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
    mode: ExecutionMode


class ExecutionBlocked(ValueError):
    pass


class ExecutionGateway:
    """Execution boundary: risk approval is mandatory before transport.

    This interface intentionally contains no exchange implementation.
    LIVE is denied until a separately reviewed adapter is installed.
    """

    def submit(self, request: ExecutionRequest, decision: RiskDecision) -> None:
        if not decision.allowed:
            raise ExecutionBlocked("risk_gate_rejected")
        if request.mode is ExecutionMode.LIVE:
            raise ExecutionBlocked("live_execution_not_enabled")
        raise ExecutionBlocked("execution_adapter_not_configured")
