from app.binance_usdm_events import UserEvent
from app.binance_usdm_recovery import recovery_event_cutoff
from app.binance_usdm_snapshot import UsdmAccountSnapshot
from app.binance_usdm_state import accept_event, from_snapshot


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
