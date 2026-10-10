import pytest


@pytest.fixture(autouse=True)
def isolated_operational_store(tmp_path, monkeypatch):
    """Never let a test write sessions, throttles, or controls to a real store."""
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
