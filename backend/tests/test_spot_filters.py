from copy import deepcopy
from decimal import getcontext

import pytest

from app.spot_filters import SpotFilterError, validate_spot_order, validate_spot_order_with_account
from app.binance_spot import BinanceAPIError, BinanceSpotClient, BinanceSpotConfig
from app.operations import set_kill_switch


def metadata():
    return {
        "exchangeFilters": [],
        "symbols": [{
            "symbol": "BTCUSDT", "baseAsset": "BTC", "quoteAsset": "USDT",
            "status": "TRADING", "isSpotTradingAllowed": True,
            "orderTypes": ["LIMIT", "MARKET"],
            "filters": [
                {"filterType": "PRICE_FILTER", "minPrice": "0.01", "maxPrice": "1000000", "tickSize": "0.01"},
                {"filterType": "LOT_SIZE", "minQty": "0.001", "maxQty": "100", "stepSize": "0.001"},
                {"filterType": "MARKET_LOT_SIZE", "minQty": "0.01", "maxQty": "10", "stepSize": "0"},
                {"filterType": "MIN_NOTIONAL", "minNotional": "10", "applyToMarket": True, "avgPriceMins": 5},
                {"filterType": "NOTIONAL", "minNotional": "10", "maxNotional": "10000",
                 "applyMinToMarket": True, "applyMaxToMarket": False, "avgPriceMins": 5},
                {"filterType": "PERCENT_PRICE_BY_SIDE", "bidMultiplierUp": "1.2", "bidMultiplierDown": "0.8",
                 "askMultiplierUp": "1.3", "askMultiplierDown": "0.7", "avgPriceMins": 5},
                {"filterType": "MAX_POSITION", "maxPosition": "100"},
            ],
        }],
    }


def check(data=None, **kwargs):
    params = dict(symbol="BTCUSDT", side="BUY", order_type="LIMIT", quantity="0.100", price="100", time_in_force="GTC")
    params.update(kwargs)
    return validate_spot_order(metadata() if data is None else data, **params)


def test_limit_exact_decimal_report_without_rounding():
    result = check()
    assert result["static_validation_passed"] is True
    assert result["quantity"] == "0.100"
    assert result["limit_notional"] == "10.000"
    assert len(result["metadata_sha256"]) == 64
    assert result["order_placement"] is False and result["live_enabled"] is False
    assert "MAX_POSITION:account_state_required" in result["deferred_checks"]
    assert "PERCENT_PRICE_BY_SIDE:exchange_reference_price_required" in result["deferred_checks"]
    assert result["account_and_asset_filters_verified"] is False
    assert result["exchange_validation_required"] is True
    assert check()["metadata_sha256"] == result["metadata_sha256"]


@pytest.mark.parametrize("field,value,reason", [
    ("quantity", "0.0001", "quantity_below_minimum"),
    ("quantity", "101", "quantity_above_maximum"),
    ("quantity", "0.1001", "quantity_invalid_increment"),
    ("price", "0.001", "price_below_minimum"),
    ("price", "1000001", "price_above_maximum"),
    ("price", "100.001", "price_invalid_increment"),
    ("price", "99", "notional_below_minimum"),
    ("price", "1000000", "notional_above_maximum"),
    ("symbol", "ETHUSDT", "symbol_metadata_mismatch"),
    ("symbol", "BTCUSDT&evil=1", "invalid_spot_symbol"),
    ("side", "LONG", "invalid_spot_order_parameters"),
    ("order_type", "STOP_LOSS", "invalid_spot_order_parameters"),
    ("time_in_force", "invalid", "limit_requires"),
    ("price", None, "limit_requires"),
])
def test_rejected_before_exchange(field, value, reason):
    with pytest.raises(SpotFilterError, match=reason):
        check(**{field: value})


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-1", "0", "1e-3", "1;rm", "", True, 1, "9" * 25])
def test_reject_invalid_order_numbers(value):
    with pytest.raises(SpotFilterError):
        check(quantity=value)


@pytest.mark.parametrize("mutation,reason", [
    (lambda x: x.update(symbols=[]), "ambiguous_symbol_metadata"),
    (lambda x: x["symbols"].append(deepcopy(x["symbols"][0])), "ambiguous_symbol_metadata"),
    (lambda x: x["symbols"][0].update(status="HALT"), "spot_symbol_not_trading"),
    (lambda x: x["symbols"][0].update(isSpotTradingAllowed="true"), "spot_symbol_not_trading"),
    (lambda x: x["symbols"][0].update(orderTypes=["MARKET"]), "unsupported_symbol_order_type"),
    (lambda x: x["symbols"][0].update(filters=[]), "required_static_filters_missing"),
    (lambda x: x["symbols"][0]["filters"].append({"filterType": "FUTURE_UNKNOWN"}), "unsupported_filter_type"),
    (lambda x: x["symbols"][0]["filters"].append({"filterType": []}), "unsupported_filter_type"),
    (lambda x: x["symbols"][0]["filters"].append(deepcopy(x["symbols"][0]["filters"][0])), "duplicate_filter_type"),
    (lambda x: x["symbols"][0]["filters"][0].update(tickSize="NaN"), "invalid_filter_number"),
    (lambda x: x["symbols"][0]["filters"][1].update(minQty="200"), "invalid_filter_range"),
    (lambda x: x["symbols"][0]["filters"][3].update(applyToMarket="false"), "invalid_filter_boolean"),
    (lambda x: x["symbols"][0]["filters"][3].update(avgPriceMins=True), "invalid_filter_integer"),
    (lambda x: x["symbols"][0]["filters"][5].update(bidMultiplierDown="2"), "invalid_filter_range"),
    (lambda x: x.update(exchangeFilters=[{"filterType": "NEW_EXCHANGE_FILTER"}]), "unsupported_filter_type"),
    (lambda x: x["symbols"][0]["filters"].append({"filterType": "MAX_NUM_ORDERS"}), "invalid_filter_integer"),
    (lambda x: x.update(exchangeFilters=[{"filterType": "EXCHANGE_MAX_NUM_ORDERS", "maxNumOrders": "25"}]), "invalid_filter_integer"),
])
def test_metadata_fail_closed(mutation, reason):
    data = metadata()
    mutation(data)
    with pytest.raises(SpotFilterError, match=reason):
        check(data)


def test_market_has_no_client_price_or_invented_notional():
    result = check(order_type="MARKET", price=None, time_in_force=None, quantity="0.01")
    assert result["limit_notional"] is None
    assert "MARKET_LOT_SIZE" in result["checked_filters"]
    assert "MIN_NOTIONAL:exchange_reference_price_required" in result["deferred_checks"]
    with pytest.raises(SpotFilterError, match="market_quantity_below_minimum"):
        check(order_type="MARKET", price=None, time_in_force=None, quantity="0.001")
    with pytest.raises(SpotFilterError, match="market_disallows"):
        check(order_type="MARKET")


def test_disabled_zero_bounds_and_exact_modulo_under_low_global_precision():
    data = metadata()
    rule = data["symbols"][0]["filters"][0]
    rule.update(minPrice="0", maxPrice="0", tickSize="0")
    old = getcontext().prec
    try:
        getcontext().prec = 3
        result = check(data, price="100.12345678901234567890")
        assert result["limit_notional"] == "10.01234567890123456789000"
        assert getcontext().prec == 3
    finally:
        getcontext().prec = old


def test_metadata_fingerprint_changes_with_rules_and_sell_defers_no_position():
    first = check()
    data = metadata()
    data["symbols"][0]["filters"][0]["tickSize"] = "0.1"
    second = check(data, side="SELL")
    assert first["metadata_sha256"] != second["metadata_sha256"]
    assert "MAX_POSITION:account_state_required" not in second["deferred_checks"]


def test_static_violation_never_reaches_signed_validation(monkeypatch):
    client = BinanceSpotClient(BinanceSpotConfig("fake-key", "fake-secret"))
    calls = []
    def transport(method, path, params=None, *, signed=False):
        calls.append((method, path, signed))
        return metadata()
    monkeypatch.setattr(client, "_request", transport)
    with pytest.raises(SpotFilterError, match="invalid_increment"):
        client.order_test(symbol="BTCUSDT", side="BUY", order_type="LIMIT",
                          quantity="0.1001", price="100", time_in_force="GTC")
    assert calls == [("GET", "/api/v3/exchangeInfo", False)]


def _account_snapshot(*, quote_free="1000", base_free="0", base_locked="0", can_trade=True):
    return {
        "canTrade": can_trade,
        "permissions": ["SPOT"],
        "balances": [
            {"asset": "USDT", "free": quote_free, "locked": "0"},
            {"asset": "BTC", "free": base_free, "locked": base_locked},
        ],
    }


def test_account_and_reference_preflight_resolves_dynamic_buy_filters():
    result = validate_spot_order_with_account(
        metadata(), _account_snapshot(), [], {"price": "100", "mins": 5, "closeTime": 1_000_000},
        symbol="BTCUSDT", side="BUY", order_type="LIMIT", quantity="0.1",
        price="100", time_in_force="GTC", now_ms=1_000_001,
    )
    assert result["deferred_checks"] == []
    assert result["account_and_asset_filters_verified"] is True
    assert result["reference_price"] == "100"
    assert result["required_quote_with_fee_buffer"] == "10.100"
    assert result["base_position_including_open_buys"] == "0"


@pytest.mark.parametrize("kwargs,reason", [
    ({"average_price": {"price": "100", "mins": 5, "closeTime": 900_000}, "now_ms": 1_000_001}, "stale_exchange_reference_price"),
    ({"average_price": {"price": "1000", "mins": 5, "closeTime": 1_000_000}, "now_ms": 1_000_001}, "price_outside_reference_band"),
    ({"average_price": {"price": "100", "mins": 1, "closeTime": 1_000_000}, "now_ms": 1_000_001}, "reference_price_window_mismatch"),
    ({"account": _account_snapshot(quote_free="10")}, "insufficient_free_quote_balance"),
    ({"account": _account_snapshot(base_free="99.95")}, "max_position_exceeded"),
    ({"account": _account_snapshot(can_trade=False)}, "spot_account_cannot_trade"),
])
def test_account_and_reference_preflight_fails_closed(kwargs, reason):
    values = {
        "metadata": metadata(), "account": _account_snapshot(), "open_orders": [],
        "average_price": {"price": "100", "mins": 5, "closeTime": 1_000_000},
        "symbol": "BTCUSDT", "side": "BUY", "order_type": "LIMIT",
        "quantity": "0.1", "price": "100", "time_in_force": "GTC",
        "now_ms": 1_000_001,
    }
    values.update(kwargs)
    with pytest.raises(SpotFilterError, match=reason):
        validate_spot_order_with_account(**values)


def test_kill_during_metadata_fetch_blocks_signed_validation(monkeypatch):
    client = BinanceSpotClient(BinanceSpotConfig("fake-key", "fake-secret"))
    calls = []
    def transport(method, path, params=None, *, signed=False):
        calls.append((method, path, signed))
        set_kill_switch(True, "test")
        return metadata()
    monkeypatch.setattr(client, "_request", transport)
    with pytest.raises(BinanceAPIError, match="kill_switch"):
        client.order_test(symbol="BTCUSDT", side="BUY", order_type="LIMIT",
                          quantity="0.100", price="100", time_in_force="GTC")
    assert len(calls) == 1 and calls[0][2] is False


def test_preflight_no_credentials_signed_headers_or_post(monkeypatch):
    client = BinanceSpotClient(BinanceSpotConfig("", ""))
    calls = []
    def transport(method, path, params=None, *, signed=False):
        calls.append((method, path, params, signed))
        return metadata()
    monkeypatch.setattr(client, "_request", transport)
    assert client.order_preflight(symbol="BTCUSDT", side="BUY", order_type="LIMIT",
                                 quantity="0.1", price="100", time_in_force="GTC")["static_validation_passed"]
    assert calls == [("GET", "/api/v3/exchangeInfo", {"symbol": "BTCUSDT"}, False)]
    with pytest.raises(BinanceAPIError, match="missing_binance_credentials"):
        client.order_test(symbol="BTCUSDT", side="BUY", order_type="LIMIT",
                          quantity="0.1", price="100", time_in_force="GTC")
    assert len(calls) == 1
