from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from dataclasses import replace
from importlib import reload

import jwt
import pytest
from fastapi.testclient import TestClient

import app.auth as auth
from app.admin import backup_database, restore_database
from app.binance_spot import BinanceAPIError, BinanceSpotClient, BinanceSpotConfig
from app.execution_contract import ExecutionRequest, authorize_execution
from app.main import app, Signal
from app.operations import (
    consume_rate_limit, get_user, kill_switch_active, operational_connection,
    save_user, set_kill_switch,
)
from app.risk_gate import RiskDecision, RiskInput, evaluate_trade_risk
from app.store import record_signal, recent_execution_audit


@pytest.fixture
def authenticated(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET", "test-operational-secret-01234567890123456789")
    save_user("admin", auth.password_hash.hash("correct-password"), "ADMIN")
    client = TestClient(app)
    token = auth.create_access_token("admin", "ADMIN")
    return client, {"Authorization": f"Bearer {token}"}, token


def test_session_revocation_survives_module_reload(authenticated):
    client, headers, token = authenticated
    assert client.post("/v1/auth/logout", headers=headers).status_code == 200
    reload(auth)
    with pytest.raises(Exception) as error:
        auth._decode(token)
    assert error.value.status_code == 401


def test_unknown_signed_session_is_not_accepted(authenticated):
    _, _, token = authenticated
    claims = jwt.decode(token, auth._secret(), algorithms=["HS256"], audience=auth.AUDIENCE)
    claims["jti"] = "forged-not-issued-session"
    forged = jwt.encode(claims, auth._secret(), algorithm="HS256")
    with pytest.raises(Exception) as error:
        auth._decode(forged)
    assert error.value.status_code == 401


def test_password_change_and_disable_revoke_existing_sessions(authenticated):
    client, headers, _ = authenticated
    save_user("admin", auth.password_hash.hash("replacement-password"), "VIEWER", enabled=False)
    assert client.get("/v1/auth/me", headers=headers).status_code == 401
    assert auth.authenticate("admin", "replacement-password") is None


def test_persistent_user_authenticates_after_restart(authenticated):
    reload(auth)
    assert auth.authenticate("admin", "correct-password") == "ADMIN"
    assert auth.authenticate("admin", "incorrect-password") is None


@pytest.mark.parametrize("claim,value", [("aud", "other-api"), ("iss", "other-issuer"), ("exp", 1)])
def test_required_session_claims_are_enforced(authenticated, claim, value):
    _, _, token = authenticated
    claims = jwt.decode(token, auth._secret(), algorithms=["HS256"], audience=auth.AUDIENCE)
    claims[claim] = value
    forged = jwt.encode(claims, auth._secret(), algorithm="HS256")
    with pytest.raises(Exception) as error:
        auth._decode(forged)
    assert error.value.status_code == 401


def test_lowercase_bearer_logout_revokes(authenticated):
    client, _, token = authenticated
    headers = {"Authorization": f"bearer {token}"}
    assert client.post("/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/v1/auth/me", headers=headers).status_code == 401


def test_rate_limit_is_durable():
    assert consume_rate_limit("test-ip", 2, now=120)
    assert consume_rate_limit("test-ip", 2, now=121)
    assert not consume_rate_limit("test-ip", 2, now=122)
    assert consume_rate_limit("test-ip", 2, now=180)


def test_login_is_throttled(monkeypatch):
    monkeypatch.setenv("M1_LOGIN_RATE_PER_MINUTE", "2")
    client = TestClient(app)
    for _ in range(2):
        assert client.post("/v1/auth/token", data={"username": "wrong", "password": "wrong"}).status_code == 401
    response = client.post("/v1/auth/token", data={"username": "wrong", "password": "wrong"})
    assert response.status_code == 429
    assert response.headers["retry-after"] == "60"


def test_untrusted_host_rejected():
    assert TestClient(app).get("/health", headers={"host": "evil.example"}).status_code == 400


def test_large_and_chunked_body_rejected(monkeypatch):
    monkeypatch.setenv("M1_MAX_BODY_BYTES", "32")
    client = TestClient(app)
    assert client.post("/v1/signals/validate", content="x" * 33).status_code == 413
    assert client.post("/v1/signals/validate", content=iter([b"x" * 20, b"x" * 20])).status_code == 413


def test_security_headers():
    response = TestClient(app).get("/health")
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_kill_switch_is_durable_and_admin_only(authenticated):
    client, headers, _ = authenticated
    assert client.put("/v1/control/kill-switch", json={"enabled": True}, headers=headers).status_code == 200
    assert kill_switch_active()
    assert recent_execution_audit()[0]["event"] == "KILL_SWITCH"
    viewer = auth.create_access_token("viewer", "VIEWER")
    assert client.put("/v1/control/kill-switch", json={"enabled": False}, headers={"Authorization": f"Bearer {viewer}"}).status_code == 403
    assert kill_switch_active()
    assert client.put("/v1/control/kill-switch", json={"enabled": False}, headers=headers).status_code == 200
    assert not kill_switch_active()


def test_atomic_signal_claim_with_concurrent_requests():
    def claim(_):
        return record_signal("concurrent-001", "BTCUSDT", "LONG", "MANUAL", "PAPER", True, [])
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(claim, range(8)))
    assert results.count(True) == 1


def test_parallel_cold_database_initialization_repeat(tmp_path, monkeypatch):
    # Exercise real cold-file WAL transitions rather than warming the database
    # before the concurrency test, which would hide initialization races.
    for index in range(10):
        monkeypatch.setenv("M1_DB_PATH", str(tmp_path / f"cold-{index}.sqlite3"))
        def claim(_):
            return record_signal("cold-start-001", "BTCUSDT", "LONG", "MANUAL", "PAPER", True, [])
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(claim, range(16)))
        assert results.count(True) == 1


@pytest.mark.parametrize("field", ["entry", "stop_loss", "take_profit", "score", "rr"])
def test_signal_rejects_infinite_values(field):
    values = dict(symbol="BTCUSDT", side="LONG", entry=100, stop_loss=90, take_profit=120,
                  score=90, rr=2, source="MANUAL", signal_id="finite-test-001")
    values[field] = float("inf")
    with pytest.raises(ValueError):
        Signal(**values)


def test_backup_restore_preserves_users_revokes_sessions_and_activates_switch(authenticated, tmp_path, monkeypatch):
    _, _, token = authenticated
    backup = tmp_path / "backup.sqlite3"
    backup_database(str(backup))
    with pytest.raises(FileExistsError):
        backup_database(str(backup))
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "restored.sqlite3"))
    restore_database(str(backup))
    assert get_user("admin")["role"] == "ADMIN"
    assert kill_switch_active()
    with pytest.raises(Exception) as error:
        auth._decode(token)
    assert error.value.status_code == 401
    with pytest.raises(ValueError, match="new_database_path"):
        restore_database(str(backup))


def test_ready_requires_auth_secret(monkeypatch):
    monkeypatch.delenv("M1_AUTH_SECRET", raising=False)
    assert TestClient(app).get("/ready").status_code == 503


@pytest.mark.parametrize("origin", ["https://evil.example", "http://testnet.binance.vision", "https://api.binance.com.evil.example"])
def test_exchange_origin_allowlist(origin):
    with pytest.raises(ValueError, match="allowlisted"):
        BinanceSpotClient(BinanceSpotConfig("key", "secret", base_url=origin))


def test_exchange_live_write_and_real_order_paths_are_unreachable():
    calls = []
    client = BinanceSpotClient(BinanceSpotConfig("key", "secret", base_url="https://api.binance.com"), opener=lambda *a, **k: calls.append(a))
    with pytest.raises(BinanceAPIError, match="live_execution_not_enabled"):
        client.order_test(symbol="BTCUSDT", side="BUY", order_type="MARKET", quantity="0.001")
    with pytest.raises(BinanceAPIError, match="exchange_operation_not_enabled"):
        client._request("POST", "/api/v3/order", signed=True)
    with pytest.raises(BinanceAPIError, match="exchange_operation_not_enabled"):
        client._request("POST", "/sapi/v1/capital/withdraw/apply", signed=True)
    assert not calls


def test_kill_switch_prevents_low_level_testnet_network_call():
    calls = []
    set_kill_switch(True, "test")
    client = BinanceSpotClient(BinanceSpotConfig("key", "secret"), opener=lambda *a, **k: calls.append(a))
    with pytest.raises(BinanceAPIError, match="kill_switch"):
        client.order_test(symbol="BTCUSDT", side="BUY", order_type="MARKET", quantity="0.001")
    assert not calls


def test_execution_contract_live_flag_cannot_bypass_policy():
    risk = RiskInput(90, *(Decimal(n) for n in ["2.5", "5", "5", "1", "5", "1", "3", "100", "1000"]))
    request = ExecutionRequest("live-test", "BTCUSDT", "BUY", Decimal("0.001"), "LIVE", risk)
    with pytest.raises(PermissionError, match="live_disabled"):
        authorize_execution(request, risk_decision=RiskDecision(True, ()), live_enabled=True)


@pytest.mark.parametrize("field", ["reward_risk", "notional", "daily_loss_pct", "open_risk_pct", "max_notional"])
@pytest.mark.parametrize("number", ["NaN", "Infinity"])
def test_full_risk_gate_rejects_non_finite_inputs(field, number):
    risk = RiskInput(90, *(Decimal(n) for n in ["2.5", "5", "5", "1", "5", "1", "3", "100", "1000"]))
    decision = evaluate_trade_risk(replace(risk, **{field: Decimal(number)}))
    assert not decision.allowed
    assert f"invalid_{field}" in decision.reasons
