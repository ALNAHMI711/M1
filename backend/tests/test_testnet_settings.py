import base64, logging, os
import pytest
from fastapi.testclient import TestClient
from app.auth import create_access_token
from app.main import app
from app.testnet_settings import (credentials_status,decrypt_value,encrypt_value,get_settings,
 load_credentials_for_testnet,load_master_key,save_credentials)

def test_aes_gcm_round_trip_and_integrity():
    key=os.urandom(32); ct,nonce=encrypt_value("synthetic-api-secret",field="api_secret",key=key)
    assert decrypt_value(ct,nonce,field="api_secret",key=key)=="synthetic-api-secret"
    damaged=bytearray(ct); damaged[0]^=1
    with pytest.raises(RuntimeError,match="credential_decryption_failed"):
        decrypt_value(bytes(damaged),nonce,field="api_secret",key=key)

def test_wrong_key_rejected():
    ct,nonce=encrypt_value("synthetic-api-secret",field="api_secret",key=os.urandom(32))
    with pytest.raises(RuntimeError,match="credential_decryption_failed"):
        decrypt_value(ct,nonce,field="api_secret",key=os.urandom(32))

def test_missing_or_invalid_key_fails_closed(tmp_path):
    with pytest.raises(RuntimeError,match="testnet_encryption_key_missing"): load_master_key(str(tmp_path/"missing"))
    p=tmp_path/"bad"; p.write_text("not-base64"); p.chmod(0o600)
    with pytest.raises(RuntimeError): load_master_key(str(p))

def test_key_file_permissions_enforced(tmp_path):
    p=tmp_path/"key"; p.write_text(base64.b64encode(os.urandom(32)).decode()); p.chmod(0o644)
    with pytest.raises(RuntimeError,match="testnet_encryption_key_file_permissions_invalid"): load_master_key(str(p))

def test_default_settings_fail_closed():
    s=get_settings()
    assert s["environment"]=="SPOT_TESTNET" and s["enabled"] is False
    assert s["allowed_symbols"]==["BTCUSDT","ETHUSDT"]
    assert s["allowed_order_types"]==["LIMIT"] and s["allowed_sides"]==["BUY"]
    assert s["max_order_notional"]=="20" and s["max_daily_notional"]=="50"
    assert not s["credentials_test_passed"] and not s["manual_approval"]

def test_credentials_encrypted_and_not_logged(caplog):
    caplog.set_level(logging.DEBUG); api_key="synthetic-testnet-key-not-real"; secret="synthetic-testnet-secret-not-real"
    key=load_master_key(); save_credentials(api_key=api_key,api_secret=secret,actor="test-admin",key=key)
    assert load_credentials_for_testnet(key=key)==(api_key,secret)
    status=credentials_status(); settings=get_settings()
    assert status["present"] and api_key not in repr(status) and secret not in repr(status)
    assert api_key not in repr(settings) and secret not in repr(settings)
    assert api_key not in caplog.text and secret not in caplog.text and not settings["enabled"]

def test_activation_requires_owner_review():
    from app.testnet_settings import update_settings
    with pytest.raises(ValueError,match="testnet_activation_requires_owner_review"):
        update_settings(allowed_symbols=["BTCUSDT"],max_order_notional="20",max_daily_notional="50",actor="admin",enabled=True)

def test_admin_api_never_returns_secrets(monkeypatch):
    monkeypatch.setenv("M1_AUTH_SECRET","test-secret-for-settings-0123456789")
    token=create_access_token("test-admin","ADMIN"); headers={"Authorization":f"Bearer {token}"}
    with TestClient(app) as client:
        api_key="synthetic-testnet-key-not-real"; secret="synthetic-testnet-secret-not-real"
        saved=client.put("/v1/admin/settings/testnet/credentials",headers=headers,json={"api_key":api_key,"api_secret":secret})
        assert saved.status_code==200 and api_key not in saved.text and secret not in saved.text
        status=client.get("/v1/admin/settings/testnet/credentials/status",headers=headers)
        settings=client.get("/v1/admin/settings/testnet",headers=headers)
        assert status.status_code==200 and settings.status_code==200
        assert api_key not in status.text+settings.text and secret not in status.text+settings.text
        assert client.get("/v1/admin/settings/testnet").status_code==401
        viewer=create_access_token("viewer","VIEWER")
        denied=client.get("/v1/admin/settings/testnet/credentials/status",headers={"Authorization":f"Bearer {viewer}"})
        assert denied.status_code==403
