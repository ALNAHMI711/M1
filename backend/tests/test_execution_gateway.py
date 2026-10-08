from decimal import Decimal

import pytest

from app.execution_gateway import (
    ExecutionBlocked,
    ExecutionGateway,
    ExecutionMode,
    ExecutionRequest,
)
from app.risk_gate import RiskInput


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


def _request(mode=ExecutionMode.DRY_RUN, **risk_overrides):
    return ExecutionRequest(
        client_order_id="test-1",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        mode=mode,
        risk=_risk(**risk_overrides),
    )


def test_execution_recomputes_risk_and_blocks_failed_gate():
    with pytest.raises(ExecutionBlocked, match="risk_gate_rejected"):
        ExecutionGateway().submit(_request(kill_switch=True))


def test_execution_does_not_accept_forged_approval():
    with pytest.raises(TypeError):
        ExecutionGateway().submit(_request(), object())


def test_live_execution_is_blocked_even_when_risk_approved():
    with pytest.raises(ExecutionBlocked, match="live_execution_not_enabled"):
        ExecutionGateway().submit(_request(ExecutionMode.LIVE))


def test_non_live_execution_requires_a_real_adapter():
    with pytest.raises(ExecutionBlocked, match="execution_adapter_not_configured"):
        ExecutionGateway().submit(_request())
