from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_account import UsdmAccountUpdate
from .binance_usdm_events import UserEvent
from .binance_usdm_private_runtime import UsdmPrivateRuntime
from .binance_usdm_snapshot import UsdmAccountSnapshot
from .binance_usdm_snapshot_recovery_gate import UsdmSnapshotRecoveryGate
from .binance_usdm_reconciliation import apply_usdm_order_update
from .binance_usdm_state import accept_account_update, accept_event, recovery_failed


@dataclass(frozen=True)
class UsdmRecoveryCoordinator:
    """Keep the private stream gate and account snapshot gate in lockstep."""

    runtime: UsdmPrivateRuntime
    gate: UsdmSnapshotRecoveryGate

    @property
    def events_allowed(self) -> bool:
        return self.runtime.events_allowed and self.gate.events_allowed

    @property
    def recovery_required(self) -> bool:
        return self.gate.recovery_required or not self.runtime.events_allowed

    def on_disconnect(self) -> "UsdmRecoveryCoordinator":
        return UsdmRecoveryCoordinator(
            runtime=self.runtime.on_disconnect(),
            gate=self.gate.require_recovery(),
        )

    def on_recovery_failure(self) -> "UsdmRecoveryCoordinator":
        return UsdmRecoveryCoordinator(
            runtime=self.runtime.on_recovery_failure(),
            gate=UsdmSnapshotRecoveryGate(
                state=recovery_failed(self.gate.state)
            ),
        )

    def restore_snapshot(self, snapshot: UsdmAccountSnapshot) -> "UsdmRecoveryCoordinator":
        restored_gate = self.gate.restore(snapshot)
        return UsdmRecoveryCoordinator(runtime=self.runtime, gate=restored_gate)

    def accept_account_update(self, update: UsdmAccountUpdate) -> "UsdmRecoveryCoordinator":
        if not self.events_allowed:
            raise ValueError("recovery_required")
        return UsdmRecoveryCoordinator(
            runtime=self.runtime,
            gate=UsdmSnapshotRecoveryGate(state=accept_account_update(self.gate.state, update)),
        )

    def accept_user_event(self, event: UserEvent, *, event_time: int) -> "UsdmRecoveryCoordinator":
        if not self.events_allowed:
            raise ValueError("recovery_required")
        if event.event_type == "ORDER_TRADE_UPDATE":
            apply_usdm_order_update(event)
        return UsdmRecoveryCoordinator(
            runtime=self.runtime,
            gate=UsdmSnapshotRecoveryGate(state=accept_event(self.gate.state, event, event_time=event_time)),
        )

    def on_recovery_success(self, listen_key: str) -> "UsdmRecoveryCoordinator":
        if self.gate.recovery_required:
            raise ValueError("snapshot_recovery_required")
        return UsdmRecoveryCoordinator(
            runtime=self.runtime.on_recovery_success(listen_key),
            gate=self.gate,
        )

    @property
    def retry_delay_seconds(self) -> float:
        return self.runtime.retry_delay_seconds

    def keepalive_due(self, elapsed_seconds: int) -> bool:
        return self.runtime.keepalive_due(elapsed_seconds)
