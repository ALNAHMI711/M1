import hashlib
import hmac
import json
from urllib.parse import parse_qs, urlsplit

import pytest

from app.binance_spot import (
    TESTNET_BASE_URL,
    BinanceAPIError,
    BinanceSpotClient,
    BinanceSpotConfig,
)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


def test_public_requests_use_testnet_by_default():
    seen = {}

    def opener(request, timeout):
        seen["url"] = request.full_url
        seen["headers"] = dict(request.headers)
        return FakeResponse({})

    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="", api_secret=""), opener=opener
    )
    assert client.config.base_url == TESTNET_BASE_URL
    assert client.ping() == {}
    assert seen["url"] == f"{TESTNET_BASE_URL}/api/v3/ping"


def test_signed_request_uses_hmac_and_api_key():
    seen = {}

    def opener(request, timeout):
        seen["url"] = request.full_url
        seen["headers"] = dict(request.headers)
        if urlsplit(request.full_url).path == "/api/v3/exchangeInfo":
            from test_spot_filters import metadata
            return FakeResponse(metadata())
        return FakeResponse({"ok": True})

    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="test-key", api_secret="secret", recv_window=5000),
        opener=opener,
    )
    result = client.order_test(
        symbol="BTCUSDT",
        side="BUY",
        order_type="LIMIT",
        quantity="0.001",
        price="10000",
        time_in_force="GTC",
    )

    assert result == {"ok": True}
    assert seen["headers"]["X-mbx-apikey"] == "test-key"

    query = parse_qs(urlsplit(seen["url"]).query)
    payload = seen["url"].split("?", 1)[1].rsplit("&signature=", 1)[0]
    expected = hmac.new(b"secret", payload.encode(), hashlib.sha256).hexdigest()
    assert query["signature"] == [expected]
    assert query["symbol"] == ["BTCUSDT"]
    assert query["side"] == ["BUY"]
    assert query["type"] == ["LIMIT"]


def test_recovery_queries_are_signed_and_use_read_only_endpoints():
    seen = []

    def opener(request, timeout):
        seen.append(request)
        return FakeResponse({"status": "FILLED"})

    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="test-key", api_secret="secret"),
        opener=opener,
    )
    assert client.get_order(symbol="BTCUSDT", order_id=123) == {"status": "FILLED"}
    assert client.open_orders(symbol="BTCUSDT") == {"status": "FILLED"}

    assert urlsplit(seen[0].full_url).path == "/api/v3/order"
    assert parse_qs(urlsplit(seen[0].full_url).query)["orderId"] == ["123"]
    assert urlsplit(seen[1].full_url).path == "/api/v3/openOrders"
    assert parse_qs(urlsplit(seen[1].full_url).query)["symbol"] == ["BTCUSDT"]
    for request in seen:
        assert request.get_header("X-mbx-apikey") == "test-key"


def test_get_order_requires_an_identifier():
    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="k", api_secret="s"),
    )
    with pytest.raises(ValueError, match="order_id_or_client_order_id_required"):
        client.get_order(symbol="BTCUSDT")


def test_signed_request_requires_credentials():
    client = BinanceSpotClient(BinanceSpotConfig(api_key="", api_secret=""))
    with pytest.raises(BinanceAPIError, match="missing_binance_credentials"):
        client.account()


def test_live_endpoint_can_only_be_selected_explicitly():
    config = BinanceSpotConfig(api_key="k", api_secret="s", base_url="https://api.binance.com")
    assert config.base_url == "https://api.binance.com"


def test_real_testnet_order_submit_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", raising=False)
    calls = []
    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="key", api_secret="secret"),
        opener=lambda *args, **kwargs: calls.append(args),
    )
    with pytest.raises(BinanceAPIError, match="testnet_order_submission_disabled"):
        client.submit_testnet_order(
            symbol="BTCUSDT", side="BUY", order_type="LIMIT", quantity="0.001",
            price="100", time_in_force="GTC", client_order_id="test-order-001",
        )
    assert calls == []


def test_gated_testnet_submit_runs_preflight_then_signed_order(monkeypatch):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    monkeypatch.setattr("app.operations.kill_switch_active", lambda: False)
    seen = []

    def opener(request, timeout):
        seen.append(request)
        return FakeResponse({"symbol": "BTCUSDT", "orderId": 123, "status": "NEW", "executedQty": "0", "price": "100"})

    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="test-key", api_secret="secret"), opener=opener,
    )
    monkeypatch.setattr(client, "order_submission_preflight", lambda **kwargs: {
        "deferred_checks": [], "account_and_asset_filters_verified": True,
    })
    result = client.submit_testnet_order(
        symbol="BTCUSDT", side="BUY", order_type="LIMIT", quantity="0.1",
        price="100", time_in_force="GTC", client_order_id="test-order-001",
    )
    assert result["orderId"] == 123
    assert [urlsplit(request.full_url).path for request in seen] == ["/api/v3/order"]
    request = seen[0]
    query = parse_qs(urlsplit(request.full_url).query)
    signed_payload = request.full_url.split("?", 1)[1].rsplit("&signature=", 1)[0]
    expected = hmac.new(b"secret", signed_payload.encode(), hashlib.sha256).hexdigest()
    assert query["signature"] == [expected]
    assert query["newClientOrderId"] == ["test-order-001"]
    assert request.get_header("X-mbx-apikey") == "test-key"


def test_invalid_reference_price_blocks_testnet_submission_before_order_post(monkeypatch):
    monkeypatch.setenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "true")
    monkeypatch.setattr("app.operations.kill_switch_active", lambda: False)
    seen = []
    def opener(request, timeout):
        seen.append(request)
        from test_spot_filters import metadata
        return FakeResponse(metadata())
    client = BinanceSpotClient(
        BinanceSpotConfig(api_key="test-key", api_secret="secret"), opener=opener,
    )
    from app.spot_filters import SpotFilterError
    with pytest.raises(SpotFilterError, match="invalid_filter_number"):
        client.submit_testnet_order(
            symbol="BTCUSDT", side="BUY", order_type="LIMIT", quantity="0.1",
            price="100", time_in_force="GTC", client_order_id="blocked-order-001",
        )
    assert [urlsplit(request.full_url).path for request in seen] == [
        "/api/v3/exchangeInfo", "/api/v3/avgPrice",
        "/api/v3/openOrders", "/api/v3/account",
    ]


def test_submission_preflight_reads_fresh_reference_account_and_open_orders(monkeypatch):
    import time
    from test_spot_filters import metadata
    calls = []
    def transport(method, path, params=None, *, signed=False):
        calls.append((method, path, signed))
        if path == "/api/v3/exchangeInfo":
            return metadata()
        if path == "/api/v3/avgPrice":
            return {"price": "100", "mins": 5, "closeTime": int(time.time() * 1000)}
        if path == "/api/v3/account":
            return {
                "canTrade": True, "permissions": ["SPOT"],
                "balances": [
                    {"asset": "BTC", "free": "0", "locked": "0"},
                    {"asset": "USDT", "free": "1000", "locked": "0"},
                ],
            }
        if path == "/api/v3/openOrders":
            return []
        raise AssertionError(path)
    client = BinanceSpotClient(BinanceSpotConfig("test-key", "test-secret"))
    monkeypatch.setattr(client, "_request", transport)
    report = client.order_submission_preflight(
        symbol="BTCUSDT", side="BUY", order_type="LIMIT", quantity="0.1",
        price="100", time_in_force="GTC",
    )
    assert report["deferred_checks"] == []
    assert report["account_and_asset_filters_verified"] is True
    assert calls == [
        ("GET", "/api/v3/exchangeInfo", False),
        ("GET", "/api/v3/avgPrice", False),
        ("GET", "/api/v3/openOrders", True),
        ("GET", "/api/v3/account", True),
    ]
