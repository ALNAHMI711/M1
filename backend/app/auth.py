import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel, ValidationError

SECRET_KEY = os.getenv("M1_AUTH_SECRET", "")
ALGORITHM = "HS256"
TOKEN_MINUTES = int(os.getenv("M1_AUTH_TOKEN_MINUTES", "30"))
ADMIN_USERNAME = os.getenv("M1_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD_HASH = os.getenv("M1_ADMIN_PASSWORD_HASH", "")

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
    if not SECRET_KEY:
        raise RuntimeError("M1_AUTH_SECRET is not configured")
    return SECRET_KEY


def authenticate(username: str, password: str) -> str | None:
    if not secrets.compare_digest(username, ADMIN_USERNAME):
        return None
    if not ADMIN_PASSWORD_HASH or not password_hash.verify(password, ADMIN_PASSWORD_HASH):
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
        "exp": now + timedelta(minutes=TOKEN_MINUTES),
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


async def current_user(security_scopes: SecurityScopes, token: str = Depends(oauth2_scheme)) -> TokenData:
    data = _decode(token)
    required = set(security_scopes.scopes)
    if required and not required.issubset(set(data.scopes)):
        raise HTTPException(status_code=403, detail="insufficient permissions")
    return data


def require_scope(scope: str):
    async def dependency(security_scopes: SecurityScopes, token: str = Depends(oauth2_scheme)) -> TokenData:
        data = _decode(token)
        required = set(security_scopes.scopes) or {scope}
        if not required.issubset(set(data.scopes)):
            raise HTTPException(status_code=403, detail="insufficient permissions")
        return data
    return dependency


def revoke(token: str) -> None:
    _revoked_tokens.add(token)
