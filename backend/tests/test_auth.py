import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

from app.main import app


@pytest.fixture()
def auth_client(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-auth")
    monkeypatch.setenv("M1_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("M1_ADMIN_PASSWORD_HASH", PasswordHash.recommended().hash("correct-password"))
    return TestClient(app)


def login(client):
    response = client.post("/v1/auth/token", data={"username": "admin", "password": "correct-password"})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_rejects_bad_credentials(auth_client):
    response = auth_client.post("/v1/auth/token", data={"username": "admin", "password": "wrong"})
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
