"""CI-only real-container check. Never target an external or production server."""
import json
import os
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

BASE = "http://127.0.0.1:8080"


def request(path, *, token=None, data=None, method="GET", expected=200, form=False):
    headers = {"Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None
    if data is not None:
        body = (urllib.parse.urlencode(data) if form else json.dumps(data)).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        response = urllib.request.urlopen(req, timeout=10)
    except urllib.error.HTTPError as exc:
        response = exc
    with response:
        assert response.status == expected, (path, response.status)
        text = response.read().decode()
        return json.loads(text) if "application/json" in response.headers.get("Content-Type", "") else text


def wait_ready():
    for _ in range(45):
        try:
            request("/ready")
            return
        except (AssertionError, OSError):
            time.sleep(1)
    raise RuntimeError("compose_backend_not_ready")


def main():
    if os.getenv("M1_COMPOSE_TEST") != "1":
        raise SystemExit("This harness is only for an isolated CI Compose stack, not production.")
    wait_ready()
    html = request("/")
    assert 'id="paper-panel"' in html
    assets = re.findall(r'(?:src|href)="(\./assets/[^"]+\.(?:js|css))"', html)
    assert len(assets) >= 2, "relative_production_assets_missing"
    for asset in assets:
        assert request("/" + asset.removeprefix("./"))
    token = request("/v1/auth/token", method="POST", form=True, data={
        "username": "ci-admin", "password": "ci-password-not-a-real-secret",
    })["access_token"]
    buy = {
        "mode": "PAPER", "client_order_id": "compose-buy-001", "symbol": "BTCUSDT",
        "side": "BUY", "quantity": "1", "price": "100", "stop_loss": "90",
        "take_profit": "125", "score": 90,
    }
    assert request("/v1/paper/orders", method="POST", token=token, data=buy)["status"] == "SIMULATED_FILLED"
    assert request("/v1/paper/orders", method="POST", token=token, data=buy)["replayed"]
    sell = {**buy, "side": "SELL", "price": "110", "client_order_id": "compose-sell-001"}
    request("/v1/paper/orders", method="POST", token=token, data=sell)
    subprocess.run(["docker", "compose", "restart", "backend"], check=True)
    wait_ready()
    account = request("/v1/paper/account", token=token)
    assert account["positions"] == []
    assert Decimal(account["cash"]) == Decimal("10009.79")
    assert Decimal(account["realized_pnl"]) == Decimal("9.79")
    assert "compose-buy-001" in request("/v1/paper/ledger.csv", token=token)
    request("/v1/control/kill-switch", method="PUT", token=token, data={"enabled": True})
    blocked = request("/v1/paper/orders", method="POST", token=token, data={
        **buy, "client_order_id": "compose-blocked-001",
    }, expected=423)
    assert blocked["detail"]["reason"] == "kill_switch"
    request("/v1/auth/logout", method="POST", token=token)
    subprocess.run(["docker", "compose", "restart", "backend"], check=True)
    wait_ready()
    assert request("/v1/auth/me", token=token, expected=401)
    print("Compose passed: assets, auth, simulated fills, fees/PnL, replay, CSV, restart persistence, kill switch, durable logout.")


if __name__ == "__main__":
    main()
