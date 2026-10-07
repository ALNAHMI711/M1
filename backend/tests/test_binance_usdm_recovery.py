import pytest

from app.binance_usdm_recovery import recover_before_events


def test_recovery_opens_event_gate_after_valid_snapshot():
    result = recover_before_events(
        {
            "status": 200,
            "result": {
                "assets": [
                    {
                        "asset": "USDT",
                        "walletBalance": "10",
                        "availableBalance": "9",
                    }
                ],
                "positions": [],
            },
        }
    )
    assert result.events_allowed is True
    assert result.snapshot.assets[0].asset == "USDT"


def test_recovery_does_not_open_event_gate_on_invalid_snapshot():
    with pytest.raises(ValueError, match="account_snapshot_failed"):
        recover_before_events({"status": 500})
