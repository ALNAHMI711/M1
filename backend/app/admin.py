"""Local administrator commands; secrets are read from a terminal, never argv."""
from __future__ import annotations

import argparse
import getpass
import os
import sqlite3
from pathlib import Path

from .auth import ROLE_SCOPES, password_hash
from .operations import save_user, set_kill_switch
from .store import connection, database_path


def backup_database(destination: str) -> None:
    target = Path(destination).resolve()
    if target == Path(database_path()).resolve():
        raise ValueError("backup_destination_is_source")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Refuse to replace an existing backup. Online SQLite backup includes WAL.
    fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        with connection() as source, sqlite3.connect(target) as output:
            source.backup(output)
            if output.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise RuntimeError("backup_integrity_check_failed")
    except Exception:
        target.unlink(missing_ok=True)
        raise


def restore_database(source: str) -> None:
    """Offline restore only, to a new DB path. Never overwrite running state."""
    target = Path(database_path()).resolve()
    if target.exists():
        raise ValueError("restore_requires_new_database_path")
    source_path = Path(source).resolve()
    if not source_path.is_file():
        raise ValueError("backup_not_found")
    target.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{source_path}?mode=ro", uri=True) as backup:
        if backup.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("invalid_backup")
        fd = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
        try:
            with sqlite3.connect(target) as destination:
                backup.backup(destination)
        except Exception:
            target.unlink(missing_ok=True)
            raise
    # Restored sessions must not resurrect old credentials.
    from .operations import operational_connection
    with operational_connection() as conn:
        conn.execute("UPDATE auth_sessions SET revoked=1")
    set_kill_switch(True, "offline_restore")


def main():
    parser = argparse.ArgumentParser(description="M1 local administration")
    sub = parser.add_subparsers(dest="command", required=True)
    user = sub.add_parser("user")
    user.add_argument("username")
    user.add_argument("--role", choices=sorted(ROLE_SCOPES), default="ADMIN")
    user.add_argument("--disable", action="store_true")
    backup = sub.add_parser("backup")
    backup.add_argument("destination")
    restore = sub.add_parser("restore")
    restore.add_argument("source")
    switch = sub.add_parser("kill-switch")
    switch.add_argument("state", choices=["on", "off"])
    args = parser.parse_args()
    if args.command == "user":
        if not args.username or len(args.username) > 64 or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for c in args.username):
            parser.error("username must be 1-64 ASCII letters, digits, dot, dash or underscore")
        password = getpass.getpass("New password (at least 12 characters): ")
        if len(password) < 12 or password != getpass.getpass("Confirm password: "):
            parser.error("password too short or confirmation mismatch")
        save_user(args.username, password_hash.hash(password), args.role, enabled=not args.disable)
        print("User saved; previous sessions revoked.")
    elif args.command == "backup":
        backup_database(args.destination)
        print("Backup created and integrity verified. Treat it as private.")
    elif args.command == "restore":
        restore_database(args.source)
        print("Database restored to new path; sessions revoked and kill switch enabled.")
    else:
        set_kill_switch(args.state == "on", "local_admin")
        print("Kill switch updated; no liquidation or live enablement.")


if __name__ == "__main__":
    main()
