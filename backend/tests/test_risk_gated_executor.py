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


def _intent(**overrides):
    values = {
        "client_order_id": "TEST-1",
        "symbol": "BTCUSDT",
        "side": "BUY",
        "quantity": Decimal("0.001"),
        "risk": _risk(),
    }
    values.update(overrides)
    return ExecutionIntent(**values)


def test_rejected_intent_never_reaches_transport():
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport)

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(_intent(risk=_risk(kill_switch=True)))

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


@pytest.mark.parametrize(
    ("overrides", "expected"),
    [
        ({"client_order_id": ""}, "missing_client_order_id"),
        ({"symbol": ""}, "missing_symbol"),
        ({"side": "HACK"}, "unsupported_side"),
        ({"quantity": Decimal("0")}, "invalid_quantity"),
        ({"quantity": Decimal("NaN")}, "invalid_quantity"),
        ({"quantity": Decimal("Infinity")}, "invalid_quantity"),
    ],
)
def test_invalid_intent_never_reaches_transport(overrides, expected):
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport)

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(_intent(**overrides))

    assert transport.calls == []
    assert expected in executor.authorize(_intent(**overrides)).reasons


@pytest.mark.parametrize("live_enabled", [False, True])
def test_live_mode_is_blocked_even_when_boolean_flag_is_true(live_enabled):
    transport = RecordingTransport()
    executor = RiskGatedExecutor(
        transport,
        mode="LIVE",
        live_enabled=live_enabled,
    )

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(_intent())

    assert transport.calls == []
    reasons = executor.authorize(_intent()).reasons
    assert "live_execution_not_implemented" in reasons
    if live_enabled:
        assert "live_readiness_verifier_required" in reasons
