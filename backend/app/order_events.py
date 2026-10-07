from typing import Any

from .store import record_execution_audit, update_execution_order

TERMINAL_STATUSES = {"FILLED", "CANCELED", "EXPIRED", "REJECTED"}


def _value(payload: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if key in payload:
            return payload[key]
    return None


def apply_spot_order_update(payload: dict[str, Any]) -> bool:
    """Apply a Binance Spot order update to durable local execution state.

    The function accepts either a normalized order object or the Binance
    execution-report shape. It never submits, amends, or cancels an order.
    """
    order = payload.get("order", payload)
    if not isinstance(order, dict):
        raise ValueError("invalid_order_update")

    client_order_id = _value(order, "clientOrderId", "c")
    signal_id = _value(order, "signalId", "signal_id")
    status = _value(order, "status", "X")
    order_id = _value(order, "orderId", "i")
    executed_quantity = _value(order, "executedQty", "z")
    price = _value(order, "price", "p")

    if not client_order_id or not status:
        raise ValueError("order_update_missing_identity_or_status")

    update_execution_order(
        str(client_order_id),
        status=str(status),
        order_id=str(order_id) if order_id is not None else None,
        executed_quantity=str(executed_quantity) if executed_quantity is not None else None,
        price=str(price) if price is not None else None,
    )
    record_execution_audit(
        event="user_data_order_update",
        status=str(status),
        detail="terminal" if status in TERMINAL_STATUSES else "non_terminal",
        client_order_id=str(client_order_id),
        signal_id=str(signal_id) if signal_id is not None else None,
    )
    return status in TERMINAL_STATUSES
