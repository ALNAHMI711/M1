import json

import pytest

from app.binance_usdm_events import (
    UserEvent,
    account_update_payload,
    is_listen_key_expired,
    order_trade_identity,
    parse_user_event,
)


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
    assert account_update_payload(event)["a"]["m"] == "ORDER"


def test_parse_listen_key_expired():
    event = parse_user_event({"e": "listenKeyExpired", "E": 123456})
    assert is_listen_key_expired(event)


def test_parse_wrapped_event():
    event = parse_user_event(
        {"stream": "user", "data": {"e": "ACCOUNT_UPDATE", "a": {}}}
    )
    assert event.event_type == "ACCOUNT_UPDATE"


def test_rejects_unknown_event():
    with pytest.raises(ValueError, match="unsupported_user_data_event"):
        parse_user_event({"e": "BOOK_TICKER"})


@pytest.mark.parametrize("raw", ["{bad-json", b"{bad-json", 123, None])
def test_rejects_malformed_user_event(raw):
    with pytest.raises(ValueError, match="invalid_user_data_event"):
        parse_user_event(raw)


def test_order_update_requires_client_order_id():
    event = parse_user_event({"e": "ORDER_TRADE_UPDATE", "i": 1})
    with pytest.raises(ValueError, match="missing_client_order_id"):
        order_trade_identity(event)


def test_order_update_rejects_boolean_order_id():
    event = parse_user_event(
        {"e": "ORDER_TRADE_UPDATE", "o": {"c": "m1-client-1", "i": True}}
    )
    with pytest.raises(ValueError, match="invalid_order_id"):
        order_trade_identity(event)


def test_account_update_requires_account_payload():
    event = UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE"})
    with pytest.raises(ValueError, match="missing_account"):
        account_update_payload(event)


def test_account_update_payload_rejects_wrong_event_type():
    event = UserEvent(event_type="ORDER_TRADE_UPDATE", payload={"o": {}})
    with pytest.raises(ValueError, match="not_account_update"):
        account_update_payload(event)


def test_event_time_is_read_from_exchange_payload():
    event = parse_user_event(
        {
            "e": "ORDER_TRADE_UPDATE",
            "E": 123456,
            "o": {"c": "m1-client-1", "i": 1},
        }
    )
    from app.binance_usdm_events import event_time

    assert event_time(event) == 123456


def test_event_time_is_required_and_strict():
    from app.binance_usdm_events import event_time

    event = UserEvent(event_type="ACCOUNT_UPDATE", payload={"e": "ACCOUNT_UPDATE"})
    with pytest.raises(ValueError, match="invalid_event_time"):
        event_time(event)
