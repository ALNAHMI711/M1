import os
import sqlite3
import time
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
        # Serialize schema migrations across workers, not only cold WAL setup.
        conn.execute("BEGIN IMMEDIATE")
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
                market TEXT NOT NULL DEFAULT 'UNKNOWN',
                order_id TEXT,
                status TEXT NOT NULL,
                quantity TEXT NOT NULL,
                executed_quantity TEXT NOT NULL DEFAULT '0',
                price TEXT,
                last_event_time INTEGER,
                updated_at TEXT NOT NULL,
                request_fingerprint TEXT
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
        if "market" not in columns:
            # Legacy records cannot safely be guessed to be Spot or futures.
            conn.execute("ALTER TABLE execution_orders ADD COLUMN market TEXT NOT NULL DEFAULT 'UNKNOWN'")
        if "request_fingerprint" not in columns:
            # Legacy rows have no provable request payload and remain unbound.
            conn.execute("ALTER TABLE execution_orders ADD COLUMN request_fingerprint TEXT")
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
    market: str = "SPOT",
    quantity: str,
    status: str = "SUBMITTED",
    order_id: str | None = None,
    executed_quantity: str = "0",
    price: str | None = None,
    last_event_time: int | None = None,
    request_fingerprint: str | None = None,
) -> None:
    if request_fingerprint is not None and (
        not isinstance(request_fingerprint, str)
        or len(request_fingerprint) != 64
        or any(char not in "0123456789abcdef" for char in request_fingerprint)
    ):
        raise ValueError("invalid_execution_request_fingerprint")
    now = datetime.now(timezone.utc).isoformat()
    with connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        cursor = conn.execute(
            """INSERT OR IGNORE INTO execution_orders
               (client_order_id, signal_id, symbol, side, mode, order_id,
                status, quantity, executed_quantity, price, last_event_time, updated_at, market,
                request_fingerprint)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                market,
                request_fingerprint,
            ),
        )
        if cursor.rowcount == 1:
            return
        existing = conn.execute(
            """SELECT signal_id, symbol, side, mode, market, quantity, request_fingerprint
               FROM execution_orders WHERE client_order_id = ?""",
            (client_order_id,),
        ).fetchone()
        if existing is None or tuple(existing) != (
            signal_id, symbol, side, mode, market, quantity, request_fingerprint
        ):
            raise ValueError("execution_order_identity_conflict")
        # Idempotent registration must never overwrite exchange state. In
        # particular, a retry cannot replace an order ID or regress a fill.


def execution_order_exists(client_order_id: str) -> bool:
    return get_execution_order(client_order_id) is not None


def get_execution_order(client_order_id: str):
    with connection() as conn:
        row = conn.execute(
            """SELECT client_order_id, signal_id, symbol, side, mode, order_id,
                      status, quantity, executed_quantity, price, last_event_time, updated_at, market,
                      request_fingerprint
               FROM execution_orders
               WHERE client_order_id = ?""",
            (client_order_id,),
        ).fetchone()
        return dict(row) if row is not None else None


def pending_execution_orders(*, mode: str | None = None, market: str | None = None, include_unknown: bool = False):
    terminal = ["FILLED", "CANCELED", "EXPIRED", "EXPIRED_IN_MATCH", "REJECTED"]
    if not include_unknown:
        terminal.append("UNKNOWN")
    clauses = [f"status NOT IN ({','.join('?' for _ in terminal)})"]
    parameters = list(terminal)
    if mode is not None:
        clauses.append("mode = ?")
        parameters.append(mode)
    if market is not None:
        clauses.append("market = ?")
        parameters.append(market)
    with connection() as conn:
        rows = conn.execute(
            f"""SELECT client_order_id, signal_id, symbol, side, mode, order_id,
                      status, quantity, executed_quantity, price, last_event_time, updated_at, market,
                      request_fingerprint
               FROM execution_orders
               WHERE {' AND '.join(clauses)}""",
            parameters,
        ).fetchall()
        return [dict(row) for row in rows]


def apply_order_state(
    client_order_id: str, *, status: str, market: str, mode: str = "TESTNET",
    order_id: str | None = None, executed_quantity: str | None = None,
    price: str | None = None, event_time: int | None = None,
    symbol: str | None = None, snapshot: dict | None = None,
    event_prefix: str = "usdm_order_update",
) -> str:
    """Atomic identity, monotonic state and CAS checks plus successful audit.

    REST snapshots must not overwrite a concurrent stream update. A legacy
    UNKNOWN market is deliberately not guessed. This function never sends orders.
    """
    terminal = {"FILLED", "CANCELED", "EXPIRED", "EXPIRED_IN_MATCH", "REJECTED"}
    valid_statuses = terminal | {"NEW", "PARTIALLY_FILLED", "PENDING_CANCEL", "UNKNOWN"}
    if status not in valid_statuses:
        raise ValueError("unsupported_order_status")
    if event_time is not None and (isinstance(event_time, bool) or not isinstance(event_time, int) or not 0 <= event_time <= 2**63 - 1):
        raise ValueError("invalid_order_event_time")
    with connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT * FROM execution_orders WHERE client_order_id=?", (client_order_id,)).fetchone()
        if row is None:
            raise ValueError("unknown_client_order_id")
        current = dict(row)
        if current["mode"] != mode or current["market"] != market:
            raise ValueError("order_environment_mismatch")
        if symbol is not None and symbol != current["symbol"]:
            raise ValueError("order_symbol_mismatch")
        if order_id is not None and current["order_id"] is not None and str(order_id) != current["order_id"]:
            raise ValueError("order_id_mismatch")

        def audit(event, detail):
            conn.execute(
                """INSERT INTO execution_audit
                   (client_order_id,signal_id,event,status,detail,created_at) VALUES (?,?,?,?,?,?)""",
                (client_order_id, current["signal_id"], event, "ignored", detail,
                 datetime.now(timezone.utc).isoformat()),
            )

        if snapshot is not None and any(
            snapshot.get(key) != current[key]
            for key in ("status", "executed_quantity", "order_id", "price", "last_event_time", "market", "mode")
        ):
            audit(f"{event_prefix}_stale", "local_state_changed_during_lookup")
            return "stale"
        last_time = current["last_event_time"]
        if event_time is not None and last_time is not None and event_time < last_time:
            audit(f"{event_prefix}_stale", f"event_time={event_time};last_event_time={last_time}")
            return "stale"
        if last_time is not None and event_time is None and snapshot is None:
            raise ValueError("order_event_time_required")
        numbers = (current["quantity"], current["executed_quantity"],
                   executed_quantity if executed_quantity is not None else current["executed_quantity"],
                   price if price is not None else current["price"] or "0")
        if any(not isinstance(value, str) or len(value) > 64 for value in numbers):
            raise ValueError("invalid_order_numbers")
        try:
            quantity, old_executed, executed, proposed_price = map(Decimal, numbers)
        except (InvalidOperation, TypeError):
            raise ValueError("invalid_order_numbers")
        if not all(v.is_finite() for v in (quantity, old_executed, executed, proposed_price)) or quantity <= 0 or old_executed < 0 or proposed_price < 0:
            raise ValueError("invalid_order_numbers")
        if executed < old_executed or executed > quantity:
            raise ValueError("executed_quantity_out_of_bounds")
        if status == "FILLED" and executed != quantity:
            raise ValueError("filled_quantity_mismatch")
        if status == "PARTIALLY_FILLED" and not 0 < executed < quantity:
            raise ValueError("partial_quantity_mismatch")
        if status in {"NEW", "REJECTED"} and executed != 0:
            raise ValueError("unfilled_status_quantity_mismatch")
        same = (
            current["status"] == status
            and (order_id is None or current["order_id"] == str(order_id))
            and executed == old_executed
            and (price is None or current["price"] is not None and Decimal(current["price"]) == proposed_price)
        )
        if same:
            # A repeated state with a later timestamp advances the watermark.
            if event_time is not None and (last_time is None or event_time > last_time):
                conn.execute("UPDATE execution_orders SET last_event_time=? WHERE client_order_id=?", (event_time, client_order_id))
            audit(f"{event_prefix}_duplicate", "state_unchanged_same_event_time" if event_time == last_time and last_time is not None else "state_unchanged")
            return "duplicate"
        if event_time is not None and last_time is not None and event_time == last_time:
            raise ValueError("conflicting_event_same_time")
        if current["status"] in terminal and current["status"] != status:
            raise ValueError("terminal_order_regression")
        if current["status"] == "PARTIALLY_FILLED" and status == "NEW":
            raise ValueError("order_status_regression")
        conn.execute(
            """UPDATE execution_orders SET status=?, order_id=?, executed_quantity=?,
               price=?, last_event_time=?, updated_at=? WHERE client_order_id=?""",
            (status, str(order_id) if order_id is not None else current["order_id"],
             executed_quantity if executed_quantity is not None else current["executed_quantity"],
             price if price is not None else current["price"], event_time if event_time is not None else last_time,
             datetime.now(timezone.utc).isoformat(), client_order_id),
        )
        audit_event = event_prefix if market == "SPOT" and event_prefix == "user_data_order_update" else f"{event_prefix}_applied"
        conn.execute(
            """INSERT INTO execution_audit
               (client_order_id,signal_id,event,status,detail,created_at) VALUES (?,?,?,?,?,?)""",
            (client_order_id, current["signal_id"], audit_event,
             status if audit_event == "user_data_order_update" else ("terminal" if status in terminal else "updated"),
             ("terminal" if status in terminal else "non_terminal") if audit_event == "user_data_order_update" else status,
             datetime.now(timezone.utc).isoformat()),
        )
        return "updated"


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
