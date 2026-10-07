from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_account import UsdmAccountUpdate
from .binance_usdm_events import UserEvent
from .binance_usdm_recovery import event_is_fresh
from .binance_usdm_snapshot import UsdmAccountSnapshot, UsdmSnapshotAsset, UsdmSnapshotPosition


@dataclass(frozen=True)
class UsdmState:
    snapshot: UsdmAccountSnapshot
    snapshot_version: int
    last_event_time: int | None = None


def from_snapshot(snapshot: UsdmAccountSnapshot, *, snapshot_version: int) -> UsdmState:
    if not isinstance(snapshot_version, int) or isinstance(snapshot_version, bool) or snapshot_version < 1:
        raise ValueError("invalid_snapshot_version")
    return UsdmState(snapshot=snapshot, snapshot_version=snapshot_version)


def _apply_account_update(snapshot: UsdmAccountSnapshot, update: UsdmAccountUpdate) -> UsdmAccountSnapshot:
    assets = {item.asset: item for item in snapshot.assets}
    for item in update.assets:
        assets[item.asset] = UsdmSnapshotAsset(
            asset=item.asset,
            wallet_balance=item.wallet_balance,
            available_balance=item.cross_wallet_balance,
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
    return UsdmAccountSnapshot(
        assets=tuple(assets.values()),
        positions=tuple(positions.values()),
    )


def accept_account_update(state: UsdmState, update: UsdmAccountUpdate) -> UsdmState:
    if update.event_time is None:
        raise ValueError("account_update_missing_event_time")
    if not event_is_fresh(
        event_time=update.event_time,
        snapshot_version=state.snapshot_version,
        last_event_time=state.last_event_time,
    ):
        return state
    return UsdmState(
        snapshot=_apply_account_update(state.snapshot, update),
        snapshot_version=state.snapshot_version,
        last_event_time=update.event_time,
    )


def accept_event(state: UsdmState, event: UserEvent, *, event_time: int) -> UsdmState:
    if not event_is_fresh(
        event_time=event_time,
        snapshot_version=state.snapshot_version,
        last_event_time=state.last_event_time,
    ):
        return state
    return UsdmState(snapshot=state.snapshot, snapshot_version=state.snapshot_version, last_event_time=event_time)
