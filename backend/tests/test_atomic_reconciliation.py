from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import sqlite3

import pytest

from app.store import record_execution_order, get_execution_order, apply_order_state
from app.recovery import recover_spot_orders
from app.order_events import apply_spot_order_update
from app.binance_usdm_events import parse_user_event
from app.binance_usdm_reconciliation import apply_usdm_order_update
from app.order_idempotency import order_request_fingerprint


def seed(**kwargs):
    record_execution_order(**{
        "client_order_id": "atomic-order-001", "signal_id": "signal-001",
        "symbol": "BTCUSDT", "side": "BUY", "mode": "TESTNET",
        "market": "SPOT", "quantity": "1", "status": "NEW", "order_id": "7", **kwargs,
    })


def update(**kwargs):
    return apply_order_state("atomic-order-001", **{
        "status": "PARTIALLY_FILLED", "market": "SPOT",
        "executed_quantity": "0.5", "event_time": 100, **kwargs,
    })


def test_duplicate_order_registration_never_overwrites_exchange_state():
    seed(status="PARTIALLY_FILLED", executed_quantity="0.5", order_id="7")
    before = get_execution_order("atomic-order-001")
    seed(status="NEW", executed_quantity="0", order_id="99")
    assert get_execution_order("atomic-order-001") == before


def test_client_order_id_collision_with_different_identity_is_rejected():
    seed()
    with pytest.raises(ValueError, match="execution_order_identity_conflict"):
        seed(symbol="ETHUSDT")
    assert get_execution_order("atomic-order-001")["symbol"] == "BTCUSDT"


def test_fingerprinted_order_retry_must_match_complete_payload():
    payload = {
        "client_order_id": "atomic-order-001", "signal_id": "signal-001",
        "symbol": "BTCUSDT", "side": "BUY", "mode": "TESTNET",
        "market": "SPOT", "order_type": "LIMIT", "quantity": "1",
        "price": "100", "time_in_force": "GTC",
        "signal": {"entry": 100, "stop_loss": 90, "take_profit": 120},
    }
    fingerprint = order_request_fingerprint(payload)
    seed(request_fingerprint=fingerprint)
    before = get_execution_order("atomic-order-001")
    seed(request_fingerprint=fingerprint, status="NEW", order_id="different")
    assert get_execution_order("atomic-order-001") == before

    changed = {**payload, "price": "101"}
    with pytest.raises(ValueError, match="execution_order_identity_conflict"):
        seed(request_fingerprint=order_request_fingerprint(changed))


def test_order_request_fingerprint_is_canonical_and_rejects_incomplete_or_nan():
    payload = {
        "client_order_id": "id-1", "signal_id": "signal-1", "symbol": "BTCUSDT",
        "side": "BUY", "mode": "TESTNET", "market": "SPOT",
        "order_type": "MARKET", "quantity": "0.1",
    }
    reordered = dict(reversed(list(payload.items())))
    assert order_request_fingerprint(payload) == order_request_fingerprint(reordered)
    with pytest.raises(ValueError, match="incomplete_order_request"):
        order_request_fingerprint({"client_order_id": "id-1"})
    with pytest.raises(ValueError, match="invalid_order_request"):
        order_request_fingerprint({**payload, "risk": float("nan")})


@pytest.mark.parametrize("values,reason", [
    ({"market": "USDM"}, "environment_mismatch"),
    ({"mode": "LIVE"}, "environment_mismatch"),
    ({"symbol": "ETHUSDT"}, "symbol_mismatch"),
    ({"order_id": "8"}, "order_id_mismatch"),
    ({"executed_quantity": "NaN"}, "invalid_order_numbers"),
    ({"executed_quantity": "-1"}, "executed_quantity_out_of_bounds"),
    ({"executed_quantity": "2"}, "executed_quantity_out_of_bounds"),
    ({"status": "FILLED", "executed_quantity": "0.5"}, "filled_quantity_mismatch"),
    ({"event_time": True}, "invalid_order_event_time"),
])
def test_bad_remote_event_cannot_modify_existing_order(values, reason):
    seed()
    before = get_execution_order("atomic-order-001")
    with pytest.raises(ValueError, match=reason):
        update(**values)
    assert get_execution_order("atomic-order-001") == before


def test_terminal_and_execution_quantity_cannot_regress():
    seed()
    update()
    with pytest.raises(ValueError, match="out_of_bounds"):
        update(executed_quantity="0.4", event_time=101)
    update(status="FILLED", executed_quantity="1", event_time=102)
    with pytest.raises(ValueError, match="terminal_order_regression"):
        update(status="CANCELED", executed_quantity="1", event_time=103)


def test_decimal_formatting_does_not_create_same_timestamp_conflict():
    seed()
    assert update(executed_quantity="0.50") == "updated"
    assert update(executed_quantity="0.5") == "duplicate"


def test_duplicate_state_advances_watermark_and_rejects_intermediate_event():
    seed()
    assert update() == "updated"
    assert update(event_time=200) == "duplicate"
    assert get_execution_order("atomic-order-001")["last_event_time"] == 200
    assert update(executed_quantity="0.8", event_time=150) == "stale"


def test_concurrent_identical_events_are_atomic():
    seed()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: update(), range(16)))
    assert results.count("updated") == 1
    assert results.count("duplicate") == 15


def test_rest_snapshot_cannot_clobber_stream_update():
    seed()
    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            update(status="FILLED", executed_quantity="1", event_time=200)
            return {"orderId": 7, "status": "NEW", "executedQty": "0", "price": "100", "updateTime": 100}
    result = recover_spot_orders(Client())
    assert result["updated"] == 0
    order = get_execution_order("atomic-order-001")
    assert order["status"] == "FILLED"
    assert order["last_event_time"] == 200


def test_recovery_only_reads_testnet_spot_orders():
    seed()
    seed(client_order_id="other-paper-001", mode="PAPER")
    seed(client_order_id="other-live-001", mode="LIVE")
    seed(client_order_id="other-usdm-001", market="USDM")
    seed(client_order_id="other-unknown-001", market="UNKNOWN")
    calls = []
    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            calls.append(kwargs)
            return {"orderId": 7, "status": "FILLED", "executedQty": "1", "price": "100"}
    assert recover_spot_orders(Client()) == {"checked": 1, "updated": 1, "unknown": 0}
    assert len(calls) == 1
    assert get_execution_order("other-usdm-001")["status"] == "NEW"


def test_quarantined_order_requires_explicit_read_only_retry():
    seed(status="UNKNOWN")
    class Client:
        execution_mode = "TESTNET"
        def get_order(self, **kwargs):
            return {"orderId": 7, "status": "FILLED", "executedQty": "1", "price": "100"}
    assert recover_spot_orders(Client())["checked"] == 0
    assert recover_spot_orders(Client(), include_quarantined=True)["updated"] == 1
    assert get_execution_order("atomic-order-001")["status"] == "FILLED"


def test_stream_wrapper_nested_payload_and_environment_isolation():
    seed()
    assert apply_spot_order_update({"event": {
        "c": "atomic-order-001", "i": 7, "s": "BTCUSDT",
        "X": "FILLED", "z": "1", "p": "100", "E": 100,
    }})
    with pytest.raises(ValueError, match="environment_mismatch"):
        apply_usdm_order_update(parse_user_event({
            "e": "ORDER_TRADE_UPDATE", "E": 200,
            "o": {"c": "atomic-order-001", "i": 7, "X": "FILLED", "z": "1", "ap": "100"},
        }))


def test_existing_database_migration_does_not_guess_market(tmp_path, monkeypatch):
    path = tmp_path / "legacy.sqlite3"
    monkeypatch.setenv("M1_DB_PATH", str(path))
    with sqlite3.connect(path) as conn:
        conn.execute("""CREATE TABLE execution_orders (
            client_order_id TEXT PRIMARY KEY, signal_id TEXT, symbol TEXT, side TEXT,
            mode TEXT, order_id TEXT, status TEXT, quantity TEXT,
            executed_quantity TEXT, price TEXT, last_event_time INTEGER, updated_at TEXT)""")
        conn.execute("INSERT INTO execution_orders VALUES ('legacy-001','s','BTCUSDT','BUY','TESTNET','7','NEW','1','0','100',NULL,'old')")
    assert get_execution_order("legacy-001")["market"] == "UNKNOWN"
    assert get_execution_order("legacy-001")["request_fingerprint"] is None
    with pytest.raises(ValueError, match="environment_mismatch"):
        apply_order_state("legacy-001", status="FILLED", market="SPOT", executed_quantity="1")
