import pytest

from app.binance_usdm_stream import UserStreamLifecycle


def test_keepalive_is_due_after_interval():
    stream = UserStreamLifecycle("listen-key")
    assert stream.keepalive_due(1800)
    assert not stream.keepalive_due(1799)


def test_lifecycle_requires_listen_key():
    with pytest.raises(ValueError, match="missing_listen_key"):
        UserStreamLifecycle("")


def test_lifecycle_rejects_invalid_interval():
    with pytest.raises(ValueError, match="invalid_keepalive_interval"):
        UserStreamLifecycle("listen-key", keepalive_interval_seconds=0)
