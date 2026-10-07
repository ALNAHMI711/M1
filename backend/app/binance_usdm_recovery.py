from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_snapshot import UsdmAccountSnapshot, parse_account_snapshot


@dataclass(frozen=True)
class UsdmRecoveryResult:
    snapshot: UsdmAccountSnapshot
    events_allowed: bool
    snapshot_version: int


def recover_before_events(response: dict, *, snapshot_version: int = 1) -> UsdmRecoveryResult:
    if not isinstance(snapshot_version, int) or isinstance(snapshot_version, bool) or snapshot_version < 1:
        raise ValueError("invalid_snapshot_version")
    snapshot = parse_account_snapshot(response)
    return UsdmRecoveryResult(snapshot=snapshot, events_allowed=True, snapshot_version=snapshot_version)


def event_is_fresh(*, event_time: int, snapshot_version: int, last_event_time: int | None) -> bool:
    if not isinstance(event_time, int) or isinstance(event_time, bool) or event_time < 0:
        raise ValueError("invalid_event_time")
    if not isinstance(snapshot_version, int) or isinstance(snapshot_version, bool) or snapshot_version < 1:
        raise ValueError("invalid_snapshot_version")
    if last_event_time is not None and (
        not isinstance(last_event_time, int) or isinstance(last_event_time, bool) or last_event_time < 0
    ):
        raise ValueError("invalid_last_event_time")
    return last_event_time is None or event_time >= last_event_time


def next_snapshot_version(previous_version: int) -> int:
    if not isinstance(previous_version, int) or isinstance(previous_version, bool) or previous_version < 1:
        raise ValueError("invalid_snapshot_version")
    return previous_version + 1
