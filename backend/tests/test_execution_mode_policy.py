import pytest

from app.execution_mode_policy import check_execution_mode


@pytest.mark.parametrize("mode", ["DEVELOPMENT", "BACKTEST", "DRY_RUN", "LIVE", "UNKNOWN"])
def test_non_submission_modes_fail_closed(mode):
    decision = check_execution_mode(mode=mode, transport_mode=mode)
    assert decision.allowed is False


@pytest.mark.parametrize("mode", ["PAPER", "TESTNET"])
def test_matching_non_live_transport_is_allowed(mode):
    assert check_execution_mode(mode=mode, transport_mode=mode).allowed is True


def test_paper_cannot_use_testnet_transport():
    decision = check_execution_mode(mode="PAPER", transport_mode="TESTNET")
    assert decision.allowed is False
    assert decision.reasons == ("transport_mode_mismatch",)


def test_missing_transport_fails_closed():
    decision = check_execution_mode(mode="TESTNET", transport_mode=None)
    assert decision.allowed is False
    assert decision.reasons == ("transport_mode_mismatch",)
