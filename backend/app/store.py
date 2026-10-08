import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation


def database_path() -> str:
    return os.getenv("M1_DB_PATH", "backend/data/m1.sqlite3")


@contextmanager
def connection():
    path = database_path()
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute(
            """CREATE TABLE IF NOT EXISTS signal_events (
                signal_id TEXT PRIMARY KEY,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                source TEXT NOT NULL,
                mode TEXT NOT NULL,
                accepted INTEGER NOT NULL,
                reasons TEXT NOT NULL,
                created_at TEXT NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS execution_orders (
                client_order_id TEXT PRIMARY KEY,
                signal_id TEXT NOT NULL,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                mode TEXT NOT NULL,
                order_id TEXT,
                status TEXT NOT NULL,
                quantity TEXT NOT NULL,
                executed_quantity TEXT NOT NULL DEFAULT '0',
                price TEXT,
                last_event_time INTEGER,
                updated_at TEXT NOT NULL
            )"""
        )
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(execution_orders)").fetchall()
        }
        if "last_event_time" not in columns:
            conn.execute(
                "ALTER TABLE execution_orders ADD COLUMN last_event_time INTEGER"
            )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS execution_audit (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_order_id TEXT,
                signal_id TEXT,
                event TEXT NOT NULL,
                status TEXT NOT NULL,
                detail TEXT NOT NULL,
                created_at TEXT NOT NULL
            )"""
        )
        conn.execute(
            """CREATE TABLE IF NOT EXISTS risk_positions (
                client_order_id TEXT PRIMARY KEY,
                mode TEXT NOT NULL,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                quantity TEXT NOT NULL,
                reference_price TEXT NOT NULL,
                stop_loss TEXT NOT NULL,
                risk_amount TEXT NOT NULL,
                status TEXT NOT NULL,
                realized_pnl TEXT,
                opened_at TEXT NOT NULL,
                closed_at TEXT
            )"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_risk_positions_mode_status
               ON risk_positions(mode, status)"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_execution_orders_status
               ON execution_orders(status)"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_execution_audit_created_at
               ON execution_audit(created_at)"""
        )
        conn.commit()
        yield conn
        conn.commit()
    finally:
        conn.close()


def record_signal(signal_id, symbol, side, source, mode, accepted, reasons):
    with connection() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO signal_events
               (signal_id, symbol, side, source, mode, accepted, reasons, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                signal_id,
                symbol,
                side,
                source,
                mode,
                int(accepted),
                ",".join(reasons),
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def signal_seen(signal_id):
    with connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM signal_events WHERE signal_id = ?", (signal_id,)
        ).fetchone()
        return row is not None


def record_execution_order(
    *,
    client_order_id: str,
    signal_id: str,
    symbol: str,
    side: str,
    mode: str,
    quantity: str,
    status: str = "SUBMITTED",
    order_id: str | None = None,
    executed_quantity: str = "0",
    price: str | None = None,
    last_event_time: int | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """INSERT INTO execution_orders
               (client_order_id, signal_id, symbol, side, mode, order_id,
                status, quantity, executed_quantity, price, last_event_time, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(client_order_id) DO UPDATE SET
                 order_id=excluded.order_id,
                 status=excluded.status,
                 executed_quantity=excluded.executed_quantity,
                 price=excluded.price,
                 last_event_time=COALESCE(excluded.last_event_time, execution_orders.last_event_time),
                 updated_at=excluded.updated_at""",
            (
                client_order_id,
                signal_id,
                symbol,
                side,
                mode,
                order_id,
                status,
                quantity,
                executed_quantity,
                price,
                last_event_time,
                now,
            ),
        )


def execution_order_exists(client_order_id: str) -> bool:
    return get_execution_order(client_order_id) is not None


def get_execution_order(client_order_id: str):
    with connection() as conn:
        row = conn.execute(
            """SELECT client_order_id, signal_id, symbol, side, mode, order_id,
                      status, quantity, executed_quantity, price, last_event_time, updated_at
               FROM execution_orders
               WHERE client_order_id = ?""",
            (client_order_id,),
        ).fetchone()
        return dict(row) if row is not None else None


def pending_execution_orders():
    with connection() as conn:
        rows = conn.execute(
            """SELECT client_order_id, signal_id, symbol, side, mode, order_id,
                      status, quantity, executed_quantity, price, last_event_time, updated_at
               FROM execution_orders
               WHERE status NOT IN ('FILLED', 'CANCELED', 'EXPIRED', 'EXPIRED_IN_MATCH', 'REJECTED', 'UNKNOWN', 'SIMULATED')"""
        ).fetchall()
        return [dict(row) for row in rows]


def claim_execution_order(
    *,
    client_order_id: str,
    signal_id: str,
    symbol: str,
    side: str,
    mode: str,
    quantity: str,
    price: str | None = None,
    risk_amount: str | None = None,
    reference_price: str | None = None,
    stop_loss: str | None = None,
) -> bool:
    """Atomically reserve a client order id before any exchange call.

    Returns False when the id already exists, so a replayed signal can never
    reach the exchange twice. The PENDING_SUBMIT row stays pending for
    recovery if the process dies or the exchange outcome is unknown.

    When ``risk_amount`` is given, the trade's stop-loss risk is reserved in
    the same transaction, so concurrent claims cannot both pass the open-risk
    limit against a stale total.
    """
    now = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        cursor = conn.execute(
            """INSERT OR IGNORE INTO execution_orders
               (client_order_id, signal_id, symbol, side, mode, order_id,
                status, quantity, executed_quantity, price, last_event_time, updated_at)
               VALUES (?, ?, ?, ?, ?, NULL, 'PENDING_SUBMIT', ?, '0', ?, NULL, ?)""",
            (client_order_id, signal_id, symbol, side, mode, quantity, price, now),
        )
        claimed = cursor.rowcount == 1
        if claimed and risk_amount is not None:
            conn.execute(
                """INSERT INTO risk_positions
                   (client_order_id, mode, symbol, side, quantity, reference_price,
                    stop_loss, risk_amount, status, realized_pnl, opened_at, closed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', NULL, ?, NULL)""",
                (
                    client_order_id,
                    mode,
                    symbol,
                    side,
                    quantity,
                    reference_price or "0",
                    stop_loss or "0",
                    risk_amount,
                    now,
                ),
            )
        return claimed


NO_FILL_TERMINAL_STATUSES = frozenset(
    {"REJECTED", "CANCELED", "EXPIRED", "EXPIRED_IN_MATCH"}
)


def _is_zero(quantity: str | None) -> bool:
    try:
        return Decimal(quantity or "0") == 0
    except (InvalidOperation, ValueError):
        return False


def release_position_risk(client_order_id: str, conn=None) -> bool:
    """Free reserved risk for an order that never opened a position."""
    now = datetime.now(timezone.utc).isoformat()
    sql = """UPDATE risk_positions SET status = 'RELEASED', closed_at = ?
             WHERE client_order_id = ? AND status = 'OPEN'"""
    if conn is not None:
        return conn.execute(sql, (now, client_order_id)).rowcount == 1
    with connection() as own:
        return own.execute(sql, (now, client_order_id)).rowcount == 1


def close_position(client_order_id: str, realized_pnl: Decimal) -> bool:
    """Record a closed position's realized PnL; only OPEN positions close."""
    now = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        cursor = conn.execute(
            """UPDATE risk_positions
               SET status = 'CLOSED', realized_pnl = ?, closed_at = ?
               WHERE client_order_id = ? AND status = 'OPEN'""",
            (str(realized_pnl), now, client_order_id),
        )
        return cursor.rowcount == 1


def get_risk_position(client_order_id: str):
    with connection() as conn:
        row = conn.execute(
            "SELECT * FROM risk_positions WHERE client_order_id = ?",
            (client_order_id,),
        ).fetchone()
        return dict(row) if row is not None else None


def open_risk_positions(mode: str):
    with connection() as conn:
        rows = conn.execute(
            """SELECT * FROM risk_positions WHERE mode = ? AND status = 'OPEN'
               ORDER BY opened_at""",
            (mode,),
        ).fetchall()
        return [dict(row) for row in rows]


def risk_totals(mode: str, since_iso: str) -> tuple[Decimal, Decimal]:
    """Return (open risk amount, realized PnL closed since ``since_iso``)."""
    with connection() as conn:
        open_rows = conn.execute(
            "SELECT risk_amount FROM risk_positions WHERE mode = ? AND status = 'OPEN'",
            (mode,),
        ).fetchall()
        closed_rows = conn.execute(
            """SELECT realized_pnl FROM risk_positions
               WHERE mode = ? AND status = 'CLOSED' AND closed_at >= ?""",
            (mode, since_iso),
        ).fetchall()
    open_risk = sum((Decimal(row["risk_amount"]) for row in open_rows), Decimal("0"))
    realized = sum(
        (Decimal(row["realized_pnl"]) for row in closed_rows if row["realized_pnl"]),
        Decimal("0"),
    )
    return open_risk, realized


def update_execution_order(
    client_order_id: str,
    *,
    status: str,
    order_id: str | None = None,
    executed_quantity: str | None = None,
    price: str | None = None,
    event_time: int | None = None,
) -> bool:
    fields = ["status = ?", "updated_at = ?"]
    values: list[str | int | None] = [status, datetime.now(timezone.utc).isoformat()]
    if order_id is not None:
        fields.append("order_id = ?")
        values.append(order_id)
    if executed_quantity is not None:
        fields.append("executed_quantity = ?")
        values.append(executed_quantity)
    if price is not None:
        fields.append("price = ?")
        values.append(price)
    if event_time is not None:
        fields.append("last_event_time = ?")
        values.append(event_time)
    values.append(client_order_id)
    with connection() as conn:
        cursor = conn.execute(
            f"UPDATE execution_orders SET {', '.join(fields)} WHERE client_order_id = ?",
            values,
        )
        updated = cursor.rowcount == 1
        if updated and status in NO_FILL_TERMINAL_STATUSES:
            row = conn.execute(
                "SELECT executed_quantity FROM execution_orders WHERE client_order_id = ?",
                (client_order_id,),
            ).fetchone()
            if row is not None and _is_zero(row["executed_quantity"]):
                release_position_risk(client_order_id, conn=conn)
        return updated


def record_execution_audit(
    *,
    event: str,
    status: str,
    detail: str,
    client_order_id: str | None = None,
    signal_id: str | None = None,
) -> None:
    with connection() as conn:
        conn.execute(
            """INSERT INTO execution_audit
               (client_order_id, signal_id, event, status, detail, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                client_order_id,
                signal_id,
                event,
                status,
                detail,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def recent_execution_audit(limit: int = 100):
    safe_limit = max(1, min(limit, 500))
    with connection() as conn:
        rows = conn.execute(
            """SELECT id, client_order_id, signal_id, event, status, detail, created_at
               FROM execution_audit
               ORDER BY id DESC LIMIT ?""",
            (safe_limit,),
        ).fetchall()
        return [dict(row) for row in rows]
