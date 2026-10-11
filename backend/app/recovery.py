from __future__ import annotations

from typing import Any

from .binance_spot import BinanceAPIError, BinanceSpotClient
from .store import (
    pending_execution_orders,
    record_execution_audit,
    apply_order_state,
)


def _status(payload: Any) -> str | None:
    if not isinstance(payload, dict):
        return None
    value = payload.get("status")
    return value if isinstance(value, str) else None


def recover_spot_orders(client: BinanceSpotClient, *, include_quarantined: bool = False) -> dict[str, int]:
    """Reconcile pending Spot orders without placing or replacing orders."""

    if getattr(client, "execution_mode", None) != "TESTNET":
        raise ValueError("spot_recovery_requires_testnet_client")
    checked = updated = unknown = 0
    for local in pending_execution_orders(mode="TESTNET", market="SPOT", include_unknown=include_quarantined):
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
                apply_order_state(local["client_order_id"], status="UNKNOWN", market="SPOT", snapshot=local, event_prefix="spot_recovery")
                record_execution_audit(
                    event="ORDER_RECOVERY",
                    status="UNKNOWN",
                    detail="remote_order_status_missing",
                    client_order_id=local["client_order_id"],
                    signal_id=local["signal_id"],
                )
                continue

            result = apply_order_state(
                local["client_order_id"],
                status=remote_status,
                market="SPOT",
                snapshot=local,
                symbol=remote.get("symbol"),
                event_time=remote.get("updateTime"),
                event_prefix="spot_recovery",
                order_id=str(remote.get("orderId"))
                if remote.get("orderId") is not None
                else local["order_id"],
                executed_quantity=str(
                    remote.get("executedQty", local["executed_quantity"])
                ),
                price=str(remote.get("price"))
                if remote.get("price") is not None
                else local["price"],
            )
            if result == "stale":
                continue
            record_execution_audit(
                event="ORDER_RECOVERY",
                status=remote_status,
                detail="remote_order_reconciled",
                client_order_id=local["client_order_id"],
                signal_id=local["signal_id"],
            )
            updated += 1
        except (BinanceAPIError, ValueError, TypeError):
            unknown += 1
            apply_order_state(local["client_order_id"], status="UNKNOWN", market="SPOT", snapshot=local, event_prefix="spot_recovery")
            record_execution_audit(
                event="ORDER_RECOVERY",
                status="UNKNOWN",
                detail="remote_order_unavailable",
                client_order_id=local["client_order_id"],
                signal_id=local["signal_id"],
            )

    return {"checked": checked, "updated": updated, "unknown": unknown}
