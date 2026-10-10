from app import store
from app.binance_spot import BinanceAPIError
from app.recovery import recover_spot_orders


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
