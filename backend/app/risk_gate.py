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


def evaluate_trade_risk(
    risk: RiskInput,
    *,
    min_score: int = 85,
    min_reward_risk: Decimal = Decimal("2"),
    max_spread_bps: Decimal = Decimal("20"),
    max_slippage_bps: Decimal = Decimal("20"),
) -> RiskDecision:
    """Pure pre-execution risk gate.

    This gate can only reject a trade. It never submits, sizes around,
    or overrides an execution policy. Callers must treat a rejected
    decision as a hard stop before any exchange request.
    """
    reasons: list[str] = []

    if risk.kill_switch:
        reasons.append("kill_switch")
    if risk.score < min_score:
        reasons.append("score_below_threshold")
    if risk.reward_risk < min_reward_risk:
        reasons.append("reward_risk_below_threshold")
    if risk.spread_bps > max_spread_bps:
        reasons.append("spread_above_limit")
    if risk.estimated_slippage_bps > max_slippage_bps:
        reasons.append("slippage_above_limit")
    if risk.daily_loss_pct >= risk.max_daily_loss_pct:
        reasons.append("daily_loss_limit")
    if risk.open_risk_pct > risk.max_open_risk_pct:
        reasons.append("open_risk_limit")
    if risk.notional > risk.max_notional:
        reasons.append("notional_limit")

    return RiskDecision(allowed=not reasons, reasons=tuple(reasons))
