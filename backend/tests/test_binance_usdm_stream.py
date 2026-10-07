import pytest

from app.binance_usdm_stream import (
    USDM_PRIVATE_STREAM_URL,
    USDM_WS_API_TESTNET_URL,
    USDM_WS_API_URL,
    UsdmUserDataStreamLifecycle,
)


def test_current_usdm_ws_api_endpoints_are_defined():
    assert USDM_WS_API_URL == "wss://ws-fapi.binance.com/ws-fapi/v1"
    assert USDM_WS_API_TESTNET_URL == "wss://testnet.binancefuture.com/ws-fapi/v1"
    assert USDM_PRIVATE_STREAM_URL == "wss://fstream.binance.com/private/ws"


def test_start_request_includes_api_key():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    assert state.start_request("req-7") == {
        "id": "req-7",
        "method": "userDataStream.start",
        "params": {"apiKey": "key"},
    }
    assert state.api_key_header == {"X-MBX-APIKEY": "key"}


def test_start_response_creates_stream_state():
    started = UsdmUserDataStreamLifecycle(api_key="key").apply_start_response(
        {"status": 200, "result": {"listenKey": "listen-key"}}
    )
    assert started.started is True
    assert started.listen_key == "listen-key"


def test_start_response_rejects_invalid_payload():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    with pytest.raises(ValueError, match="usdm_stream_start_failed"):
        state.apply_start_response({"status": 500})
    with pytest.raises(ValueError, match="missing_listen_key"):
        state.apply_start_response({"status": 200, "result": {}})


def test_private_stream_url_requires_started_stream():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    with pytest.raises(ValueError, match="stream_not_started"):
        _ = state.private_stream_url
    started = state.started_with("listen-key")
    assert started.private_stream_url == (
        "wss://fstream.binance.com/private/ws"
        "?listenKey=listen-key&events=ORDER_TRADE_UPDATE%2CACCOUNT_UPDATE"
    )


def test_listen_key_is_url_encoded():
    state = UsdmUserDataStreamLifecycle(api_key="key").started_with("a/b+c")
    assert "listenKey=a%2Fb%2Bc" in state.private_stream_url


def test_keepalive_request_and_response_refresh_listen_key():
    started = UsdmUserDataStreamLifecycle(api_key="key").started_with("old-key")
    assert started.keepalive_request("req-2") == {
        "id": "req-2",
        "method": "userDataStream.ping",
        "params": {"apiKey": "key"},
    }
    refreshed = started.apply_keepalive_response(
        {"status": 200, "result": {"listenKey": "new-key"}}
    )
    assert refreshed.listen_key == "new-key"


def test_keepalive_requires_started_stream():
    with pytest.raises(ValueError, match="stream_not_started"):
        UsdmUserDataStreamLifecycle(api_key="key").keepalive_request("req-1")


def test_keepalive_is_due_before_stream_expiry():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    assert state.keepalive_due(49 * 60) is False
    assert state.keepalive_due(50 * 60) is True


def test_stop_request_and_response():
    started = UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    assert started.stop_request("req-3") == {
        "id": "req-3",
        "method": "userDataStream.stop",
        "params": {"apiKey": "key"},
    }
    stopped = started.apply_stop_response({"status": 200, "result": {}})
    assert stopped.started is False
    assert stopped.listen_key is None


@pytest.mark.parametrize(
    "kwargs,error",
    [
        ({"api_key": ""}, "missing_api_key"),
        ({"api_key": "key", "keepalive_interval_seconds": 0}, "invalid_keepalive_interval"),
        ({"api_key": "key", "keepalive_interval_seconds": True}, "invalid_keepalive_interval"),
    ],
)
def test_invalid_stream_configuration(kwargs, error):
    with pytest.raises(ValueError, match=error):
        UsdmUserDataStreamLifecycle(**kwargs)


def test_invalid_request_id_is_rejected():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    with pytest.raises(ValueError, match="invalid_request_id"):
        state.start_request(7)


def test_empty_request_id_is_rejected():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    with pytest.raises(ValueError, match="invalid_request_id"):
        state.start_request("")


def test_negative_or_bool_elapsed_is_rejected():
    state = UsdmUserDataStreamLifecycle(api_key="key")
    with pytest.raises(ValueError, match="invalid_elapsed_seconds"):
        state.keepalive_due(-1)
    with pytest.raises(ValueError, match="invalid_elapsed_seconds"):
        state.keepalive_due(True)
