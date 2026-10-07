import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app.main import app


@pytest.fixture()
def auth_client(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-auth-0123456789abcd")
    monkeypatch.setenv("M1_ADMIN_USERNAME", "admin")
    monkeypatch.setenv(
        "M1_ADMIN_PASSWORD_HASH",
        PasswordHash.recommended().hash("correct-password"),
    )
    return TestClient(app)


def login(client):
    response = client.post(
        "/v1/auth/token",
        data={"username": "admin", "password": "correct-password"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_rejects_bad_credentials(auth_client):
    response = auth_client.post(
        "/v1/auth/token",
        data={"username": "admin", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_me_and_rbac(auth_client):
    token = login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}
    me = auth_client.get("/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "ADMIN"
    status = auth_client.get("/v1/control/status", headers=headers)
    assert status.status_code == 200
    assert status.json()["live_enabled"] is False


def test_logout_revokes_token(auth_client):
    token = login(auth_client)
    headers = {"Authorization": f"Bearer {token}"}
    logout = auth_client.post("/v1/auth/logout", headers=headers)
    assert logout.status_code == 200
    me = auth_client.get("/v1/auth/me", headers=headers)
    assert me.status_code == 401


def test_protected_endpoint_requires_authentication(auth_client):
    response = auth_client.get("/v1/control/status")
    assert response.status_code == 401


def test_control_write_scope_is_enforced(auth_client):
    from app.auth import create_access_token

    viewer_token = create_access_token("viewer", "VIEWER")
    headers = {"Authorization": f"Bearer {viewer_token}"}
    response = auth_client.post("/v1/binance/spot/recover", headers=headers)
    assert response.status_code == 403


def test_short_auth_secret_is_rejected(auth_client, monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "too-short")
    with pytest.raises(RuntimeError, match="at least 32 bytes"):
        login(auth_client)
