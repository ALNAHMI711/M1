from concurrent.futures import ThreadPoolExecutor

import pytest

from app import store
from app.binance_spot import BinanceAPIError
from app.order_idempotency import order_request_fingerprint
from app.testnet_submission import SpotTestnetSubmissionError, submit_reserved_spot_testnet_order


def reserve(monkeypatch, tmp_path, client_order_id="test-submit-001"):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    monkeypatch.setenv("M1_TESTNET_ALLOWED_SYMBOLS", "BTCUSDT")
    monkeypatch.setenv("M1_TESTNET_MAX_NOTIONAL", "25")
    payload = {
        "client_order_id": client_order_id,
        "signal_id": "signal-submit-001",
        "symbol": "BTCUSDT",
        "side": "BUY",
        "mode": "TESTNET",
        "market": "SPOT",
        "order_type": "LIMIT",
        "quantity": "0.1",
        "price": "100",
        "time_in_force": "GTC",
        "signal": {
            "symbol": "BTCUSDT", "side": "LONG", "entry": 100,
            "stop_loss": 90, "take_profit": 120, "score": 92, "rr": 2,
            "source": "MANUAL", "mode": "TESTNET", "signal_id": "signal-submit-001",
        },
    }
    fingerprint = order_request_fingerprint(payload)
    created, order = store.reserve_spot_testnet_order_intent(
        client_order_id=client_order_id,
        signal_id=payload["signal_id"],
        symbol=payload["symbol"],
        side=payload["side"],
        quantity=payload["quantity"],
        price=payload["price"],
        request_fingerprint=fingerprint,
        request_payload=payload,
    )
    assert created
    return order


class FakeClient:
    execution_mode = "TESTNET"

    def __init__(self, response=None, error=None):
        self.response = response or {
            "symbol": "BTCUSDT", "orderId": 73, "status": "NEW",
            "executedQty": "0", "price": "100", "updateTime": 123,
        }
        self.error = error
        self.calls = []

    def submit_testnet_order(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return self.response


def test_reserved_order_submits_once_and_persists_exchange_response(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    reserve(monkeypatch, tmp_path)
    client = FakeClient()
    result = submit_reserved_spot_testnet_order(client, "test-submit-001")
    assert result == {"submitted": True, "status": "NEW", "order_id": 73}
    assert len(client.calls) == 1
    assert client.calls[0]["client_order_id"] == "test-submit-001"
    order = store.get_execution_order("test-submit-001")
    assert order["status"] == "NEW" and order["order_id"] == "73"
    assert order["last_event_time"] == 123

    duplicate = submit_reserved_spot_testnet_order(client, "test-submit-001")
    assert duplicate["submitted"] is False
    assert len(client.calls) == 1


def test_transport_error_is_quarantined_and_never_retried(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    reserve(monkeypatch, tmp_path)
    client = FakeClient(error=BinanceAPIError("ambiguous transport failure"))
    result = submit_reserved_spot_testnet_order(client, "test-submit-001")
    assert result["submitted"] is None and result["status"] == "UNKNOWN"
    assert len(client.calls) == 1
    order = store.get_execution_order("test-submit-001")
    assert order["status"] == "UNKNOWN"
    retry = submit_reserved_spot_testnet_order(client, "test-submit-001")
    assert retry["submitted"] is False
    assert len(client.calls) == 1


def test_unlabeled_or_non_testnet_client_never_claims_or_sends(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    reserve(monkeypatch, tmp_path)
    class WrongClient(FakeClient):
        execution_mode = "LIVE"
    client = WrongClient()
    with pytest.raises(SpotTestnetSubmissionError, match="testnet_client_required"):
        submit_reserved_spot_testnet_order(client, "test-submit-001")
    assert client.calls == []
    assert store.get_execution_order("test-submit-001")["status"] == "SUBMITTING"


def test_two_workers_cannot_submit_same_reserved_intent(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    reserve(monkeypatch, tmp_path)
    client = FakeClient()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(
            lambda _: submit_reserved_spot_testnet_order(client, "test-submit-001"),
            range(2),
        ))
    assert len(client.calls) == 1
    assert sum(result["submitted"] is True for result in results) == 1


def test_submission_feature_flag_off_preserves_reserved_intent(monkeypatch, tmp_path):
    monkeypatch.delenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", raising=False)
    reserve(monkeypatch, tmp_path)
    client = FakeClient()
    with pytest.raises(SpotTestnetSubmissionError, match="submission_disabled"):
        submit_reserved_spot_testnet_order(client, "test-submit-001")
    assert client.calls == []
    assert store.get_execution_order("test-submit-001")["status"] == "SUBMITTING"
