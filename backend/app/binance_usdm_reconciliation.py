from __future__ import annotations

from .binance_usdm_events import UserEvent, event_time, order_trade_identity
from .store import apply_order_state, record_execution_audit

FUTURES_ORDER_STATUSES = {"NEW", "PARTIALLY_FILLED", "FILLED", "CANCELED", "EXPIRED", "EXPIRED_IN_MATCH", "REJECTED"}
TERMINAL_FUTURES_ORDER_STATUSES = {"FILLED", "CANCELED", "EXPIRED", "EXPIRED_IN_MATCH", "REJECTED"}


def apply_usdm_order_update(event: UserEvent) -> str:
    """Ordered, atomic, environment-specific reconciliation. Never sends orders."""
    client_order_id, order_id = order_trade_identity(event)
    order = event.payload["o"]
    status = order.get("X")
    if status not in FUTURES_ORDER_STATUSES:
        raise ValueError("unsupported_usdm_order_status")
    executed, price = order.get("z"), order.get("ap")
    if executed is not None and not isinstance(executed, str):
        raise ValueError("invalid_executed_quantity")
    if price is not None and not isinstance(price, str):
        raise ValueError("invalid_average_price")
    try:
        return apply_order_state(
            client_order_id, status=status, market="USDM",
            order_id=str(order_id) if order_id is not None else None,
            executed_quantity=executed, price=price, event_time=event_time(event),
            symbol=order.get("s"), event_prefix="usdm_order_update",
        )
    except ValueError as exc:
        record_execution_audit(
            event="usdm_order_update_rejected", status="rejected",
            detail=str(exc), client_order_id=client_order_id,
        )
        raise
