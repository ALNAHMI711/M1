import pytest

from app.binance_usdm_private_transport import UsdmPrivateStreamTransport
from app.binance_usdm_stream import UsdmUserDataStreamLifecycle


class FakeSocket:
    def __init__(self, messages):
        self.messages = list(messages)
        self.closed = False
        self.close_args = None

    async def recv(self):
        return self.messages.pop(0)

    async def close(self, **kwargs):
        self.closed = True
        self.close_args = kwargs


@pytest.mark.asyncio
async def test_connect_receive_and_close(monkeypatch):
    socket = FakeSocket(
        [
            {
                "e": "ORDER_TRADE_UPDATE",
                "E": 100,
                "o": {"c": "client-1", "i": 7, "X": "FILLED"},
            }
        ]
    )

    async def fake_connect(url, **kwargs):
        assert url == (
            "wss://fstream.binance.com/private/ws"
            "?listenKey=listen-key&events=ORDER_TRADE_UPDATE%2CACCOUNT_UPDATE"
        )
        assert kwargs["max_size"] == 1_048_576
        return socket

    monkeypatch.setattr(
        "app.binance_usdm_private_transport.websockets.connect",
        fake_connect,
    )

    transport = UsdmPrivateStreamTransport(
        UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    )
    await transport.connect()
    assert transport.connected is True

    event = await transport.receive()
    assert event.event_type == "ORDER_TRADE_UPDATE"
    assert event.payload["E"] == 100

    await transport.close()
    assert transport.connected is False
    assert socket.closed is True
    assert socket.close_args == {"code": 1000, "reason": "client_shutdown"}


@pytest.mark.asyncio
async def test_wrapped_event_is_parsed(monkeypatch):
    socket = FakeSocket(
        [
            '{"stream":"listen-key","data":{"e":"ACCOUNT_UPDATE","E":101,"a":{"B":[],"P":[]}}}'
        ]
    )

    async def fake_connect(url, **kwargs):
        return socket

    monkeypatch.setattr(
        "app.binance_usdm_private_transport.websockets.connect",
        fake_connect,
    )

    transport = UsdmPrivateStreamTransport(
        UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    )
    await transport.connect()
    event = await transport.receive()
    assert event.event_type == "ACCOUNT_UPDATE"
    assert event.payload["E"] == 101


@pytest.mark.asyncio
async def test_connect_requires_started_stream():
    transport = UsdmPrivateStreamTransport(
        UsdmUserDataStreamLifecycle(api_key="key")
    )
    with pytest.raises(ValueError, match="stream_not_started"):
        await transport.connect()


@pytest.mark.asyncio
async def test_receive_requires_connection():
    transport = UsdmPrivateStreamTransport(
        UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    )
    with pytest.raises(ValueError, match="stream_not_connected"):
        await transport.receive()


@pytest.mark.asyncio
async def test_close_is_idempotent():
    transport = UsdmPrivateStreamTransport(
        UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    )
    await transport.close()
    assert transport.connected is False
