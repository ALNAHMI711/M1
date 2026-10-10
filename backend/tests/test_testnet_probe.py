import json

from app import testnet_probe
from app.binance_spot import BinanceAPIError
from test_spot_filters import metadata


def test_probe_public_only_no_credentials_or_orders(monkeypatch, capsys):
    calls = []
    def transport(self, method, path, params=None, *, signed=False):
        assert self.config.api_key == self.config.api_secret == ""
        calls.append((method, path, signed))
        return metadata()
    monkeypatch.setenv("BINANCE_API_SECRET", "must-not-use-or-print")
    monkeypatch.setattr(testnet_probe.BinanceSpotClient, "_request", transport)
    code = testnet_probe.main(["--symbol", "BTCUSDT", "--quantity", "0.1",
                              "--price", "100", "--time-in-force", "GTC"])
    assert code == 0
    text = capsys.readouterr().out
    assert json.loads(text)["order_placement"] is False
    assert "must-not-use-or-print" not in text
    assert calls == [("GET", "/api/v3/exchangeInfo", False)]


def test_probe_failure_redacts_upstream(monkeypatch, capsys):
    def unavailable(*args, **kwargs):
        raise BinanceAPIError("raw-secret-from-upstream")
    monkeypatch.setattr(testnet_probe.BinanceSpotClient, "order_preflight", unavailable)
    assert testnet_probe.main(["--symbol", "BTCUSDT", "--quantity", "0.1",
                              "--price", "100", "--time-in-force", "GTC"]) == 3
    text = capsys.readouterr().out
    assert "raw-secret" not in text
    assert json.loads(text)["reason"] == "testnet_metadata_unavailable"
