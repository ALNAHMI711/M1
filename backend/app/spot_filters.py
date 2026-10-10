"""Conservative static preflight, not an exchange/account readiness certificate.

Rules: https://developers.binance.com/en/docs/products/spot/filters
Dynamic market/reference-price, position and account counters remain exchange-side.
Never round an order silently, and never derive market notional from user prices.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, localcontext
from typing import Any


class SpotFilterError(ValueError):
    """Stable, non-secret error safe for an API response."""


def _decimal(value: Any, *, positive: bool = False) -> Decimal:
    if not isinstance(value, str) or not re.fullmatch(r"\d{1,24}(?:\.\d{1,20})?", value):
        raise SpotFilterError("invalid_filter_number")
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise SpotFilterError("invalid_filter_number") from exc
    if not number.is_finite() or number < 0 or (positive and number == 0):
        raise SpotFilterError("invalid_filter_number")
    return number


def _range(value: Decimal, rule: dict, low: str, high: str, step: str, name: str) -> None:
    minimum, maximum, interval = (_decimal(rule.get(key)) for key in (low, high, step))
    if minimum and maximum and minimum > maximum:
        raise SpotFilterError("invalid_filter_range")
    if minimum and value < minimum:
        raise SpotFilterError(f"{name}_below_minimum")
    if maximum and value > maximum:
        raise SpotFilterError(f"{name}_above_maximum")
    if interval and value % interval:
        raise SpotFilterError(f"{name}_invalid_increment")


def _integer(value: Any) -> int:
    if type(value) is not int or not 0 <= value <= 1_000_000_000:
        raise SpotFilterError("invalid_filter_integer")
    return value


def _boolean(value: Any) -> bool:
    if type(value) is not bool:
        raise SpotFilterError("invalid_filter_boolean")
    return value


STATIC = {"PRICE_FILTER", "LOT_SIZE", "MARKET_LOT_SIZE", "MIN_NOTIONAL", "NOTIONAL"}
DYNAMIC = {
    "PERCENT_PRICE", "PERCENT_PRICE_BY_SIDE", "MAX_NUM_ORDERS",
    "MAX_NUM_ALGO_ORDERS", "MAX_NUM_ICEBERG_ORDERS", "MAX_POSITION",
    "ICEBERG_PARTS", "TRAILING_DELTA", "MAX_NUM_ORDER_AMENDS", "MAX_NUM_ORDER_LISTS",
}
EXCHANGE_DYNAMIC = {
    "EXCHANGE_MAX_NUM_ORDERS", "EXCHANGE_MAX_NUM_ALGO_ORDERS",
    "EXCHANGE_MAX_NUM_ICEBERG_ORDERS", "EXCHANGE_MAX_NUM_ORDER_LISTS",
}
INTEGER_RULE_FIELDS = {
    "MAX_NUM_ORDERS": ("maxNumOrders",),
    "MAX_NUM_ALGO_ORDERS": ("maxNumAlgoOrders",),
    "MAX_NUM_ICEBERG_ORDERS": ("maxNumIcebergOrders",),
    "ICEBERG_PARTS": ("limit",),
    "TRAILING_DELTA": ("minTrailingAboveDelta", "maxTrailingAboveDelta",
                       "minTrailingBelowDelta", "maxTrailingBelowDelta"),
    "MAX_NUM_ORDER_AMENDS": ("maxNumOrderAmends",),
    "MAX_NUM_ORDER_LISTS": ("maxNumOrderLists",),
    "EXCHANGE_MAX_NUM_ORDERS": ("maxNumOrders",),
    "EXCHANGE_MAX_NUM_ALGO_ORDERS": ("maxNumAlgoOrders",),
    "EXCHANGE_MAX_NUM_ICEBERG_ORDERS": ("maxNumIcebergOrders",),
    "EXCHANGE_MAX_NUM_ORDER_LISTS": ("maxNumOrderLists",),
}


def _rules(value: Any, allowed: set[str]) -> dict[str, dict]:
    if not isinstance(value, list) or len(value) > 64:
        raise SpotFilterError("invalid_filter_metadata")
    rules: dict[str, dict] = {}
    for item in value:
        if not isinstance(item, dict) or not isinstance(item.get("filterType"), str) or item["filterType"] not in allowed:
            raise SpotFilterError("unsupported_filter_type")
        kind = item["filterType"]
        if kind in rules:
            raise SpotFilterError("duplicate_filter_type")
        rules[kind] = item
    return rules


def validate_spot_order(
    metadata: Any, *, symbol: str, side: str, order_type: str, quantity: str,
    price: str | None = None, time_in_force: str | None = None,
) -> dict:
    if not isinstance(symbol, str) or not re.fullmatch(r"[A-Z0-9]{3,20}", symbol):
        raise SpotFilterError("invalid_spot_symbol")
    if not isinstance(side, str) or not isinstance(order_type, str) or side not in {"BUY", "SELL"} or order_type not in {"LIMIT", "MARKET"}:
        raise SpotFilterError("invalid_spot_order_parameters")
    qty = _decimal(quantity, positive=True)
    if order_type == "LIMIT":
        if time_in_force not in {"GTC", "IOC", "FOK"} or price is None:
            raise SpotFilterError("limit_requires_price_and_time_in_force")
        limit_price = _decimal(price, positive=True)
    else:
        if price is not None or time_in_force is not None:
            raise SpotFilterError("market_disallows_price_and_time_in_force")
        limit_price = None
    if not isinstance(metadata, dict):
        raise SpotFilterError("invalid_exchange_metadata")
    symbols = metadata.get("symbols")
    if not isinstance(symbols, list) or len(symbols) != 1 or not isinstance(symbols[0], dict):
        raise SpotFilterError("ambiguous_symbol_metadata")
    info = symbols[0]
    if info.get("symbol") != symbol:
        raise SpotFilterError("symbol_metadata_mismatch")
    if info.get("status") != "TRADING" or info.get("isSpotTradingAllowed") is not True:
        raise SpotFilterError("spot_symbol_not_trading")
    types = info.get("orderTypes")
    if not isinstance(types, list) or order_type not in types:
        raise SpotFilterError("unsupported_symbol_order_type")
    rules = _rules(info.get("filters"), STATIC | DYNAMIC)
    exchange = _rules(metadata.get("exchangeFilters", []), EXCHANGE_DYNAMIC)
    # Optional exchange filters are not guessed from absent/malformed static rules.
    if not {"PRICE_FILTER", "LOT_SIZE"} <= rules.keys():
        raise SpotFilterError("required_static_filters_missing")
    checked: list[str] = []
    deferred: list[str] = sorted(exchange)
    with localcontext() as context:
        context.prec = 100  # exact multiplication/modulo for bounded decimal input
        _range(qty, rules["LOT_SIZE"], "minQty", "maxQty", "stepSize", "quantity")
        checked.append("LOT_SIZE")
        if order_type == "MARKET" and "MARKET_LOT_SIZE" in rules:
            _range(qty, rules["MARKET_LOT_SIZE"], "minQty", "maxQty", "stepSize", "market_quantity")
            checked.append("MARKET_LOT_SIZE")
        # Validate PRICE_FILTER metadata even for a market request with no price.
        if limit_price is not None:
            _range(limit_price, rules["PRICE_FILTER"], "minPrice", "maxPrice", "tickSize", "price")
            checked.append("PRICE_FILTER")
        else:
            price_rule = rules["PRICE_FILTER"]
            lo, hi, _ = (_decimal(price_rule.get(k)) for k in ("minPrice", "maxPrice", "tickSize"))
            if lo and hi and lo > hi:
                raise SpotFilterError("invalid_filter_range")
        notional = qty * limit_price if limit_price is not None else None
        for kind in ("MIN_NOTIONAL", "NOTIONAL"):
            if kind not in rules:
                continue
            rule = rules[kind]
            minimum = _decimal(rule.get("minNotional"))
            _integer(rule.get("avgPriceMins"))
            if kind == "MIN_NOTIONAL":
                applies_min = _boolean(rule.get("applyToMarket"))
                applies_max = False
                maximum = Decimal(0)
            else:
                maximum = _decimal(rule.get("maxNotional"))
                applies_min = _boolean(rule.get("applyMinToMarket"))
                applies_max = _boolean(rule.get("applyMaxToMarket"))
                if minimum and maximum and minimum > maximum:
                    raise SpotFilterError("invalid_filter_range")
            if notional is not None:
                if minimum and notional < minimum:
                    raise SpotFilterError("notional_below_minimum")
                if maximum and notional > maximum:
                    raise SpotFilterError("notional_above_maximum")
                checked.append(kind)
            elif applies_min or applies_max:
                deferred.append(kind + ":exchange_reference_price_required")
        for kind in sorted(DYNAMIC & rules.keys()):
            rule = rules[kind]
            if kind in {"PERCENT_PRICE", "PERCENT_PRICE_BY_SIDE"}:
                keys = ("multiplierUp", "multiplierDown") if kind == "PERCENT_PRICE" else (
                    "bidMultiplierUp", "bidMultiplierDown", "askMultiplierUp", "askMultiplierDown")
                numbers = [_decimal(rule.get(k), positive=True) for k in keys]
                if any(numbers[i] < numbers[i + 1] for i in range(0, len(numbers), 2)):
                    raise SpotFilterError("invalid_filter_range")
                _integer(rule.get("avgPriceMins"))
                if order_type == "LIMIT":
                    deferred.append(kind + ":exchange_reference_price_required")
            elif kind == "MAX_POSITION":
                _decimal(rule.get("maxPosition"), positive=True)
                if side == "BUY":
                    deferred.append(kind + ":account_state_required")
            else:
                values = [_integer(rule.get(key)) for key in INTEGER_RULE_FIELDS[kind]]
                if kind == "TRAILING_DELTA" and (values[0] > values[1] or values[2] > values[3]):
                    raise SpotFilterError("invalid_filter_range")
                deferred.append(kind + ":exchange_state_or_order_feature")
        for kind, rule in exchange.items():
            for key in INTEGER_RULE_FIELDS[kind]:
                _integer(rule.get(key))
    return {
        "mode": "TESTNET", "symbol": symbol, "side": side, "order_type": order_type,
        "quantity": quantity, "price": price,
        "static_validation_passed": True, "order_placement": False, "live_enabled": False,
        "checked_filters": checked, "deferred_checks": deferred,
        "account_and_asset_filters_verified": False,
        "exchange_validation_required": True,
        "limit_notional": format(notional, "f") if notional is not None else None,
        "metadata_sha256": hashlib.sha256(json.dumps(metadata, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
