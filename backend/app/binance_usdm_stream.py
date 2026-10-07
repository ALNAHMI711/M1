from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode


USDM_WS_API_URL = "wss://ws-fapi.binance.com/ws-fapi/v1"
USDM_WS_API_TESTNET_URL = "wss://testnet.binancefuture.com/ws-fapi/v1"
USDM_PRIVATE_STREAM_URL = "wss://fstream.binance.com/private/ws"


def _request_id(request_id: str) -> str:
    if not isinstance(request_id, str) or not request_id:
        raise ValueError("invalid_request_id")
    return request_id


def _validate_start_response(response: object) -> str:
    if not isinstance(response, dict):
        raise ValueError("invalid_start_response")
    if response.get("status") != 200:
        raise ValueError("usdm_stream_start_failed")
    result = response.get("result")
    if not isinstance(result, dict):
        raise ValueError("invalid_start_result")
    listen_key = result.get("listenKey")
    if not isinstance(listen_key, str) or not listen_key:
        raise ValueError("missing_listen_key")
    return listen_key


def _validate_control_response(response: object, expected_status: int = 200) -> None:
    if not isinstance(response, dict) or response.get("status") != expected_status:
        raise ValueError("usdm_stream_control_failed")


@dataclass(frozen=True)
class UsdmUserDataStreamLifecycle:
    """State and request builders for USD-M Futures user-data streaming."""

    api_key: str
    keepalive_interval_seconds: int = 50 * 60
    listen_key: str | None = None

    def __post_init__(self) -> None:
        if not isinstance(self.api_key, str) or not self.api_key:
            raise ValueError("missing_api_key")
        if (
            not isinstance(self.keepalive_interval_seconds, int)
            or isinstance(self.keepalive_interval_seconds, bool)
            or self.keepalive_interval_seconds <= 0
        ):
            raise ValueError("invalid_keepalive_interval")

    @property
    def started(self) -> bool:
        return bool(self.listen_key)

    @property
    def api_key_header(self) -> dict[str, str]:
        return {"X-MBX-APIKEY": self.api_key}

    @property
    def private_stream_url(self) -> str:
        if not self.listen_key:
            raise ValueError("stream_not_started")
        query = urlencode({
            "listenKey": self.listen_key,
            "events": "ORDER_TRADE_UPDATE,ACCOUNT_UPDATE",
        })
        return f"{USDM_PRIVATE_STREAM_URL}?{query}"

    def start_request(self, request_id: str) -> dict:
        return {
            "id": _request_id(request_id),
            "method": "userDataStream.start",
            "params": {"apiKey": self.api_key},
        }

    def apply_start_response(self, response: object) -> "UsdmUserDataStreamLifecycle":
        return self.started_with(_validate_start_response(response))

    def started_with(self, listen_key: str) -> "UsdmUserDataStreamLifecycle":
        if not isinstance(listen_key, str) or not listen_key:
            raise ValueError("missing_listen_key")
        return UsdmUserDataStreamLifecycle(
            api_key=self.api_key,
            keepalive_interval_seconds=self.keepalive_interval_seconds,
            listen_key=listen_key,
        )

    def keepalive_request(self, request_id: str) -> dict:
        if not self.started:
            raise ValueError("stream_not_started")
        return {
            "id": _request_id(request_id),
            "method": "userDataStream.ping",
            "params": {"apiKey": self.api_key},
        }

    def apply_keepalive_response(
        self, response: object
    ) -> "UsdmUserDataStreamLifecycle":
        _validate_control_response(response)
        return self.started_with(_validate_start_response(response))

    def keepalive_due(self, elapsed_seconds: int) -> bool:
        if (
            not isinstance(elapsed_seconds, int)
            or isinstance(elapsed_seconds, bool)
            or elapsed_seconds < 0
        ):
            raise ValueError("invalid_elapsed_seconds")
        return elapsed_seconds >= self.keepalive_interval_seconds

    def stop_request(self, request_id: str) -> dict:
        if not self.started:
            raise ValueError("stream_not_started")
        return {
            "id": _request_id(request_id),
            "method": "userDataStream.stop",
            "params": {"apiKey": self.api_key},
        }

    def apply_stop_response(self, response: object) -> "UsdmUserDataStreamLifecycle":
        _validate_control_response(response)
        return self.stopped()

    def stopped(self) -> "UsdmUserDataStreamLifecycle":
        return UsdmUserDataStreamLifecycle(
            api_key=self.api_key,
            keepalive_interval_seconds=self.keepalive_interval_seconds,
            listen_key=None,
        )
