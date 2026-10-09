from decimal import Decimal

from app.execution_service import ExecutionIntent, ExecutionResult, ExecutionService
from app.risk_gate import RiskInput


class SpyAdapter:
    def __init__(self):
        self.calls = 0

    def submit(self, intent):
        self.calls += 1
        return ExecutionResult(True, intent.client_order_id, "accepted")


def risk(**overrides):
    values = dict(
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
    values.update(overrides)
    return RiskInput(**values)


def intent(**overrides):
    values = dict(
        client_order_id="test-client-1",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        risk=risk(),
    )
    values.update(overrides)
    return ExecutionIntent(**values)


def test_adapter_never_called_when_live_is_disabled():
    adapter = SpyAdapter()
    result = ExecutionService(adapter, live_enabled=False).submit(intent())
    assert result.status == "blocked"
    assert result.reasons == ("live_execution_disabled",)
    assert adapter.calls == 0


def test_risk_rejection_prevents_adapter_call_even_if_live_enabled():
    adapter = SpyAdapter()
    rejected_intent = intent(risk=risk(kill_switch=True))
    result = ExecutionService(adapter, live_enabled=True).submit(rejected_intent)
    assert result.status == "rejected"
    assert result.reasons == ("kill_switch",)
    assert adapter.calls == 0


def test_invalid_quantity_prevents_adapter_call():
    adapter = SpyAdapter()
    result = ExecutionService(adapter, live_enabled=True).submit(
        intent(quantity=Decimal("0"))
    )
    assert result.status == "rejected"
    assert result.reasons == ("invalid_quantity",)
    assert adapter.calls == 0


def test_adapter_called_only_after_valid_risk_approval():
    adapter = SpyAdapter()
    result = ExecutionService(adapter, live_enabled=True).submit(intent())
    assert result.accepted is True
    assert result.status == "accepted"
    assert adapter.calls == 1
