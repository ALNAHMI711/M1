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


def _risk():
    return RiskInput(
        score=90,
        reward_risk=Decimal("2.5"),
        spread_bps=Decimal("5"),
        estimated_slippage_bps=Decimal("5"),
        daily_loss_pct=Decimal("1"),
        max_daily_loss_pct=Decimal("5"),
        open_risk_pct=Decimal("1"),
        max_open_risk_pct=Decimal("3"),
        notional=Decimal("100"),
        max_notional=Decimal("1000"),
    )


def _intent():
    return ExecutionIntent("TEST-1", "BTCUSDT", "BUY", Decimal("0.001"), _risk())


def test_live_mode_is_blocked_even_when_boolean_flag_is_true():
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport, mode="LIVE", live_enabled=True)

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(_intent())

    assert transport.calls == []
    assert "live_execution_not_implemented" in executor.authorize(_intent()).reasons
    assert "live_readiness_verifier_required" in executor.authorize(_intent()).reasons


def test_unknown_mode_fails_closed():
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport, mode="REALTIME")

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(_intent())

    assert transport.calls == []
    assert "invalid_execution_mode" in executor.authorize(_intent()).reasons


def test_non_live_mode_still_requires_risk_approval():
    transport = RecordingTransport()
    executor = RiskGatedExecutor(transport, mode="TESTNET")
    bad_risk = RiskInput(
        score=10,
        reward_risk=Decimal("1"),
        spread_bps=Decimal("5"),
        estimated_slippage_bps=Decimal("5"),
        daily_loss_pct=Decimal("1"),
        max_daily_loss_pct=Decimal("5"),
        open_risk_pct=Decimal("1"),
        max_open_risk_pct=Decimal("3"),
        notional=Decimal("100"),
        max_notional=Decimal("1000"),
    )
    intent = ExecutionIntent("TEST-2", "BTCUSDT", "BUY", Decimal("0.001"), bad_risk)

    with pytest.raises(PermissionError, match="risk_gate_rejected"):
        executor.submit(intent)

    assert transport.calls == []
