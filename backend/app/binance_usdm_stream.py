from __future__ import annotations

from dataclasses import dataclass


USDM_WS_API_URL = "wss://ws-fapi.binance.com/ws-fapi/v1"
USDM_WS_API_TESTNET_URL = "wss://testnet.binancefuture.com/ws-fapi/v1"


@dataclass(frozen=True)
class UsdmUserDataStreamLifecycle:
    """State for the USD-M Futures WebSocket API user-data stream."""

    api_key: str
    keepalive_interval_seconds: int = 50 * 60
    listen_key: str | None = None

    def __post_init__(self) -> None:
        if not self.api_key:
            raise ValueError("missing_api_key")
        if self.keepalive_interval_seconds <= 0:
            raise ValueError("invalid_keepalive_interval")

    @property
    def started(self) -> bool:
        return bool(self.listen_key)

    def start_request(self, request_id: int) -> dict:
        if not isinstance(request_id, int):
            raise ValueError("invalid_request_id")
        return {"id": request_id, "method": "userDataStream.start"}

    def started_with(self, listen_key: str) -> "UsdmUserDataStreamLifecycle":
        if not listen_key:
            raise ValueError("missing_listen_key")
        return UsdmUserDataStreamLifecycle(
            api_key=self.api_key,
            keepalive_interval_seconds=self.keepalive_interval_seconds,
            listen_key=listen_key,
        )

    def keepalive_request(self, request_id: int) -> dict:
        if not self.started:
            raise ValueError("stream_not_started")
        if not isinstance(request_id, int):
            raise ValueError("invalid_request_id")
        return {
            "id": request_id,
            "method": "userDataStream.ping",
            "params": {"listenKey": self.listen_key},
        }

    def keepalive_due(self, elapsed_seconds: int) -> bool:
        if elapsed_seconds < 0:
            raise ValueError("invalid_elapsed_seconds")
        return elapsed_seconds >= self.keepalive_interval_seconds

    def stop_request(self, request_id: int) -> dict:
        if not self.started:
            raise ValueError("stream_not_started")
        if not isinstance(request_id, int):
            raise ValueError("invalid_request_id")
        return {
            "id": request_id,
            "method": "userDataStream.stop",
            "params": {"listenKey": self.listen_key},
        }

    def stopped(self) -> "UsdmUserDataStreamLifecycle":
        return UsdmUserDataStreamLifecycle(
            api_key=self.api_key,
            keepalive_interval_seconds=self.keepalive_interval_seconds,
            listen_key=None,
        )
