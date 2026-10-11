"""Durable operational controls. Never store raw tokens or passwords here."""
from __future__ import annotations

import hashlib
import sqlite3
import time
from contextlib import contextmanager

from .store import connection


@contextmanager
def operational_connection():
    with connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS auth_users (
                username TEXT PRIMARY KEY, password_hash TEXT NOT NULL,
                role TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS auth_sessions (
                jti TEXT PRIMARY KEY, username TEXT NOT NULL,
                role TEXT NOT NULL, expires_at INTEGER NOT NULL,
                revoked INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
            CREATE TABLE IF NOT EXISTS operational_settings (
                key TEXT PRIMARY KEY, value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rate_windows (
                key TEXT PRIMARY KEY, window INTEGER NOT NULL, count INTEGER NOT NULL
            );
        """)
        yield conn


def get_user(username: str):
    with operational_connection() as conn:
        row = conn.execute("SELECT * FROM auth_users WHERE username = ?", (username,)).fetchone()
        return dict(row) if row else None


def save_user(username: str, password_hash: str, role: str, *, enabled: bool = True):
    with operational_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            """INSERT INTO auth_users VALUES (?, ?, ?, ?)
               ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash,
               role=excluded.role, enabled=excluded.enabled""",
            (username, password_hash, role, int(enabled)),
        )
        # Password/role/enablement changes invalidate all existing sessions.
        conn.execute("UPDATE auth_sessions SET revoked=1 WHERE username=?", (username,))


def save_session(jti: str, username: str, role: str, expires_at: int):
    with operational_connection() as conn:
        conn.execute("DELETE FROM auth_sessions WHERE expires_at < ?", (int(time.time()),))
        conn.execute("INSERT INTO auth_sessions VALUES (?, ?, ?, ?, 0)", (jti, username, role, expires_at))


def session_active(jti: str, username: str, role: str) -> bool:
    with operational_connection() as conn:
        row = conn.execute(
            """SELECT 1 FROM auth_sessions WHERE jti=? AND username=? AND role=?
               AND revoked=0 AND expires_at > ?""",
            (jti, username, role, int(time.time())),
        ).fetchone()
        user = conn.execute("SELECT role, enabled FROM auth_users WHERE username=?", (username,)).fetchone()
        return bool(row) and (user is None or bool(user["enabled"]) and user["role"] == role)


def revoke_session(jti: str):
    with operational_connection() as conn:
        conn.execute("UPDATE auth_sessions SET revoked=1 WHERE jti=?", (jti,))


def kill_switch_active() -> bool:
    with operational_connection() as conn:
        row = conn.execute("SELECT value FROM operational_settings WHERE key='kill_switch'").fetchone()
        return row is not None and row["value"] != "false"


def set_kill_switch(enabled: bool, actor: str):
    with operational_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            """INSERT INTO operational_settings VALUES ('kill_switch', ?)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value""",
            ("true" if enabled else "false",),
        )
        conn.execute(
            """INSERT INTO execution_audit (event, status, detail, created_at)
               VALUES ('KILL_SWITCH', ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))""",
            ("ENABLED" if enabled else "DISABLED", f"actor:{actor}"),
        )


def consume_rate_limit(key: str, limit: int, *, now: int | None = None) -> bool:
    """A fixed-minute window shared by all workers/restarts using the database."""
    window = (int(time.time()) if now is None else now) // 60
    digest = hashlib.sha256(key.encode()).hexdigest()
    with operational_connection() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM rate_windows WHERE window < ?", (window - 2,))
        conn.execute(
            """INSERT INTO rate_windows VALUES (?, ?, 1)
               ON CONFLICT(key) DO UPDATE SET window=excluded.window,
               count=CASE WHEN rate_windows.window=excluded.window
                          THEN rate_windows.count+1 ELSE 1 END""",
            (digest, window),
        )
        count = conn.execute("SELECT count FROM rate_windows WHERE key=?", (digest,)).fetchone()["count"]
        return count <= limit


def check_database() -> bool:
    try:
        with operational_connection() as conn:
            return conn.execute("PRAGMA quick_check").fetchone()[0] == "ok"
    except (sqlite3.Error, OSError):
        return False
