from app.binance_usdm_private_runtime import UsdmPrivateRuntime
from app.binance_usdm_reconnect import UsdmReconnectPolicy
from app.binance_usdm_stream import UsdmUserDataStreamLifecycle


def test_disconnect_blocks_events_and_advances_retry_delay():
    runtime = UsdmPrivateRuntime(
        lifecycle=UsdmUserDataStreamLifecycle(api_key="key").started_with("listen-key")
    )
    blocked = runtime.on_disconnect()
    assert blocked.events_allowed is False
    assert blocked.retry_delay_seconds == 1.0

    failed = blocked.on_recovery_failure()
    assert failed.events_allowed is False
    assert failed.retry_delay_seconds == 2.0


def test_recovery_success_reopens_gate_and_sets_new_listen_key():
    runtime = UsdmPrivateRuntime(
        lifecycle=UsdmUserDataStreamLifecycle(api_key="key").started_with("old-key")
    ).on_disconnect()

    recovered = runtime.on_recovery_success("new-key")
    assert recovered.events_allowed is True
    assert recovered.lifecycle.listen_key == "new-key"
    assert recovered.retry_delay_seconds == 1.0


def test_runtime_keepalive_uses_lifecycle_policy():
    runtime = UsdmPrivateRuntime(
        lifecycle=UsdmUserDataStreamLifecycle(
            api_key="key",
            keepalive_interval_seconds=100,
        )
    )
    assert runtime.keepalive_due(99) is False
    assert runtime.keepalive_due(100) is True


def test_runtime_uses_custom_reconnect_policy():
    runtime = UsdmPrivateRuntime(
        lifecycle=UsdmUserDataStreamLifecycle(api_key="key"),
        policy=UsdmReconnectPolicy(
            initial_delay_seconds=3.0,
            max_delay_seconds=10.0,
        ),
    ).on_disconnect()
    assert runtime.retry_delay_seconds == 3.0
