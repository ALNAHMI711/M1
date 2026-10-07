from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_private_runtime import UsdmPrivateRuntime
from .binance_usdm_snapshot import UsdmAccountSnapshot
from .binance_usdm_snapshot_recovery_gate import UsdmSnapshotRecoveryGate


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
                state=__import__(
                    "app.binance_usdm_state",
                    fromlist=["recovery_failed"],
                ).recovery_failed(self.gate.state)
            ),
        )

    def restore_snapshot(self, snapshot: UsdmAccountSnapshot) -> "UsdmRecoveryCoordinator":
        restored_gate = self.gate.restore(snapshot)
        return UsdmRecoveryCoordinator(runtime=self.runtime, gate=restored_gate)

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
