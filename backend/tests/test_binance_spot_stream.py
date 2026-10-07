import json

import pytest

from app.binance_spot_stream import (
    BinanceSpotStreamConfig,
    BinanceSpotUserDataStream,
    sign_subscription,
    signature_payload,
    subscription_request,
)


def test_signature_payload_is_sorted_and_percent_encoded():
    assert signature_payload(
        {"timestamp": 123, "apiKey": "key", "recvWindow": 5000}
    ) == "apiKey=key&recvWindow=5000&timestamp=123"


def test_sign_subscription_uses_hmac_sha256():
    params = sign_subscription(
        api_key="key",
        api_secret="secret",
        timestamp=123,
        recv_window=5000,
    )
    assert params["apiKey"] == "key"
    assert params["timestamp"] == 123
    assert params["recvWindow"] == 5000
    assert len(params["signature"]) == 64


def test_subscription_request_uses_signature_method():
    request = subscription_request(
        api_key="key",
        api_secret="secret",
        timestamp=123,
        request_id="request-1",
    )
    assert request["id"] == "request-1"
    assert request["method"] == "userDataStream.subscribe.signature"
    assert request["params"]["apiKey"] == "key"


def test_stream_rejects_failed_subscription():
    with pytest.raises(Exception, match="subscription_failed"):
        BinanceSpotUserDataStream._ensure_subscription_confirmed(
            {"status": 401, "error": {"code": -2015}}
        )


def test_stream_consumes_execution_report_only_for_known_order(monkeypatch, tmp_path):
    applied = []

    class FakeRest:
        pass

    stream = BinanceSpotUserDataStream(
        BinanceSpotStreamConfig(api_key="key", api_secret="secret"),
        rest_client=FakeRest(),
        apply_event=lambda payload: applied.append(payload) or True,
    )
    stream._consume(
        {
            "subscriptionId": 0,
            "event": {
                "e": "executionReport",
                "c": "client-1",
                "X": "FILLED",
            },
        }
    )
    assert len(applied) == 1
    assert applied[0]["event"]["c"] == "client-1"


def test_stream_ignores_non_execution_events():
    applied = []
    stream = BinanceSpotUserDataStream(
        BinanceSpotStreamConfig(api_key="key", api_secret="secret"),
        rest_client=object(),
        apply_event=lambda payload: applied.append(payload) or True,
    )
    stream._consume(
        {"subscriptionId": 0, "event": {"e": "outboundAccountPosition"}}
    )
    assert applied == []


def test_stream_requires_credentials():
    with pytest.raises(ValueError, match="missing_binance_credentials"):
        subscription_request(api_key="", api_secret="secret")


def test_stream_enforces_recv_window_limit():
    with pytest.raises(ValueError, match="recv_window_too_large"):
        sign_subscription(
            api_key="key",
            api_secret="secret",
            timestamp=123,
            recv_window=60001,
        )
