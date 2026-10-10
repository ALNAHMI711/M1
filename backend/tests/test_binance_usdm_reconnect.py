import pytest

from app.binance_usdm_reconnect import UsdmReconnectPolicy, UsdmReconnectState


def test_reconnect_policy_uses_bounded_exponential_backoff():
    policy = UsdmReconnectPolicy()
    assert policy.delay_seconds(0) == 1.0
    assert policy.delay_seconds(1) == 2.0
    assert policy.delay_seconds(2) == 4.0
    assert policy.delay_seconds(10) == 30.0


@pytest.mark.parametrize(
    "kwargs,error",
    [
        ({"initial_delay_seconds": 0}, "invalid_initial_delay"),
        ({"initial_delay_seconds": 5, "max_delay_seconds": 4}, "invalid_max_delay"),
        ({"multiplier": 0.5}, "invalid_multiplier"),
    ],
)
def test_invalid_reconnect_policy(kwargs, error):
    with pytest.raises(ValueError, match=error):
        UsdmReconnectPolicy(**kwargs)


def test_invalid_reconnect_attempt_is_rejected():
    with pytest.raises(ValueError, match="invalid_reconnect_attempt"):
        UsdmReconnectPolicy().delay_seconds(-1)
    with pytest.raises(ValueError, match="invalid_reconnect_attempt"):
        UsdmReconnectPolicy().delay_seconds(True)


def test_disconnect_blocks_events_until_recovery():
    state = UsdmReconnectState(attempt=2, events_allowed=True)
    disconnected = state.disconnected()
    assert disconnected.attempt == 2
    assert disconnected.events_allowed is False

    failed = disconnected.recovery_failed()
    assert failed.attempt == 3
    assert failed.events_allowed is False

    recovered = failed.recovery_succeeded()
    assert recovered.attempt == 0
    assert recovered.events_allowed is True
