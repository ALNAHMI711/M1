import pytest

from app.binance_usdm_stream import UsdmUserDataStreamLifecycle


def test_stream_starts_only_with_listen_key():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    assert state.started is False
    started = state.started_with("listen-key")
    assert started.started is True
    assert started.listen_key == "listen-key"


def test_keepalive_is_due_before_stream_expiry():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    assert state.keepalive_due(49 * 60) is False
    assert state.keepalive_due(50 * 60) is True


def test_stream_can_be_stopped():
    state = UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    stopped = state.stopped()
    assert stopped.started is False
    assert stopped.listen_key is None


@pytest.mark.parametrize(
    "kwargs,error",
    [
        ({"api_key": ""}, "missing_api_key"),
        ({"api_key": "key", "keepalive_interval_seconds": 0}, "invalid_keepalive_interval"),
    ],
)
def test_invalid_stream_configuration(kwargs, error):
    with pytest.raises(ValueError, match=error):
        UsdmUserDataStreamLifecycle(**kwargs)


def test_negative_elapsed_is_rejected():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    with pytest.raises(ValueError, match="invalid_elapsed_seconds"):
        state.keepalive_due(-1)
