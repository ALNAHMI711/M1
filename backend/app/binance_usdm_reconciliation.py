from __future__ import annotations

from .binance_usdm_events import UserEvent, order_trade_identity
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
    """Apply a Binance USD-M order event to an existing local order.

    This function is deliberately reconciliation-only: it never submits,
    amends, or cancels an exchange order.
    """
    client_order_id, order_id = order_trade_identity(event)
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
        record_execution_audit(
            event="usdm_order_update_duplicate",
            status="ignored",
            detail="state_unchanged",
            client_order_id=client_order_id,
            signal_id=current["signal_id"],
        )
        return "duplicate"

    updated = update_execution_order(
        client_order_id,
        status=status,
        order_id=str(order_id) if order_id is not None else None,
        executed_quantity=executed_quantity,
        price=average_price,
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
