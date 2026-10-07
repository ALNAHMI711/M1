import pytest

from app.binance_usdm_recovery import event_is_fresh, next_snapshot_version, recover_before_events


def test_recovery_opens_event_gate_after_valid_snapshot():
    result = recover_before_events(
        {"status": 200, "result": {"assets": [{"asset": "USDT", "walletBalance": "10", "availableBalance": "9"}], "positions": []}}
    )
    assert result.events_allowed is True
    assert result.snapshot.assets[0].asset == "USDT"
    assert result.snapshot_version == 1


def test_recovery_does_not_open_event_gate_on_invalid_snapshot():
    with pytest.raises(ValueError, match="account_snapshot_failed"):
        recover_before_events({"status": 500})


@pytest.mark.parametrize(
    "event_time,last_event_time,expected",
    [(100, None, True), (100, 99, True), (100, 100, True), (100, 101, False)],
)
def test_event_freshness(event_time, last_event_time, expected):
    assert event_is_fresh(event_time=event_time, snapshot_version=1, last_event_time=last_event_time) is expected


def test_invalid_recovery_and_event_times_are_rejected():
    with pytest.raises(ValueError, match="invalid_snapshot_version"):
        recover_before_events({"status": 200, "result": {"assets": [], "positions": []}}, snapshot_version=0)
    with pytest.raises(ValueError, match="invalid_event_time"):
        event_is_fresh(event_time=-1, snapshot_version=1, last_event_time=None)


def test_snapshot_version_increments_after_reconnect():
    assert next_snapshot_version(1) == 2
    assert next_snapshot_version(2) == 3
    with pytest.raises(ValueError, match="invalid_snapshot_version"):
        next_snapshot_version(0)
