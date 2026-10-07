from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_events import UserEvent
from .binance_usdm_recovery import event_is_fresh
from .binance_usdm_snapshot import UsdmAccountSnapshot


@dataclass(frozen=True)
class UsdmState:
    snapshot: UsdmAccountSnapshot
    snapshot_version: int
    last_event_time: int | None = None


def from_snapshot(snapshot: UsdmAccountSnapshot, *, snapshot_version: int) -> UsdmState:
    if snapshot_version < 1:
        raise ValueError("invalid_snapshot_version")
    return UsdmState(snapshot=snapshot, snapshot_version=snapshot_version)


def accept_event(state: UsdmState, event: UserEvent, *, event_time: int) -> UsdmState:
    if not event_is_fresh(
        event_time=event_time,
        snapshot_version=state.snapshot_version,
        last_event_time=state.last_event_time,
    ):
        return state
    return UsdmState(
        snapshot=state.snapshot,
        snapshot_version=state.snapshot_version,
        last_event_time=event_time,
    )
