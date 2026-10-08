from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .risk_gate import RiskDecision, RiskInput, evaluate_trade_risk


@dataclass(frozen=True)
class ExecutionIntent:
    client_order_id: str
    symbol: str
    side: str
    quantity: Decimal
    risk: RiskInput


class RiskGatedExecutor:
    """Execution boundary that requires an explicit risk approval.

    The executor is deliberately transport-agnostic. A real Binance adapter
    must be injected later; rejected intents never reach that adapter.
    """

    def __init__(self, transport) -> None:
        self._transport = transport

    def authorize(self, intent: ExecutionIntent) -> RiskDecision:
        decision = evaluate_trade_risk(intent.risk)
        if not decision.allowed:
            return decision
        return decision

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
