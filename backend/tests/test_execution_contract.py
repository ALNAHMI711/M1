from decimal import Decimal

from app.execution_contract import (
    ExecutionMode,
    ExecutionRequest,
    ExecutionResult,
    RiskFirstExecutionService,
)
from app.risk_gate import RiskInput


class Adapter:
    def __init__(self):
        self.calls = 0

    def submit(self, request):
        self.calls += 1
        return ExecutionResult(True, request.client_order_id)


def risk(**overrides):
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


def request(mode=ExecutionMode.DRY_RUN, **risk_overrides):
    return ExecutionRequest(
        client_order_id="test-001",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        risk=risk(**risk_overrides),
        mode=mode,
    )


def test_rejected_risk_never_reaches_adapter():
    adapter = Adapter()
    service = RiskFirstExecutionService(adapter)
    result = service.submit(request(score=80))
    assert result.accepted is False
    assert "score_below_threshold" in result.reason
    assert adapter.calls == 0


def test_live_is_blocked_even_when_risk_passes():
    adapter = Adapter()
    service = RiskFirstExecutionService(adapter)
    result = service.submit(request(ExecutionMode.LIVE))
    assert result.accepted is False
    assert result.reason == "live_execution_disabled"
    assert adapter.calls == 0


def test_allowed_non_live_request_reaches_adapter():
    adapter = Adapter()
    service = RiskFirstExecutionService(adapter)
    result = service.submit(request())
    assert result.accepted is True
    assert adapter.calls == 1


def test_live_requires_explicit_service_enablement():
    adapter = Adapter()
    service = RiskFirstExecutionService(adapter, allow_live=True)
    result = service.submit(request(ExecutionMode.LIVE))
    assert result.accepted is True
    assert adapter.calls == 1
