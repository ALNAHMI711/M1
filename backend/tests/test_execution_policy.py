from decimal import Decimal

from app.execution_policy import ExecutionMode, ExecutionRequest, authorize_execution
from app.risk_gate import RiskInput


def _request(**overrides):
    values = {
        "symbol": "BTCUSDT",
        "side": "BUY",
        "quantity": "0.001",
        "mode": ExecutionMode.TESTNET,
        "risk": RiskInput(
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
    }
    values.update(overrides)
    return ExecutionRequest(**values)


def test_testnet_execution_is_authorized_when_risk_passes():
    decision = authorize_execution(_request())
    assert decision.allowed is True
    assert decision.reason is None


def test_live_is_blocked_by_default():
    decision = authorize_execution(_request(mode=ExecutionMode.LIVE))
    assert decision.allowed is False
    assert decision.reason == "live_execution_disabled"


def test_live_can_never_bypass_a_rejected_risk_gate():
    risk = _request().risk
    risk = type(risk)(**{**risk.__dict__, "score": 50})
    decision = authorize_execution(
        _request(mode=ExecutionMode.LIVE, risk=risk),
        live_enabled=True,
    )
    assert decision.allowed is False
    assert decision.reason == "risk_rejected"


def test_invalid_symbol_and_side_are_rejected_before_execution():
    assert authorize_execution(_request(symbol="btcusdt")).reason == "invalid_symbol"
    assert authorize_execution(_request(side="HOLD")).reason == "invalid_side"


def test_invalid_quantities_are_rejected_before_risk():
    for quantity in ("0", "-1", "NaN", "Infinity", "not-a-number"):
        decision = authorize_execution(_request(quantity=quantity))
        assert decision.allowed is False
        assert decision.reason == "invalid_quantity"
