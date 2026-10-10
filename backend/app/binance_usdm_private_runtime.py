from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_reconnect import UsdmReconnectPolicy
from .binance_usdm_reconnect_flow import UsdmReconnectFlow
from .binance_usdm_stream import UsdmUserDataStreamLifecycle


@dataclass(frozen=True)
class UsdmPrivateRuntime:
    lifecycle: UsdmUserDataStreamLifecycle
    reconnect: UsdmReconnectFlow = UsdmReconnectFlow()
    policy: UsdmReconnectPolicy = UsdmReconnectPolicy()

    def on_disconnect(self) -> "UsdmPrivateRuntime":
        return UsdmPrivateRuntime(
            lifecycle=self.lifecycle,
            reconnect=self.reconnect.on_disconnect(),
            policy=self.policy,
        )

    def on_recovery_failure(self) -> "UsdmPrivateRuntime":
        return UsdmPrivateRuntime(
            lifecycle=self.lifecycle,
            reconnect=self.reconnect.on_recovery_failure(),
            policy=self.policy,
        )

    def on_recovery_success(self, listen_key: str) -> "UsdmPrivateRuntime":
        lifecycle = self.lifecycle.started_with(listen_key)
        return UsdmPrivateRuntime(
            lifecycle=lifecycle,
            reconnect=self.reconnect.on_recovery_success(),
            policy=self.policy,
        )

    @property
    def events_allowed(self) -> bool:
        return self.reconnect.events_allowed

    @property
    def retry_delay_seconds(self) -> float:
        return self.reconnect.retry_delay(self.policy)

    def keepalive_due(self, elapsed_seconds: int) -> bool:
        return self.lifecycle.keepalive_due(elapsed_seconds)
