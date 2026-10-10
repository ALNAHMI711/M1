"""Durable cash-only simulated fills. No exchange imports or network transport.

Prices, spread, fees and slippage are explicit assumptions, not verified market
data or venue fills. Stops/targets are metadata; they do not trigger orders.
"""
from __future__ import annotations

import hashlib
import json
import os
import csv
import io
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt

from .operations import operational_connection
from .risk_gate import RiskInput, evaluate_trade_risk

Amount = Annotated[Decimal, Field(gt=0, max_digits=20, decimal_places=8, allow_inf_nan=False)]
Bps = Annotated[Decimal, Field(ge=0, max_digits=8, decimal_places=4, allow_inf_nan=False)]
ZERO, HUNDRED, BPS = Decimal(0), Decimal(100), Decimal(10000)


class PaperOrder(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    client_order_id: str = Field(min_length=8, max_length=64, pattern=r"^[A-Za-z0-9._:-]+$")
    symbol: str = Field(pattern=r"^[A-Z0-9]{2,16}USDT$")
    side: Literal["BUY", "SELL"]
    quantity: Amount
    price: Amount
    stop_loss: Amount | None = None
    take_profit: Amount | None = None
    score: Annotated[StrictInt, Field(ge=0, le=100)] = 90
    spread_bps: Bps = ZERO
    slippage_bps: Bps = ZERO
    mode: Literal["PAPER"] = "PAPER"


class PaperError(ValueError):
    def __init__(self, reason: str, status_code: int = 422):
        super().__init__(reason)
        self.reason, self.status_code = reason, status_code


def _number(name, default, maximum, *, zero=False):
    try:
        raw = os.getenv(name, default)
        if len(raw) > 64:
            raise ValueError
        value = Decimal(raw)
        if not value.is_finite() or value.as_tuple().exponent < -8 or value > Decimal(maximum) or (value < 0 if zero else value <= 0):
            raise ValueError
        return value
    except (ValueError, ArithmeticError):
        raise PaperError("invalid_paper_server_configuration", 503)


@dataclass(frozen=True)
class PaperPolicy:
    initial_cash: Decimal
    fee_bps: Decimal
    max_notional: Decimal
    max_trade_risk_pct: Decimal
    max_open_risk_pct: Decimal
    max_daily_loss_pct: Decimal

    @classmethod
    def from_env(cls):
        return cls(
            _number("M1_PAPER_INITIAL_CASH", "10000", "1000000"),
            _number("M1_PAPER_FEE_BPS", "10", "1000", zero=True),
            _number("M1_PAPER_MAX_NOTIONAL", "1000", "10000000"),
            _number("M1_PAPER_MAX_TRADE_RISK_PCT", "1", "100"),
            _number("M1_PAPER_MAX_OPEN_RISK_PCT", "3", "100"),
            _number("M1_PAPER_MAX_DAILY_LOSS_PCT", "5", "100"),
        )


def _text(number):
    # Do not round cash or quantities to floating-point values.
    return format(number, "f")


def _now():
    return datetime.now(timezone.utc)


def _schema(conn):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS paper_accounts (
            username TEXT PRIMARY KEY, initial_cash TEXT NOT NULL,
            cash TEXT NOT NULL, realized_pnl TEXT NOT NULL DEFAULT '0',
            fees_paid TEXT NOT NULL DEFAULT '0', created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS paper_positions (
            username TEXT NOT NULL REFERENCES paper_accounts(username),
            symbol TEXT NOT NULL, quantity TEXT NOT NULL, cost_basis TEXT NOT NULL,
            stop_loss TEXT NOT NULL, take_profit TEXT NOT NULL,
            PRIMARY KEY(username,symbol)
        );
        CREATE TABLE IF NOT EXISTS paper_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL REFERENCES paper_accounts(username),
            client_order_id TEXT NOT NULL, fingerprint TEXT NOT NULL,
            realized_pnl TEXT NOT NULL, created_at TEXT NOT NULL,
            response TEXT NOT NULL, UNIQUE(username,client_order_id)
        );
        CREATE INDEX IF NOT EXISTS idx_paper_orders_user_date
        ON paper_orders(username,created_at);
    """)


def _daily_loss(conn, username, now):
    rows = conn.execute(
        "SELECT realized_pnl FROM paper_orders WHERE username=? AND created_at>=?",
        (username, now.date().isoformat()),
    )
    # Gains must not erase already realized daily losses.
    return sum((max(ZERO, -Decimal(row["realized_pnl"])) for row in rows), ZERO)


def _snapshot(conn, username, policy, now):
    row = conn.execute("SELECT * FROM paper_accounts WHERE username=?", (username,)).fetchone()
    account = dict(row) if row else {
        "username": username, "initial_cash": _text(policy.initial_cash),
        "cash": _text(policy.initial_cash), "realized_pnl": "0", "fees_paid": "0",
    }
    positions = [dict(p) for p in conn.execute(
        "SELECT symbol,quantity,cost_basis,stop_loss,take_profit FROM paper_positions WHERE username=? ORDER BY symbol",
        (username,),
    )]
    for position in positions:
        position["average_cost"] = _text(Decimal(position["cost_basis"]) / Decimal(position["quantity"]))
    recent = [json.loads(o["response"]) for o in conn.execute(
        "SELECT response FROM paper_orders WHERE username=? ORDER BY id DESC LIMIT 20", (username,)
    )]
    return {
        **account, "mode": "PAPER", "live_enabled": False,
        "account_exists": row is not None, "quote_asset": "USDT",
        "positions": positions, "recent_orders": recent,
        "equity_at_cost": _text(Decimal(account["cash"]) + sum((Decimal(p["cost_basis"]) for p in positions), ZERO)),
        "daily_loss_pct": _text(_daily_loss(conn, username, now) / Decimal(account["initial_cash"]) * HUNDRED),
        "valuation": "cost_basis_not_mark_to_market",
        "fill_model": "instant_assumed_price_with_adverse_spread_and_slippage",
        "price_source": "user_assumption_not_exchange",
        "limits": {k: _text(v) for k, v in policy.__dict__.items()},
        "max_positions": 5, "automatic_stop_orders": False,
    }


def paper_account(username):
    policy = PaperPolicy.from_env()
    with localcontext() as context:
        context.prec = 50
        with operational_connection() as conn:
            _schema(conn)
            # A consistent read snapshot, even if another worker fills an order.
            conn.execute("BEGIN")
            return _snapshot(conn, username, policy, _now())


def paper_ledger_csv(username: str, limit: int = 1000) -> str:
    fields = [
        "created_at", "client_order_id", "symbol", "side", "quantity",
        "quoted_price", "fill_price", "fee", "realized_pnl", "cash_after",
        "mode", "status", "risk_gate", "price_source",
    ]
    numeric = {"quantity", "quoted_price", "fill_price", "fee", "realized_pnl", "cash_after"}
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fields, quoting=csv.QUOTE_ALL)
    writer.writeheader()
    with operational_connection() as conn:
        _schema(conn)
        conn.execute("BEGIN")
        rows = conn.execute(
            "SELECT response FROM paper_orders WHERE username=? ORDER BY id DESC LIMIT ?",
            (username, max(1, min(int(limit), 5000))),
        )
        for row in rows:
            response = json.loads(row["response"])
            safe = {}
            for field in fields:
                value = str(response.get(field, ""))
                # Preserve real numeric negatives, but neutralize spreadsheet
                # formulas in identifiers/text, even if local data is malformed.
                number = field in numeric and re.fullmatch(r"-?\d+(?:\.\d+)?", value)
                safe[field] = "'" + value if not number and value.startswith(("=", "+", "-", "@", "\t", "\r")) else value
            writer.writerow(safe)
    return output.getvalue()


def submit_paper_order(username: str, order: PaperOrder):
    # Revalidate even an internally constructed model. No caller-provided risk
    # decision or account limits are accepted at this execution boundary.
    order = PaperOrder.model_validate(order.model_dump(mode="json"))
    if order.symbol == "USDTUSDT":
        raise PaperError("invalid_paper_symbol")
    policy = PaperPolicy.from_env()
    canonical = order.model_dump(mode="json")
    for name, value in order.model_dump().items():
        if isinstance(value, Decimal):
            canonical[name] = format(value.normalize(), "f")
    fingerprint = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    with localcontext() as context:
        context.prec = 50
        with operational_connection() as conn:
            _schema(conn)
            conn.execute("BEGIN IMMEDIATE")
            previous = conn.execute(
                "SELECT fingerprint,response FROM paper_orders WHERE username=? AND client_order_id=?",
                (username, order.client_order_id),
            ).fetchone()
            if previous:
                if previous["fingerprint"] != fingerprint:
                    raise PaperError("paper_idempotency_conflict", 409)
                return {**json.loads(previous["response"]), "replayed": True}
            switch = conn.execute("SELECT value FROM operational_settings WHERE key='kill_switch'").fetchone()
            if switch and switch["value"] != "false":
                raise PaperError("kill_switch", 423)
            if order.spread_bps > 20 or order.slippage_bps > 20:
                raise PaperError("spread_or_slippage_above_limit")
            now = _now()
            conn.execute(
                "INSERT OR IGNORE INTO paper_accounts(username,initial_cash,cash,created_at) VALUES (?,?,?,?)",
                (username, _text(policy.initial_cash), _text(policy.initial_cash), now.isoformat()),
            )
            account = conn.execute("SELECT * FROM paper_accounts WHERE username=?", (username,)).fetchone()
            position = conn.execute(
                "SELECT * FROM paper_positions WHERE username=? AND symbol=?", (username, order.symbol),
            ).fetchone()
            cash, initial = Decimal(account["cash"]), Decimal(account["initial_cash"])
            held = Decimal(position["quantity"]) if position else ZERO
            basis = Decimal(position["cost_basis"]) if position else ZERO
            adverse_bps = order.slippage_bps + order.spread_bps / 2
            fill_price = order.price * (1 + (adverse_bps / BPS if order.side == "BUY" else -adverse_bps / BPS))
            gross = fill_price * order.quantity
            fee = gross * policy.fee_bps / BPS
            realized = ZERO
            if order.side == "BUY":
                if order.stop_loss is None or order.take_profit is None or not order.stop_loss < fill_price < order.take_profit:
                    raise PaperError("invalid_paper_risk_reward_levels")
                if position and (Decimal(position["stop_loss"]) != order.stop_loss or Decimal(position["take_profit"]) != order.take_profit):
                    raise PaperError("position_levels_mismatch")
                new_basis, new_quantity = basis + gross + fee, held + order.quantity
                other_positions = list(conn.execute(
                    "SELECT * FROM paper_positions WHERE username=? AND symbol<>?", (username, order.symbol),
                ))
                if not position and len(other_positions) >= 5:
                    raise PaperError("paper_position_count_limit")
                exit_fee_factor = 1 - policy.fee_bps / BPS
                # Planned stop/target at their quoted levels, with exit fees.
                # This is not a guaranteed stop fill or future spread estimate.
                order_risk = gross + fee - order.quantity * order.stop_loss * exit_fee_factor
                target_reward = order.quantity * order.take_profit * exit_fee_factor - gross - fee
                total_risk = max(ZERO, new_basis - new_quantity * order.stop_loss * exit_fee_factor) + sum(
                    (max(ZERO, Decimal(p["cost_basis"]) - Decimal(p["quantity"]) * Decimal(p["stop_loss"]) * exit_fee_factor) for p in other_positions),
                    ZERO,
                )
                risk = RiskInput(
                    score=order.score, reward_risk=target_reward / order_risk,
                    spread_bps=order.spread_bps, estimated_slippage_bps=order.slippage_bps,
                    daily_loss_pct=_daily_loss(conn, username, now) / initial * HUNDRED,
                    max_daily_loss_pct=policy.max_daily_loss_pct,
                    open_risk_pct=total_risk / initial * HUNDRED, max_open_risk_pct=policy.max_open_risk_pct,
                    notional=gross, max_notional=policy.max_notional,
                )
                decision = evaluate_trade_risk(risk)
                if not decision.allowed:
                    raise PaperError(",".join(decision.reasons))
                if order_risk / initial * HUNDRED > policy.max_trade_risk_pct:
                    raise PaperError("paper_trade_risk_limit")
                if gross + fee > cash:
                    raise PaperError("insufficient_paper_cash")
                cash -= gross + fee
                conn.execute(
                    """INSERT INTO paper_positions VALUES (?,?,?,?,?,?)
                       ON CONFLICT(username,symbol) DO UPDATE SET quantity=excluded.quantity,cost_basis=excluded.cost_basis""",
                    (username, order.symbol, _text(new_quantity), _text(new_basis), _text(order.stop_loss), _text(order.take_profit)),
                )
                gate = "full_entry_risk_gate"
            else:
                # Risk-reducing, cash-only exit. Never borrow or create a short.
                # Daily entry-loss limits must not prevent closing holdings.
                if order.quantity > held:
                    raise PaperError("insufficient_paper_position")
                sold_basis = basis if order.quantity == held else (basis * order.quantity / held).quantize(Decimal("1e-20"), rounding=ROUND_HALF_EVEN)
                cash += gross - fee
                realized = gross - fee - sold_basis
                if order.quantity == held:
                    conn.execute("DELETE FROM paper_positions WHERE username=? AND symbol=?", (username, order.symbol))
                else:
                    conn.execute(
                        "UPDATE paper_positions SET quantity=?,cost_basis=? WHERE username=? AND symbol=?",
                        (_text(held - order.quantity), _text(basis - sold_basis), username, order.symbol),
                    )
                gate = "reduce_only_exit_gate"
            conn.execute(
                "UPDATE paper_accounts SET cash=?,realized_pnl=?,fees_paid=? WHERE username=?",
                (_text(cash), _text(Decimal(account["realized_pnl"]) + realized),
                 _text(Decimal(account["fees_paid"]) + fee), username),
            )
            response = {
                "accepted": True, "mode": "PAPER", "live_enabled": False,
                "client_order_id": order.client_order_id, "symbol": order.symbol, "side": order.side,
                "quantity": _text(order.quantity), "quoted_price": _text(order.price), "fill_price": _text(fill_price),
                "notional": _text(gross), "fee": _text(fee), "realized_pnl": _text(realized),
                "cash_after": _text(cash), "fee_bps": _text(policy.fee_bps),
                "spread_bps": _text(order.spread_bps), "slippage_bps": _text(order.slippage_bps),
                "risk_gate": gate, "price_source": "user_assumption_not_exchange",
                "risk_model": "planned_stop_and_target_with_fees_no_guaranteed_exit",
                "status": "SIMULATED_FILLED", "created_at": now.isoformat(), "replayed": False,
            }
            conn.execute(
                "INSERT INTO paper_orders(username,client_order_id,fingerprint,realized_pnl,created_at,response) VALUES (?,?,?,?,?,?)",
                (username, order.client_order_id, fingerprint, _text(realized), now.isoformat(), json.dumps(response)),
            )
            conn.execute(
                """INSERT INTO execution_audit(client_order_id,event,status,detail,created_at)
                   VALUES (?,'PAPER_SIMULATION','SIMULATED_FILLED','no_exchange_order',?)""",
                (order.client_order_id, now.isoformat()),
            )
            return response
