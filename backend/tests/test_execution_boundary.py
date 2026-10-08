from decimal import Decimal

from app.execution_boundary import (
    ExecutionMode,
    ExecutionRequest,
    GuardedExecutionService,
)
from app.risk_gate import RiskInput


class RecordingAdapter:
    def __init__(self):
        self.requests = []

    def submit(self, request):
        self.requests.append(request)


def _request(**risk_overrides):
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
    values.update(risk_overrides)
    return ExecutionRequest(
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        risk=RiskInput(**values),
        mode=ExecutionMode.TESTNET,
    )


def test_rejected_risk_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = GuardedExecutionService(adapter).submit(_request(score=80))
    assert result.accepted is False
    assert result.reason == "risk_rejected"
    assert adapter.requests == []


def test_allowed_request_requires_real_adapter():
    result = GuardedExecutionService().submit(_request())
    assert result.accepted is False
    assert result.reason == "execution_adapter_not_configured"


def test_allowed_request_reaches_configured_adapter():
    adapter = RecordingAdapter()
    result = GuardedExecutionService(adapter).submit(_request())
    assert result.accepted is True
    assert result.reason == "submitted"
    assert len(adapter.requests) == 1
    assert adapter.requests[0].symbol == "BTCUSDT"


def test_invalid_quantity_is_rejected_before_adapter():
    adapter = RecordingAdapter()
    request = _request()
    request = ExecutionRequest(
        symbol=request.symbol,
        side=request.side,
        quantity=Decimal("0"),
        risk=request.risk,
        mode=request.mode,
    )
    try:
        GuardedExecutionService(adapter).submit(request)
    except ValueError as exc:
        assert str(exc) == "invalid_quantity"
    else:
        raise AssertionError("expected invalid_quantity")
    assert adapter.requests == []
