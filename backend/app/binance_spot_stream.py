from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

from .binance_spot import BinanceAPIError, BinanceSpotClient
from .order_events import apply_spot_order_update
from .recovery import recover_spot_orders

TESTNET_WS_URL = "wss://ws-api.testnet.binance.vision/ws-api/v3"
LIVE_WS_URL = "wss://ws-api.binance.com:443/ws-api/v3"


@dataclass(frozen=True)
class BinanceSpotStreamConfig:
    api_key: str
    api_secret: str
    testnet: bool = True
    recv_window: int = 5000
    reconnect_min_seconds: float = 1.0
    reconnect_max_seconds: float = 30.0

    @property
    def url(self) -> str:
        return TESTNET_WS_URL if self.testnet else LIVE_WS_URL


def signature_payload(params: dict[str, Any]) -> str:
    """Return Binance's sorted, percent-encoded HMAC payload."""
    pairs = []
    for key in sorted(params):
        value = params[key]
        pairs.append(f"{quote(str(key), safe='')}={quote(str(value), safe='')}")
    return "&".join(pairs)


def sign_subscription(
    *,
    api_key: str,
    api_secret: str,
    timestamp: int,
    recv_window: int | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"apiKey": api_key, "timestamp": timestamp}
    if recv_window is not None:
        if recv_window > 60000:
            raise ValueError("recv_window_too_large")
        params["recvWindow"] = recv_window
    payload = signature_payload(params)
    signature = hmac.new(
        api_secret.encode("utf-8"),
        payload.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {**params, "signature": signature}


def subscription_request(
    *,
    api_key: str,
    api_secret: str,
    recv_window: int = 5000,
    request_id: str | None = None,
    timestamp: int | None = None,
) -> dict[str, Any]:
    if not api_key or not api_secret:
        raise ValueError("missing_binance_credentials")
    return {
        "id": request_id or str(uuid.uuid4()),
        "method": "userDataStream.subscribe.signature",
        "params": sign_subscription(
            api_key=api_key,
            api_secret=api_secret,
            timestamp=timestamp or int(time.time() * 1000),
            recv_window=recv_window,
        ),
    }


def unwrap_event(payload: dict[str, Any]) -> dict[str, Any] | None:
    event = payload.get("event")
    return event if isinstance(event, dict) else None


class BinanceSpotUserDataStream:
    """Reconnectable Spot User Data Stream boundary.

    This class only consumes account events. It never submits, amends, or
    cancels orders. After reconnect it reconciles local execution state via
    REST before accepting the stream as synchronized.
    """

    def __init__(
        self,
        config: BinanceSpotStreamConfig,
        *,
        rest_client: BinanceSpotClient,
        connect: Callable[..., Awaitable[Any]] | None = None,
        apply_event: Callable[[dict[str, Any]], bool] = apply_spot_order_update,
        recover: Callable[[BinanceSpotClient], dict[str, int]] = recover_spot_orders,
    ):
        self.config = config
        self.rest_client = rest_client
        self._connect = connect
        self._apply_event = apply_event
        self._recover = recover
        self._stopped = False

    async def run(self) -> None:
        if self._connect is None:
            try:
                import websockets
            except ImportError as exc:
                raise BinanceAPIError("websockets_dependency_missing") from exc
            connect = websockets.connect
        else:
            connect = self._connect

        delay = self.config.reconnect_min_seconds

        while not self._stopped:
            try:
                async with connect(self.config.url) as websocket:
                    request = subscription_request(
                        api_key=self.config.api_key,
                        api_secret=self.config.api_secret,
                        recv_window=self.config.recv_window,
                    )
                    await websocket.send(json.dumps(request))
                    response = json.loads(await websocket.recv())
                    self._ensure_subscription_confirmed(response)

                    self._recover(self.rest_client)
                    delay = self.config.reconnect_min_seconds

                    async for raw in websocket:
                        payload = json.loads(raw)
                        self._consume(payload)
            except asyncio.CancelledError:
                raise
            except (OSError, TimeoutError, ValueError, BinanceAPIError, json.JSONDecodeError):
                if self._stopped:
                    return
                await asyncio.sleep(delay)
                delay = min(delay * 2, self.config.reconnect_max_seconds)

    def stop(self) -> None:
        self._stopped = True

    @staticmethod
    def _ensure_subscription_confirmed(payload: dict[str, Any]) -> None:
        if payload.get("status") != 200:
            raise BinanceAPIError("user_data_stream_subscription_failed")
        result = payload.get("result")
        if not isinstance(result, dict) or result.get("subscriptionId") is None:
            raise BinanceAPIError("user_data_stream_subscription_missing_id")

    def _consume(self, payload: dict[str, Any]) -> None:
        event = unwrap_event(payload)
        if event is None:
            return
        event_type = event.get("e")
        if event_type in {"serverShutdown", "eventStreamTerminated"}:
            raise BinanceAPIError(f"user_data_stream_{event_type}")
        if event_type == "executionReport":
            self._apply_event(payload)
