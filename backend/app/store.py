import os
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timezone


def database_path() -> str:
    return os.getenv("M1_DB_PATH", "backend/data/m1.sqlite3")


@contextmanager
def connection():
    path = database_path()
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, mode=0o700, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    os.chmod(path, 0o600)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA busy_timeout = 15000")
        conn.execute("PRAGMA foreign_keys = ON")
        # WAL initialization takes an exclusive lock and SQLite may return BUSY
        # immediately despite busy_timeout during simultaneous cold opens.
        deadline = time.monotonic() + 15
        while True:
            try:
                if conn.execute("PRAGMA journal_mode").fetchone()[0] != "wal":
                    conn.execute("PRAGMA journal_mode = WAL")
                break
            except sqlite3.OperationalError as exc:
                if "locked" not in str(exc).lower() or time.monotonic() >= deadline:
                    raise
                time.sleep(0.025)
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
        cursor = conn.execute(
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
        return cursor.rowcount == 1


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
               WHERE status NOT IN ('FILLED', 'CANCELED', 'EXPIRED', 'EXPIRED_IN_MATCH', 'REJECTED', 'UNKNOWN')"""
        ).fetchall()
        return [dict(row) for row in rows]


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
        return cursor.rowcount == 1


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
