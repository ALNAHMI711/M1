from __future__ import annotations

from typing import Any

from .binance_spot import BinanceAPIError, BinanceSpotClient
from .store import pending_execution_orders, update_execution_order


TERMINAL_STATUSES = {"FILLED", "CANCELED", "EXPIRED", "REJECTED"}


def _status(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get("status")
    return value if isinstance(value, str) else None


def recover_spot_orders(client: BinanceSpotClient) -> dict[str, int]:
    """Reconcile locally pending orders with Binance without placing orders.

    A restart must never resend an order merely because local state is missing
    or stale. Each pending order is queried by Binance order ID when known,
    otherwise by the client order ID. Unknown/transport failures remain
    UNKNOWN
    so an operator can investigate before any further execution is attempted.
    """

    checked = updated = unknown = 0
    for local in pending_execution_orders():
        checked += 1
        try:
            remote = client.get_order(
                symbol=local["symbol"],
                order_id=int(local["order_id"]) if local["order_id"] else None,
                client_order_id=local["client_order_id"] if not local["order_id"] else None,
            )
            remote_status = _status(remote)
            if remote_status is None:
                unknown += 1
                update_execution_order(local["client_order_id"], status="UNKNOWN")
                continue

            update_execution_order(
                local["client_order_id"],
                status=remote_status,
                order_id=str(remote.get("orderId"))
                if remote.get("orderId") is not None
                else local["order_id"],
                executed_quantity=str(remote.get("executedQty", local["executed_quantity"])),
                price=str(remote.get("price"))
                if remote.get("price") is not None
                else local["price"],
            )
            updated += 1
        except (BinanceAPIError, ValueError, TypeError):
            unknown += 1
            update_execution_order(local["client_order_id"], status="UNKNOWN")

    return {"checked": checked, "updated": updated, "unknown": unknown}
