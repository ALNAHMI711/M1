from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class UsdmUserDataStreamLifecycle:
    """State for the current USD-M Futures user-data stream."""

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

    def started_with(self, listen_key: str) -> "UsdmUserDataStreamLifecycle":
        if not listen_key:
            raise ValueError("missing_listen_key")
        return UsdmUserDataStreamLifecycle(
            api_key=self.api_key,
            keepalive_interval_seconds=self.keepalive_interval_seconds,
            listen_key=listen_key,
        )

    def keepalive_due(self, elapsed_seconds: int) -> bool:
        if elapsed_seconds < 0:
            raise ValueError("invalid_elapsed_seconds")
        return elapsed_seconds >= self.keepalive_interval_seconds

    def stopped(self) -> "UsdmUserDataStreamLifecycle":
        return UsdmUserDataStreamLifecycle(
            api_key=self.api_key,
            keepalive_interval_seconds=self.keepalive_interval_seconds,
            listen_key=None,
        )
