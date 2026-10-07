import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

import app.main as main


class FakeBinanceClient:
    def __init__(self, config):
        assert config.base_url == main.BinanceSpotConfig.from_env(testnet=True).base_url

    def order_test(self, **kwargs):
        return {"validated": True, "symbol": kwargs["symbol"], "side": kwargs["side"]}


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-binance")
    monkeypatch.setenv("M1_ADMIN_USERNAME", "admin")
    monkeypatch.setenv(
        "M1_ADMIN_PASSWORD_HASH",
        PasswordHash.recommended().hash("correct-password"),
    )
    monkeypatch.setattr(main, "BinanceSpotClient", FakeBinanceClient)
    return TestClient(main.app)


def login(client):
    response = client.post(
        "/v1/auth/token",
        data={"username": "admin", "password": "correct-password"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def signal(mode="TESTNET", score=92, rr=2):
    return {
        "symbol": "BTCUSDT",
        "side": "LONG",
        "entry": 100,
        "stop_loss": 90,
        "take_profit": 120,
        "score": score,
        "rr": rr,
        "source": "MANUAL",
        "mode": mode,
        "signal_id": "binance-test-001",
    }


def test_testnet_order_endpoint_runs_risk_gate(client):
    token = login(client)
    response = client.post(
        "/v1/binance/spot/order-test",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "signal": signal(),
            "order_type": "LIMIT",
            "quantity": "0.001",
            "price": "100",
            "time_in_force": "GTC",
        },
    )
    assert response.status_code == 200
    assert response.json()["mode"] == "TESTNET"
    assert response.json()["result"]["validated"] is True


def test_testnet_order_endpoint_rejects_live(client):
    token = login(client)
    response = client.post(
        "/v1/binance/spot/order-test",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(mode="LIVE"), "quantity": "0.001"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "binance_order_test_requires_testnet_mode"


def test_testnet_order_endpoint_rejects_low_score(client):
    token = login(client)
    response = client.post(
        "/v1/binance/spot/order-test",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(score=84), "quantity": "0.001"},
    )
    assert response.status_code == 422
    assert "score_below_85" in response.json()["detail"]["reasons"]


def test_testnet_order_endpoint_requires_write_scope(client):
    response = client.post(
        "/v1/binance/spot/order-test",
        json={"signal": signal(), "quantity": "0.001"},
    )
    assert response.status_code == 401
