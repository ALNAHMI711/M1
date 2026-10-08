from decimal import Decimal

import pytest

from app.risk_gate import RiskInput
from app.risk_gated_executor import ExecutionIntent, RiskGatedExecutor


class RecordingTransport:
    def __init__(self):
        self.calls = []

    def submit(self, **kwargs):
        self.calls.append(kwargs)
        return {"accepted": True}


def _risk(**overrides):
    values = {
        "score": 90,
        "reward_risk": Decimal("2.5"),
        "spread_bps": Decimal("5"),
        "estimated_slippage_bps": Decimal("5"),
        "daily_loss_pct": Decimal("1"),
        "max_daily_loss_pct": Decimal("5"),
        "open_risk_pct": Decimal("1"),
        "max_open_risk_pct": Decimal("3"),
        "notional": Decimal("100"),
        "max_notional": Decimal("1000"),
    }
    values.update(overrides)
    return RiskInput(**values)


def _intent(**risk_overrides):
    return ExecutionIntent(
        client_order_id="TEST-1",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        risk=_risk(**risk_overrides),
    )


def test_rejected_intent_never_reaches_transport():
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport)

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(_intent(kill_switch=True))

    assert transport.calls == []


def test_approved_intent_reaches_transport():
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport)

    result = executor.submit(_intent())

    assert result == {"accepted": True}
    assert transport.calls == [{
        "client_order_id": "TEST-1",
        "symbol": "BTCUSDT",
        "side": "BUY",
        "quantity": Decimal("0.001"),
    }]
