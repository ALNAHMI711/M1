from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class UsdmReconnectPolicy:
    """Bounded exponential backoff for a private USD-M stream reconnect loop."""

    initial_delay_seconds: float = 1.0
    max_delay_seconds: float = 30.0
    multiplier: float = 2.0

    def __post_init__(self) -> None:
        if self.initial_delay_seconds <= 0:
            raise ValueError("invalid_initial_delay")
        if self.max_delay_seconds < self.initial_delay_seconds:
            raise ValueError("invalid_max_delay")
        if self.multiplier < 1:
            raise ValueError("invalid_multiplier")

    def delay_seconds(self, attempt: int) -> float:
        if not isinstance(attempt, int) or isinstance(attempt, bool) or attempt < 0:
            raise ValueError("invalid_reconnect_attempt")
        return min(
            self.max_delay_seconds,
            self.initial_delay_seconds * (self.multiplier ** attempt),
        )


@dataclass(frozen=True)
class UsdmReconnectState:
    """Reconnect state; a disconnect always blocks event processing until recovery."""

    attempt: int = 0
    events_allowed: bool = False

    def disconnected(self) -> "UsdmReconnectState":
        return UsdmReconnectState(
            attempt=self.attempt,
            events_allowed=False,
        )

    def recovery_succeeded(self) -> "UsdmReconnectState":
        return UsdmReconnectState(
            attempt=0,
            events_allowed=True,
        )

    def recovery_failed(self) -> "UsdmReconnectState":
        return UsdmReconnectState(
            attempt=self.attempt + 1,
            events_allowed=False,
        )
