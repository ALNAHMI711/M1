from decimal import Decimal

import pytest

from app.execution_gateway import (
    ExecutionBlocked,
    ExecutionGateway,
    ExecutionMode,
    ExecutionRequest,
)
from app.risk_gate import RiskDecision


def _request(mode=ExecutionMode.DRY_RUN):
    return ExecutionRequest(
        client_order_id="test-1",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        mode=mode,
    )


def test_execution_requires_risk_approval():
    with pytest.raises(ExecutionBlocked, match="risk_gate_rejected"):
        ExecutionGateway().submit(_request(), RiskDecision(False, ("kill_switch",)))


def test_live_execution_is_blocked_even_when_risk_approved():
    with pytest.raises(ExecutionBlocked, match="live_execution_not_enabled"):
        ExecutionGateway().submit(_request(ExecutionMode.LIVE), RiskDecision(True, ()))


def test_non_live_execution_requires_a_real_adapter():
    with pytest.raises(ExecutionBlocked, match="execution_adapter_not_configured"):
        ExecutionGateway().submit(_request(), RiskDecision(True, ()))
