"""Fail-closed orchestration for a previously reserved Spot Testnet intent.

This module is not exposed as an API route. It is a transport primitive and
requires an explicitly enabled Testnet client plus a durable reserved intent.
"""
from __future__ import annotations

import json
import os
from decimal import Decimal, InvalidOperation
from typing import Any

from .binance_spot import BinanceAPIError, BinanceSpotClient
from .order_idempotency import order_request_fingerprint
from .store import (
    apply_order_state,
    claim_spot_testnet_order_submission,
    get_execution_order,
)
from .testnet_settings import get_settings


class SpotTestnetSubmissionError(RuntimeError):
    pass


def _quarantine(client_order_id: str, *, event_prefix: str) -> None:
    current = get_execution_order(client_order_id)
    if current is None or current["status"] not in {"SENDING", "UNKNOWN"}:
        return
    apply_order_state(
        client_order_id,
        status="UNKNOWN",
        market="SPOT",
        mode="TESTNET",
        snapshot=current,
        event_prefix=event_prefix,
    )


def submit_reserved_spot_testnet_order(
    client: BinanceSpotClient, client_order_id: str
) -> dict[str, Any]:
    """Submit one durable intent exactly once; uncertain outcomes are quarantined.

    A duplicate invocation never retries the transport. The operator must run
    the read-only recovery path for SENDING/UNKNOWN records.
    """
    if getattr(client, "execution_mode", None) != "TESTNET":
        raise SpotTestnetSubmissionError("testnet_client_required")
    if os.getenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "false").lower() != "true":
        raise SpotTestnetSubmissionError("testnet_order_submission_disabled")
    settings = get_settings()
    if not settings["enabled"] or not settings["manual_approval"] or not settings["credentials_test_passed"]:
        raise SpotTestnetSubmissionError("testnet_admin_settings_disabled")
    order = get_execution_order(client_order_id)
    if order is None:
        raise SpotTestnetSubmissionError("reserved_testnet_order_not_found")
    if order["mode"] != "TESTNET" or order["market"] != "SPOT":
        raise SpotTestnetSubmissionError("reserved_testnet_order_environment_mismatch")
    if order["status"] != "SUBMITTING":
        return {"submitted": False, "status": order["status"], "reason": "intent_not_claimable"}
    if not order["request_payload_json"] or not order["request_fingerprint"]:
        raise SpotTestnetSubmissionError("reserved_testnet_order_payload_missing")
    try:
        payload = json.loads(order["request_payload_json"])
    except (json.JSONDecodeError, TypeError) as exc:
        raise SpotTestnetSubmissionError("reserved_testnet_order_payload_invalid") from exc
    if not isinstance(payload, dict) or order_request_fingerprint(payload) != order["request_fingerprint"]:
        raise SpotTestnetSubmissionError("reserved_testnet_order_fingerprint_mismatch")
    expected = {
        "client_order_id": order["client_order_id"], "signal_id": order["signal_id"],
        "symbol": order["symbol"], "side": order["side"], "mode": "TESTNET",
        "market": "SPOT", "quantity": order["quantity"],
    }
    if any(payload.get(key) != value for key, value in expected.items()):
        raise SpotTestnetSubmissionError("reserved_testnet_order_identity_mismatch")
    # Current account/asset state and market-reference checks are incomplete.
    # Until those are implemented, permit only bounded limit buys from an
    # explicit server allowlist; never sell or submit a market order here.
    if (
        payload.get("order_type") != "LIMIT" or order["side"] != "BUY"
        or payload.get("price") is None or str(payload.get("price")) != str(order["price"])
        or payload.get("time_in_force") not in {"GTC", "IOC", "FOK"}
    ):
        raise SpotTestnetSubmissionError("testnet_order_type_or_side_not_enabled")
    allowed_symbols = set(settings["allowed_symbols"])
    if not allowed_symbols or order["symbol"] not in allowed_symbols:
        raise SpotTestnetSubmissionError("testnet_symbol_not_allowlisted")
    try:
        maximum_notional = Decimal(settings["max_order_notional"])
        notional = Decimal(order["quantity"]) * Decimal(str(payload["price"]))
    except (InvalidOperation, KeyError, TypeError) as exc:
        raise SpotTestnetSubmissionError("testnet_order_notional_invalid") from exc
    if not maximum_notional.is_finite() or maximum_notional <= 0 or notional > maximum_notional:
        raise SpotTestnetSubmissionError("testnet_order_notional_limit")
    try:
        from .main import Signal, risk_check
        signal = Signal.model_validate(payload.get("signal"))
    except Exception as exc:
        raise SpotTestnetSubmissionError("testnet_signal_payload_invalid") from exc
    if (
        signal.mode != "TESTNET" or signal.signal_id != order["signal_id"]
        or signal.symbol != order["symbol"] or signal.side != "LONG"
        or Decimal(str(signal.entry)) != Decimal(str(payload["price"]))
    ):
        raise SpotTestnetSubmissionError("testnet_signal_order_mismatch")
    accepted, reasons = risk_check(signal)
    if not accepted:
        raise SpotTestnetSubmissionError("testnet_risk_rejected:" + ",".join(reasons))

    # Repeat the dynamic account/asset/reference checks here, not only in the
    # HTTP route. This protects any future scheduler, CLI, or internal caller.
    try:
        report = client.order_submission_preflight(
            symbol=payload["symbol"], side="BUY", order_type="LIMIT",
            quantity=payload["quantity"], price=payload["price"],
            time_in_force=payload["time_in_force"],
        )
    except Exception as exc:
        raise SpotTestnetSubmissionError("testnet_exchange_validation_failed") from exc
    if (
        not isinstance(report, dict) or report.get("deferred_checks")
        or report.get("account_and_asset_filters_verified") is not True
    ):
        raise SpotTestnetSubmissionError("testnet_exchange_validation_incomplete")

    try:
        amount = Decimal(order["quantity"]) * Decimal(str(payload["price"]))
        daily_limit = Decimal(settings["max_daily_notional"])
    except (InvalidOperation, KeyError, TypeError) as exc:
        raise SpotTestnetSubmissionError("testnet_order_notional_invalid") from exc
    if not amount.is_finite() or amount <= 0 or not daily_limit.is_finite() or daily_limit <= 0:
        raise SpotTestnetSubmissionError("testnet_order_notional_invalid")
    from .testnet_settings import reserve_daily_notional
    if not reserve_daily_notional(
        client_order_id=client_order_id, notional=amount, daily_limit=daily_limit
    ):
        raise SpotTestnetSubmissionError("testnet_daily_notional_limit")

    if not claim_spot_testnet_order_submission(
        client_order_id, request_fingerprint=order["request_fingerprint"]
    ):
        latest = get_execution_order(client_order_id)
        return {
            "submitted": False,
            "status": latest["status"] if latest else "UNKNOWN",
            "reason": "intent_already_claimed_or_changed",
        }

    try:
        response = client.submit_testnet_order(
            symbol=payload["symbol"], side=payload["side"],
            order_type=payload["order_type"], quantity=payload["quantity"],
            client_order_id=payload["client_order_id"], price=payload.get("price"),
            time_in_force=payload.get("time_in_force"),
        )
        if not isinstance(response, dict) or not isinstance(response.get("status"), str):
            raise SpotTestnetSubmissionError("invalid_testnet_order_response")
        status = response["status"]
        if status not in {
            "NEW", "PARTIALLY_FILLED", "PENDING_CANCEL", "FILLED", "CANCELED",
            "EXPIRED", "EXPIRED_IN_MATCH", "REJECTED",
        }:
            raise SpotTestnetSubmissionError("unsupported_testnet_order_response_status")
        if response.get("symbol") not in (None, payload["symbol"]):
            raise SpotTestnetSubmissionError("testnet_order_response_symbol_mismatch")
        if response.get("clientOrderId") not in (None, payload["client_order_id"]):
            raise SpotTestnetSubmissionError("testnet_order_response_client_id_mismatch")
        remote_order_id = response.get("orderId")
        if isinstance(remote_order_id, bool) or not isinstance(remote_order_id, int) or remote_order_id <= 0:
            raise SpotTestnetSubmissionError("testnet_order_response_id_missing")
        executed = str(response.get("executedQty", "0"))
        event_time = response.get("updateTime", response.get("transactTime"))
        latest = get_execution_order(client_order_id)
        result = apply_order_state(
            client_order_id, status=status, market="SPOT", mode="TESTNET",
            order_id=str(remote_order_id),
            executed_quantity=executed,
            price=str(response["price"]) if response.get("price") is not None else order["price"],
            event_time=event_time, symbol=payload["symbol"], snapshot=latest,
            event_prefix="spot_submit",
        )
        if result == "stale":
            return {"submitted": True, "status": "UNKNOWN", "reason": "response_snapshot_stale"}
        return {"submitted": True, "status": status, "order_id": response.get("orderId")}
    except Exception as exc:
        # Once a request may have crossed the network boundary, never retry it
        # automatically. Read-only reconciliation is the only recovery path.
        try:
            _quarantine(client_order_id, event_prefix="spot_submit")
        except Exception:
            pass
        if isinstance(exc, SpotTestnetSubmissionError):
            reason = str(exc)
        elif isinstance(exc, BinanceAPIError):
            reason = "testnet_transport_or_exchange_error"
        else:
            reason = "testnet_submission_outcome_unknown"
        return {"submitted": None, "status": "UNKNOWN", "reason": reason}
