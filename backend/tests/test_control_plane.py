import hashlib
import hmac
import json

import pytest
from fastapi.testclient import TestClient

from app.main import Signal, app, calculated_rr, risk_check, valid_signature
from app.telegram import parse_telegram_signal


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db = tmp_path / "signals.sqlite3"
    monkeypatch.setenv("M1_DB_PATH", str(db))
    return TestClient(app)


def test_calculated_rr_long():
    signal = Signal(
        symbol="BTCUSDT", side="LONG", entry=100, stop_loss=90,
        take_profit=120, score=90, rr=2, source="MANUAL", signal_id="test-long-01"
    )
    assert calculated_rr(signal) == 2


def test_risk_rejects_low_score():
    signal = Signal(
        symbol="BTCUSDT", side="LONG", entry=100, stop_loss=90,
        take_profit=120, score=84, rr=2, source="MANUAL", signal_id="test-score-01"
    )
    accepted, reasons = risk_check(signal)
    assert not accepted
    assert "score_below_85" in reasons


def test_risk_rejects_live():
    signal = Signal(
        symbol="BTCUSDT", side="LONG", entry=100, stop_loss=90,
        take_profit=120, score=90, rr=2, source="MANUAL",
        mode="LIVE", signal_id="test-live-01"
    )
    accepted, reasons = risk_check(signal)
    assert not accepted
    assert "live_execution_not_implemented" in reasons


def test_telegram_parser_arabic():
    parsed = parse_telegram_signal(
        "BTCUSDT شراء ENTRY: 100 SL: 90 TP1: 120 SCORE: 92 RR: 2"
    )
    assert parsed.symbol == "BTCUSDT"
    assert parsed.side == "LONG"
    assert parsed.entry == 100
    assert parsed.stop_loss == 90
    assert parsed.take_profit == 120
    assert parsed.score == 92
    assert parsed.rr == 2


def test_telegram_parser_rejects_missing_field():
    with pytest.raises(ValueError):
        parse_telegram_signal("BTCUSDT LONG ENTRY: 100 SL: 90 TP1: 120")


def test_signature():
    raw = b'{"signal_id":"signature-01"}'
    secret = "test-secret"
    signature = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    import app.main as main
    old = main.WEBHOOK_SECRET
    main.WEBHOOK_SECRET = secret
    try:
        assert valid_signature(raw, signature)
        assert not valid_signature(raw, "bad")
    finally:
        main.WEBHOOK_SECRET = old


def test_webhook_accepts_and_rejects_duplicate(client):
    import app.main as main
    old = main.WEBHOOK_SECRET
    main.WEBHOOK_SECRET = "webhook-secret"
    try:
        payload = {
            "symbol": "BTCUSDT",
            "side": "LONG",
            "entry": 100,
            "stop_loss": 90,
            "take_profit": 120,
            "score": 92,
            "rr": 2,
            "source": "TRADINGVIEW",
            "mode": "PAPER",
            "signal_id": "webhook-unique-01",
        }
        raw = json.dumps(payload, separators=(",", ":")).encode()
        signature = hmac.new(b"webhook-secret", raw, hashlib.sha256).hexdigest()
        first = client.post(
            "/v1/webhooks/tradingview", content=raw, headers={"x-signature": signature}
        )
        assert first.status_code == 200
        assert first.json()["accepted"] is True
        second = client.post(
            "/v1/webhooks/tradingview", content=raw, headers={"x-signature": signature}
        )
        assert second.status_code == 409
    finally:
        main.WEBHOOK_SECRET = old


def test_validate_endpoint_rejects_bad_rr(client):
    payload = {
        "symbol": "BTCUSDT", "side": "LONG", "entry": 100,
        "stop_loss": 95, "take_profit": 105, "score": 90, "rr": 1,
        "source": "MANUAL", "mode": "PAPER", "signal_id": "validate-rr-01",
    }
    response = client.post("/v1/signals/validate", json=payload)
    assert response.status_code == 200
    assert response.json()["accepted"] is False
    assert "rr_below_2" in response.json()["reasons"]


def test_telegram_endpoint_runs_risk_gate(client):
    response = client.post(
        "/v1/signals/telegram/parse",
        params={"text": "BTCUSDT LONG ENTRY: 100 SL: 90 TP1: 120 SCORE: 92 RR: 2"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["signal"]["source"] == "TELEGRAM"
