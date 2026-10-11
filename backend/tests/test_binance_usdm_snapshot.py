import pytest

from app.binance_usdm_snapshot import parse_account_snapshot


def test_parse_account_snapshot():
    snapshot = parse_account_snapshot(
        {
            "status": 200,
            "result": {
                "assets": [
                    {
                        "asset": "USDT",
                        "walletBalance": "100.50",
                        "availableBalance": "90.25",
                    }
                ],
                "positions": [
                    {
                        "symbol": "BTCUSDT",
                        "positionSide": "BOTH",
                        "positionAmt": "0.010",
                        "entryPrice": "60000.00",
                        "unrealizedProfit": "2.50",
                    }
                ],
            },
        }
    )
    assert snapshot.assets[0].wallet_balance == "100.50"
    assert snapshot.assets[0].available_balance == "90.25"
    assert snapshot.positions[0].quantity == "0.010"


@pytest.mark.parametrize(
    "response,error",
    [
        ({"status": 500}, "account_snapshot_failed"),
        ({"status": 200}, "missing_account_snapshot_result"),
        (
            {"status": 200, "result": {"assets": {}, "positions": []}},
            "invalid_account_snapshot_arrays",
        ),
    ],
)
def test_snapshot_response_validation(response, error):
    with pytest.raises(ValueError, match=error):
        parse_account_snapshot(response)


def test_snapshot_rejects_invalid_position_side():
    with pytest.raises(ValueError, match="invalid_snapshot_position_side"):
        parse_account_snapshot(
            {
                "status": 200,
                "result": {
                    "assets": [],
                    "positions": [
                        {
                            "symbol": "BTCUSDT",
                            "positionSide": "INVALID",
                            "positionAmt": "0",
                            "entryPrice": "0",
                            "unrealizedProfit": "0",
                        }
                    ],
                },
            }
        )


def test_snapshot_rejects_non_numeric_balance():
    with pytest.raises(ValueError, match="invalid_wallet_balance"):
        parse_account_snapshot(
            {
                "status": 200,
                "result": {
                    "assets": [
                        {
                            "asset": "USDT",
                            "walletBalance": "not-a-number",
                            "availableBalance": "1",
                        }
                    ],
                    "positions": [],
                },
            }
        )
