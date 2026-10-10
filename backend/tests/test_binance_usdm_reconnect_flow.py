from app.binance_usdm_reconnect import UsdmReconnectPolicy
from app.binance_usdm_reconnect_flow import UsdmReconnectFlow


def test_disconnect_closes_event_gate_and_backoff_advances():
    policy = UsdmReconnectPolicy()
    flow = UsdmReconnectFlow().on_disconnect()
    assert flow.events_allowed is False
    assert flow.retry_delay(policy) == 1.0

    flow = flow.on_recovery_failure()
    assert flow.events_allowed is False
    assert flow.retry_delay(policy) == 2.0

    flow = flow.on_recovery_failure()
    assert flow.retry_delay(policy) == 4.0


def test_recovery_success_resets_attempt_and_opens_gate():
    flow = UsdmReconnectFlow().on_disconnect().on_recovery_failure()
    recovered = flow.on_recovery_success()
    assert recovered.events_allowed is True
    assert recovered.retry_delay(UsdmReconnectPolicy()) == 1.0


def test_retry_delay_accepts_valid_policy():
    flow = UsdmReconnectFlow()
    assert flow.retry_delay(UsdmReconnectPolicy()) == 1.0
