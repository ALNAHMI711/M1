from __future__ import annotations

from dataclasses import dataclass
from typing import Any, AsyncIterator

import websockets

from .binance_usdm_events import UserEvent, parse_user_event
from .binance_usdm_stream import UsdmUserDataStreamLifecycle


@dataclass
class UsdmPrivateStreamTransport:
    """Thin network transport for the USD-M private user-data stream.

    Reconnection and snapshot recovery stay outside this class so the
    recovery gate remains the only authority that can re-enable events.
    """

    lifecycle: UsdmUserDataStreamLifecycle
    ping_interval_seconds: float | None = 20.0
    ping_timeout_seconds: float | None = 20.0
    close_timeout_seconds: float = 10.0
    max_message_size: int = 1_048_576
    _socket: Any = None

    def __post_init__(self) -> None:
        if not isinstance(self.max_message_size, int) or isinstance(self.max_message_size, bool):
            raise ValueError("invalid_max_message_size")
        if self.max_message_size <= 0:
            raise ValueError("invalid_max_message_size")
        if self.close_timeout_seconds <= 0:
            raise ValueError("invalid_close_timeout")
        if self.ping_interval_seconds is not None and self.ping_interval_seconds <= 0:
            raise ValueError("invalid_ping_interval")
        if self.ping_timeout_seconds is not None and self.ping_timeout_seconds <= 0:
            raise ValueError("invalid_ping_timeout")

    @property
    def connected(self) -> bool:
        return self._socket is not None

    async def connect(self) -> None:
        if not self.lifecycle.started:
            raise ValueError("stream_not_started")
        if self.connected:
            raise ValueError("stream_already_connected")
        self._socket = await websockets.connect(
            self.lifecycle.private_stream_url,
            ping_interval=self.ping_interval_seconds,
            ping_timeout=self.ping_timeout_seconds,
            close_timeout=self.close_timeout_seconds,
            max_size=self.max_message_size,
        )

    async def receive(self) -> UserEvent:
        if self._socket is None:
            raise ValueError("stream_not_connected")
        raw = await self._socket.recv()
        return parse_user_event(raw)

    async def events(self) -> AsyncIterator[UserEvent]:
        while self.connected:
            yield await self.receive()

    async def close(self) -> None:
        socket = self._socket
        self._socket = None
        if socket is not None:
            await socket.close(
                code=1000,
                reason="client_shutdown",
            )
