from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_reconnect import UsdmReconnectPolicy, UsdmReconnectState


@dataclass(frozen=True)
class UsdmReconnectFlow:
    state: UsdmReconnectState = UsdmReconnectState()

    def on_disconnect(self) -> "UsdmReconnectFlow":
        return UsdmReconnectFlow(state=self.state.disconnected())

    def on_recovery_failure(self) -> "UsdmReconnectFlow":
        return UsdmReconnectFlow(state=self.state.recovery_failed())

    def on_recovery_success(self) -> "UsdmReconnectFlow":
        return UsdmReconnectFlow(state=self.state.recovery_succeeded())

    def retry_delay(self, policy: UsdmReconnectPolicy) -> float:
        return policy.delay_seconds(self.state.attempt)

    @property
    def events_allowed(self) -> bool:
        return self.state.events_allowed
