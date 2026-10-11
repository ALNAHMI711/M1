"""Encrypted persistence and strict Spot Testnet policy."""
from __future__ import annotations
import base64, json, os, secrets, stat
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from .store import connection

MIGRATION_VERSION=1
MIGRATION_NAME="0001_testnet_settings"
KEY_VERSION=1
DEFAULT_KEY_FILE="/run/secrets/m1_testnet_encryption_key"
ALLOWED_SYMBOLS={"BTCUSDT","ETHUSDT"}
MAX_ORDER_NOTIONAL=Decimal("20")
MAX_DAILY_NOTIONAL=Decimal("50")

def _now():
    return datetime.now(timezone.utc).isoformat()

def load_master_key(path: str | None=None) -> bytes:
    """Load a protected base64 AES key; reject project paths and unsafe links.

    TODO(security): implement versioned key rotation and re-encryption of stored
    credentials before enabling production use. Rotation is intentionally deferred.
    """
    configured = path or os.getenv("M1_TESTNET_ENCRYPTION_KEY_FILE", DEFAULT_KEY_FILE)
    p = Path(configured).expanduser()
    project_root = Path(__file__).resolve().parents[2]
    lexical_path = Path(os.path.abspath(p))
    allowed_secrets_root = Path(
        os.getenv("M1_TESTNET_SECRETS_DIR", "/run/secrets")
    ).resolve()

    # Reject both a path lexically inside the checkout and a path that resolves
    # into it (including links from outside the checkout).
    try:
        resolved_path = p.resolve(strict=True)
    except FileNotFoundError:
        raise RuntimeError("testnet_encryption_key_missing") from None
    except OSError:
        raise RuntimeError("testnet_encryption_key_unreadable") from None

    if lexical_path.is_relative_to(project_root) or resolved_path.is_relative_to(project_root):
        raise RuntimeError("testnet_encryption_key_path_inside_project")

    # A symlink is permitted only when its resolved target remains under the
    # configured secrets mount. Ordinary protected files may live elsewhere,
    # provided they remain outside the project tree.
    if p.is_symlink() and not resolved_path.is_relative_to(allowed_secrets_root):
        raise RuntimeError("testnet_encryption_key_symlink_target_not_allowed")

    # Open the resolved target once, then validate the opened inode before reading.
    # This narrows the path-swap/TOCTOU window without following a second path read.
    # TODO(security): consider platform-specific openat2/RESOLVE_BENEATH hardening
    # if the secret mount can be modified by an untrusted local process.
    try:
        expected = resolved_path.stat()
        fd = os.open(resolved_path, os.O_RDONLY | getattr(os, "O_CLOEXEC", 0))
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode):
                raise RuntimeError("testnet_encryption_key_file_invalid")
            if (info.st_dev, info.st_ino) != (expected.st_dev, expected.st_ino):
                raise RuntimeError("testnet_encryption_key_file_changed")
            # Accept root-owned Docker secrets and files owned by the service user;
            # reject files owned by a different untrusted account.
            if info.st_uid not in {0, os.geteuid()}:
                raise RuntimeError("testnet_encryption_key_file_owner_invalid")
            permissions = stat.S_IMODE(info.st_mode)
            if permissions & 0o077 or permissions & 0o004:
                raise RuntimeError("testnet_encryption_key_file_permissions_invalid")
            chunks = []
            while True:
                chunk = os.read(fd, 4096)
                if not chunk:
                    break
                chunks.append(chunk)
            raw = b"".join(chunks).strip()
        finally:
            os.close(fd)
    except RuntimeError:
        raise
    except FileNotFoundError:
        raise RuntimeError("testnet_encryption_key_missing") from None
    except OSError:
        raise RuntimeError("testnet_encryption_key_unreadable") from None

    try:
        key = base64.b64decode(raw, validate=True)
    except (ValueError, base64.binascii.Error):
        raise RuntimeError("testnet_encryption_key_format_invalid") from None
    if len(key) != 32:
        raise RuntimeError("testnet_encryption_key_must_be_32_bytes")
    return key

def encrypt_value(value: str, *, field: str, key: bytes, nonce: bytes | None=None):
    if not isinstance(value,str) or not value or len(value)>4096 or "\x00" in value: raise ValueError("invalid_credential_value")
    if len(key)!=32: raise RuntimeError("testnet_encryption_key_must_be_32_bytes")
    n=nonce or secrets.token_bytes(12)
    if len(n)!=12: raise ValueError("invalid_encryption_nonce")
    aad=f"m1:credentials:BINANCE:SPOT_TESTNET:{field}:v{KEY_VERSION}".encode()
    return AESGCM(key).encrypt(n,value.encode(),aad),n

def decrypt_value(ciphertext: bytes, nonce: bytes, *, field: str, key: bytes) -> str:
    if len(key)!=32 or len(nonce)!=12: raise RuntimeError("credential_decryption_failed")
    aad=f"m1:credentials:BINANCE:SPOT_TESTNET:{field}:v{KEY_VERSION}".encode()
    try: return AESGCM(key).decrypt(nonce,ciphertext,aad).decode()
    except (InvalidTag,UnicodeDecodeError,ValueError): raise RuntimeError("credential_decryption_failed") from None

def apply_migrations():
    sql=(Path(__file__).parent/"migrations"/f"{MIGRATION_NAME}.sql").read_text(encoding="utf-8")
    with connection() as c:
        c.execute("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)")
        if c.execute("SELECT 1 FROM schema_migrations WHERE version=?",(MIGRATION_VERSION,)).fetchone(): return
        c.executescript(sql)
        c.execute("INSERT OR IGNORE INTO schema_migrations VALUES(?,?,?)",(MIGRATION_VERSION,MIGRATION_NAME,_now()))

def _row(c):
    r=c.execute("SELECT * FROM app_settings WHERE id=1").fetchone()
    if r is None: raise RuntimeError("testnet_settings_missing")
    return dict(r)

def credentials_status():
    apply_migrations()
    with connection() as c:
        r=c.execute("SELECT encryption_key_version,updated_by,updated_at FROM exchange_credentials WHERE id=1").fetchone()
        s=c.execute("SELECT credentials_test_passed FROM app_settings WHERE id=1").fetchone()
    return {"present":r is not None,"encryption_key_version":r["encryption_key_version"] if r else None,
            "updated_by":r["updated_by"] if r else None,"updated_at":r["updated_at"] if r else None,
            "test_passed":bool(s["credentials_test_passed"]) if s else False}

def get_settings():
    apply_migrations()
    with connection() as c: r=_row(c)
    return {"environment":r["environment"],"enabled":bool(r["enabled"]),
        "allowed_symbols":json.loads(r["allowed_symbols_json"]),
        "allowed_order_types":json.loads(r["allowed_order_types_json"]),
        "allowed_sides":json.loads(r["allowed_sides_json"]),
        "max_order_notional":r["max_order_notional"],"max_daily_notional":r["max_daily_notional"],
        "credentials_present":credentials_status()["present"],
        "credentials_test_passed":bool(r["credentials_test_passed"]),
        "manual_approval":bool(r["manual_approval"]),"updated_by":r["updated_by"],
        "updated_at":r["updated_at"],"version":r["version"]}

def update_settings(*,allowed_symbols,max_order_notional,max_daily_notional,actor,enabled=False):
    apply_migrations()
    if enabled: raise ValueError("testnet_activation_requires_owner_review")
    symbols=sorted(set(allowed_symbols))
    if not symbols or any(x not in ALLOWED_SYMBOLS for x in symbols): raise ValueError("testnet_symbol_not_allowlisted")
    try: order=Decimal(max_order_notional); daily=Decimal(max_daily_notional)
    except (InvalidOperation,TypeError): raise ValueError("testnet_order_limits_invalid") from None
    if not order.is_finite() or order<=0 or order>MAX_ORDER_NOTIONAL or not daily.is_finite() or daily<=0 or daily>MAX_DAILY_NOTIONAL or daily<order:
        raise ValueError("testnet_order_limits_invalid")
    with connection() as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("""UPDATE app_settings SET enabled=0,manual_approval=0,allowed_symbols_json=?,allowed_order_types_json='["LIMIT"]',
            allowed_sides_json='["BUY"]',max_order_notional=?,max_daily_notional=?,updated_by=?,updated_at=?,version=version+1 WHERE id=1""",
            (json.dumps(symbols,separators=(",",":")),format(order,"f"),format(daily,"f"),actor,_now()))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
            ("TESTNET_SETTINGS_UPDATED","SUCCESS",json.dumps({"actor":actor,"symbols":symbols,"max_order_notional":format(order,"f"),"max_daily_notional":format(daily,"f")},separators=(",",":")),_now()))
    return get_settings()

def activate_testnet(*, actor: str, confirmed: bool):
    """Enable Spot Testnet only after saved credentials, a passed test, and explicit owner confirmation."""
    if confirmed is not True:
        raise ValueError("testnet_owner_confirmation_required")
    apply_migrations()
    with connection() as c:
        c.execute("BEGIN IMMEDIATE")
        settings = c.execute("SELECT * FROM app_settings WHERE id=1").fetchone()
        credentials = c.execute("SELECT id FROM exchange_credentials WHERE id=1").fetchone()
        if settings is None:
            raise RuntimeError("testnet_settings_missing")
        if credentials is None:
            raise ValueError("testnet_credentials_required")
        if not bool(settings["credentials_test_passed"]):
            raise ValueError("testnet_connection_test_required")
        now = _now()
        c.execute("UPDATE app_settings SET enabled=1,manual_approval=1,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(actor,now))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
            ("TESTNET_ACTIVATION","ENABLED",json.dumps({"actor":actor,"confirmation":True,"environment":"SPOT_TESTNET"}),now))
    return get_settings()

def deactivate_testnet(*, actor: str):
    apply_migrations()
    now = _now()
    with connection() as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("UPDATE app_settings SET enabled=0,manual_approval=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(actor,now))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
            ("TESTNET_ACTIVATION","DISABLED",json.dumps({"actor":actor,"environment":"SPOT_TESTNET"}),now))
    return get_settings()

def recent_testnet_audit(*, limit: int=50):
    apply_migrations()
    bounded=max(1,min(int(limit),100))
    with connection() as c:
        rows=c.execute("""SELECT id,event,status,detail,created_at FROM execution_audit
            WHERE event LIKE 'TESTNET_%' ORDER BY id DESC LIMIT ?""",(bounded,)).fetchall()
    result=[]
    for row in rows:
        try:
            detail=json.loads(row["detail"])
        except (TypeError,ValueError):
            detail={"message":"redacted"}
        # Never return credentials, raw request data, or arbitrary exception text.
        safe={k:detail[k] for k in ("actor","symbols","max_order_notional","max_daily_notional","environment","confirmation") if k in detail}
        result.append({"id":row["id"],"event":row["event"],"status":row["status"],"detail":safe,"created_at":row["created_at"]})
    return result

def save_credentials(*,api_key,api_secret,actor,key=None):
    apply_migrations(); master=key if key is not None else load_master_key()
    kc,kn=encrypt_value(api_key,field="api_key",key=master); sc,sn=encrypt_value(api_secret,field="api_secret",key=master)
    with connection() as c:
        c.execute("BEGIN IMMEDIATE")
        c.execute("""INSERT INTO exchange_credentials(id,exchange,environment,api_key_ciphertext,api_key_nonce,api_secret_ciphertext,api_secret_nonce,encryption_key_version,updated_by,updated_at)
          VALUES(1,'BINANCE','SPOT_TESTNET',?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
          api_key_ciphertext=excluded.api_key_ciphertext,api_key_nonce=excluded.api_key_nonce,
          api_secret_ciphertext=excluded.api_secret_ciphertext,api_secret_nonce=excluded.api_secret_nonce,
          encryption_key_version=excluded.encryption_key_version,updated_by=excluded.updated_by,updated_at=excluded.updated_at""",
          (kc,kn,sc,sn,KEY_VERSION,actor,_now()))
        now = _now()
        c.execute("UPDATE app_settings SET enabled=0,credentials_test_passed=0,manual_approval=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(actor,now))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
            ("TESTNET_CREDENTIALS","SAVED",json.dumps({"actor":actor,"operation":"encrypted_credentials_saved"}),now))

def load_credentials_for_testnet(*,key=None):
    apply_migrations(); master=key if key is not None else load_master_key()
    with connection() as c: r=c.execute("SELECT * FROM exchange_credentials WHERE id=1").fetchone()
    if r is None: raise RuntimeError("testnet_credentials_not_configured")
    if r["environment"]!="SPOT_TESTNET" or r["exchange"]!="BINANCE": raise RuntimeError("testnet_credentials_environment_invalid")
    return (decrypt_value(r["api_key_ciphertext"],r["api_key_nonce"],field="api_key",key=master),
            decrypt_value(r["api_secret_ciphertext"],r["api_secret_nonce"],field="api_secret",key=master))

def _mark_test(actor,passed):
    apply_migrations()
    with connection() as c:
        c.execute("BEGIN IMMEDIATE")
        now = _now()
        c.execute("UPDATE app_settings SET credentials_test_passed=?,enabled=0,manual_approval=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(int(passed),actor,now))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
                  ("TESTNET_CREDENTIALS_CHECK","PASSED" if passed else "FAILED",
                   json.dumps({"actor":actor,"operation":"read_only_account_check"} if passed else {"actor":actor,"operation":"read_only_account_check_failed"}),now))
def mark_credentials_test_passed(actor): _mark_test(actor,True)
def mark_credentials_test_failed(actor): _mark_test(actor,False)

def delete_credentials(actor):
    apply_migrations()
    with connection() as c:
        c.execute("BEGIN IMMEDIATE"); c.execute("DELETE FROM exchange_credentials WHERE id=1")
        now = _now()
        c.execute("UPDATE app_settings SET enabled=0,credentials_test_passed=0,manual_approval=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(actor,now))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
            ("TESTNET_CREDENTIALS","DELETED",json.dumps({"actor":actor,"operation":"credentials_deleted"}),now))
