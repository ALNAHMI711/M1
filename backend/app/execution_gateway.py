from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk


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
    risk: RiskInput


class ExecutionBlocked(ValueError):
    pass


class ExecutionGateway:
    """Execution boundary: risk approval is mandatory before transport.

    The gateway computes the risk decision itself so callers cannot forge an
    approved RiskDecision and bypass the hard gate. It contains no exchange
    implementation. LIVE remains denied until a separately reviewed adapter
    is installed and explicitly enabled.
    """

    def evaluate(self, request: ExecutionRequest) -> RiskDecision:
        return evaluate_trade_risk(request.risk)

    def submit(self, request: ExecutionRequest) -> None:
        decision = self.evaluate(request)
        if not decision.allowed:
            raise ExecutionBlocked("risk_gate_rejected")
        if request.mode is ExecutionMode.LIVE:
            raise ExecutionBlocked("live_execution_not_enabled")
        raise ExecutionBlocked("execution_adapter_not_configured")
