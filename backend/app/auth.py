import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel, ValidationError

ALGORITHM = "HS256"
SCOPES = {
    "control:read": "Read the trading control plane",
    "control:write": "Change non-trading control settings",
    "signals:read": "Read signal state",
    "signals:validate": "Validate signals",
    "admin": "Administrative operations",
}
ROLE_SCOPES = {
    "VIEWER": {"control:read", "signals:read"},
    "OPERATOR": {"control:read", "signals:read", "signals:validate"},
    "ADMIN": set(SCOPES),
}

password_hash = PasswordHash.recommended()
dummy_password_hash = password_hash.hash("invalid-password-dummy")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/token", scopes=SCOPES)
_revoked_tokens: set[str] = set()


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
    return secret


def authenticate(username: str, password: str) -> str | None:
    admin_username = os.getenv("M1_ADMIN_USERNAME", "admin")
    password_hash_value = os.getenv("M1_ADMIN_PASSWORD_HASH", "")
    if not secrets.compare_digest(username, admin_username):
        password_hash.verify(password, dummy_password_hash)
        return None
    if not password_hash_value or not password_hash.verify(password, password_hash_value):
        return None
    return "ADMIN"


def create_access_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    jti = secrets.token_urlsafe(24)
    scopes = sorted(ROLE_SCOPES[role])
    payload = {
        "sub": username,
        "role": role,
        "scope": " ".join(scopes),
        "iat": now,
        "exp": now + timedelta(minutes=int(os.getenv("M1_AUTH_TOKEN_MINUTES", "30"))),
        "jti": jti,
    }
    return jwt.encode(payload, _secret(), algorithm=ALGORITHM)


def _decode(token: str) -> TokenData:
    if token in _revoked_tokens:
        raise HTTPException(status_code=401, detail="session revoked", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, _secret(), algorithms=[ALGORITHM])
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
    _revoked_tokens.add(token)
