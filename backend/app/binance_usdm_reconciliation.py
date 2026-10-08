from __future__ import annotations

from .binance_usdm_events import UserEvent, event_time, order_trade_identity
from .store import (
    execution_order_exists,
    get_execution_order,
    record_execution_audit,
    update_execution_order,
)

FUTURES_ORDER_STATUSES = {
    "NEW",
    "PARTIALLY_FILLED",
    "FILLED",
    "CANCELED",
    "EXPIRED",
    "EXPIRED_IN_MATCH",
    "REJECTED",
}
TERMINAL_FUTURES_ORDER_STATUSES = {
    "FILLED",
    "CANCELED",
    "EXPIRED",
    "EXPIRED_IN_MATCH",
    "REJECTED",
}


def apply_usdm_order_update(event: UserEvent) -> str:
    """Apply an ordered Binance USD-M order event to an existing local order.

    This function is deliberately reconciliation-only: it never submits,
    amends, or cancels an exchange order.
    """
    client_order_id, order_id = order_trade_identity(event)
    exchange_event_time = event_time(event)
    order = event.payload["o"]
    status = order.get("X")
    if status not in FUTURES_ORDER_STATUSES:
        raise ValueError("unsupported_usdm_order_status")

    if not execution_order_exists(client_order_id):
        record_execution_audit(
            event="usdm_order_update_rejected",
            status="rejected",
            detail="unknown_client_order_id",
            client_order_id=client_order_id,
        )
        raise ValueError("unknown_client_order_id")

    current = get_execution_order(client_order_id)
    if current is None:
        raise ValueError("execution_order_disappeared")

    last_event_time = current.get("last_event_time")
    if last_event_time is not None and exchange_event_time < last_event_time:
        record_execution_audit(
            event="usdm_order_update_stale",
            status="ignored",
            detail=f"event_time={exchange_event_time};last_event_time={last_event_time}",
            client_order_id=client_order_id,
            signal_id=current["signal_id"],
        )
        return "stale"

    executed_quantity = order.get("z")
    average_price = order.get("ap")
    if executed_quantity is not None and not isinstance(executed_quantity, str):
        raise ValueError("invalid_executed_quantity")
    if average_price is not None and not isinstance(average_price, str):
        raise ValueError("invalid_average_price")

    same_state = (
        current["status"] == status
        and (order_id is None or current["order_id"] == str(order_id))
        and (
            executed_quantity is None
            or current["executed_quantity"] == executed_quantity
        )
        and (average_price is None or current["price"] == average_price)
    )
    if same_state:
        if (
            last_event_time is not None
            and exchange_event_time == last_event_time
        ):
            detail = "state_unchanged_same_event_time"
        else:
            detail = "state_unchanged"
        record_execution_audit(
            event="usdm_order_update_duplicate",
            status="ignored",
            detail=detail,
            client_order_id=client_order_id,
            signal_id=current["signal_id"],
        )
        return "duplicate"

    if last_event_time is not None and exchange_event_time == last_event_time:
        record_execution_audit(
            event="usdm_order_update_rejected",
            status="rejected",
            detail="conflicting_event_same_time",
            client_order_id=client_order_id,
            signal_id=current["signal_id"],
        )
        raise ValueError("conflicting_event_same_time")

    updated = update_execution_order(
        client_order_id,
        status=status,
        order_id=str(order_id) if order_id is not None else None,
        executed_quantity=executed_quantity,
        price=average_price,
        event_time=exchange_event_time,
    )
    if not updated:
        raise ValueError("execution_order_update_failed")

    record_execution_audit(
        event="usdm_order_update_applied",
        status="terminal" if status in TERMINAL_FUTURES_ORDER_STATUSES else "updated",
        detail=status,
        client_order_id=client_order_id,
        signal_id=current["signal_id"],
    )
    return "updated"
