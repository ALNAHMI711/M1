from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal, Protocol

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk

VALID_SIDES = frozenset({"BUY", "SELL"})
ExecutionMode = Literal["DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET", "LIVE"]
NON_LIVE_MODES = frozenset({"DEVELOPMENT", "BACKTEST", "DRY_RUN", "PAPER", "TESTNET"})


class ExecutionTransport(Protocol):
    def submit(self, **kwargs): ...


@dataclass(frozen=True)
class ExecutionIntent:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    risk: RiskInput


class RiskGatedExecutor:
    """Transport-agnostic execution boundary with LIVE fail-closed by default.

    Risk approval is necessary but not sufficient for LIVE. This class has no
    production arming/readiness verifier, so LIVE is deliberately prohibited.
    """
    def __init__(
        self,
        transport: ExecutionTransport,
        *,
        mode: ExecutionMode = "DRY_RUN",
        live_enabled: bool = False,
    ) -> None:
        self._transport = transport
        self._mode = mode
        self._live_enabled = live_enabled

    def authorize(self, intent: ExecutionIntent) -> RiskDecision:
        reasons: list[str] = []
        if self._mode not in NON_LIVE_MODES and self._mode != "LIVE":
            reasons.append("invalid_execution_mode")
        if self._mode == "LIVE":
            # No complete server-side readiness/arming implementation exists yet.
            reasons.append("live_execution_not_implemented")
        if self._live_enabled:
            # A boolean flag alone is never sufficient authorization for LIVE.
            reasons.append("live_readiness_verifier_required")
        if not isinstance(intent, ExecutionIntent):
            return RiskDecision(False, ("invalid_execution_intent",))
        if not isinstance(intent.client_order_id, str) or not intent.client_order_id.strip():
            reasons.append("missing_client_order_id")
        if not isinstance(intent.symbol, str) or not intent.symbol.strip():
            reasons.append("missing_symbol")
        if not isinstance(intent.side, str) or intent.side not in VALID_SIDES:
            reasons.append("unsupported_side")
        quantity = intent.quantity
        if not isinstance(quantity, Decimal) or not quantity.is_finite() or quantity <= Decimal("0"):
            reasons.append("invalid_quantity")
        if reasons:
            return RiskDecision(False, tuple(reasons))
        return evaluate_trade_risk(intent.risk)

    def submit(self, intent: ExecutionIntent):
        decision = self.authorize(intent)
        if not decision.allowed:
            raise PermissionError("risk_gate_rejected")
        return self._transport.submit(
            client_order_id=intent.client_order_id,
            symbol=intent.symbol,
            side=intent.side,
            quantity=intent.quantity,
        )
