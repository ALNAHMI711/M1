from app import store
from app.binance_spot import BinanceAPIError
from app.recovery import recover_spot_orders
from app.order_idempotency import order_request_fingerprint


def test_recovery_rejects_live_or_unlabeled_clients_without_network():
    import pytest
    from app.binance_spot import BinanceSpotClient, BinanceSpotConfig, LIVE_BASE_URL
    client = BinanceSpotClient(BinanceSpotConfig("key", "secret", base_url=LIVE_BASE_URL),
                               opener=lambda *args, **kwargs: pytest.fail("network_must_not_run"))
    for rejected in (client, object()):
        with pytest.raises(ValueError, match="requires_testnet_client"):
            recover_spot_orders(rejected)


def test_recovery_updates_remote_order(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    store.record_execution_order(
        client_order_id="m1-test-001",
        signal_id="signal-001",
        symbol="BTCUSDT",
        side="BUY",
        mode="TESTNET",
        quantity="0.001",
        order_id="123",
    )

    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            assert kwargs == {"symbol": "BTCUSDT", "order_id": 123, "client_order_id": None}
            return {
                "orderId": 123,
                "status": "FILLED",
                "executedQty": "0.001",
                "price": "50000",
            }

    assert recover_spot_orders(Client()) == {"checked": 1, "updated": 1, "unknown": 0}
    assert store.pending_execution_orders() == []


def test_recovery_marks_binance_failure_unknown(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    store.record_execution_order(
        client_order_id="m1-test-002",
        signal_id="signal-002",
        symbol="ETHUSDT",
        side="SELL",
        mode="TESTNET",
        quantity="0.01",
    )

    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            raise BinanceAPIError("temporary")

    assert recover_spot_orders(Client()) == {"checked": 1, "updated": 0, "unknown": 1}
    assert store.pending_execution_orders() == []


def test_recovery_uses_client_order_id_when_remote_id_missing(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    store.record_execution_order(
        client_order_id="m1-test-003",
        signal_id="signal-003",
        symbol="BTCUSDT",
        side="BUY",
        mode="TESTNET",
        quantity="0.001",
    )

    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            assert kwargs == {
                "symbol": "BTCUSDT",
                "order_id": None,
                "client_order_id": "m1-test-003",
            }
            return {"status": "CANCELED", "executedQty": "0", "price": "0"}

    assert recover_spot_orders(Client()) == {"checked": 1, "updated": 1, "unknown": 0}
    assert store.pending_execution_orders() == []


def test_recovery_does_not_retry_quarantined_unknown(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    store.record_execution_order(
        client_order_id="m1-test-004",
        signal_id="signal-004",
        symbol="BTCUSDT",
        side="BUY",
        mode="TESTNET",
        quantity="0.001",
        status="UNKNOWN",
    )

    calls = []

    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            calls.append(kwargs)
            return {"status": "FILLED", "executedQty": "0.001", "price": "50000"}

    assert recover_spot_orders(Client()) == {"checked": 0, "updated": 0, "unknown": 0}
    assert calls == []
    assert store.pending_execution_orders() == []


def test_recovery_reconciles_submitting_intent_by_client_id_without_resubmission(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    payload = {
        "client_order_id": "m1-crash-before-ack", "signal_id": "signal-crash-001",
        "symbol": "BTCUSDT", "side": "BUY", "mode": "TESTNET",
        "market": "SPOT", "order_type": "LIMIT", "quantity": "0.001",
        "price": "50000", "time_in_force": "GTC",
    }
    created, intent = store.reserve_spot_testnet_order_intent(
        client_order_id=payload["client_order_id"], signal_id=payload["signal_id"],
        symbol=payload["symbol"], side=payload["side"], quantity=payload["quantity"],
        price=payload["price"], request_fingerprint=order_request_fingerprint(payload),
        request_payload=payload,
    )
    assert created and intent["status"] == "SUBMITTING"

    class ReadOnlyClient:
        execution_mode = "TESTNET"
        def __init__(self):
            self.lookups = []
        def get_order(self, **kwargs):
            self.lookups.append(kwargs)
            return {
                "symbol": "BTCUSDT", "orderId": 456, "status": "NEW",
                "executedQty": "0", "price": "50000", "updateTime": 100,
            }

    client = ReadOnlyClient()
    assert recover_spot_orders(client) == {"checked": 1, "updated": 1, "unknown": 0}
    assert client.lookups == [{
        "symbol": "BTCUSDT", "order_id": None,
        "client_order_id": "m1-crash-before-ack",
    }]
    recovered = store.get_execution_order("m1-crash-before-ack")
    assert recovered["status"] == "NEW" and recovered["order_id"] == "456"
    assert recovered["request_fingerprint"] == intent["request_fingerprint"]
    assert recovered["request_payload_json"] == intent["request_payload_json"]
    pending = store.pending_execution_orders(mode="TESTNET", market="SPOT")
    assert len(pending) == 1
    assert pending[0]["client_order_id"] == "m1-crash-before-ack"
    assert pending[0]["status"] == "NEW"
