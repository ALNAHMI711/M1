import pytest

from app.binance_usdm_events import parse_user_event
from app.binance_usdm_reconciliation import apply_usdm_order_update
from app.store import get_execution_order, record_execution_order, recent_execution_audit


def _seed_order(tmp_path, monkeypatch):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    record_execution_order(
        client_order_id="m1-futures-1",
        signal_id="sig-1",
        symbol="BTCUSDT",
        side="LONG",
        mode="TESTNET",
        quantity="0.01",
    )


def test_applies_usdm_order_update_and_maps_terminal_status(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)

    result = apply_usdm_order_update(
        parse_user_event(
            {
                "e": "ORDER_TRADE_UPDATE",
                "o": {
                    "c": "m1-futures-1",
                    "i": 98765,
                    "X": "EXPIRED_IN_MATCH",
                    "z": "0.010",
                    "ap": "62000.10",
                },
            }
        )
    )

    assert result == "updated"
    assert get_execution_order("m1-futures-1")["status"] == "EXPIRED_IN_MATCH"
    assert get_execution_order("m1-futures-1")["order_id"] == "98765"
    assert get_execution_order("m1-futures-1")["executed_quantity"] == "0.010"


def test_duplicate_usdm_order_update_is_idempotent(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)
    event = parse_user_event(
        {
            "e": "ORDER_TRADE_UPDATE",
            "o": {
                "c": "m1-futures-1",
                "i": 98765,
                "X": "FILLED",
                "z": "0.010",
                "ap": "62000.10",
            },
        }
    )

    assert apply_usdm_order_update(event) == "updated"
    assert apply_usdm_order_update(event) == "duplicate"
    audits = recent_execution_audit(10)
    assert [row["event"] for row in audits[:2]] == [
        "usdm_order_update_duplicate",
        "usdm_order_update_applied",
    ]


def test_unknown_client_order_is_rejected_and_audited(tmp_path, monkeypatch):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))

    event = parse_user_event(
        {
            "e": "ORDER_TRADE_UPDATE",
            "o": {
                "c": "not-owned-by-m1",
                "i": 1,
                "X": "NEW",
                "z": "0",
                "ap": "0",
            },
        }
    )

    with pytest.raises(ValueError, match="unknown_client_order_id"):
        apply_usdm_order_update(event)

    audit = recent_execution_audit(1)[0]
    assert audit["event"] == "usdm_order_update_rejected"
    assert audit["detail"] == "unknown_client_order_id"


def test_rejects_unsupported_usdm_order_status(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)

    with pytest.raises(ValueError, match="unsupported_usdm_order_status"):
        apply_usdm_order_update(
            parse_user_event(
                {
                    "e": "ORDER_TRADE_UPDATE",
                    "o": {
                        "c": "m1-futures-1",
                        "i": 98765,
                        "X": "UNKNOWN_STATUS",
                    },
                }
            )
        )
