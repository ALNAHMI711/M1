from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from .spot_filters import validate_spot_order, validate_spot_order_with_account, SpotFilterError
from dataclasses import dataclass
from typing import Any, Mapping

TESTNET_BASE_URL = "https://testnet.binance.vision"
LIVE_BASE_URL = "https://api.binance.com"


class BinanceAPIError(RuntimeError):
    """Raised when Binance returns an API or transport error."""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise BinanceAPIError("binance_redirect_blocked")


@dataclass(frozen=True)
class BinanceSpotConfig:
    api_key: str
    api_secret: str
    base_url: str = TESTNET_BASE_URL
    recv_window: int = 5000

    @classmethod
    def from_env(cls, *, testnet: bool = True) -> "BinanceSpotConfig":
        return cls(
            api_key=os.getenv("BINANCE_API_KEY", ""),
            api_secret=os.getenv("BINANCE_API_SECRET", ""),
            base_url=TESTNET_BASE_URL if testnet else LIVE_BASE_URL,
            recv_window=int(os.getenv("BINANCE_RECV_WINDOW", "5000")),
        )


class BinanceSpotClient:
    """Minimal official Binance Spot REST boundary.

    This client does not decide whether a trade is allowed. Callers must run
    the M1 risk gate before invoking signed trading methods.
    """

    def __init__(self, config: BinanceSpotConfig, *, opener=None):
        if config.base_url not in {TESTNET_BASE_URL, LIVE_BASE_URL}:
            raise ValueError("Binance endpoint must be an allowlisted HTTPS origin")
        if not 1 <= config.recv_window <= 60000:
            raise ValueError("invalid_recv_window")
        self.config = config
        self._opener = opener or urllib.request.build_opener(_NoRedirect()).open

    @property
    def execution_mode(self) -> str:
        return "TESTNET" if self.config.base_url == TESTNET_BASE_URL else "LIVE"

    def _request(
        self,
        method: str,
        path: str,
        params: Mapping[str, Any] | None = None,
        *,
        signed: bool = False,
    ) -> Any:
        allowed = {
            ("GET", "/api/v3/ping"), ("GET", "/api/v3/exchangeInfo"),
            ("GET", "/api/v3/account"), ("GET", "/api/v3/order"),
            ("GET", "/api/v3/openOrders"), ("GET", "/api/v3/avgPrice"),
            ("POST", "/api/v3/order/test"),
        }
        if os.getenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "false").lower() == "true":
            allowed.add(("POST", "/api/v3/order"))
        if (method.upper(), path) not in allowed:
            raise BinanceAPIError("exchange_operation_not_enabled")
        if method.upper() != "GET" and self.config.base_url != TESTNET_BASE_URL:
            raise BinanceAPIError("live_execution_not_enabled")
        values = dict(params or {})
        if signed:
            if not self.config.api_key or not self.config.api_secret:
                raise BinanceAPIError("missing_binance_credentials")
            values.setdefault("timestamp", int(time.time() * 1000))
            values.setdefault("recvWindow", self.config.recv_window)

        query = urllib.parse.urlencode(values, doseq=True)
        if signed:
            signature = hmac.new(
                self.config.api_secret.encode("utf-8"),
                query.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            query = f"{query}&signature={urllib.parse.quote(signature, safe='')}"

        url = f"{self.config.base_url.rstrip('/')}{path}"
        if query:
            url = f"{url}?{query}"

        request = urllib.request.Request(
            url,
            method=method.upper(),
            headers={
                "Accept": "application/json",
                **({"X-MBX-APIKEY": self.config.api_key} if signed else {}),
            },
        )
        try:
            with self._opener(request, timeout=10) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            try:
                payload = json.loads(exc.read().decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                payload = {"code": exc.code, "msg": "binance_http_error"}
            raise BinanceAPIError(json.dumps(payload, ensure_ascii=False)) from exc
        except (urllib.error.URLError, TimeoutError) as exc:
            raise BinanceAPIError("binance_transport_error") from exc
        except (ValueError, UnicodeDecodeError) as exc:
            raise BinanceAPIError("binance_invalid_response") from exc

        if isinstance(payload, dict) and "code" in payload and payload.get("code", 0) < 0:
            raise BinanceAPIError(json.dumps(payload, ensure_ascii=False))
        return payload

    def ping(self) -> Any:
        return self._request("GET", "/api/v3/ping")

    def exchange_info(self, symbol: str | None = None) -> Any:
        params = {"symbol": symbol} if symbol else None
        return self._request("GET", "/api/v3/exchangeInfo", params)

    def account(self) -> Any:
        return self._request("GET", "/api/v3/account", signed=True)

    def get_order(
        self,
        *,
        symbol: str,
        order_id: int | None = None,
        client_order_id: str | None = None,
    ) -> Any:
        if order_id is None and client_order_id is None:
            raise ValueError("order_id_or_client_order_id_required")
        params: dict[str, Any] = {"symbol": symbol.upper()}
        if order_id is not None:
            params["orderId"] = order_id
        else:
            params["origClientOrderId"] = client_order_id
        return self._request("GET", "/api/v3/order", params, signed=True)

    def open_orders(self, *, symbol: str | None = None) -> Any:
        params = {"symbol": symbol.upper()} if symbol else None
        return self._request("GET", "/api/v3/openOrders", params, signed=True)

    def average_price(self, *, symbol: str) -> Any:
        return self._request("GET", "/api/v3/avgPrice", {"symbol": symbol.upper()})

    def order_preflight(self, *, symbol: str, side: str, order_type: str,
                        quantity: str, price: str | None = None,
                        time_in_force: str | None = None) -> dict:
        if self.execution_mode != "TESTNET":
            raise BinanceAPIError("live_execution_not_enabled")
        # Validate shape before querying, never accepting URLs or external metadata
        # from the API caller. Fresh metadata is fetched from this Testnet origin.
        import re
        if not isinstance(symbol, str) or not re.fullmatch(r"[A-Z0-9]{3,20}", symbol):
            raise SpotFilterError("invalid_spot_symbol")
        return validate_spot_order(
            self.exchange_info(symbol), symbol=symbol, side=side,
            order_type=order_type, quantity=quantity, price=price,
            time_in_force=time_in_force,
        )

    def order_submission_preflight(
        self, *, symbol: str, side: str, order_type: str, quantity: str,
        price: str | None = None, time_in_force: str | None = None,
    ) -> dict:
        if self.execution_mode != "TESTNET":
            raise BinanceAPIError("live_execution_not_enabled")
        metadata = self.exchange_info(symbol)
        average = self.average_price(symbol=symbol)
        open_orders = self.open_orders()
        account = self.account()
        try:
            fee_buffer_bps = int(os.getenv("M1_TESTNET_FEE_BUFFER_BPS", "100"))
        except ValueError as exc:
            raise SpotFilterError("invalid_fee_buffer") from exc
        return validate_spot_order_with_account(
            metadata, account, open_orders, average, symbol=symbol, side=side,
            order_type=order_type, quantity=quantity, price=price,
            time_in_force=time_in_force, fee_buffer_bps=fee_buffer_bps,
        )

    def order_test(
        self,
        *,
        symbol: str,
        side: str,
        order_type: str,
        quantity: str,
        price: str | None = None,
        time_in_force: str | None = None,
        client_order_id: str | None = None,
    ) -> Any:
        from .operations import kill_switch_active
        if kill_switch_active():
            raise BinanceAPIError("kill_switch")
        if self.execution_mode != "TESTNET":
            raise BinanceAPIError("live_execution_not_enabled")
        if not self.config.api_key or not self.config.api_secret:
            raise BinanceAPIError("missing_binance_credentials")
        self.order_preflight(symbol=symbol, side=side, order_type=order_type,
                             quantity=quantity, price=price, time_in_force=time_in_force)
        if kill_switch_active():
            raise BinanceAPIError("kill_switch")
        params: dict[str, Any] = {
            "symbol": symbol.upper(),
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": quantity,
        }
        if price is not None:
            params["price"] = price
        if time_in_force is not None:
            params["timeInForce"] = time_in_force
        if client_order_id is not None:
            params["newClientOrderId"] = client_order_id
        return self._request("POST", "/api/v3/order/test", params, signed=True)

    def submit_testnet_order(
        self,
        *,
        symbol: str,
        side: str,
        order_type: str,
        quantity: str,
        client_order_id: str,
        price: str | None = None,
        time_in_force: str | None = None,
    ) -> Any:
        """Submit one real-to-Testnet order; disabled unless explicitly enabled.

        Callers must durably reserve and claim the idempotent intent and pass
        all application risk/authorization gates before invoking this method.
        This method never permits the LIVE endpoint.
        """
        from .operations import kill_switch_active

        if os.getenv("M1_TESTNET_ORDER_SUBMISSION_ENABLED", "false").lower() != "true":
            raise BinanceAPIError("testnet_order_submission_disabled")
        if self.execution_mode != "TESTNET":
            raise BinanceAPIError("testnet_client_required")
        if not self.config.api_key or not self.config.api_secret:
            raise BinanceAPIError("missing_binance_credentials")
        if not isinstance(client_order_id, str) or not client_order_id.strip():
            raise BinanceAPIError("client_order_id_required")
        if kill_switch_active():
            raise BinanceAPIError("kill_switch")
        report = self.order_submission_preflight(
            symbol=symbol, side=side, order_type=order_type, quantity=quantity,
            price=price, time_in_force=time_in_force,
        )
        if report.get("deferred_checks") or report.get("account_and_asset_filters_verified") is not True:
            raise BinanceAPIError("testnet_exchange_validation_incomplete")
        if kill_switch_active():
            raise BinanceAPIError("kill_switch")
        params: dict[str, Any] = {
            "symbol": symbol.upper(), "side": side.upper(), "type": order_type.upper(),
            "quantity": quantity, "newClientOrderId": client_order_id,
        }
        if price is not None:
            params["price"] = price
        if time_in_force is not None:
            params["timeInForce"] = time_in_force
        return self._request("POST", "/api/v3/order", params, signed=True)
