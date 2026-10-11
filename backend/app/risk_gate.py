from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class RiskInput:
    score: int
    reward_risk: Decimal
    spread_bps: Decimal
    estimated_slippage_bps: Decimal
    daily_loss_pct: Decimal
    max_daily_loss_pct: Decimal
    open_risk_pct: Decimal
    max_open_risk_pct: Decimal
    notional: Decimal
    max_notional: Decimal
    kill_switch: bool = False


@dataclass(frozen=True)
class RiskDecision:
    allowed: bool
    reasons: tuple[str, ...]


_NUMERIC_FIELDS = (
    "reward_risk",
    "spread_bps",
    "estimated_slippage_bps",
    "daily_loss_pct",
    "max_daily_loss_pct",
    "open_risk_pct",
    "max_open_risk_pct",
    "notional",
    "max_notional",
)


def evaluate_trade_risk(
    risk: RiskInput,
    *,
    min_score: int = 85,
    min_reward_risk: Decimal = Decimal("2"),
    max_spread_bps: Decimal = Decimal("20"),
    max_slippage_bps: Decimal = Decimal("20"),
) -> RiskDecision:
    """Fail-closed, pure pre-execution risk gate."""
    if not isinstance(risk, RiskInput):
        return RiskDecision(False, ("invalid_risk_input",))

    reasons: list[str] = []
    invalid = False
    if not isinstance(risk.kill_switch, bool):
        reasons.append("invalid_kill_switch")
        invalid = True
    elif risk.kill_switch:
        reasons.append("kill_switch")

    if (
        isinstance(risk.score, bool)
        or not isinstance(risk.score, int)
        or not 0 <= risk.score <= 100
    ):
        reasons.append("invalid_score")
        invalid = True

    for field in _NUMERIC_FIELDS:
        value = getattr(risk, field)
        if not isinstance(value, Decimal) or not value.is_finite():
            reasons.append(f"invalid_{field}")
            invalid = True

    thresholds = {
        "min_reward_risk": min_reward_risk,
        "max_spread_bps": max_spread_bps,
        "max_slippage_bps": max_slippage_bps,
    }
    for field, value in thresholds.items():
        if not isinstance(value, Decimal) or not value.is_finite() or value < 0:
            reasons.append(f"invalid_{field}")
            invalid = True

    if isinstance(min_score, bool) or not isinstance(min_score, int) or not 0 <= min_score <= 100:
        reasons.append("invalid_min_score")
        invalid = True

    if invalid:
        return RiskDecision(False, tuple(reasons))

    if risk.score < min_score:
        reasons.append("score_below_threshold")
    if risk.reward_risk < 0:
        reasons.append("invalid_reward_risk")
    elif risk.reward_risk < min_reward_risk:
        reasons.append("reward_risk_below_threshold")
    if risk.spread_bps < 0:
        reasons.append("invalid_spread")
    elif risk.spread_bps > max_spread_bps:
        reasons.append("spread_above_limit")
    if risk.estimated_slippage_bps < 0:
        reasons.append("invalid_slippage")
    elif risk.estimated_slippage_bps > max_slippage_bps:
        reasons.append("slippage_above_limit")
    if risk.daily_loss_pct < 0 or risk.max_daily_loss_pct <= 0:
        reasons.append("invalid_daily_loss_limit")
    elif risk.daily_loss_pct >= risk.max_daily_loss_pct:
        reasons.append("daily_loss_limit")
    if risk.open_risk_pct < 0 or risk.max_open_risk_pct < 0:
        reasons.append("invalid_open_risk_limit")
    elif risk.open_risk_pct > risk.max_open_risk_pct:
        reasons.append("open_risk_limit")
    if risk.notional <= 0 or risk.max_notional <= 0:
        reasons.append("invalid_notional_limit")
    elif risk.notional > risk.max_notional:
        reasons.append("notional_limit")

    return RiskDecision(allowed=not reasons, reasons=tuple(reasons))
