from __future__ import annotations

import json
from dataclasses import dataclass


SUPPORTED_EVENTS = {"ORDER_TRADE_UPDATE", "ACCOUNT_UPDATE"}


@dataclass(frozen=True)
class UserEvent:
    event_type: str
    payload: dict


def parse_user_event(raw: str | bytes | dict) -> UserEvent:
    payload = json.loads(raw) if isinstance(raw, (str, bytes)) else raw
    if not isinstance(payload, dict):
        raise ValueError("invalid_user_data_event")
    event = payload.get("data")
    if not isinstance(event, dict):
        event = payload
    event_type = event.get("e")
    if event_type not in SUPPORTED_EVENTS:
        raise ValueError("unsupported_user_data_event")
    return UserEvent(event_type=event_type, payload=event)


def order_trade_identity(event: UserEvent) -> tuple[str, int | None]:
    if event.event_type != "ORDER_TRADE_UPDATE":
        raise ValueError("not_order_trade_update")
    order = event.payload.get("o")
    if not isinstance(order, dict):
        raise ValueError("order_update_missing_order")
    client_order_id = order.get("c")
    order_id = order.get("i")
    if not isinstance(client_order_id, str) or not client_order_id:
        raise ValueError("order_update_missing_client_order_id")
    if order_id is not None and not isinstance(order_id, int):
        raise ValueError("order_update_invalid_order_id")
    return client_order_id, order_id
