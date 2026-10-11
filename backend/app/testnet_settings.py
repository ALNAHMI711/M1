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
    """Load base64 for a 32-byte AES key; no env/plaintext fallback."""
    p=Path(path or os.getenv("M1_TESTNET_ENCRYPTION_KEY_FILE",DEFAULT_KEY_FILE))
    try:
        info=p.stat()
        if not stat.S_ISREG(info.st_mode): raise RuntimeError("testnet_encryption_key_file_invalid")
        if str(p)!=DEFAULT_KEY_FILE and stat.S_IMODE(info.st_mode)&0o077:
            raise RuntimeError("testnet_encryption_key_file_permissions_invalid")
        raw=p.read_bytes().strip()
    except FileNotFoundError: raise RuntimeError("testnet_encryption_key_missing") from None
    except OSError: raise RuntimeError("testnet_encryption_key_unreadable") from None
    try: key=base64.b64decode(raw,validate=True)
    except (ValueError,base64.binascii.Error): raise RuntimeError("testnet_encryption_key_format_invalid") from None
    if len(key)!=32: raise RuntimeError("testnet_encryption_key_must_be_32_bytes")
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
        c.execute("""UPDATE app_settings SET enabled=0,allowed_symbols_json=?,allowed_order_types_json='["LIMIT"]',
            allowed_sides_json='["BUY"]',max_order_notional=?,max_daily_notional=?,updated_by=?,updated_at=?,version=version+1 WHERE id=1""",
            (json.dumps(symbols,separators=(",",":")),format(order,"f"),format(daily,"f"),actor,_now()))
    return get_settings()

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
        c.execute("UPDATE app_settings SET enabled=0,credentials_test_passed=0,manual_approval=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(actor,_now()))

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
        c.execute("UPDATE app_settings SET credentials_test_passed=?,enabled=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(int(passed),actor,_now()))
        c.execute("INSERT INTO execution_audit(event,status,detail,created_at) VALUES(?,?,?,?)",
                  ("TESTNET_CREDENTIALS_CHECK","PASSED" if passed else "FAILED","read_only_account_check" if passed else "read_only_account_check_failed",_now()))
def mark_credentials_test_passed(actor): _mark_test(actor,True)
def mark_credentials_test_failed(actor): _mark_test(actor,False)

def delete_credentials(actor):
    apply_migrations()
    with connection() as c:
        c.execute("BEGIN IMMEDIATE"); c.execute("DELETE FROM exchange_credentials WHERE id=1")
        c.execute("UPDATE app_settings SET enabled=0,credentials_test_passed=0,manual_approval=0,updated_by=?,updated_at=?,version=version+1 WHERE id=1",(actor,_now()))
