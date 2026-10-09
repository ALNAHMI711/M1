from decimal import Decimal

from app.execution_policy import ExecutionRequest, ExecutionResult, submit_authorized
from app.risk_gate import RiskInput


class RecordingAdapter:
    def __init__(self):
        self.calls = []

    def submit(self, request):
        self.calls.append(request)
        return ExecutionResult(accepted=True, status="SUBMITTED")


class RaisingAdapter:
    def submit(self, request):
        raise RuntimeError("private exchange response must not leak")


def request(**overrides):
    values = dict(
        client_order_id="m1-test-1",
        signal_id="sig-1",
        symbol="BTCUSDT",
        side="BUY",
        quantity=Decimal("0.001"),
        mode="PAPER",
        risk=RiskInput(
            score=90, reward_risk=Decimal("2.5"), spread_bps=Decimal("5"),
            estimated_slippage_bps=Decimal("5"), daily_loss_pct=Decimal("1"),
            max_daily_loss_pct=Decimal("5"), open_risk_pct=Decimal("1"),
            max_open_risk_pct=Decimal("3"), notional=Decimal("100"),
            max_notional=Decimal("1000"),
        ),
    )
    values.update(overrides)
    return ExecutionRequest(**values)


def test_rejected_risk_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(
        adapter,
        request(risk=RiskInput(
            score=70, reward_risk=Decimal("1.0"), spread_bps=Decimal("30"),
            estimated_slippage_bps=Decimal("30"), daily_loss_pct=Decimal("6"),
            max_daily_loss_pct=Decimal("5"), open_risk_pct=Decimal("4"),
            max_open_risk_pct=Decimal("3"), notional=Decimal("1200"),
            max_notional=Decimal("1000"),
        )),
    )
    assert result.status == "REJECTED_BY_POLICY"
    assert adapter.calls == []


def test_allowed_paper_request_reaches_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request())
    assert result.accepted is True
    assert len(adapter.calls) == 1


def test_live_is_blocked_before_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request(mode="LIVE"))
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "live_execution_not_enabled"
    assert adapter.calls == []


def test_invalid_execution_request_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(
        adapter,
        request(side="HACK", quantity=Decimal("0"), mode="UNKNOWN"),
    )
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == (
        "unsupported_side,invalid_quantity,unsupported_execution_mode"
    )
    assert adapter.calls == []


def test_blank_identity_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(
        adapter,
        request(client_order_id="", signal_id="", symbol=""),
    )
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == (
        "missing_client_order_id,missing_signal_id,missing_symbol"
    )
    assert adapter.calls == []


def test_non_finite_quantity_never_reaches_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request(quantity=Decimal("NaN")))
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "invalid_quantity"
    assert adapter.calls == []


def test_adapter_exception_is_sanitized():
    result = submit_authorized(RaisingAdapter(), request())
    assert result == ExecutionResult(
        accepted=False,
        status="ADAPTER_FAILURE",
        reason="adapter_submission_failed",
    )

def test_malformed_request_fails_closed_without_adapter_call():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, None)
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "invalid_execution_request"
    assert adapter.calls == []


def test_invalid_adapter_interface_fails_closed():
    result = submit_authorized(object(), request())
    assert result == ExecutionResult(
        accepted=False,
        status="ADAPTER_FAILURE",
        reason="invalid_execution_adapter",
    )
