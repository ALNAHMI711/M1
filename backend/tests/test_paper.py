from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import json
import os
import socket
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth import create_access_token
from app.main import app
from app.admin import backup_database, restore_database
from app.operations import set_kill_switch
from app.paper import PaperOrder, PaperError, paper_account, submit_paper_order
from app.paper import paper_ledger_csv
import csv
import io
import app.paper as paper


def buy(identifier="paper-buy-001", **overrides):
    return PaperOrder(**{
        "client_order_id": identifier, "symbol": "BTCUSDT", "side": "BUY",
        "quantity": "1", "price": "100", "stop_loss": "90",
        "take_profit": "125", "score": 90, **overrides,
    })


def sell(identifier="paper-sell-001", **overrides):
    return PaperOrder(**{
        "client_order_id": identifier, "symbol": "BTCUSDT", "side": "SELL",
        "quantity": "1", "price": "110", "score": 0, **overrides,
    })


def test_read_does_not_create_or_reset_account():
    account = paper_account("alice")
    assert not account["account_exists"]
    assert Decimal(account["cash"]) == 10000
    assert account["price_source"] == "user_assumption_not_exchange"
    assert account["automatic_stop_orders"] is False
    assert account["positions"] == account["recent_orders"] == []


def test_buy_sell_cash_fees_and_realized_pnl():
    opened = submit_paper_order("alice", buy())
    assert opened["risk_gate"] == "full_entry_risk_gate"
    assert Decimal(opened["cash_after"]) == Decimal("9899.9")
    assert Decimal(opened["fee"]) == Decimal("0.1")
    assert paper_account("alice")["positions"][0]["symbol"] == "BTCUSDT"
    closed = submit_paper_order("alice", sell())
    assert closed["risk_gate"] == "reduce_only_exit_gate"
    assert Decimal(closed["realized_pnl"]) == Decimal("9.79")
    account = paper_account("alice")
    assert account["positions"] == []
    assert Decimal(account["cash"]) == Decimal("10009.79")
    assert Decimal(account["fees_paid"]) == Decimal("0.21")
    assert Decimal(account["equity_at_cost"]) == Decimal(account["initial_cash"]) + Decimal(account["realized_pnl"])


def test_partial_close_allocates_basis_and_preserves_accounting():
    submit_paper_order("alice", buy())
    submit_paper_order("alice", sell("partial-close-001", quantity="0.4"))
    account = paper_account("alice")
    assert Decimal(account["positions"][0]["quantity"]) == Decimal("0.6")
    assert Decimal(account["equity_at_cost"]) == Decimal(account["initial_cash"]) + Decimal(account["realized_pnl"])
    submit_paper_order("alice", sell("final-close-001", quantity="0.6"))
    account = paper_account("alice")
    assert account["positions"] == []
    assert Decimal(account["realized_pnl"]) == Decimal("9.79")


def test_adverse_spread_slippage_and_fee_assumptions_are_applied():
    result = submit_paper_order("alice", buy(spread_bps="4", slippage_bps="3", take_profit="121"))
    assert Decimal(result["fill_price"]) == Decimal("100.05")
    assert Decimal(result["fee"]) == Decimal("0.10005")
    assert result["status"] == "SIMULATED_FILLED"
    assert result["live_enabled"] is False


def test_same_id_replay_and_changed_payload_conflict():
    first = submit_paper_order("alice", buy())
    replay = submit_paper_order("alice", buy(quantity="1.0", price="100.00"))
    assert replay == {**first, "replayed": True}
    with pytest.raises(PaperError, match="idempotency_conflict"):
        submit_paper_order("alice", buy(quantity="2"))
    assert len(paper_account("alice")["recent_orders"]) == 1


def test_concurrent_same_id_fills_once():
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: submit_paper_order("alice", buy()), range(16)))
    assert sum(not result["replayed"] for result in results) == 1
    account = paper_account("alice")
    assert Decimal(account["positions"][0]["quantity"]) == 1
    assert len(account["recent_orders"]) == 1


def test_concurrent_unique_orders_cannot_overspend(monkeypatch):
    monkeypatch.setenv("M1_PAPER_INITIAL_CASH", "150")
    def attempt(index):
        try:
            return submit_paper_order("alice", buy(f"concurrent-{index:04}", stop_loss="99.9", take_profit="120"))
        except PaperError as error:
            return error.reason
    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(attempt, range(10)))
    assert sum(isinstance(r, dict) for r in results) == 1
    assert all(r == "insufficient_paper_cash" for r in results if isinstance(r, str))
    assert Decimal(paper_account("alice")["cash"]) == Decimal("49.9")


def test_accounts_and_idempotency_keys_are_isolated():
    submit_paper_order("alice", buy())
    assert not paper_account("bob")["account_exists"]
    result = submit_paper_order("bob", buy())
    assert not result["replayed"]
    assert len(paper_account("alice")["recent_orders"]) == len(paper_account("bob")["recent_orders"]) == 1


@pytest.mark.parametrize("field,value,reason", [
    ("score", 84, "score_below_threshold"),
    ("take_profit", "110", "reward_risk_below_threshold"),
    ("spread_bps", "21", "spread_or_slippage_above_limit"),
    ("slippage_bps", "21", "spread_or_slippage_above_limit"),
    ("stop_loss", "101", "invalid_paper_risk_reward_levels"),
])
def test_rejected_entry_rolls_back_all_changes(field, value, reason):
    with pytest.raises(PaperError, match=reason):
        submit_paper_order("alice", buy(**{field: value}))
    account = paper_account("alice")
    assert not account["account_exists"]
    assert account["positions"] == account["recent_orders"] == []


@pytest.mark.parametrize("setting,value,reason", [
    ("M1_PAPER_MAX_NOTIONAL", "50", "notional_limit"),
    ("M1_PAPER_MAX_OPEN_RISK_PCT", "0.05", "open_risk_limit"),
    ("M1_PAPER_MAX_TRADE_RISK_PCT", "0.05", "paper_trade_risk_limit"),
])
def test_server_limits_cannot_be_supplied_by_client(monkeypatch, setting, value, reason):
    monkeypatch.setenv(setting, value)
    with pytest.raises(PaperError, match=reason):
        submit_paper_order("alice", buy())
    with pytest.raises(ValidationError):
        buy(max_notional="999999")


def test_insufficient_cash_and_no_short_positions(monkeypatch):
    monkeypatch.setenv("M1_PAPER_INITIAL_CASH", "100")
    with pytest.raises(PaperError, match="insufficient_paper_cash"):
        submit_paper_order("alice", buy(quantity="2", stop_loss="99.99", take_profit="101"))
    with pytest.raises(PaperError, match="insufficient_paper_position"):
        submit_paper_order("alice", sell())
    assert not paper_account("alice")["account_exists"]


def test_position_levels_must_not_be_silently_changed():
    submit_paper_order("alice", buy())
    with pytest.raises(PaperError, match="position_levels_mismatch"):
        submit_paper_order("alice", buy("scale-in-002", stop_loss="95"))
    assert Decimal(paper_account("alice")["positions"][0]["quantity"]) == 1


def test_daily_loss_blocks_entries_not_risk_reducing_exit_or_gains(monkeypatch):
    monkeypatch.setenv("M1_PAPER_MAX_DAILY_LOSS_PCT", "0.05")
    submit_paper_order("alice", buy())
    submit_paper_order("alice", buy("eth-entry-001", symbol="ETHUSDT"))
    submit_paper_order("alice", sell(price="1"))
    with pytest.raises(PaperError, match="daily_loss_limit"):
        submit_paper_order("alice", buy("new-entry-001"))
    submit_paper_order("alice", sell("eth-close-001", symbol="ETHUSDT", price="210"))
    account = paper_account("alice")
    assert Decimal(account["realized_pnl"]) > 0
    assert Decimal(account["daily_loss_pct"]) > Decimal("0.05")
    assert account["positions"] == []
    with pytest.raises(PaperError, match="daily_loss_limit"):
        submit_paper_order("alice", buy("new-entry-002"))


def test_daily_loss_uses_server_utc_day(monkeypatch):
    day = datetime(2026, 10, 10, 12, tzinfo=timezone.utc)
    monkeypatch.setattr(paper, "_now", lambda: day)
    submit_paper_order("alice", buy())
    submit_paper_order("alice", sell(price="90"))
    assert Decimal(paper_account("alice")["daily_loss_pct"]) > 0
    monkeypatch.setattr(paper, "_now", lambda: day + timedelta(days=1))
    assert Decimal(paper_account("alice")["daily_loss_pct"]) == 0


def test_kill_switch_blocks_new_fills_but_replay_does_not_refill():
    first = submit_paper_order("alice", buy())
    set_kill_switch(True, "test")
    assert submit_paper_order("alice", buy()) == {**first, "replayed": True}
    with pytest.raises(PaperError, match="kill_switch"):
        submit_paper_order("alice", sell())
    assert len(paper_account("alice")["recent_orders"]) == 1


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-1", "0", "0.000000001"])
def test_non_finite_or_invalid_amounts_are_rejected(value):
    with pytest.raises(ValidationError):
        buy(quantity=value)


@pytest.mark.parametrize("mode", ["LIVE", "TESTNET", "live"])
def test_simulator_cannot_be_retargeted_to_exchange(mode):
    with pytest.raises(ValidationError):
        buy(mode=mode)


def test_paper_never_connects_to_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("paper simulation attempted network")
    monkeypatch.setattr(socket, "create_connection", forbidden)
    assert submit_paper_order("alice", buy())["accepted"]
    assert submit_paper_order("alice", sell())["accepted"]


def test_restart_and_backup_restore_preserve_paper_ledger(tmp_path, monkeypatch):
    submit_paper_order("alice", buy())
    output = subprocess.check_output(
        [sys.executable, "-c", "import json; from app.paper import paper_account; print(json.dumps(paper_account('alice')))"],
        env=os.environ.copy(), text=True,
    )
    assert Decimal(json.loads(output)["positions"][0]["quantity"]) == 1
    backup = tmp_path / "paper-backup.sqlite3"
    backup_database(str(backup))
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "restored-paper.sqlite3"))
    restore_database(str(backup))
    assert Decimal(paper_account("alice")["positions"][0]["quantity"]) == 1
    assert submit_paper_order("alice", buy())["replayed"]
    with pytest.raises(PaperError, match="kill_switch"):
        submit_paper_order("alice", sell())


def test_seed_cannot_be_reset_by_environment_change(monkeypatch):
    submit_paper_order("alice", buy())
    monkeypatch.setenv("M1_PAPER_INITIAL_CASH", "20000")
    account = paper_account("alice")
    assert Decimal(account["initial_cash"]) == 10000
    assert Decimal(account["cash"]) == Decimal("9899.9")


@pytest.mark.parametrize("value", ["NaN", "-1", "0", "1000001"])
def test_invalid_server_configuration_fails_closed(monkeypatch, value):
    monkeypatch.setenv("M1_PAPER_INITIAL_CASH", value)
    with pytest.raises(PaperError, match="invalid_paper_server_configuration"):
        submit_paper_order("alice", buy())


def test_paper_endpoint_auth_roles_and_account_isolation(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "paper-test-secret-01234567890123456789")
    client = TestClient(app)
    assert client.get("/v1/paper/account").status_code == 401
    viewer = {"Authorization": f"Bearer {create_access_token('viewer', 'VIEWER')}"}
    assert client.get("/v1/paper/account", headers=viewer).status_code == 200
    assert client.post("/v1/paper/orders", headers=viewer, json=buy().model_dump(mode="json")).status_code == 403
    operator = {"Authorization": f"Bearer {create_access_token('operator', 'OPERATOR')}"}
    response = client.post("/v1/paper/orders", headers=operator, json=buy().model_dump(mode="json"))
    assert response.status_code == 200
    assert response.json()["mode"] == "PAPER"
    assert client.get("/v1/paper/account", headers=viewer).json()["positions"] == []
    response = client.post("/v1/paper/orders", headers=operator, json=buy(quantity="2").model_dump(mode="json"))
    assert response.status_code == 409


def test_csv_is_own_account_only_and_formula_safe():
    submit_paper_order("alice", buy("-formula-safe-001"))
    submit_paper_order("bob", buy("bob-private-001"))
    rows = list(csv.DictReader(io.StringIO(paper_ledger_csv("alice"))))
    assert len(rows) == 1
    assert rows[0]["client_order_id"] == "'-formula-safe-001"
    assert "bob-private" not in paper_ledger_csv("alice")
    assert rows[0]["mode"] == "PAPER"


def test_csv_endpoint_requires_own_session_and_bounds_export(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "paper-test-secret-01234567890123456789")
    client = TestClient(app)
    assert client.get("/v1/paper/ledger.csv").status_code == 401
    headers = {"Authorization": f"Bearer {create_access_token('reader', 'VIEWER')}"}
    response = client.get("/v1/paper/ledger.csv", headers=headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert response.headers["cache-control"] == "no-store"
    assert client.get("/v1/paper/ledger.csv?limit=5001", headers=headers).status_code == 422
