from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app import store
from app.execution_boundary import ExecutionMode, LiveExecutionRequirements
from app.execution_pipeline import (
    AdapterAck,
    AdapterRejected,
    ExecutionPipeline,
    MarketQuote,
    OrderIntent,
    Outcome,
    RiskLimits,
    client_order_id_for,
    ledger_account_state,
    utc_day_start,
)

EQUITY = Decimal("10000")
LIMITS = RiskLimits(account_equity=EQUITY, max_notional=Decimal("1000"))


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))


class Adapter:
    def __init__(self, error=None):
        self.calls = 0
        self._error = error

    def submit(self, order, client_order_id):
        self.calls += 1
        if self._error:
            raise self._error
        return AdapterAck(status="NEW", order_id="1")


def intent(signal_id="ledger-0001", mode=ExecutionMode.TESTNET, quantity="1"):
    return OrderIntent(
        signal_id=signal_id,
        symbol="BTCUSDT",
        side="BUY",
        order_type="MARKET",
        quantity=quantity,
        mode=mode,
        score=92,
        entry=Decimal("100"),
        stop_loss=Decimal("98"),
        take_profit=Decimal("106"),
    )


def pipeline(adapter, **kwargs):
    kwargs.setdefault("limits", LIMITS)
    return ExecutionPipeline(
        adapter=adapter,
        quote_provider=lambda symbol: MarketQuote(Decimal("99.99"), Decimal("100.01")),
        account_state=ledger_account_state(kwargs["limits"].account_equity),
        **kwargs,
    )


def test_empty_ledger_is_tracked_and_zero():
    state = ledger_account_state(EQUITY)(ExecutionMode.LIVE)
    assert state.tracked is True
    assert state.daily_loss_pct == 0
    assert state.open_risk_pct == 0


def test_missing_equity_is_untracked():
    assert ledger_account_state(None)(ExecutionMode.LIVE).tracked is False


def test_submission_reserves_open_risk():
    pipeline(Adapter()).execute(intent())
    state = ledger_account_state(EQUITY)(ExecutionMode.TESTNET)
    # 1 * (100.01 - 98) / 10000 * 100
    assert state.open_risk_pct == Decimal("0.0201")


def test_open_risk_accumulates_until_limit_blocks_next_trade():
    adapter = Adapter()
    limits = RiskLimits(
        account_equity=EQUITY, max_notional=Decimal("1000"), max_open_risk_pct=Decimal("0.15")
    )
    run = pipeline(adapter, limits=limits)
    # each trade: 5 * (100.01 - 98) / 10000 * 100 = 0.1005%; two exceed 0.15%
    first = run.execute(intent("ledger-a", quantity="5"))
    second = run.execute(intent("ledger-b", quantity="5"))
    assert first.outcome is Outcome.SUBMITTED
    assert second.outcome is Outcome.REJECTED
    assert "open_risk_limit" in second.reasons
    assert adapter.calls == 1


def test_risk_is_scoped_per_mode():
    pipeline(Adapter()).execute(intent("ledger-paper", mode=ExecutionMode.PAPER, quantity="5"))
    assert ledger_account_state(EQUITY)(ExecutionMode.LIVE).open_risk_pct == 0
    assert ledger_account_state(EQUITY)(ExecutionMode.PAPER).open_risk_pct > 0


def test_adapter_rejection_releases_reserved_risk():
    pipeline(Adapter(error=AdapterRejected("binance_rejected"))).execute(intent())
    cid = client_order_id_for("ledger-0001", ExecutionMode.TESTNET)
    assert store.get_risk_position(cid)["status"] == "RELEASED"
    assert ledger_account_state(EQUITY)(ExecutionMode.TESTNET).open_risk_pct == 0


def test_canceled_without_fill_releases_risk():
    pipeline(Adapter()).execute(intent())
    cid = client_order_id_for("ledger-0001", ExecutionMode.TESTNET)
    store.update_execution_order(cid, status="CANCELED", executed_quantity="0")
    assert store.get_risk_position(cid)["status"] == "RELEASED"


def test_canceled_after_partial_fill_keeps_risk_open():
    pipeline(Adapter()).execute(intent())
    cid = client_order_id_for("ledger-0001", ExecutionMode.TESTNET)
    store.update_execution_order(cid, status="CANCELED", executed_quantity="0.4")
    assert store.get_risk_position(cid)["status"] == "OPEN"


def test_realized_loss_counts_toward_daily_loss_and_blocks():
    adapter = Adapter()
    run = pipeline(adapter)
    run.execute(intent("ledger-loss"))
    cid = client_order_id_for("ledger-loss", ExecutionMode.TESTNET)
    assert store.close_position(cid, Decimal("-200")) is True

    state = ledger_account_state(EQUITY)(ExecutionMode.TESTNET)
    assert state.daily_loss_pct == Decimal("2")
    assert state.open_risk_pct == 0

    blocked = run.execute(intent("ledger-next"))
    assert "daily_loss_limit" in blocked.reasons
    assert adapter.calls == 1


def test_profits_offset_losses_and_never_go_negative():
    run = pipeline(Adapter())
    run.execute(intent("ledger-w"))
    run.execute(intent("ledger-l"))
    store.close_position(client_order_id_for("ledger-w", ExecutionMode.TESTNET), Decimal("150"))
    store.close_position(client_order_id_for("ledger-l", ExecutionMode.TESTNET), Decimal("-50"))
    assert ledger_account_state(EQUITY)(ExecutionMode.TESTNET).daily_loss_pct == 0


def test_position_closes_only_once():
    pipeline(Adapter()).execute(intent())
    cid = client_order_id_for("ledger-0001", ExecutionMode.TESTNET)
    assert store.close_position(cid, Decimal("-10")) is True
    assert store.close_position(cid, Decimal("-10")) is False


def test_utc_day_start_truncates_to_midnight():
    moment = datetime(2026, 10, 8, 17, 45, 3, tzinfo=timezone.utc)
    assert utc_day_start(moment) == "2026-10-08T00:00:00+00:00"


def test_live_with_ledger_still_requires_enable_and_readiness():
    adapter = Adapter()
    blocked = pipeline(adapter).execute(intent(mode=ExecutionMode.LIVE))
    assert blocked.outcome is Outcome.REJECTED
    assert "account_risk_untracked" not in blocked.reasons
    assert "live_execution_disabled" in blocked.reasons
    assert adapter.calls == 0

    ready = LiveExecutionRequirements(True, True, True, True, True)
    allowed = pipeline(adapter, live_enabled=True, live_requirements=ready).execute(
        intent("ledger-live", mode=ExecutionMode.LIVE)
    )
    assert allowed.outcome is Outcome.SUBMITTED


# --- API ---------------------------------------------------------------


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "api.sqlite3"))
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-ledger-0123456789abcdef")
    monkeypatch.setenv("M1_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("M1_ADMIN_PASSWORD_HASH", PasswordHash.recommended().hash("pw-correct"))
    monkeypatch.setenv("M1_ACCOUNT_EQUITY", "10000")
    from app.main import app

    return TestClient(app)


def headers(client):
    token = client.post(
        "/v1/auth/token", data={"username": "admin", "password": "pw-correct"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_risk_state_requires_auth(client):
    assert client.get("/v1/risk/state").status_code == 401


def test_risk_state_and_close_flow(client):
    auth = headers(client)
    store.claim_execution_order(
        client_order_id="m1manual",
        signal_id="manual-1",
        symbol="BTCUSDT",
        side="BUY",
        mode="PAPER",
        quantity="1",
        risk_amount="50",
        reference_price="100",
        stop_loss="50",
    )
    state = client.get("/v1/risk/state?mode=PAPER", headers=auth).json()
    assert state["tracked"] is True
    assert Decimal(state["open_risk_pct"]) == Decimal("0.5")
    assert len(state["open_positions"]) == 1

    closed = client.post(
        "/v1/risk/positions/m1manual/close", json={"realized_pnl": "-30"}, headers=auth
    )
    assert closed.status_code == 200
    again = client.post(
        "/v1/risk/positions/m1manual/close", json={"realized_pnl": "-30"}, headers=auth
    )
    assert again.status_code == 409

    state = client.get("/v1/risk/state?mode=PAPER", headers=auth).json()
    assert Decimal(state["daily_loss_pct"]) == Decimal("0.3")
    assert state["open_positions"] == []


def test_close_unknown_position_is_404(client):
    response = client.post(
        "/v1/risk/positions/nope/close", json={"realized_pnl": "1"}, headers=headers(client)
    )
    assert response.status_code == 404


def test_close_rejects_malformed_pnl(client):
    response = client.post(
        "/v1/risk/positions/x/close", json={"realized_pnl": "1e9"}, headers=headers(client)
    )
    assert response.status_code == 422
