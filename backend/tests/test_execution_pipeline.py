from decimal import Decimal

import pytest

from app import store
from app.binance_spot import BinanceAPIError
from app.execution_boundary import ExecutionMode, LiveExecutionRequirements
from app.execution_pipeline import (
    AccountRiskState,
    AdapterAck,
    AdapterRejected,
    AdapterUncertain,
    BinanceSpotAdapter,
    ExecutionPipeline,
    MarketQuote,
    OrderIntent,
    Outcome,
    PaperAdapter,
    RiskLimits,
    client_order_id_for,
)


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))


def quotes(bid="99.99", ask="100.01"):
    return lambda symbol: MarketQuote(Decimal(bid), Decimal(ask))


LIMITS = RiskLimits(account_equity=Decimal("10000"), max_notional=Decimal("1000"))


def intent(**overrides):
    values = dict(
        signal_id="signal-0001",
        symbol="BTCUSDT",
        side="BUY",
        order_type="MARKET",
        quantity="1",
        mode=ExecutionMode.TESTNET,
        score=92,
        entry=Decimal("100"),
        stop_loss=Decimal("98"),
        take_profit=Decimal("106"),
    )
    values.update(overrides)
    return OrderIntent(**values)


class RecordingAdapter:
    def __init__(self, ack=None, error=None):
        self.calls = []
        self._ack = ack or AdapterAck(status="NEW", order_id="42")
        self._error = error

    def submit(self, order, client_order_id):
        self.calls.append((order, client_order_id))
        if self._error:
            raise self._error
        return self._ack


def pipeline(adapter=None, **kwargs):
    kwargs.setdefault("quote_provider", quotes())
    kwargs.setdefault("limits", LIMITS)
    return ExecutionPipeline(adapter=adapter, **kwargs)


def test_approved_order_is_submitted_persisted_and_audited():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter).execute(intent())

    assert outcome.outcome is Outcome.SUBMITTED
    assert outcome.order_id == "42"
    assert len(adapter.calls) == 1
    row = store.get_execution_order(outcome.client_order_id)
    assert row["status"] == "NEW" and row["order_id"] == "42"
    events = [item["event"] for item in store.recent_execution_audit()]
    assert events[:2] == ["EXECUTION_SUBMIT", "EXECUTION_CLAIMED"]


def test_replayed_signal_never_reaches_adapter_twice():
    adapter = RecordingAdapter()
    service = pipeline(adapter)
    first = service.execute(intent())
    second = service.execute(intent())

    assert first.outcome is Outcome.SUBMITTED
    assert second.outcome is Outcome.DUPLICATE
    assert second.client_order_id == first.client_order_id
    assert len(adapter.calls) == 1


def test_risk_rejection_blocks_adapter():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter).execute(intent(score=70))

    assert outcome.outcome is Outcome.REJECTED
    assert "score_below_threshold" in outcome.reasons
    assert adapter.calls == []
    assert store.get_execution_order(client_order_id_for("signal-0001", ExecutionMode.TESTNET)) is None


def test_reward_risk_is_recomputed_at_market_price():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter, quote_provider=quotes("101.49", "101.51")).execute(intent())

    assert outcome.outcome is Outcome.REJECTED
    assert "reward_risk_below_threshold" in outcome.reasons
    assert "entry_price_drift" in outcome.reasons
    assert adapter.calls == []


def test_wide_spread_and_notional_limits_reject():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter, quote_provider=quotes("99", "101")).execute(
        intent(quantity="20")
    )

    assert {"spread_above_limit", "notional_limit"} <= set(outcome.reasons)
    assert adapter.calls == []


def test_kill_switch_rejects():
    limits = RiskLimits(account_equity=Decimal("10000"), max_notional=Decimal("1000"), kill_switch=True)
    adapter = RecordingAdapter()
    outcome = pipeline(adapter, limits=limits).execute(intent())

    assert "kill_switch" in outcome.reasons
    assert adapter.calls == []


def test_missing_equity_fails_closed():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter, limits=RiskLimits(account_equity=None)).execute(intent())

    assert outcome.reasons == ("account_equity_not_configured",)
    assert adapter.calls == []


def test_quote_failure_fails_closed():
    def broken(symbol):
        raise BinanceAPIError("binance_transport_error")

    adapter = RecordingAdapter()
    outcome = pipeline(adapter, quote_provider=broken).execute(intent())

    assert outcome.reasons == ("market_quote_unavailable",)
    assert adapter.calls == []


def test_live_is_blocked_by_default_even_when_risk_passes():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter).execute(intent(mode=ExecutionMode.LIVE))

    assert outcome.outcome is Outcome.REJECTED
    assert set(outcome.reasons) == {
        "live_execution_disabled",
        "live_readiness_incomplete",
        "account_risk_untracked",
    }
    assert adapter.calls == []


def test_live_requires_tracked_account_risk():
    ready = LiveExecutionRequirements(True, True, True, True, True)
    adapter = RecordingAdapter()
    outcome = pipeline(adapter, live_requirements=ready, live_enabled=True).execute(
        intent(mode=ExecutionMode.LIVE)
    )

    assert outcome.reasons == ("account_risk_untracked",)
    assert adapter.calls == []


def test_live_passes_only_when_every_gate_is_satisfied():
    ready = LiveExecutionRequirements(True, True, True, True, True)
    adapter = RecordingAdapter()
    outcome = pipeline(
        adapter,
        live_requirements=ready,
        live_enabled=True,
        account_state=lambda: AccountRiskState(Decimal("0"), Decimal("0"), tracked=True),
    ).execute(intent(mode=ExecutionMode.LIVE))

    assert outcome.outcome is Outcome.SUBMITTED
    assert len(adapter.calls) == 1


def test_existing_open_risk_counts_against_limit():
    adapter = RecordingAdapter()
    outcome = pipeline(
        adapter,
        account_state=lambda: AccountRiskState(Decimal("0"), Decimal("2.99"), tracked=True),
    ).execute(intent())

    assert "open_risk_limit" in outcome.reasons


def test_daily_loss_limit_rejects():
    adapter = RecordingAdapter()
    outcome = pipeline(
        adapter,
        account_state=lambda: AccountRiskState(Decimal("2"), Decimal("0"), tracked=True),
    ).execute(intent())

    assert "daily_loss_limit" in outcome.reasons


def test_dry_run_validates_without_persisting_or_submitting():
    adapter = RecordingAdapter()
    outcome = pipeline(adapter).execute(intent(mode=ExecutionMode.DRY_RUN))

    assert outcome.outcome is Outcome.VALIDATED
    assert adapter.calls == []
    assert store.get_execution_order(outcome.client_order_id) is None


@pytest.mark.parametrize("mode", [ExecutionMode.DEVELOPMENT, ExecutionMode.BACKTEST])
def test_offline_modes_are_not_executable(mode):
    outcome = pipeline(RecordingAdapter()).execute(intent(mode=mode))
    assert "mode_not_executable" in outcome.reasons


@pytest.mark.parametrize(
    "overrides, reason",
    [
        ({"quantity": "0"}, "invalid_quantity"),
        ({"quantity": "NaN"}, "invalid_quantity"),
        ({"side": "LONG"}, "invalid_side"),
        ({"symbol": "btcusdt"}, "invalid_symbol"),
        ({"order_type": "LIMIT"}, "limit_requires_price_and_time_in_force"),
        ({"price": "100"}, "market_order_must_not_set_price"),
    ],
)
def test_malformed_intents_are_rejected(overrides, reason):
    adapter = RecordingAdapter()
    outcome = pipeline(adapter).execute(intent(**overrides))
    assert reason in outcome.reasons
    assert adapter.calls == []


def test_definite_rejection_marks_order_rejected():
    adapter = RecordingAdapter(error=AdapterRejected("binance_rejected"))
    outcome = pipeline(adapter).execute(intent())

    assert outcome.outcome is Outcome.REJECTED
    assert store.get_execution_order(outcome.client_order_id)["status"] == "REJECTED"
    assert store.pending_execution_orders() == []


def test_uncertain_submit_stays_pending_for_recovery():
    adapter = RecordingAdapter(error=AdapterUncertain("binance_outcome_unknown"))
    outcome = pipeline(adapter).execute(intent())

    assert outcome.outcome is Outcome.UNCERTAIN
    pending = store.pending_execution_orders()
    assert [row["client_order_id"] for row in pending] == [outcome.client_order_id]
    assert pending[0]["status"] == "PENDING_SUBMIT"


def test_paper_adapter_simulates_without_network_and_is_terminal():
    outcome = pipeline(PaperAdapter(quotes())).execute(intent(mode=ExecutionMode.PAPER))

    assert outcome.outcome is Outcome.SUBMITTED
    assert outcome.status == "SIMULATED"
    assert store.pending_execution_orders() == []


def test_client_order_id_is_deterministic_and_binance_safe():
    first = client_order_id_for("signal-0001", ExecutionMode.TESTNET)
    assert first == client_order_id_for("signal-0001", ExecutionMode.TESTNET)
    assert first != client_order_id_for("signal-0001", ExecutionMode.PAPER)
    assert len(first) <= 36 and first.isalnum()


class FakeClient:
    def __init__(self, result=None, error=None):
        self.kwargs = None
        self._result = result
        self._error = error

    def new_order(self, **kwargs):
        self.kwargs = kwargs
        if self._error:
            raise self._error
        return self._result


def test_binance_adapter_maps_ack_and_sends_client_order_id():
    client = FakeClient({"orderId": 7, "status": "FILLED", "executedQty": "1", "price": "0"})
    ack = BinanceSpotAdapter(client).submit(intent(), "m1abc")

    assert ack == AdapterAck(status="FILLED", order_id="7", executed_quantity="1", price="0")
    assert client.kwargs["client_order_id"] == "m1abc"


@pytest.mark.parametrize(
    "error, expected",
    [
        (BinanceAPIError('{"code": -2010, "msg": "insufficient"}', status_code=400), AdapterRejected),
        (BinanceAPIError("missing_binance_credentials", request_sent=False), AdapterRejected),
        (BinanceAPIError('{"code": -1007, "msg": "timeout"}', status_code=408), AdapterUncertain),
        (BinanceAPIError('{"code": 500}', status_code=503), AdapterUncertain),
        (BinanceAPIError("binance_transport_error"), AdapterUncertain),
    ],
)
def test_binance_adapter_classifies_errors(error, expected):
    with pytest.raises(expected):
        BinanceSpotAdapter(FakeClient(error=error)).submit(intent(), "m1abc")
