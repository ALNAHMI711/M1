import time
from datetime import datetime, timezone, timedelta

import jwt
from fastapi.testclient import TestClient

from app.auth import create_access_token
from app.main import app


def admin_headers(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-settings-0123456789")
    return {"Authorization": f"Bearer {create_access_token('test-admin', 'ADMIN')}"}


def test_admin_endpoints_require_admin_scope_and_reject_expired_session(monkeypatch):
    headers = admin_headers(monkeypatch)
    viewer = create_access_token("viewer", "VIEWER")
    secret = "test-secret-for-settings-0123456789"
    now = int(time.time())
    expired = jwt.encode({
        "sub": "test-admin", "role": "ADMIN", "scope": " ".join([
            "admin", "control:read", "control:write", "signals:read", "signals:validate",
            "trading:admin", "paper:read", "paper:write"
        ]),
        "iat": now - 120, "exp": now - 60, "jti": "expired-test-session",
        "iss": "m1-control-plane", "aud": "m1-control-api",
    }, secret, algorithm="HS256")
    with TestClient(app) as client:
        assert client.get("/v1/admin/settings/testnet", headers={"Authorization": f"Bearer {viewer}"}).status_code == 403
        assert client.get("/v1/admin/settings/testnet", headers={"Authorization": f"Bearer {expired}"}).status_code == 401
        assert client.get("/v1/admin/settings/testnet", headers=headers).status_code == 200


def test_activation_requires_saved_credentials_successful_test_and_second_confirmation(monkeypatch):
    import app.testnet_admin as admin
    headers = admin_headers(monkeypatch)

    class FakeReadOnlyBinance:
        def __init__(self, config):
            assert config.base_url == "https://testnet.binance.vision"
        def account(self):
            return {"canTrade": True, "balances": []}

    monkeypatch.setattr(admin, "BinanceSpotClient", FakeReadOnlyBinance)
    with TestClient(app) as client:
        before = client.post("/v1/admin/settings/testnet/activation", headers=headers, json={"confirm": True})
        assert before.status_code == 409
        api_key, api_secret = "synthetic-key-never-real", "synthetic-secret-never-real"
        saved = client.put("/v1/admin/settings/testnet/credentials", headers=headers,
                           json={"api_key": api_key, "api_secret": api_secret})
        assert saved.status_code == 200
        premature = client.post("/v1/admin/settings/testnet/activation", headers=headers, json={"confirm": True})
        assert premature.status_code == 409
        tested = client.post("/v1/admin/settings/testnet/credentials/test", headers=headers, json={})
        assert tested.status_code == 200
        no_confirmation = client.post("/v1/admin/settings/testnet/activation", headers=headers, json={"confirm": False})
        assert no_confirmation.status_code == 409
        enabled = client.post("/v1/admin/settings/testnet/activation", headers=headers, json={"confirm": True})
        assert enabled.status_code == 200
        assert enabled.json()["enabled"] is True and enabled.json()["manual_approval"] is True
        status = client.get("/v1/admin/settings/testnet/credentials/status", headers=headers)
        audit = client.get("/v1/admin/settings/testnet/audit", headers=headers)
        combined = saved.text + tested.text + enabled.text + status.text + audit.text
        assert api_key not in combined and api_secret not in combined


def test_missing_credentials_connection_test_fails_closed_without_exchange_call(monkeypatch):
    import app.testnet_admin as admin
    headers = admin_headers(monkeypatch)
    called = []
    monkeypatch.setattr(admin, "BinanceSpotClient", lambda config: called.append(config))
    with TestClient(app) as client:
        response = client.post("/v1/admin/settings/testnet/credentials/test", headers=headers, json={})
        assert response.status_code == 409
        assert response.json()["detail"] == "testnet_credentials_not_configured"
        assert called == []


def test_settings_survive_new_client_and_admin_api_never_returns_secret(monkeypatch):
    headers = admin_headers(monkeypatch)
    with TestClient(app) as first:
        changed = first.put("/v1/admin/settings/testnet", headers=headers, json={
            "allowed_symbols": ["ETHUSDT"], "max_order_notional": "10",
            "max_daily_notional": "30", "enabled": False,
        })
        assert changed.status_code == 200
    with TestClient(app) as restarted:
        response = restarted.get("/v1/admin/settings/testnet", headers=headers)
        assert response.status_code == 200
        assert response.json()["allowed_symbols"] == ["ETHUSDT"]
        assert response.json()["max_order_notional"] == "10"
        assert response.json()["max_daily_notional"] == "30"
