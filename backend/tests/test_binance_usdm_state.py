import pytest

from app.binance_usdm_events import UserEvent
from app.binance_usdm_recovery import recovery_event_cutoff
from app.binance_usdm_snapshot import UsdmAccountSnapshot, UsdmSnapshotAsset
from app.binance_usdm_state import accept_event, apply_recovery, from_snapshot, mark_recovery_required


def test_accept_event_tracks_latest_event_time():
    state = from_snapshot(UsdmAccountSnapshot(assets=(), positions=()), snapshot_version=2)
    event = UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE", "a": {}})
    state = accept_event(state, event, event_time=100)
    assert state.last_event_time == 100
    state = accept_event(state, event, event_time=101)
    assert state.last_event_time == 101


def test_stale_event_does_not_replace_latest_time():
    state = from_snapshot(UsdmAccountSnapshot(assets=(), positions=()), snapshot_version=2)
    event = UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE", "a": {}})
    state = accept_event(state, event, event_time=100)
    assert accept_event(state, event, event_time=99) == state


def test_recovery_cutoff_is_explicit_and_stable():
    assert recovery_event_cutoff(snapshot_version=3, last_event_time=123) == (3, 123)
    assert recovery_event_cutoff(snapshot_version=4, last_event_time=None) == (4, None)


def test_recovery_gate_blocks_events_until_a_new_snapshot():
    state = from_snapshot(UsdmAccountSnapshot(assets=(), positions=()), snapshot_version=2)
    blocked = mark_recovery_required(state)
    assert blocked.snapshot_version == 3
    assert blocked.last_event_time is None
    assert blocked.events_allowed is False
    event = UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE", "a": {}})
    with pytest.raises(ValueError, match="recovery_required"):
        accept_event(blocked, event, event_time=200)


def test_successful_recovery_reopens_gate_and_resets_event_cutoff():
    state = from_snapshot(
        UsdmAccountSnapshot(assets=(UsdmSnapshotAsset("USDT", "10", "9"),), positions=()),
        snapshot_version=2,
    )
    state = accept_event(
        state,
        UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE", "a": {}}),
        event_time=500,
    )
    blocked = mark_recovery_required(state)
    recovered = apply_recovery(
        blocked,
        UsdmAccountSnapshot(assets=(UsdmSnapshotAsset("USDT", "12", "11"),), positions=()),
    )
    assert recovered.snapshot.assets[0].wallet_balance == "12"
    assert recovered.snapshot_version == 3
    assert recovered.last_event_time is None
    assert recovered.events_allowed is True
