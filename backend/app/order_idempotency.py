"""Canonical fingerprints for durable, idempotent exchange-order requests."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping
from typing import Any


_REQUIRED_FIELDS = {
    "client_order_id",
    "signal_id",
    "symbol",
    "side",
    "mode",
    "market",
    "order_type",
    "quantity",
}


def canonical_order_request_json(payload: Mapping[str, Any]) -> str:
    """Return a stable JSON representation of the complete order request.

    Hashing the complete payload (rather than a hand-picked subset) binds the
    idempotency key to signal/risk inputs and every order parameter. Callers
    should pass the validated model serialization including explicit defaults.
    """
    if not isinstance(payload, Mapping) or not _REQUIRED_FIELDS.issubset(payload):
        raise ValueError("incomplete_order_request_for_fingerprint")
    try:
        canonical = json.dumps(
            dict(payload),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        )
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid_order_request_for_fingerprint") from exc
    return canonical


def order_request_fingerprint(payload: Mapping[str, Any]) -> str:
    """Return a stable SHA-256 digest of the complete JSON request payload."""
    canonical = canonical_order_request_json(payload)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
