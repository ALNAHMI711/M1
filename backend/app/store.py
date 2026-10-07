import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone


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
                updated_at TEXT NOT NULL
            )"""
        )
        conn.execute(
            """CREATE INDEX IF NOT EXISTS idx_execution_orders_status
               ON execution_orders(status)"""
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
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute(
            """INSERT INTO execution_orders
               (client_order_id, signal_id, symbol, side, mode, order_id,
                status, quantity, executed_quantity, price, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT(client_order_id) DO UPDATE SET
                 order_id=excluded.order_id,
                 status=excluded.status,
                 executed_quantity=excluded.executed_quantity,
                 price=excluded.price,
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
                now,
            ),
        )


def pending_execution_orders():
    with connection() as conn:
        rows = conn.execute(
            """SELECT client_order_id, signal_id, symbol, side, mode, order_id,
                      status, quantity, executed_quantity, price, updated_at
               FROM execution_orders
               WHERE status NOT IN ('FILLED', 'CANCELED', 'EXPIRED', 'REJECTED')"""
        ).fetchall()
        return [dict(row) for row in rows]


def update_execution_order(
    client_order_id: str,
    *,
    status: str,
    order_id: str | None = None,
    executed_quantity: str | None = None,
    price: str | None = None,
) -> None:
    fields = ["status = ?", "updated_at = ?"]
    values: list[str | None] = [status, datetime.now(timezone.utc).isoformat()]
    if order_id is not None:
        fields.append("order_id = ?")
        values.append(order_id)
    if executed_quantity is not None:
        fields.append("executed_quantity = ?")
        values.append(executed_quantity)
    if price is not None:
        fields.append("price = ?")
        values.append(price)
    values.append(client_order_id)
    with connection() as conn:
        conn.execute(
            f"UPDATE execution_orders SET {', '.join(fields)} WHERE client_order_id = ?",
            values,
        )
