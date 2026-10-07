from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_account import UsdmAccountUpdate
from .binance_usdm_events import UserEvent
from .binance_usdm_recovery import event_is_fresh, next_snapshot_version
from .binance_usdm_snapshot import UsdmAccountSnapshot, UsdmSnapshotAsset, UsdmSnapshotPosition


@dataclass(frozen=True)
class UsdmState:
    snapshot: UsdmAccountSnapshot
    snapshot_version: int
    last_event_time: int | None = None
    events_allowed: bool = False


def from_snapshot(snapshot: UsdmAccountSnapshot, *, snapshot_version: int) -> UsdmState:
    if not isinstance(snapshot_version, int) or isinstance(snapshot_version, bool) or snapshot_version < 1:
        raise ValueError("invalid_snapshot_version")
    return UsdmState(snapshot=snapshot, snapshot_version=snapshot_version, events_allowed=True)


def apply_recovery(state: UsdmState, snapshot: UsdmAccountSnapshot) -> UsdmState:
    return UsdmState(
        snapshot=snapshot,
        snapshot_version=state.snapshot_version,
        last_event_time=None,
        events_allowed=True,
    )


def mark_recovery_required(state: UsdmState) -> UsdmState:
    return UsdmState(
        snapshot=state.snapshot,
        snapshot_version=next_snapshot_version(state.snapshot_version),
        last_event_time=None,
        events_allowed=False,
    )


def _apply_account_update(snapshot: UsdmAccountSnapshot, update: UsdmAccountUpdate) -> UsdmAccountSnapshot:
    assets = {item.asset: item for item in snapshot.assets}
    for item in update.assets:
        current = assets.get(item.asset)
        if current is None:
            raise ValueError("account_update_missing_snapshot_asset")
        assets[item.asset] = UsdmSnapshotAsset(
            asset=item.asset,
            wallet_balance=item.wallet_balance,
            available_balance=current.available_balance,
        )

    positions = {(item.symbol, item.position_side): item for item in snapshot.positions}
    for item in update.positions:
        positions[(item.symbol, item.position_side)] = UsdmSnapshotPosition(
            symbol=item.symbol,
            position_side=item.position_side,
            quantity=item.quantity,
            entry_price=item.entry_price,
            unrealized_pnl=item.unrealized_pnl,
        )
    return UsdmAccountSnapshot(assets=tuple(assets.values()), positions=tuple(positions.values()))


def accept_account_update(state: UsdmState, update: UsdmAccountUpdate) -> UsdmState:
    if not state.events_allowed:
        raise ValueError("recovery_required")
    if update.event_time is None:
        raise ValueError("account_update_missing_event_time")
    if not event_is_fresh(event_time=update.event_time, snapshot_version=state.snapshot_version, last_event_time=state.last_event_time):
        return state
    return UsdmState(
        snapshot=_apply_account_update(state.snapshot, update),
        snapshot_version=state.snapshot_version,
        last_event_time=update.event_time,
        events_allowed=True,
    )


def accept_event(state: UsdmState, event: UserEvent, *, event_time: int) -> UsdmState:
    if not state.events_allowed:
        raise ValueError("recovery_required")
    if not event_is_fresh(event_time=event_time, snapshot_version=state.snapshot_version, last_event_time=state.last_event_time):
        return state
    return UsdmState(snapshot=state.snapshot, snapshot_version=state.snapshot_version, last_event_time=event_time, events_allowed=True)
