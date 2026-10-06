import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.getenv("M1_DB_PATH", "backend/data/m1.sqlite3")


@contextmanager
def connection():
    conn = sqlite3.connect(DB_PATH)
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
