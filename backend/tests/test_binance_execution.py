import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

import app.main as main


class FakeBinanceClient:
    execution_mode = "TESTNET"

    def __init__(self, config):
        assert config.base_url == main.BinanceSpotConfig.from_env(testnet=True).base_url

    def order_test(self, **kwargs):
        return {"validated": True, "symbol": kwargs["symbol"], "side": kwargs["side"]}

    def order_preflight(self, **kwargs):
        from test_spot_filters import metadata
        from app.spot_filters import validate_spot_order
        return validate_spot_order(metadata(), **kwargs)

    def order_submission_preflight(self, **kwargs):
        return self.order_preflight(**kwargs)

    def submit_testnet_order(self, **kwargs):
        return {
            "symbol": kwargs["symbol"], "orderId": 91, "status": "NEW",
            "executedQty": "0", "price": kwargs.get("price"), "updateTime": 101,
        }


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-binance-0123456789abcd")
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


def test_preflight_uses_public_metadata_and_reports_deferred_checks(client):
    token = login(client)
    response = client.post("/v1/binance/spot/preflight",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC"})
    assert response.status_code == 200
    report = response.json()
    assert report["static_validation_passed"] and report["exchange_validation_required"]
    assert report["order_placement"] is False and report["live_enabled"] is False


@pytest.mark.parametrize("body", [
    {"order_type": "LIMIT", "quantity": "0.1"},
    {"order_type": "MARKET", "quantity": "0.1", "price": "100"},
    {"quantity": "0.1", "metadata": {"filters": []}},
    {"order_type": "LIMIT", "quantity": "0.1", "price": "200", "time_in_force": "GTC"},
])
def test_shape_and_external_metadata_injection_rejected(client, body):
    token = login(client)
    response = client.post("/v1/binance/spot/preflight",
        headers={"Authorization": f"Bearer {token}"}, json={"signal": signal(), **body})
    assert response.status_code == 422


def test_real_client_preflight_rejection_prevents_signed_call(client, monkeypatch):
    from app.binance_spot import BinanceSpotClient
    from test_spot_filters import metadata
    calls = []
    def transport(self, method, path, params=None, *, signed=False):
        calls.append((method, path, signed))
        return metadata()
    monkeypatch.setattr(main, "BinanceSpotClient", BinanceSpotClient)
    monkeypatch.setattr(BinanceSpotClient, "_request", transport)
    monkeypatch.setenv("BINANCE_API_KEY", "fake-test-key")
    monkeypatch.setenv("BINANCE_API_SECRET", "fake-test-secret")
    token = login(client)
    response = client.post("/v1/binance/spot/order-test",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1001",
              "price": "100", "time_in_force": "GTC"})
    assert response.status_code == 422
    assert response.json()["detail"] == "quantity_invalid_increment"
    assert calls == [("GET", "/api/v3/exchangeInfo", False)]


def test_preflight_transport_errors_are_redacted(client, monkeypatch):
    from app.binance_spot import BinanceAPIError
    def fail(self, **kwargs):
        raise BinanceAPIError("upstream_detail_that_must_not_escape")
    monkeypatch.setattr(FakeBinanceClient, "order_preflight", fail)
    token = login(client)
    response = client.post("/v1/binance/spot/preflight",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC"})
    assert response.status_code == 502
    assert response.json()["detail"] == "testnet_metadata_unavailable"
    assert "upstream_detail" not in response.text


def test_preflight_read_scope_is_available_to_viewer_without_exchange_keys(client, monkeypatch):
    from app.auth import create_access_token
    from app.binance_spot import BinanceSpotClient
    from test_spot_filters import metadata
    calls = []
    def transport(self, method, path, params=None, *, signed=False):
        assert self.config.api_key == self.config.api_secret == ""
        calls.append((method, path, signed))
        return metadata()
    monkeypatch.setattr(main, "BinanceSpotClient", BinanceSpotClient)
    monkeypatch.setattr(BinanceSpotClient, "_request", transport)
    monkeypatch.setenv("BINANCE_API_KEY", "unused-fake-key")
    monkeypatch.setenv("BINANCE_API_SECRET", "unused-fake-secret")
    token = create_access_token("viewer", "VIEWER")
    response = client.post("/v1/binance/spot/preflight",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC"})
    assert response.status_code == 200
    assert calls == [("GET", "/api/v3/exchangeInfo", False)]


def test_order_submit_is_disabled_by_default_before_preflight(client, monkeypatch):
    monkeypatch.delenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", raising=False)
    token = login(client)
    response = client.post(
        "/v1/binance/spot/order-submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC", "client_order_id": "submit-001"},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "testnet_order_submission_disabled"


def test_order_submit_refuses_missing_credentials_before_exchange_preflight(client, monkeypatch):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    monkeypatch.setenv("M1_TESTNET_ALLOWED_SYMBOLS", "BTCUSDT")
    monkeypatch.setenv("M1_TESTNET_MAX_NOTIONAL", "100")
    monkeypatch.delenv("BINANCE_API_KEY", raising=False)
    monkeypatch.delenv("BINANCE_API_SECRET", raising=False)
    token = login(client)
    response = client.post(
        "/v1/binance/spot/order-submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC", "client_order_id": "submit-no-key"},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "testnet_credentials_not_configured"


def test_order_submit_refuses_unresolved_account_and_reference_checks(client, monkeypatch):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    monkeypatch.setenv("M1_TESTNET_ALLOWED_SYMBOLS", "BTCUSDT")
    monkeypatch.setenv("M1_TESTNET_MAX_NOTIONAL", "100")
    monkeypatch.setenv("BINANCE_API_KEY", "fake-testnet-key")
    monkeypatch.setenv("BINANCE_API_SECRET", "fake-testnet-secret")
    token = login(client)
    response = client.post(
        "/v1/binance/spot/order-submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC", "client_order_id": "submit-002"},
    )
    assert response.status_code == 409
    assert response.json()["detail"] == "testnet_exchange_validation_incomplete"


def test_order_submit_happy_path_uses_reserved_single_submission_offline(client, monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "submit.sqlite3"))
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    monkeypatch.setenv("M1_TESTNET_ALLOWED_SYMBOLS", "BTCUSDT")
    monkeypatch.setenv("M1_TESTNET_MAX_NOTIONAL", "100")
    monkeypatch.setenv("BINANCE_API_KEY", "fake-testnet-key")
    monkeypatch.setenv("BINANCE_API_SECRET", "fake-testnet-secret")
    monkeypatch.setattr(FakeBinanceClient, "order_submission_preflight", lambda self, **kwargs: {
        "deferred_checks": [], "account_and_asset_filters_verified": True,
    })
    token = login(client)
    body = {"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
            "price": "100", "time_in_force": "GTC", "client_order_id": "submit-003"}
    response = client.post(
        "/v1/binance/spot/order-submit",
        headers={"Authorization": f"Bearer {token}"}, json=body,
    )
    assert response.status_code == 200
    assert response.json()["submitted"] is True
    assert response.json()["order_id"] == 91
    from app.store import get_execution_order
    order = get_execution_order("submit-003")
    assert order["status"] == "NEW" and order["market"] == "SPOT"


def test_order_submit_is_admin_only(client, monkeypatch):
    from app.auth import create_access_token
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    token = create_access_token("operator", "OPERATOR")
    response = client.post(
        "/v1/binance/spot/order-submit",
        headers={"Authorization": f"Bearer {token}"},
        json={"signal": signal(), "order_type": "LIMIT", "quantity": "0.1",
              "price": "100", "time_in_force": "GTC", "client_order_id": "submit-004"},
    )
    assert response.status_code == 403
