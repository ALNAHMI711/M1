from decimal import Decimal

from app.execution_policy import ExecutionRequest, ExecutionResult, submit_authorized
from app.risk_gate import RiskInput


class RecordingAdapter:
    execution_mode = "PAPER"

    def __init__(self):
        self.calls = []

    def submit(self, request):
        self.calls.append(request)
        return ExecutionResult(accepted=True, status="SUBMITTED")


class RaisingAdapter:
    execution_mode = "PAPER"

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


def test_allowed_paper_request_reaches_matching_adapter():
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


def test_testnet_is_blocked_before_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request(mode="TESTNET"))
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "testnet_execution_not_enabled"
    assert adapter.calls == []


def test_adapter_mode_must_match_request():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request(mode="DRY_RUN"))
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "execution_mode_adapter_mismatch"
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


def test_kill_switch_blocks_adapter_even_when_other_metrics_pass():
    adapter = RecordingAdapter()
    safe_risk = request().risk
    result = submit_authorized(
        adapter,
        request(risk=RiskInput(
            score=safe_risk.score,
            reward_risk=safe_risk.reward_risk,
            spread_bps=safe_risk.spread_bps,
            estimated_slippage_bps=safe_risk.estimated_slippage_bps,
            daily_loss_pct=safe_risk.daily_loss_pct,
            max_daily_loss_pct=safe_risk.max_daily_loss_pct,
            open_risk_pct=safe_risk.open_risk_pct,
            max_open_risk_pct=safe_risk.max_open_risk_pct,
            notional=safe_risk.notional,
            max_notional=safe_risk.max_notional,
            kill_switch=True,
        )),
    )
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "kill_switch"
    assert adapter.calls == []


def test_invalid_adapter_result_fails_closed():
    class MalformedResultAdapter:
        execution_mode = "PAPER"

        def submit(self, request):
            return {"accepted": True, "status": "SUBMITTED"}

    result = submit_authorized(MalformedResultAdapter(), request())
    assert result == ExecutionResult(
        accepted=False,
        status="ADAPTER_FAILURE",
        reason="invalid_adapter_result",
    )



def test_malformed_risk_object_is_rejected_before_adapter():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request(risk=None))
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "invalid_risk_input"
    assert adapter.calls == []


def test_adapter_mode_missing_is_rejected_before_adapter():
    class AdapterWithoutMode:
        def __init__(self):
            self.calls = []

        def submit(self, request):
            self.calls.append(request)
            return ExecutionResult(accepted=True, status="SUBMITTED")

    adapter = AdapterWithoutMode()
    result = submit_authorized(adapter, request())
    assert result.status == "REJECTED_BY_POLICY"
    assert result.reason == "execution_mode_adapter_mismatch"
    assert adapter.calls == []


def test_adapter_cannot_turn_rejected_policy_into_submission():
    adapter = RecordingAdapter()
    result = submit_authorized(adapter, request(side="TRANSFER"))
    assert result.accepted is False
    assert result.status == "REJECTED_BY_POLICY"
    assert adapter.calls == []
