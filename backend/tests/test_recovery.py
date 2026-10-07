from app import store
from app.binance_spot import BinanceSpotClient, BinanceSpotConfig
from app.recovery import recover_spot_orders


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
        def get_order(self, **kwargs):
            assert kwargs == {"symbol": "BTCUSDT", "order_id": 123, "client_order_id": None}
            return {
                "orderId": 123,
                "status": "FILLED",
                "executedQty": "0.001",
                "price": "50000",
            }

    assert recover_spot_orders(Client()) == {"checked": 1, "updated": 1, "unknown": 0}
    rows = store.pending_execution_orders()
    assert rows == []


def test_recovery_marks_transport_failure_unknown(monkeypatch, tmp_path):
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
        def get_order(self, **kwargs):
            raise RuntimeError("unexpected")

    assert recover_spot_orders(Client()) == {"checked": 1, "updated": 0, "unknown": 0}


def test_recovery_handles_binance_api_failure(monkeypatch, tmp_path):
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
        def get_order(self, **kwargs):
            raise BinanceAPIError("temporary")

    result = recover_spot_orders(Client())
    assert result == {"checked": 1, "updated": 0, "unknown": 1}
    assert store.pending_execution_orders()[0]["status"] == "UNKNOWN"
