from decimal import Decimal

from app.risk_gate import RiskInput, evaluate_trade_risk


def _risk(**overrides):
    values = {
        "score": 90,
        "reward_risk": Decimal("2.5"),
        "spread_bps": Decimal("5"),
        "estimated_slippage_bps": Decimal("5"),
        "daily_loss_pct": Decimal("1"),
        "max_daily_loss_pct": Decimal("5"),
        "open_risk_pct": Decimal("1"),
        "max_open_risk_pct": Decimal("3"),
        "notional": Decimal("100"),
        "max_notional": Decimal("1000"),
    }
    values.update(overrides)
    return RiskInput(**values)


def test_risk_gate_allows_valid_trade():
    decision = evaluate_trade_risk(_risk())
    assert decision.allowed is True
    assert decision.reasons == ()


def test_risk_gate_hard_blocks_kill_switch():
    decision = evaluate_trade_risk(_risk(kill_switch=True))
    assert decision.allowed is False
    assert decision.reasons == ("kill_switch",)


def test_risk_gate_rejects_multiple_limits():
    decision = evaluate_trade_risk(
        _risk(
            score=80,
            reward_risk=Decimal("1.5"),
            spread_bps=Decimal("30"),
            estimated_slippage_bps=Decimal("30"),
            daily_loss_pct=Decimal("5"),
            open_risk_pct=Decimal("4"),
            notional=Decimal("1200"),
        )
    )
    assert decision.allowed is False
    assert decision.reasons == (
        "score_below_threshold",
        "reward_risk_below_threshold",
        "spread_above_limit",
        "slippage_above_limit",
        "daily_loss_limit",
        "open_risk_limit",
        "notional_limit",
    )


def test_risk_gate_uses_strict_thresholds():
    decision = evaluate_trade_risk(
        _risk(score=85, reward_risk=Decimal("2"))
    )
    assert decision.allowed is True
