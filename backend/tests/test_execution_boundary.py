from decimal import Decimal

from app.execution_boundary import ExecutionIntent, dispatch_execution
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


def _intent(mode):
    return ExecutionIntent(
        client_order_id="m1-test-001",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        mode=mode,
    )


class FakeAdapter:
    def __init__(self):
        self.calls = 0

    def submit(self, intent):
        self.calls += 1
        return "testnet-order-123"


def test_rejected_risk_never_calls_adapter():
    adapter = FakeAdapter()
    result = dispatch_execution(
        _intent("TESTNET"), _risk(kill_switch=True), adapter=adapter
    )
    assert result.status == "rejected"
    assert result.reasons == ("kill_switch",)
    assert adapter.calls == 0


def test_live_is_blocked_even_with_adapter():
    adapter = FakeAdapter()
    result = dispatch_execution(_intent("LIVE"), _risk(), adapter=adapter)
    assert result.status == "blocked"
    assert result.reasons == ("live_execution_not_implemented",)
    assert adapter.calls == 0


def test_non_execution_mode_never_calls_adapter():
    adapter = FakeAdapter()
    result = dispatch_execution(_intent("PAPER"), _risk(), adapter=adapter)
    assert result.status == "not_submitted"
    assert adapter.calls == 0


def test_testnet_submits_only_after_risk_approval():
    adapter = FakeAdapter()
    result = dispatch_execution(_intent("TESTNET"), _risk(), adapter=adapter)
    assert result.status == "submitted_testnet"
    assert result.exchange_order_id == "testnet-order-123"
    assert adapter.calls == 1


def test_testnet_without_adapter_is_blocked():
    result = dispatch_execution(_intent("TESTNET"), _risk())
    assert result.status == "blocked"
    assert result.reasons == ("testnet_adapter_unavailable",)


def test_invalid_quantity_is_rejected_before_adapter():
    adapter = FakeAdapter()
    intent = ExecutionIntent(
        client_order_id="m1-test-002",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0"),
        mode="TESTNET",
    )
    result = dispatch_execution(intent, _risk(), adapter=adapter)
    assert result.status == "rejected"
    assert result.reasons == ("invalid_quantity",)
    assert adapter.calls == 0
