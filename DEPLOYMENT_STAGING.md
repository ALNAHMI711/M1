# Staging deployment guide

This procedure prepares and runs **staging only** from `feature/testnet-settings-admin`. It does not merge, deploy automatically, or enable Testnet. Use a dedicated staging host and a real DNS name you control.

## 1. Environment variables

Names and metadata only; never copy secret values into this document or Git.

| Variable | Required | Purpose / format | Secret? | How to obtain |
|---|---|---|---|---|
| `M1_SITE_ADDRESS` | Yes | Caddy site address: a bare public DNS name (for example, `staging.example.com`), not a URL or scheme | No | Choose a DNS name and point its A/AAAA records to the staging host |
| `M1_AUTH_SECRET` | Yes | Random UTF-8 secret of at least 32 bytes, used to sign sessions | **Yes** | Generate locally with `openssl rand -base64 48`; keep only in the host's untracked `.env` |
| `M1_ADMIN_USERNAME` | Recommended | Initial administrator login name; plain text | No | Choose a unique staging-only name |
| `M1_ADMIN_PASSWORD_HASH` | Yes for first-login bootstrap | Password hash produced by `pwdlib.PasswordHash.recommended()`; never a plaintext password | **Sensitive** | Generate using the command below; do not commit it |
| `M1_AUTH_TOKEN_MINUTES` | Optional | Integer from 1 to 60; default 30 | No | Choose a short staging session duration |
| `M1_LOGIN_RATE_PER_MINUTE` | Optional | Positive integer login rate limit | No | Choose a conservative rate |
| `M1_API_RATE_PER_MINUTE` | Optional | Positive integer API rate limit | No | Choose a conservative rate |
| `M1_MAX_BODY_BYTES` | Optional | Positive integer request body cap; default 65536 | No | Keep at or below 65536 for this staging profile |
| `M1_ALLOWED_HOSTS` | Set by Compose | Comma-separated accepted Host values for the backend | No | Keep the Compose default unless backend host routing changes |
| `M1_CORS_ORIGINS` | Optional | Comma-separated exact origins; blank disables extra CORS origins | No | Leave blank unless a separately hosted trusted frontend is required |
| `M1_DB_PATH` | Set by Compose | SQLite path inside container; `/data/m1.sqlite3` | No | Keep the Compose value; `/data` is on a persistent named volume |
| `M1_TESTNET_ENCRYPTION_KEY_FILE` | Yes | Absolute **host** path to a protected Base64 file containing exactly 32 random bytes after decoding | Path only, not the key | Create the file as described below; keep it outside the checkout |
| `M1_TESTNET_SECRETS_DIR` | Normally unset | Optional in-container allowed secrets directory; default `/run/secrets` | No | Do not override for the Compose secret mount |
| `M1_TESTNET_ORDER_SUBMISSION_ENABLED` | **Must be unset or false** | Boolean feature gate; only literal `true` enables the first gate | No | Leave unset during preparation; admin settings and safety checks remain additional gates |
| `TRADINGVIEW_WEBHOOK_SECRET` | Optional | Random shared secret for authenticated TradingView webhooks | **Yes** | Generate independently; leave unset if webhooks are not being tested |
| `BINANCE_API_KEY` | **Must be unset** | Legacy environment credential path; not used for admin-encrypted credentials | **Yes** | Do not configure it; enter Spot Testnet credentials only through the authenticated admin UI |
| `BINANCE_API_SECRET` | **Must be unset** | Legacy environment credential path | **Yes** | Do not configure it; enter Spot Testnet credentials only through the authenticated admin UI |
| `BINANCE_RECV_WINDOW` | Optional | Integer receive window in milliseconds; default 5000 | No | Leave default unless testing requires otherwise |
| `M1_PAPER_INITIAL_CASH` | Optional | Decimal simulated starting cash; default 10000 | No | Paper-only test value |
| `M1_PAPER_FEE_BPS` | Optional | Decimal simulated fee in basis points; default 10 | No | Paper simulation assumption only |
| `M1_PAPER_MAX_NOTIONAL` | Optional | Positive decimal simulated notional ceiling; default 1000 | No | Choose a conservative value |
| `M1_PAPER_MAX_TRADE_RISK_PCT` | Optional | Positive decimal per-trade risk percentage; default 1 | No | Keep conservative |
| `M1_PAPER_MAX_OPEN_RISK_PCT` | Optional | Positive decimal aggregate open-risk percentage; default 3 | No | Keep conservative |
| `M1_PAPER_MAX_DAILY_LOSS_PCT` | Optional | Positive decimal daily loss percentage; default 5 | No | Keep conservative |

Do not put encryption-key bytes in an environment variable. Only `M1_TESTNET_ENCRYPTION_KEY_FILE` (the path) may be visible in Compose environment metadata. The key itself must be a file-mounted secret.

### Generate the encryption key

Run on the staging host, outside the repository. This produces Base64 of 32 cryptographically random bytes:

```bash
sudo install -d -o root -g root -m 0711 /etc/m1-staging/secrets
sudo sh -c 'umask 077; openssl rand -base64 32 > /etc/m1-staging/secrets/testnet-encryption-key'
sudo chown 10001:10001 /etc/m1-staging/secrets/testnet-encryption-key
sudo chmod 0600 /etc/m1-staging/secrets/testnet-encryption-key
```

The file should be one Base64 line. Validate without printing the key:

```bash
python3 -c 'import base64,pathlib; p=pathlib.Path("/etc/m1-staging/secrets/testnet-encryption-key"); b=base64.b64decode(p.read_bytes().strip(),validate=True); assert len(b)==32; print("encryption key format OK; 32 decoded bytes")'
stat -c '%a %u:%g %n' /etc/m1-staging/secrets/testnet-encryption-key
```

Expected mode is `600`. The parent directory is root-owned with mode `711` so the service can traverse the known path without listing the directory. Ownership by UID/GID `10001:10001` lets the non-root backend process read the file; the file remains mode `600`. Keep the file backed up securely: credentials saved with this key cannot be decrypted if the key is lost or changed. Never rotate/delete it after credentials have been saved without a tested re-encryption migration.

### Prepare host-only `.env`

From the repository root, create a private, untracked `.env`. Never paste actual values into chat, commits, tickets, or logs:

```bash
umask 077
cp .env.example .env
chmod 0600 .env
```

Edit locally. Set `M1_SITE_ADDRESS` to the bare DNS name (e.g. `staging.example.com`), `M1_AUTH_SECRET` to output from `openssl rand -base64 48`, and `M1_ADMIN_USERNAME` to your chosen staging admin name. Set `M1_ADMIN_PASSWORD_HASH` to the output of:

```bash
python3 -c 'from getpass import getpass; from pwdlib import PasswordHash; print(PasswordHash.recommended().hash(getpass("New staging admin password: ")))'
```

Run this in the backend virtual environment where `pwdlib` is installed. Do not store the plaintext password in `.env`. Set `M1_TESTNET_ENCRYPTION_KEY_FILE` to the absolute host path above. Leave `BINANCE_API_KEY`, `BINANCE_API_SECRET`, and `M1_TESTNET_ORDER_SUBMISSION_ENABLED` unset. Leave `TRADINGVIEW_WEBHOOK_SECRET` unset unless intentionally testing webhooks.

## 2. Ubuntu VPS prerequisites and installation

Use a clean supported Ubuntu LTS VPS, a DNS name you control, and a non-root sudo user. Recommended starting point: **2 vCPU, 2 GB RAM, 20 GB SSD**. A 1 vCPU / 1 GB host may run at low load, but image builds may run out of memory.

Install Docker Engine and the Compose plugin from Docker's official apt repository:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
docker --version
docker compose version
```

Do not add an untrusted account to the `docker` group: membership is effectively root-level access. Use `sudo docker` if appropriate.

## 3. Review and preflight

1. Use only `feature/testnet-settings-admin`; verify the checked-out SHA is the reviewed commit.
2. Verify DNS A/AAAA records point to staging and the host firewall allows inbound TCP 80/443. Caddy needs public port 80 for ACME HTTP challenge/redirect and 443 for HTTPS. UDP 443 is optional for HTTP/3.
3. Run `scripts/staging_preflight.sh` from the repository root. It must pass and does not print secret contents.
4. Check rendered Compose configuration with `docker compose config --quiet`. Do not paste expanded configuration into public logs because it includes environment values.
5. Confirm `.env` and the encryption-key file are outside Git. `.dockerignore` excludes `.env` and `.env.*`.

## 4. Clone the project (preparation only)

```bash
git clone --branch feature/testnet-settings-admin --single-branch https://github.com/ALNAHMI711/M1.git
cd M1
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
```

Verify the branch and compare the SHA with the reviewed commit before continuing. Do not use `main`.

## 5. Configure Caddy's hostname

The current `deploy/Caddyfile` already reads `M1_SITE_ADDRESS`; do not hard-code a domain into the image. Set `M1_SITE_ADDRESS` in the host-only `.env` to a bare DNS hostname such as `staging.example.com` (no scheme). Point DNS A/AAAA records to the VPS and allow inbound TCP 80/443 in both provider and host firewalls. Caddy obtains and renews the TLS certificate when DNS and ports are correct.

## 6. Start staging (only after owner approval)

From the repository root on the staging host:

```bash
git switch feature/testnet-settings-admin
git pull --ff-only origin feature/testnet-settings-admin
git rev-parse HEAD
scripts/staging_preflight.sh
docker compose config --quiet
docker compose build --pull
docker compose up -d
docker compose ps
```

Do not run until the owner reviews the exact commit and host configuration. This starts the app but does not activate Testnet or place orders. Compose publishes Caddy on host ports 80/443; the backend only has internal `expose: 8000` and no host-published port. SQLite data is on the persistent `m1-data` named volume; Caddy certificate/configuration data uses persistent named volumes too.

## 7. Verify startup and encryption

```bash
docker compose ps
docker compose logs --no-color --tail=200 backend web
curl --fail --silent --show-error https://staging.example.com/ready
```

Replace the example hostname with the configured DNS name. Expect HTTP 200 JSON readiness with `status: ready`, `mode: paper-first`, and `live_enabled: false`. Check logs for key-format, permission, missing-key, database, or decryption errors. Never print the key or dump the full environment. Check Caddy certificate issuance and HTTPS in a browser; a certificate warning is a stop condition, not something to bypass. Startup success validates key loading; credential decryption can only be verified after credentials are saved, so initially there should be no credentials.

If HTTPS/certificate issuance fails, stop and fix DNS/firewall/Caddy before entering any credential.

## 8. Verify Testnet is off

1. Sign in with the staging administrator account over HTTPS.
2. Open **إعدادات Spot Testnet** in the control panel.
3. Confirm environment is `SPOT_TESTNET`, status is disabled, manual approval is off, and no credentials are present.
4. Verify `M1_TESTNET_ORDER_SUBMISSION_ENABLED` is unset or `false`. Do not activate anything during the initial smoke test.

## 9. Add Spot Testnet credentials and test connectivity

Only after the owner confirms HTTPS, host identity, administrator login, persistent storage, and key-load health:

1. Create **Spot Testnet** API credentials on Binance's official Spot Test Network. Never use a Mainnet API key. Do not grant withdrawals.
2. In the authenticated admin UI, enter the Testnet API key and secret in the dedicated credential fields and save. The server encrypts them using the mounted file key; the UI must never display them again.
3. Confirm the UI reports credentials present and Testnet remains disabled.
4. Click **اختبار الاتصال / Test credentials** once. This is a read-only account request against `https://testnet.binance.vision`; it is not an order. Confirm the UI reports success and the audit entry shows the read-only check passed.
5. Confirm Testnet is still disabled after the test. The credential test intentionally resets activation to disabled.

## 10. Activation and emergency disable

Activation is **not part of the initial deployment**. Only after a separate explicit owner review of staging may the owner enable Testnet through the UI's separate activation confirmation. Activation requires saved credentials and a successful read-only test; only the admin owner role can confirm. Current execution policy remains Spot Testnet only, BUY LIMIT only, with allowlisted symbols and bounded order sizes. Passing connectivity does not mean production readiness.

If anything looks wrong:
1. Immediately use the admin UI's **Disable Testnet** action over HTTPS.
2. Also stop further submissions at the host: `docker compose stop backend` (this stops the API; it is not a liquidation operation).
3. Preserve logs/audit records securely, do not retry ambiguous orders, and investigate before restarting. If the UI is unavailable, stop the backend service from the host. The kill switch stops new automation/submissions; it does not liquidate positions.

## 8. Absolutely prohibited in staging

- No Binance Mainnet credentials, endpoints, or account connections.
- No `LIVE` mode, live execution, futures, margin, or non-Spot adapters.
- No withdrawal permission on any API key.
- No enabling order submission as a shortcut, disabling risk filters, direct backend port exposure, or bypassing admin activation.
- No real credentials or encryption-key bytes in Git, `.env.example`, Docker images, CI logs, issue comments, screenshots, or shell command arguments.
- No deployment from `main`, no merge, and no PR #4 changes as part of this staging preparation.

**Stop condition:** if Compose differs from this guide, the key is unreadable by the backend, HTTPS is not valid, or Testnet does not clearly show disabled, do not enter credentials and do not activate Testnet.

## Docker image and key-path invariant

`backend/Dockerfile` already exists. It must preserve the layout expected by `backend/app/testnet_settings.py`: application code at `/opt/m1/backend/app` makes `/opt/m1` the project root and leaves `/run/secrets/m1_testnet_encryption_key` outside it. Do not move the app to `/app/app` without updating and testing the path guard; that layout can cause the key path to be rejected.

The encryption key is not baked into the image. Compose mounts the host key as `/run/secrets/m1_testnet_encryption_key`; only this in-container path is passed to the backend. The host source path is used by Compose to locate the file.
