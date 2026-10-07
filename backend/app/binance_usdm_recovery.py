from __future__ import annotations

from dataclasses import dataclass

from .binance_usdm_snapshot import UsdmAccountSnapshot, parse_account_snapshot


@dataclass(frozen=True)
class UsdmRecoveryResult:
    snapshot: UsdmAccountSnapshot
    events_allowed: bool


def recover_before_events(response: dict) -> UsdmRecoveryResult:
    snapshot = parse_account_snapshot(response)
    return UsdmRecoveryResult(snapshot=snapshot, events_allowed=True)
