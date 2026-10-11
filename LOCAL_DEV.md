# M1 Local Docker Development

This guide runs M1 on your own computer for development and local testing. It does not deploy to any cloud. Keep all exchange integration disabled; do not use real Binance credentials, even locally.

## Requirements

### Windows 10/11

1. Install and start Docker Desktop.
2. During setup, enable the WSL 2 backend. If prompted, install/update WSL with an elevated PowerShell terminal: `wsl --install`, restart Windows if required, and make sure Docker Desktop is using the WSL 2 engine.
3. Verify in PowerShell or a WSL terminal: `docker --version` and `docker compose version`.

### Linux (Ubuntu/Debian)

Install Docker Engine and the Compose plugin using Docker's official instructions/repository. Verify with `docker --version` and `docker compose version`. Use `sudo docker ...` if your account is not authorized; membership in the `docker` group is effectively root access.

## 1. Get the reviewed branch

Use only `feature/testnet-settings-admin` for this staging-preparation work. Do not switch to `main`.

```bash
git clone --branch feature/testnet-settings-admin --single-branch https://github.com/ALNAHMI711/M1.git
cd M1
git rev-parse --abbrev-ref HEAD
```

## 2. Create a local encryption key

Use a path outside the checkout. These examples assume Linux, macOS, or WSL; on native Windows, run the commands inside WSL so the file path and Docker bind mount are Linux paths.

```bash
mkdir -p "$HOME/.config/m1/secrets"
chmod 700 "$HOME/.config/m1" "$HOME/.config/m1/secrets"
umask 077
openssl rand -base64 32 > "$HOME/.config/m1/secrets/testnet-encryption-key"
chmod 600 "$HOME/.config/m1/secrets/testnet-encryption-key"
```

Check the format without printing the key:

```bash
python3 -c 'import base64,pathlib; b=base64.b64decode(pathlib.Path.home().joinpath(".config/m1/secrets/testnet-encryption-key").read_bytes().strip(),validate=True); assert len(b)==32; print("key format OK: 32 decoded bytes")'
```

The local key is only for this local environment. Back it up securely if you ever store encrypted test credentials, and do not reuse it on a cloud host. Never commit or share the key.

## 3. Prepare the local .env

```bash
umask 077
cp .env.example .env
chmod 600 .env
```

Edit `.env` locally and set at least:

- `M1_AUTH_SECRET`: generate with `openssl rand -base64 48`.
- `M1_SITE_ADDRESS=:80`: listen on HTTP port 80 for local-only access (no public DNS/TLS needed).
- `M1_ADMIN_USERNAME`: choose a local administrator username.
- `M1_TESTNET_ENCRYPTION_KEY_FILE`: absolute path to the key created above, for example `/home/YOUR_USER/.config/m1/secrets/testnet-encryption-key` inside Linux/WSL. Use your actual path, not this example.
- `M1_ADMIN_PASSWORD_HASH`: generate it inside the Docker image after the backend image is built, as shown below.

Leave `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `TRADINGVIEW_WEBHOOK_SECRET`, and `M1_TESTNET_ORDER_SUBMISSION_ENABLED` unset. Do not put any real exchange key in local `.env`, a terminal command, screenshot, log, or test fixture.

## 4. Build and create the administrator password hash

From the repository root, after setting the required values above:

```bash
docker compose build backend
docker compose run --rm --no-deps backend python -m app.auth hash-password
```

Enter the chosen password twice. Copy the one-line hash output to `M1_ADMIN_PASSWORD_HASH` in `.env`; never store the plaintext password in the file. This uses the locked dependencies inside the backend image and does not start the service or enable Testnet.

## 5. Start and open the local app

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
curl --fail --silent --show-error http://localhost/ready
```

Open **http://localhost** in your browser. Expected readiness is HTTP 200 with `status: ready`, `mode: paper-first`, and `live_enabled: false`. If port 80 or 443 is already in use, stop the conflicting service before starting Compose; do not expose the backend port directly.

### Optional local hostname

Add `127.0.0.1 m1.local` to your OS hosts file (Windows: run a text editor as Administrator and edit `C:\\Windows\\System32\\drivers\\etc\\hosts`; Linux/WSL client: edit `/etc/hosts` on the machine whose browser makes the request). Keep `M1_SITE_ADDRESS=:80` and open **http://m1.local**. This is a local-only name, not public DNS.

## 6. Stop, start, restart, and remove

```bash
docker compose stop                 # stop containers; retain data
docker compose start                # start stopped containers
docker compose restart              # restart containers
docker compose logs --tail=100      # inspect recent logs; do not share secret-bearing output
docker compose down                 # remove containers and network; retain named volumes
docker compose down --volumes       # DESTRUCTIVE: also deletes database and Caddy volumes
```

Do not use `down --volumes` unless you intentionally want to erase local database and certificate/configuration state. Back up anything you need first.

## 7. Temporary access from the internet (optional)

Prefer local-only access. A tunnel makes the service reachable outside your device and increases exposure. Use only a temporary tunnel, a strong unique administrator password, and no exchange credentials.

- **Cloudflare Tunnel / cloudflared:** use the official cloudflared installation and tunnel documentation. For quick testing, configure a tunnel to forward to `http://localhost:80`; avoid publishing a permanent public hostname unless you understand Cloudflare Access and authentication requirements.
- **ngrok:** install the official ngrok agent, authenticate it locally, then run `ngrok http 80`. Copy the temporary HTTPS forwarding URL into your browser. Do not put an ngrok token in Git or share it.

Official guides: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) · [ngrok HTTP tunnels](https://ngrok.com/docs/agent/cli/).

Do not open ports 80/443 on your home router just for this test. Stop the tunnel when finished. A tunnel does not make a local environment production-safe.

## Safety reminders

- Local means development only. Do not enter Mainnet or real Binance API keys, even for testing.
- Keep Testnet disabled. Do not set `M1_TESTNET_ORDER_SUBMISSION_ENABLED=true`.
- No live orders, no real money, and no withdrawals.
- Keep `.env` and the encryption key out of Git; never paste their contents into chat or logs.
- This local compose stack uses HTTP. Do not send sensitive credentials over a network or through a public tunnel.
