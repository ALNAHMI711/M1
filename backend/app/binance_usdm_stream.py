from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class UserStreamLifecycle:
    listen_key: str
    keepalive_interval_seconds: int = 30 * 60

    def __post_init__(self) -> None:
        if not self.listen_key:
            raise ValueError("missing_listen_key")
        if self.keepalive_interval_seconds <= 0:
            raise ValueError("invalid_keepalive_interval")

    def keepalive_due(self, elapsed_seconds: int) -> bool:
        return elapsed_seconds >= self.keepalive_interval_seconds
