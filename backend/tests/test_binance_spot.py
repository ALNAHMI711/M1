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
