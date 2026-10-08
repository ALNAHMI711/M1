import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

import app.main as main


class FakeBinanceClient:
    orders: list[dict] = []

    def __init__(self, config):
        self.config = config

    def book_ticker(self, symbol):
        return {"bidPrice": "99.99", "askPrice": "100.01"}

    def new_order(self, **kwargs):
        assert self.config.base_url == main.BinanceSpotConfig.from_env(testnet=True).base_url
        FakeBinanceClient.orders.append(kwargs)
        return {"orderId": 101, "status": "NEW", "executedQty": "0"}


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-execution-0123456789ab")
    monkeypatch.setenv("M1_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("M1_ADMIN_PASSWORD_HASH", PasswordHash.recommended().hash("correct-password"))
    monkeypatch.setenv("M1_ACCOUNT_EQUITY", "10000")
    monkeypatch.setenv("M1_MAX_NOTIONAL", "1000")
    monkeypatch.delenv("M1_KILL_SWITCH", raising=False)
    FakeBinanceClient.orders = []
    monkeypatch.setattr(main, "BinanceSpotClient", FakeBinanceClient)
    return TestClient(main.app)


def auth(client):
    token = client.post(
        "/v1/auth/token", data={"username": "admin", "password": "correct-password"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def payload(mode="TESTNET", score=92, signal_id="api-signal-0001"):
    return {
        "signal": {
            "symbol": "BTCUSDT",
            "side": "LONG",
            "entry": 100,
            "stop_loss": 98,
            "take_profit": 106,
            "score": score,
            "rr": 3,
            "source": "MANUAL",
            "mode": mode,
            "signal_id": signal_id,
        },
        "quantity": "1",
    }


def test_requires_authentication(client):
    assert client.post("/v1/execution/submit", json=payload()).status_code == 401


def test_testnet_submit_then_replay_is_idempotent(client):
    headers = auth(client)
    first = client.post("/v1/execution/submit", json=payload(), headers=headers)
    second = client.post("/v1/execution/submit", json=payload(), headers=headers)

    assert first.status_code == 200 and first.json()["outcome"] == "SUBMITTED"
    assert second.status_code == 200 and second.json()["outcome"] == "DUPLICATE"
    assert len(FakeBinanceClient.orders) == 1
    assert FakeBinanceClient.orders[0]["client_order_id"] == first.json()["client_order_id"]


def test_low_score_never_reaches_exchange(client):
    response = client.post(
        "/v1/execution/submit", json=payload(score=60), headers=auth(client)
    )
    assert response.status_code == 422
    assert FakeBinanceClient.orders == []


def test_live_is_rejected_and_never_reaches_exchange(client):
    response = client.post(
        "/v1/execution/submit", json=payload(mode="LIVE"), headers=auth(client)
    )
    assert response.status_code == 422
    assert "live_execution_disabled" in response.json()["detail"]["reasons"]
    assert FakeBinanceClient.orders == []


def test_kill_switch_env_blocks_execution(client, monkeypatch):
    monkeypatch.setenv("M1_KILL_SWITCH", "true")
    response = client.post("/v1/execution/submit", json=payload(), headers=auth(client))
    assert response.status_code == 422
    assert "kill_switch" in response.json()["detail"]["reasons"]
    assert FakeBinanceClient.orders == []


def test_paper_mode_simulates_without_exchange_order(client):
    response = client.post(
        "/v1/execution/submit", json=payload(mode="PAPER"), headers=auth(client)
    )
    assert response.status_code == 200
    assert response.json()["status"] == "SIMULATED"
    assert FakeBinanceClient.orders == []
