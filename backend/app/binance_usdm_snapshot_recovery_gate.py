from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_recovery import next_snapshot_version
from .binance_usdm_snapshot import UsdmAccountSnapshot
from .binance_usdm_state import UsdmState, apply_recovery, mark_recovery_required


@dataclass(frozen=True)
class UsdmSnapshotRecoveryGate:
    state: UsdmState

    @property
    def events_allowed(self) -> bool:
        return self.state.events_allowed

    @property
    def recovery_required(self) -> bool:
        return not self.state.events_allowed

    def require_recovery(self) -> "UsdmSnapshotRecoveryGate":
        return UsdmSnapshotRecoveryGate(state=mark_recovery_required(self.state))

    def restore(self, snapshot: UsdmAccountSnapshot) -> "UsdmSnapshotRecoveryGate":
        if not self.recovery_required:
            raise ValueError("recovery_not_required")
        return UsdmSnapshotRecoveryGate(state=apply_recovery(self.state, snapshot))

    @property
    def next_snapshot_version(self) -> int:
        return next_snapshot_version(self.state.snapshot_version)
