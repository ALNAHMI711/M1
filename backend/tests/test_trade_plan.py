from decimal import Decimal as D

import pytest
from fastapi.testclient import TestClient
from pwdlib import PasswordHash

import app.main as main
from app.trade_plan import (
    atr_stop_reasons,
    build_take_profit_ladder,
    floor_to_step,
    next_stop,
    size_position,
)


def sizing(**overrides):
    params = dict(
        side="BUY",
        equity=D("10000"),
        risk_pct=D("1"),
        entry=D("100"),
        stop=D("95"),
        max_notional=D("100000"),
        step_size=D("0.001"),
    )
    params.update(overrides)
    return size_position(**params)


def test_floor_to_step_never_rounds_up():
    assert floor_to_step(D("1.23456"), D("0.01")) == D("1.23")
    with pytest.raises(ValueError):
        floor_to_step(D("1"), D("0"))


def test_size_by_risk_budget():
    result = sizing()
    assert result.ok
    assert result.quantity == D("20.000")
    assert result.risk_amount == D("100")
    assert result.capped_by == "risk"


def test_size_capped_by_notional_never_exceeds_cap():
    result = sizing(max_notional=D("500"))
    assert result.capped_by == "notional"
    assert result.notional <= D("500")
    assert result.risk_pct < D("1")


def test_short_sizing_uses_stop_above_entry():
    result = sizing(side="SELL", stop=D("105"))
    assert result.ok and result.quantity == D("20.000")


@pytest.mark.parametrize(
    "overrides,reason",
    [
        ({"stop": D("101")}, "stop_on_wrong_side"),
        ({"side": "SELL", "stop": D("95")}, "stop_on_wrong_side"),
        ({"side": "HOLD"}, "invalid_side"),
        ({"equity": D("0")}, "invalid_sizing_inputs"),
        ({"min_qty": D("50")}, "quantity_below_minimum"),
        ({"max_notional": D("5"), "min_notional": D("10")}, "notional_below_minimum"),
    ],
)
def test_sizing_rejections(overrides, reason):
    assert reason in sizing(**overrides).reasons


def test_rounding_keeps_risk_within_budget():
    result = sizing(stop=D("97"), step_size=D("1"))
    assert result.quantity == D("33")
    assert result.risk_amount <= D("100")


def test_atr_stop_checks():
    assert atr_stop_reasons(entry=D("100"), stop=D("99.8"), atr=D("1")) == ["stop_inside_atr_noise"]
    assert atr_stop_reasons(entry=D("100"), stop=D("90"), atr=D("1")) == ["stop_too_wide_for_atr"]
    assert atr_stop_reasons(entry=D("100"), stop=D("98"), atr=D("1")) == []
    assert atr_stop_reasons(entry=D("100"), stop=D("98"), atr=None) == []
    assert atr_stop_reasons(entry=D("100"), stop=D("98"), atr=D("0")) == ["invalid_atr"]


def test_default_ladder_has_seven_targets_and_exact_quantity():
    ladder = build_take_profit_ladder(
        side="BUY", entry=D("100"), stop=D("95"), quantity=D("20"), step_size=D("0.001")
    )
    assert ladder.ok
    assert [t.index for t in ladder.targets] == [1, 2, 3, 4, 5, 6, 7]
    assert sum(t.quantity for t in ladder.targets) == D("20")
    assert ladder.targets[0].price == D("105")
    assert ladder.targets[-1].price == D("130")
    assert ladder.weighted_reward_risk == D("2.5")


def test_short_ladder_targets_descend():
    ladder = build_take_profit_ladder(
        side="SELL", entry=D("100"), stop=D("105"), quantity=D("10"), step_size=D("0.01")
    )
    prices = [t.price for t in ladder.targets]
    assert prices == sorted(prices, reverse=True)
    assert prices[0] == D("95")


def test_small_slices_carry_forward_and_total_is_exact():
    ladder = build_take_profit_ladder(
        side="BUY",
        entry=D("100"),
        stop=D("95"),
        quantity=D("3"),
        step_size=D("1"),
        min_qty=D("1"),
    )
    assert ladder.ok
    assert sum(t.quantity for t in ladder.targets) == D("3")
    assert all(t.quantity >= 1 for t in ladder.targets)
    assert len(ladder.targets) < 7


def test_short_target_price_cannot_go_negative():
    ladder = build_take_profit_ladder(
        side="SELL", entry=D("10"), stop=D("15"), quantity=D("1"), step_size=D("0.1")
    )
    assert ladder.reasons == ("target_price_not_positive",)


@pytest.mark.parametrize(
    "r,a,reason",
    [
        ((D("2"), D("1")), (D("0.5"), D("0.5")), "r_multiples_must_increase"),
        ((D("1"), D("2")), (D("0.5"), D("0.4")), "allocations_must_sum_to_one"),
        ((D("1"),), (D("0.5"), D("0.5")), "allocations_length_mismatch"),
        (tuple(D(i) for i in range(1, 9)), tuple([D("0.125")] * 8), "target_count_out_of_range"),
    ],
)
def test_ladder_validation(r, a, reason):
    ladder = build_take_profit_ladder(
        side="BUY",
        entry=D("100"),
        stop=D("95"),
        quantity=D("10"),
        step_size=D("0.01"),
        r_multiples=r,
        allocations=a,
    )
    assert reason in ladder.reasons
    assert ladder.targets == ()


def test_stop_unchanged_before_tp1():
    assert next_stop(
        side="BUY", entry=D("100"), current_stop=D("95"), price=D("104"), targets_hit=0
    ) == D("95")


def test_breakeven_after_tp1_includes_fee_buffer():
    stop = next_stop(
        side="BUY", entry=D("100"), current_stop=D("95"), price=D("105"), targets_hit=1
    )
    assert stop == D("100.1")
    short = next_stop(
        side="SELL", entry=D("100"), current_stop=D("105"), price=D("95"), targets_hit=1
    )
    assert short == D("99.9")


def test_trailing_after_tp2_ratchets_only_forward():
    stop = next_stop(
        side="BUY",
        entry=D("100"),
        current_stop=D("100.1"),
        price=D("110"),
        targets_hit=2,
        atr=D("2"),
    )
    assert stop == D("106")
    pullback = next_stop(
        side="BUY", entry=D("100"), current_stop=stop, price=D("107"), targets_hit=2, atr=D("2")
    )
    assert pullback == D("106")


def test_stop_never_crosses_current_price():
    stop = next_stop(
        side="BUY", entry=D("100"), current_stop=D("95"), price=D("100.05"), targets_hit=1
    )
    assert stop == D("95")


@pytest.fixture()
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("M1_DB_PATH", str(tmp_path / "m1.sqlite3"))
    monkeypatch.setenv("M1_AUTH_SECRET", "test-secret-for-trade-plan-0123456789abc")
    monkeypatch.setenv("M1_ADMIN_USERNAME", "admin")
    monkeypatch.setenv("M1_ADMIN_PASSWORD_HASH", PasswordHash.recommended().hash("correct-password"))
    monkeypatch.setenv("M1_ACCOUNT_EQUITY", "10000")
    monkeypatch.setenv("M1_MAX_NOTIONAL", "100000")
    return TestClient(main.app)


def headers(client):
    token = client.post(
        "/v1/auth/token", data={"username": "admin", "password": "correct-password"}
    ).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


PLAN = {"side": "LONG", "entry": "100", "stop_loss": "95", "risk_pct": "1", "step_size": "0.001"}


def test_plan_requires_auth(client):
    assert client.post("/v1/risk/plan", json=PLAN).status_code == 401


def test_plan_endpoint_returns_sized_ladder(client):
    body = client.post("/v1/risk/plan", json=PLAN, headers=headers(client)).json()
    assert body["accepted"] is True
    assert body["quantity"] == "20.000"
    assert len(body["targets"]) == 7
    assert body["weighted_reward_risk"] == "2.5000"


def test_plan_rejects_excessive_risk_pct(client):
    response = client.post(
        "/v1/risk/plan", json={**PLAN, "risk_pct": "5"}, headers=headers(client)
    )
    assert response.status_code == 422


def test_plan_flags_low_weighted_reward_risk(client):
    body = client.post(
        "/v1/risk/plan",
        json={**PLAN, "r_multiples": ["1", "1.5"], "allocations": ["0.5", "0.5"]},
        headers=headers(client),
    ).json()
    assert body["accepted"] is False
    assert "weighted_reward_risk_below_threshold" in body["reasons"]


def test_plan_requires_equity(client, monkeypatch):
    monkeypatch.delenv("M1_ACCOUNT_EQUITY")
    response = client.post("/v1/risk/plan", json=PLAN, headers=headers(client))
    assert response.status_code == 422
