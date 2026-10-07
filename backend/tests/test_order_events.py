import sqlite3

import pytest

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
            "SELECT event, status, detail FROM execution_audit ORDER BY id DESC LIMIT 1"
        ).fetchone()

    assert row == ("FILLED", "123", "0.5", "101")
    assert audit == ("user_data_order_update", "FILLED", "terminal")


def test_apply_spot_order_update_rejects_missing_identity():
    with pytest.raises(ValueError, match="order_update_missing_identity_or_status"):
        events.apply_spot_order_update({"X": "NEW"})


def test_apply_spot_order_update_rejects_unknown_client_order_id(monkeypatch, tmp_path):
    db = tmp_path / "events.sqlite3"
    monkeypatch.setenv("M1_DB_PATH", str(db))

    with pytest.raises(ValueError, match="unknown_client_order_id"):
        events.apply_spot_order_update({"c": "attacker-order", "X": "FILLED"})

    with sqlite3.connect(db) as conn:
        audit = conn.execute(
            "SELECT event, status, detail, client_order_id FROM execution_audit ORDER BY id DESC LIMIT 1"
        ).fetchone()

    assert audit == (
        "user_data_order_update_rejected",
        "FILLED",
        "unknown_client_order_id",
        "attacker-order",
    )
