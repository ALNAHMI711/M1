from decimal import Decimal

from app.execution_guard import ExecutionResult, GuardedExecutor, OrderRequest
from app.risk_gate import RiskDecision


class RecordingAdapter:
    def __init__(self):
        self.requests = []

    def submit(self, request):
        self.requests.append(request)
        return ExecutionResult(True, "SUBMITTED", "adapter_called")


def request(mode="TESTNET"):
    return OrderRequest("cid-1", "BTCUSDT", "BUY", Decimal("0.01"), mode)


def test_rejected_risk_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = GuardedExecutor(adapter).execute(
        request(),
        RiskDecision(False, ("kill_switch",)),
    )
    assert result.status == "RISK_REJECTED"
    assert adapter.requests == []


def test_live_is_disabled_by_default_and_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = GuardedExecutor(adapter).execute(
        request("LIVE"),
        RiskDecision(True, ()),
    )
    assert result.status == "LIVE_DISABLED"
    assert adapter.requests == []


def test_valid_testnet_request_reaches_adapter():
    adapter = RecordingAdapter()
    result = GuardedExecutor(adapter).execute(
        request(),
        RiskDecision(True, ()),
    )
    assert result.status == "SUBMITTED"
    assert len(adapter.requests) == 1


def test_unknown_mode_is_rejected_before_adapter():
    adapter = RecordingAdapter()
    result = GuardedExecutor(adapter).execute(
        request("UNKNOWN"),
        RiskDecision(True, ()),
    )
    assert result.status == "MODE_REJECTED"
    assert adapter.requests == []
