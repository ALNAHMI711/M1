from decimal import Decimal

import pytest

from app.execution_contract import (
    ExecutionRequest,
    ExecutionResult,
    authorize_execution,
    submit_after_risk,
)
from app.risk_gate import RiskDecision, RiskInput


def _request():
    return ExecutionRequest(
        client_order_id="M1-TEST-1",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        mode="TESTNET",
        risk=RiskInput(
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
        ),
    )


def test_authorization_blocks_rejected_risk():
    with pytest.raises(PermissionError, match="execution_blocked"):
        authorize_execution(
            _request(),
            risk_decision=RiskDecision(False, ("kill_switch",)),
        )


def test_authorization_blocks_non_positive_quantity():
    request = _request()
    request = ExecutionRequest(**{**request.__dict__, "quantity": Decimal("0")})
    with pytest.raises(ValueError, match="invalid_execution_quantity"):
        authorize_execution(request, risk_decision=RiskDecision(True, ()))


def test_submit_after_risk_cannot_call_adapter_when_blocked():
    class Adapter:
        called = False

        def submit(self, request):
            self.called = True
            return ExecutionResult(True, request.client_order_id, "1", "NEW")

    adapter = Adapter()
    with pytest.raises(PermissionError):
        submit_after_risk(
            adapter,
            _request(),
            risk_decision=RiskDecision(False, ("score_below_threshold",)),
        )
    assert adapter.called is False
