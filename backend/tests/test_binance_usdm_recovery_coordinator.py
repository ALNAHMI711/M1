from app.binance_usdm_private_runtime import UsdmPrivateRuntime
from app.binance_usdm_recovery_coordinator import UsdmRecoveryCoordinator
from app.binance_usdm_snapshot import UsdmAccountSnapshot
from app.binance_usdm_snapshot_recovery_gate import UsdmSnapshotRecoveryGate
from app.binance_usdm_state import from_snapshot
from app.binance_usdm_stream import UsdmUserDataStreamLifecycle


def make_coordinator() -> UsdmRecoveryCoordinator:
    state = from_snapshot(
        UsdmAccountSnapshot(assets=(), positions=()),
        snapshot_version=1,
    )
    runtime = UsdmPrivateRuntime(
        lifecycle=UsdmUserDataStreamLifecycle(api_key="key").started_with("old-key")
    )
    return UsdmRecoveryCoordinator(
        runtime=runtime,
        gate=UsdmSnapshotRecoveryGate(state=state),
    )


def test_disconnect_blocks_both_runtime_and_state_events():
    coordinator = make_coordinator().on_disconnect()

    assert coordinator.events_allowed is False
    assert coordinator.recovery_required is True
    assert coordinator.runtime.lifecycle.listen_key == "old-key"
    assert coordinator.retry_delay_seconds == 1.0
    assert coordinator.gate.state.snapshot_version == 2


def test_failed_recovery_keeps_both_gates_closed_and_increments_attempt():
    coordinator = make_coordinator().on_disconnect().on_recovery_failure()

    assert coordinator.events_allowed is False
    assert coordinator.recovery_required is True
    assert coordinator.gate.state.recovery_attempt == 1
    assert coordinator.retry_delay_seconds == 2.0


def test_snapshot_restore_then_stream_recovery_reopens_both_gates():
    coordinator = make_coordinator().on_disconnect()
    restored = coordinator.restore_snapshot(
        UsdmAccountSnapshot(assets=(), positions=())
    )

    assert restored.gate.events_allowed is True
    assert restored.runtime.events_allowed is False
    assert restored.events_allowed is False

    recovered = restored.on_recovery_success("new-key")

    assert recovered.events_allowed is True
    assert recovered.recovery_required is False
    assert recovered.runtime.lifecycle.listen_key == "new-key"
    assert recovered.gate.state.snapshot_version == 2
    assert recovered.gate.state.recovery_attempt == 0
    assert recovered.retry_delay_seconds == 1.0


def test_stream_recovery_cannot_open_before_snapshot_restore():
    coordinator = make_coordinator().on_disconnect()

    try:
        coordinator.on_recovery_success("new-key")
    except ValueError as exc:
        assert str(exc) == "snapshot_recovery_required"
    else:
        raise AssertionError("stream recovery must not open before snapshot recovery")


def test_events_are_rejected_while_recovery_is_pending():
    from app.binance_usdm_account import UsdmAccountUpdate
    from app.binance_usdm_events import UserEvent

    coordinator = make_coordinator().on_disconnect()
    account_update = UsdmAccountUpdate(
        event_time=100,
        transaction_time=100,
        reason="ORDER",
        assets=(),
        positions=(),
    )
    event = UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE"})

    try:
        coordinator.accept_account_update(account_update)
    except ValueError as exc:
        assert str(exc) == "recovery_required"
    else:
        raise AssertionError("account updates must remain blocked during recovery")

    try:
        coordinator.accept_user_event(event, event_time=100)
    except ValueError as exc:
        assert str(exc) == "recovery_required"
    else:
        raise AssertionError("user events must remain blocked during recovery")


def test_account_update_opens_state_progress_only_after_runtime_recovery():
    from app.binance_usdm_account import UsdmAccountUpdate

    coordinator = make_coordinator().on_disconnect().restore_snapshot(
        UsdmAccountSnapshot(assets=(), positions=())
    ).on_recovery_success("new-key")
    updated = coordinator.accept_account_update(
        UsdmAccountUpdate(
            event_time=100,
            transaction_time=100,
            reason="ORDER",
            assets=(),
            positions=(),
        )
    )

    assert updated.events_allowed is True
    assert updated.gate.state.last_event_time == 100
