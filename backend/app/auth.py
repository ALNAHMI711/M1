import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel, ValidationError
from pwdlib.exceptions import UnknownHashError

from .operations import get_user, revoke_session, save_session, session_active

ALGORITHM = "HS256"
SCOPES = {
    "control:read": "Read the trading control plane",
    "control:write": "Change non-trading control settings",
    "signals:read": "Read signal state",
    "signals:validate": "Validate signals",
    "admin": "Administrative operations",
    "trading:admin": "Manage Spot Testnet settings and encrypted credentials",
    "paper:read": "Read own simulated paper account",
    "paper:write": "Submit simulated cash-only paper orders; never exchange orders",
}
ROLE_SCOPES = {
    "VIEWER": {"control:read", "signals:read", "paper:read"},
    "OPERATOR": {"control:read", "signals:read", "signals:validate", "paper:read", "paper:write"},
    "TRADING_ADMIN": {"control:read", "trading:admin"},
    "ADMIN": set(SCOPES),
}

password_hash = PasswordHash.recommended()
dummy_password_hash = password_hash.hash("invalid-password-dummy")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/token", scopes=SCOPES)
ISSUER = "m1-control-plane"
AUDIENCE = "m1-control-api"


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: str
    role: str
    scopes: list[str]
    jti: str


def _secret() -> str:
    secret = os.getenv("M1_AUTH_SECRET", "")
    if not secret:
        raise RuntimeError("M1_AUTH_SECRET is not configured")
    if len(secret.encode("utf-8")) < 32:
        raise RuntimeError("M1_AUTH_SECRET must be at least 32 bytes")
    return secret


def authenticate(username: str, password: str) -> str | None:
    user = get_user(username)
    if user is not None:
        try:
            verified = password_hash.verify(password, user["password_hash"])
        except (ValueError, UnknownHashError):
            return None
        return user["role"] if verified and user["enabled"] and user["role"] in ROLE_SCOPES else None
    admin_username = os.getenv("M1_ADMIN_USERNAME", "admin")
    password_hash_value = os.getenv("M1_ADMIN_PASSWORD_HASH", "")
    if not secrets.compare_digest(username, admin_username):
        password_hash.verify(password, dummy_password_hash)
        return None
    try:
        verified = bool(password_hash_value) and password_hash.verify(password, password_hash_value)
    except (ValueError, UnknownHashError):
        verified = False
    if not verified:
        return None
    return "ADMIN"


def create_access_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(24)
    scopes = sorted(ROLE_SCOPES[role])
    secret = _secret()
    minutes = int(os.getenv("M1_AUTH_TOKEN_MINUTES", "30"))
    if not 1 <= minutes <= 60:
        raise RuntimeError("M1_AUTH_TOKEN_MINUTES must be between 1 and 60")
    expires = now + timedelta(minutes=minutes)
    payload = {
        "sub": username,
        "role": role,
        "scope": " ".join(scopes),
        "iat": now,
        "exp": expires,
        "jti": jti,
        "iss": ISSUER,
        "aud": AUDIENCE,
    }
    token = jwt.encode(payload, secret, algorithm=ALGORITHM)
    save_session(jti, username, role, int(expires.timestamp()))
    return token


def _decode(token: str) -> TokenData:
    try:
        payload = jwt.decode(
            token, _secret(), algorithms=[ALGORITHM], issuer=ISSUER, audience=AUDIENCE,
            options={"require": ["sub", "role", "scope", "iat", "exp", "jti", "iss", "aud"]},
        )
        data = TokenData(
            username=payload["sub"],
            role=payload["role"],
            scopes=str(payload.get("scope", "")).split(),
            jti=payload["jti"],
        )
    except (InvalidTokenError, KeyError, ValidationError):
        raise HTTPException(status_code=401, detail="invalid or expired session", headers={"WWW-Authenticate": "Bearer"})
    if data.role not in ROLE_SCOPES or not set(data.scopes).issubset(ROLE_SCOPES[data.role]):
        raise HTTPException(status_code=403, detail="invalid session permissions")
    if not session_active(data.jti, data.username, data.role):
        raise HTTPException(status_code=401, detail="session revoked or unavailable", headers={"WWW-Authenticate": "Bearer"})
    return data


async def current_user(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme),
) -> TokenData:
    data = _decode(token)
    required = set(security_scopes.scopes)
    if required and not required.issubset(set(data.scopes)):
        raise HTTPException(status_code=403, detail="insufficient permissions")
    return data


def revoke(token: str) -> None:
    revoke_session(_decode(token).jti)
