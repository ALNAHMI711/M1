"""Pure trade planning: position sizing, ATR stop check, TP1-TP7 ladder,
breakeven and trailing stops.

Nothing here talks to an exchange or the database. Every function is
deterministic so the same inputs always produce the same plan, which keeps
the risk math auditable and unit-testable.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_DOWN, Decimal

BPS = Decimal("10000")
HUNDRED = Decimal("100")
MAX_TARGETS = 7

DEFAULT_R_MULTIPLES: tuple[Decimal, ...] = tuple(
    Decimal(v) for v in ("1", "1.5", "2", "3", "4", "5", "6")
)
DEFAULT_ALLOCATIONS: tuple[Decimal, ...] = tuple(
    Decimal(v) for v in ("0.25", "0.2", "0.15", "0.15", "0.1", "0.1", "0.05")
)


def floor_to_step(value: Decimal, step: Decimal) -> Decimal:
    if step <= 0:
        raise ValueError("step_must_be_positive")
    steps = (value / step).to_integral_value(rounding=ROUND_DOWN)
    return (steps * step).quantize(step if step < 1 else Decimal("1"))


def _risk_per_unit(side: str, entry: Decimal, stop: Decimal) -> Decimal:
    return entry - stop if side == "BUY" else stop - entry


@dataclass(frozen=True)
class Sizing:
    quantity: Decimal
    notional: Decimal
    risk_amount: Decimal
    risk_pct: Decimal
    capped_by: str | None
    reasons: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.reasons


def size_position(
    *,
    side: str,
    equity: Decimal,
    risk_pct: Decimal,
    entry: Decimal,
    stop: Decimal,
    max_notional: Decimal,
    step_size: Decimal,
    min_qty: Decimal = Decimal("0"),
    min_notional: Decimal = Decimal("0"),
) -> Sizing:
    """Size so a stop-out loses at most ``risk_pct`` of equity.

    The result only ever rounds down, so neither the risk budget nor the
    notional cap can be exceeded by rounding.
    """
    zero = Decimal("0")
    if side not in {"BUY", "SELL"}:
        return Sizing(zero, zero, zero, zero, None, ("invalid_side",))
    if equity <= 0 or risk_pct <= 0 or entry <= 0 or step_size <= 0 or max_notional <= 0:
        return Sizing(zero, zero, zero, zero, None, ("invalid_sizing_inputs",))
    per_unit = _risk_per_unit(side, entry, stop)
    if per_unit <= 0:
        return Sizing(zero, zero, zero, zero, None, ("stop_on_wrong_side",))

    budget = equity * risk_pct / HUNDRED
    by_risk = budget / per_unit
    by_notional = max_notional / entry
    capped_by = "notional" if by_notional < by_risk else "risk"
    quantity = floor_to_step(min(by_risk, by_notional), step_size)

    notional = quantity * entry
    risk_amount = quantity * per_unit
    reasons: list[str] = []
    if quantity <= 0 or quantity < min_qty:
        reasons.append("quantity_below_minimum")
    if notional < min_notional:
        reasons.append("notional_below_minimum")
    return Sizing(
        quantity=quantity,
        notional=notional,
        risk_amount=risk_amount,
        risk_pct=risk_amount / equity * HUNDRED,
        capped_by=capped_by,
        reasons=tuple(reasons),
    )


def atr_stop_reasons(
    *,
    entry: Decimal,
    stop: Decimal,
    atr: Decimal | None,
    min_atr_multiple: Decimal = Decimal("0.5"),
    max_atr_multiple: Decimal = Decimal("4"),
) -> list[str]:
    """Reject stops inside normal noise or unreasonably wide for volatility."""
    if atr is None:
        return []
    if atr <= 0:
        return ["invalid_atr"]
    distance = abs(entry - stop)
    if distance < atr * min_atr_multiple:
        return ["stop_inside_atr_noise"]
    if distance > atr * max_atr_multiple:
        return ["stop_too_wide_for_atr"]
    return []


@dataclass(frozen=True)
class Target:
    index: int
    price: Decimal
    r_multiple: Decimal
    allocation: Decimal
    quantity: Decimal


@dataclass(frozen=True)
class Ladder:
    targets: tuple[Target, ...]
    weighted_reward_risk: Decimal
    reasons: tuple[str, ...]

    @property
    def ok(self) -> bool:
        return not self.reasons


def build_take_profit_ladder(
    *,
    side: str,
    entry: Decimal,
    stop: Decimal,
    quantity: Decimal,
    step_size: Decimal,
    min_qty: Decimal = Decimal("0"),
    r_multiples: tuple[Decimal, ...] = DEFAULT_R_MULTIPLES,
    allocations: tuple[Decimal, ...] = DEFAULT_ALLOCATIONS,
) -> Ladder:
    """Split ``quantity`` across up to seven R-multiple targets.

    A slice that rounds below ``min_qty`` carries forward into the next
    target, and the last target takes any rounding remainder, so the
    target quantities always add up exactly to ``quantity``.
    """
    reasons: list[str] = []
    if not 1 <= len(r_multiples) <= MAX_TARGETS:
        reasons.append("target_count_out_of_range")
    if len(r_multiples) != len(allocations):
        reasons.append("allocations_length_mismatch")
    if any(r <= 0 for r in r_multiples) or any(
        b <= a for a, b in zip(r_multiples, r_multiples[1:])
    ):
        reasons.append("r_multiples_must_increase")
    if any(a <= 0 for a in allocations) or sum(allocations, Decimal("0")) != 1:
        reasons.append("allocations_must_sum_to_one")
    per_unit = _risk_per_unit(side, entry, stop)
    if per_unit <= 0:
        reasons.append("stop_on_wrong_side")
    if quantity <= 0:
        reasons.append("quantity_not_positive")
    if reasons:
        return Ladder((), Decimal("0"), tuple(reasons))

    direction = Decimal("1") if side == "BUY" else Decimal("-1")
    targets: list[Target] = []
    assigned = Decimal("0")
    carry = Decimal("0")
    last = len(r_multiples) - 1
    for i, (r, allocation) in enumerate(zip(r_multiples, allocations)):
        if i == last:
            slice_qty = quantity - assigned
        else:
            slice_qty = floor_to_step(quantity * allocation + carry, step_size)
            if slice_qty < min_qty or slice_qty <= 0:
                carry += quantity * allocation
                continue
            carry = Decimal("0")
        if slice_qty <= 0:
            continue
        assigned += slice_qty
        targets.append(
            Target(
                index=i + 1,
                price=entry + direction * per_unit * r,
                r_multiple=r,
                allocation=allocation,
                quantity=slice_qty,
            )
        )

    if any(t.price <= 0 for t in targets):
        return Ladder((), Decimal("0"), ("target_price_not_positive",))
    if targets and targets[-1].quantity < min_qty:
        reasons.append("final_target_below_minimum")

    weighted = sum((t.r_multiple * t.quantity for t in targets), Decimal("0")) / quantity
    return Ladder(tuple(targets), weighted, tuple(reasons))


def next_stop(
    *,
    side: str,
    entry: Decimal,
    current_stop: Decimal,
    price: Decimal,
    targets_hit: int,
    atr: Decimal | None = None,
    trail_atr_multiple: Decimal = Decimal("2"),
    breakeven_after: int = 1,
    trail_after: int = 2,
    fee_buffer_bps: Decimal = Decimal("10"),
) -> Decimal:
    """Ratchet the stop: breakeven after TP1, ATR trailing after TP2.

    The stop can only move toward the profit side and never past the
    current price, so a stop update can never widen risk or trigger an
    immediate fill.
    """
    candidate = current_stop
    if targets_hit >= breakeven_after:
        buffer = entry * fee_buffer_bps / BPS
        breakeven = entry + buffer if side == "BUY" else entry - buffer
        candidate = _tighter(side, candidate, breakeven)
    if targets_hit >= trail_after and atr is not None and atr > 0:
        trail = price - atr * trail_atr_multiple if side == "BUY" else price + atr * trail_atr_multiple
        candidate = _tighter(side, candidate, trail)

    crosses_price = candidate >= price if side == "BUY" else candidate <= price
    return current_stop if crosses_price else candidate


def _tighter(side: str, a: Decimal, b: Decimal) -> Decimal:
    return max(a, b) if side == "BUY" else min(a, b)
