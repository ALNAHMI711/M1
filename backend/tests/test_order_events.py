import sqlite3

import app.order_events as events
from app.store import record_execution_order


def test_apply_spot_order_update_persists_state(monkeypatch, tmp_path):
    db = tmp_path / "events.sqlite3"
    monkeypatch.setenv("M1_DB_PATH", str(db))

    record_execution_order(
        client_order_id="client-1",
        signal_id="signal-1",
        symbol="BTCUSDT",
        side="BUY",
        mode="TESTNET",
        quantity="0.5",
        status="NEW",
        order_id="123",
        executed_quantity="0",
        price="100",
    )

    terminal = events.apply_spot_order_update(
        {
            "e": "executionReport",
            "c": "client-1",
            "i": 123,
            "X": "FILLED",
            "z": "0.5",
            "p": "101",
        }
    )

    assert terminal is True
    with sqlite3.connect(db) as conn:
        row = conn.execute(
            "SELECT status, order_id, executed_quantity, price FROM execution_orders WHERE client_order_id = ?",
            ("client-1",),
        ).fetchone()
        audit = conn.execute(
            "SELECT event, status FROM execution_audit ORDER BY id DESC LIMIT 1"
        ).fetchone()

    assert row == ("FILLED", "123", "0.5", "101")
    assert audit == ("user_data_order_update", "FILLED")


def test_apply_spot_order_update_rejects_missing_identity():
    try:
        events.apply_spot_order_update({"X": "NEW"})
    except ValueError as exc:
        assert str(exc) == "order_update_missing_identity_or_status"
    else:
        raise AssertionError("expected ValueError")
