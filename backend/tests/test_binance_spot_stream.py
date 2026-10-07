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


def test_stream_reconnects_after_termination_and_recovers_before_events():
    calls = []
    recovery_calls = []
    responses = iter([
        {"status": 200, "result": {"subscriptionId": 1}},
        {"status": 200, "result": {"subscriptionId": 2}},
    ])

    class FakeWebSocket:
        def __init__(self, events):
            self.events = iter(events)
            self.sent = []

        async def send(self, value):
            self.sent.append(json.loads(value))

        async def recv(self):
            return json.dumps(next(responses))

        def __aiter__(self):
            return self

        async def __anext__(self):
            try:
                return next(self.events)
            except StopIteration:
                raise StopAsyncIteration

    streams = [
        FakeWebSocket([json.dumps({"event": {"e": "eventStreamTerminated"}})]),
        FakeWebSocket([json.dumps({"event": {"e": "executionReport", "c": "client-1"}})]),
    ]

    class Connect:
        def __call__(self, url):
            websocket = streams.pop(0)

            class Context:
                async def __aenter__(self):
                    calls.append(url)
                    return websocket

                async def __aexit__(self, exc_type, exc, tb):
                    return False

            return Context()

    applied = []
    stream = BinanceSpotUserDataStream(
        BinanceSpotStreamConfig(
            api_key="key",
            api_secret="secret",
            reconnect_min_seconds=0,
            reconnect_max_seconds=0,
        ),
        rest_client=object(),
        connect=Connect(),
        apply_event=lambda payload: applied.append(payload) or True,
        recover=lambda client: recovery_calls.append(True) or {"checked": 0, "updated": 0, "unknown": 0},
    )

    async def stop_after_second_recovery(client):
        recovery_calls.append(True)
        if len(recovery_calls) >= 2:
            stream.stop()
        return {"checked": 0, "updated": 0, "unknown": 0}

    stream._recover = stop_after_second_recovery

    import asyncio
    asyncio.run(stream.run())

    assert len(calls) == 2
    assert len(recovery_calls) == 2
    assert len(applied) == 1
