import json

import pytest

from app.binance_usdm_events import UserEvent, order_trade_identity, parse_user_event


def test_parse_order_trade_update():
    event = parse_user_event(
        json.dumps(
            {
                "e": "ORDER_TRADE_UPDATE",
                "o": {"c": "m1-client-1", "i": 12345},
            }
        )
    )
    assert isinstance(event, UserEvent)
    assert event.event_type == "ORDER_TRADE_UPDATE"
    assert order_trade_identity(event) == ("m1-client-1", 12345)


def test_parse_account_update():
    event = parse_user_event({"e": "ACCOUNT_UPDATE", "a": {"m": "ORDER"}})
    assert event.event_type == "ACCOUNT_UPDATE"


def test_parse_wrapped_event():
    event = parse_user_event(
        {"stream": "user", "data": {"e": "ACCOUNT_UPDATE", "a": {}}}
    )
    assert event.event_type == "ACCOUNT_UPDATE"


def test_rejects_unknown_event():
    with pytest.raises(ValueError, match="unsupported_user_data_event"):
        parse_user_event({"e": "BOOK_TICKER"})


def test_order_update_requires_client_order_id():
    event = parse_user_event({"e": "ORDER_TRADE_UPDATE", "o": {"i": 1}})
    with pytest.raises(ValueError, match="missing_client_order_id"):
        order_trade_identity(event)
