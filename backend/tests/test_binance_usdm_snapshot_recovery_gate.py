import pytest

from app.binance_usdm_snapshot import UsdmAccountSnapshot
from app.binance_usdm_snapshot_recovery_gate import UsdmSnapshotRecoveryGate
from app.binance_usdm_state import from_snapshot


def test_recovery_gate_blocks_events_until_snapshot_restore():
    state = from_snapshot(
        UsdmAccountSnapshot(assets=(), positions=()),
        snapshot_version=2,
    )
    gate = UsdmSnapshotRecoveryGate(state=state).require_recovery()

    assert gate.recovery_required is True
    assert gate.events_allowed is False
    assert gate.next_snapshot_version == 4

    restored = gate.restore(UsdmAccountSnapshot(assets=(), positions=()))
    assert restored.events_allowed is True
    assert restored.recovery_required is False
    assert restored.state.snapshot_version == 3


def test_restore_requires_recovery_state():
    gate = UsdmSnapshotRecoveryGate(
        state=from_snapshot(
            UsdmAccountSnapshot(assets=(), positions=()),
            snapshot_version=1,
        )
    )
    with pytest.raises(ValueError, match="recovery_not_required"):
        gate.restore(UsdmAccountSnapshot(assets=(), positions=()))
