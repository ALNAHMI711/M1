#!/usr/bin/env bash
set -Eeuo pipefail

fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
pass() { printf 'PASS: %s\n' "$*"; }

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "run from inside a Git checkout"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed"
docker compose version >/dev/null 2>&1 || fail "Docker Compose plugin is unavailable"
pass "Docker and Docker Compose are available"

KEY_FILE="${M1_TESTNET_ENCRYPTION_KEY_FILE:-}"
[[ -n "$KEY_FILE" ]] || fail "set M1_TESTNET_ENCRYPTION_KEY_FILE to an absolute protected key-file path"
[[ "$KEY_FILE" = /* ]] || fail "M1_TESTNET_ENCRYPTION_KEY_FILE must be an absolute path"
[[ -f "$KEY_FILE" && ! -L "$KEY_FILE" ]] || fail "key file must exist as a regular non-symlink file"
mode="$(stat -c '%a' "$KEY_FILE" 2>/dev/null || stat -f '%Lp' "$KEY_FILE")"
[[ "$mode" == "600" ]] || fail "key file permissions must be exactly 600 (got $mode)"
python3 - "$KEY_FILE" <<'PY' || fail "key file must contain valid Base64 encoding of exactly 32 bytes"
import base64, pathlib, sys
raw = pathlib.Path(sys.argv[1]).read_bytes().strip()
decoded = base64.b64decode(raw, validate=True)
if len(decoded) != 32:
    raise SystemExit(1)
PY
key_real="$(realpath "$KEY_FILE")"
root_real="$(realpath "$ROOT")"
case "$key_real" in "$root_real"/*) fail "key file must be outside the repository" ;; esac
pass "Encryption key file exists outside repository, mode 600, Base64 decodes to 32 bytes"

# Check tracked files only and never print matched lines or credential values.
if git ls-files -z | xargs -0 -r grep -IlE '(BINANCE_API_KEY|BINANCE_API_SECRET)[[:space:]]*=[[:space:]]*[^[:space:]#]{12,}|"?(apiKey|api_key|apiSecret|api_secret)"?[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]{24,}"' 2>/dev/null | grep -q .; then
  fail "possible populated Binance credential assignment found in tracked repository file (contents suppressed)"
fi
pass "No populated Binance credential assignments detected in tracked files"

if git ls-files --error-unmatch .env >/dev/null 2>&1 || git ls-files | grep -Eq '(^|/)\.env($|[^.])'; then
  fail "a real .env file is tracked by Git"
fi
pass "No real .env file is tracked by Git"

[[ -f compose.yaml ]] || fail "compose.yaml is missing"
grep -Eq '^[[:space:]]*m1_testnet_encryption_key:[[:space:]]*$' compose.yaml || fail "Compose secret definition is missing"
grep -Eq '^[[:space:]]*file:[[:space:]]*\$\{M1_TESTNET_ENCRYPTION_KEY_FILE' compose.yaml || fail "Compose secret must use the host key file"
grep -Eq '^[[:space:]]*M1_TESTNET_ENCRYPTION_KEY_FILE:[[:space:]]*/run/secrets/m1_testnet_encryption_key' compose.yaml || fail "backend must receive only the secret file path"
if grep -Eq '^[[:space:]]*M1_TESTNET_ENCRYPTION_KEY[[:space:]]*:' compose.yaml; then
  fail "raw encryption key must not be passed as an environment variable"
fi
if sed -n '/^[[:space:]]*backend:/,/^[[:space:]]*web:/p' compose.yaml | grep -Eq '^[[:space:]]*ports:'; then
  fail "backend must not publish a host port directly"
fi
pass "Compose mounts encryption key as a file secret, exposes only its path, and does not publish backend ports"

if grep -RIlE 'M1_TESTNET_ENCRYPTION_KEY[[:space:]]*=[[:space:]]*["]?[A-Za-z0-9+/]{40,}={0,2}' --include='Dockerfile*' --include='*.dockerfile' . 2>/dev/null | grep -q .; then
  fail "possible encryption key literal found in a Docker build file"
fi
pass "No encryption-key literal detected in Docker build files"

printf '\nStaging preflight passed. No services were started and no deployment was performed.\n'
