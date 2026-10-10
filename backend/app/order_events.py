from typing import Any

from .store import execution_order_exists, record_execution_audit, update_execution_order

TERMINAL_STATUSES = {"FILLED", "CANCELED", "EXPIRED", "REJECTED"}


def _value(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload:
            return payload[key]
    return None


def apply_spot_order_update(payload: dict[str, Any]) -> bool:
    """Apply a Binance Spot order update to durable local execution state.

    The local clientOrderId is the trust boundary: remote events cannot create
    or retarget a local execution order. The function never submits, amends,
    or cancels an order.
    """
    order = payload.get("order", payload)
    if not isinstance(order, dict):
        raise ValueError("invalid_order_update")

    client_order_id = _value(order, "clientOrderId", "c")
    status = _value(order, "status", "X")
    order_id = _value(order, "orderId", "i")
    executed_quantity = _value(order, "executedQty", "z")
    price = _value(order, "price", "p")

    if not client_order_id or not status:
        raise ValueError("order_update_missing_identity_or_status")

    client_order_id = str(client_order_id)
    status = str(status)
    if not execution_order_exists(client_order_id):
        record_execution_audit(
            event="user_data_order_update_rejected",
            status=status,
            detail="unknown_client_order_id",
            client_order_id=client_order_id,
        )
        raise ValueError("unknown_client_order_id")

    updated = update_execution_order(
        client_order_id,
        status=status,
        order_id=str(order_id) if order_id is not None else None,
        executed_quantity=str(executed_quantity) if executed_quantity is not None else None,
        price=str(price) if price is not None else None,
    )
    if not updated:
        raise ValueError("execution_order_update_failed")

    record_execution_audit(
        event="user_data_order_update",
        status=status,
        detail="terminal" if status in TERMINAL_STATUSES else "non_terminal",
        client_order_id=client_order_id,
    )
    return status in TERMINAL_STATUSES
