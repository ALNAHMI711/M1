import pytest


@pytest.fixture(autouse=True)
def isolated_operational_store(tmp_path, monkeypatch):
    """Never let a test write sessions, throttles, or controls to a real store."""
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    import base64
    import os
    key_file = tmp_path / "testnet-encryption-key"
    key_file.write_text(base64.b64encode(os.urandom(32)).decode("ascii"), encoding="ascii")
    key_file.chmod(0o600)
    monkeypatch.setenv("M1_TESTNET_ENCRYPTION_KEY_FILE", str(key_file))
