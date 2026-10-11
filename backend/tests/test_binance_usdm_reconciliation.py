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
        market="USDM",
        quantity="0.01",
    )


def _event(status="FILLED", event_time=1000, *, executed="0.010", price="62000.10"):
    return parse_user_event(
        {
            "e": "ORDER_TRADE_UPDATE",
            "E": event_time,
            "o": {
                "c": "m1-futures-1",
                "i": 98765,
                "X": status,
                "z": executed,
                "ap": price,
            },
        }
    )


def test_applies_usdm_order_update_and_maps_terminal_status(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)

    result = apply_usdm_order_update(
        _event("EXPIRED_IN_MATCH", 1000)
    )

    assert result == "updated"
    order = get_execution_order("m1-futures-1")
    assert order["status"] == "EXPIRED_IN_MATCH"
    assert order["order_id"] == "98765"
    assert order["executed_quantity"] == "0.010"
    assert order["last_event_time"] == 1000


def test_duplicate_usdm_order_update_is_idempotent(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)
    event = _event("FILLED", 2000)

    assert apply_usdm_order_update(event) == "updated"
    assert apply_usdm_order_update(event) == "duplicate"
    audits = recent_execution_audit(10)
    assert [row["event"] for row in audits[:2]] == [
        "usdm_order_update_duplicate",
        "usdm_order_update_applied",
    ]


def test_stale_usdm_order_update_is_ignored_after_restart(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)

    assert apply_usdm_order_update(_event("FILLED", 3000)) == "updated"
    assert apply_usdm_order_update(_event("PARTIALLY_FILLED", 2999, executed="0.005")) == "stale"

    order = get_execution_order("m1-futures-1")
    assert order["status"] == "FILLED"
    assert order["executed_quantity"] == "0.010"
    assert order["last_event_time"] == 3000

    audit = recent_execution_audit(1)[0]
    assert audit["event"] == "usdm_order_update_stale"


def test_conflicting_same_timestamp_is_rejected(tmp_path, monkeypatch):
    _seed_order(tmp_path, monkeypatch)

    assert apply_usdm_order_update(_event("FILLED", 4000)) == "updated"
    with pytest.raises(ValueError, match="conflicting_event_same_time"):
        apply_usdm_order_update(_event("CANCELED", 4000))

    order = get_execution_order("m1-futures-1")
    assert order["status"] == "FILLED"


def test_unknown_client_order_is_rejected_and_audited(tmp_path, monkeypatch):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))

    event = parse_user_event(
        {
            "e": "ORDER_TRADE_UPDATE",
            "E": 1000,
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
                    "E": 1000,
                    "o": {
                        "c": "m1-futures-1",
                        "i": 98765,
                        "X": "UNKNOWN_STATUS",
                    },
                }
            )
        )
