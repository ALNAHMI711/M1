from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk

VALID_SIDES = frozenset({"BUY", "SELL"})


@dataclass(frozen=True)
class ExecutionIntent:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    risk: RiskInput


class RiskGatedExecutor:
    """Execution boundary that requires explicit risk approval.

    Transport-agnostic; rejected intents never reach the injected adapter.
    This is not a live-readiness gate and must not enable LIVE trading.
    """

    def __init__(self, transport) -> None:
        self._transport = transport

    def authorize(self, intent: ExecutionIntent) -> RiskDecision:
        reasons: list[str] = []
        if not isinstance(intent.client_order_id, str) or not intent.client_order_id.strip():
            reasons.append("missing_client_order_id")
        if not isinstance(intent.symbol, str) or not intent.symbol.strip():
            reasons.append("missing_symbol")
        if intent.side not in VALID_SIDES:
            reasons.append("unsupported_side")
        quantity = intent.quantity
        if (
            not isinstance(quantity, Decimal)
            or not quantity.is_finite()
            or quantity <= Decimal("0")
        ):
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
