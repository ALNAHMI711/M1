import pytest

from app.binance_usdm_account import parse_account_update


def test_parses_partial_account_and_position_update():
    result = parse_account_update(
        {
            "e": "ACCOUNT_UPDATE",
            "E": 1700000000123,
            "T": 1700000000000,
            "a": {
                "m": "ORDER",
                "B": [
                    {"a": "USDT", "wb": "100.00", "cw": "90.00", "bc": "1.25"}
                ],
                "P": [
                    {
                        "s": "BTCUSDT",
                        "ps": "BOTH",
                        "pa": "0.010",
                        "ep": "62000.00",
                        "up": "12.50",
                        "mt": "CROSSED",
                    }
                ],
            },
        }
    )

    assert result.reason == "ORDER"
    assert result.assets[0].asset == "USDT"
    assert result.assets[0].wallet_balance == "100.00"
    assert result.positions[0].symbol == "BTCUSDT"
    assert result.positions[0].quantity == "0.010"


def test_rejects_non_account_event():
    with pytest.raises(ValueError, match="invalid_account_update"):
        parse_account_update({"e": "ORDER_TRADE_UPDATE"})


@pytest.mark.parametrize(
    "field,value,error",
    [
        ("wb", "nan", "invalid_wallet_balance"),
        ("pa", "not-a-number", "invalid_position_quantity"),
    ],
)
def test_rejects_invalid_decimal_fields(field, value, error):
    payload = {
        "e": "ACCOUNT_UPDATE",
        "a": {
            "B": [{"a": "USDT", "wb": "100", "cw": "90", "bc": "1"}],
            "P": [
                {
                    "s": "BTCUSDT",
                    "ps": "BOTH",
                    "pa": "0",
                    "ep": "62000",
                    "up": "0",
                    "mt": "CROSSED",
                }
            ],
        },
    }
    if field in {"wb"}:
        payload["a"]["B"][0][field] = value
    else:
        payload["a"]["P"][0][field] = value

    with pytest.raises(ValueError, match=error):
        parse_account_update(payload)


def test_rejects_unknown_position_side():
    with pytest.raises(ValueError, match="invalid_position_side"):
        parse_account_update(
            {
                "e": "ACCOUNT_UPDATE",
                "a": {
                    "B": [],
                    "P": [
                        {
                            "s": "BTCUSDT",
                            "ps": "INVALID",
                            "pa": "0",
                            "ep": "0",
                            "up": "0",
                            "mt": "CROSSED",
                        }
                    ],
                },
            }
        )
