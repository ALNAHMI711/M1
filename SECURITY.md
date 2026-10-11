# Security Policy

## Trading safety
This repository provides charts/indicators, safety controls and a cash-only
PAPER ledger. The browser must not be treated as a live-trading control plane.
PAPER uses explicit user assumptions, not guaranteed exchange prices or fills.

Before enabling future LIVE execution:
- keep Binance withdrawals/transfers disabled;
- restrict the Binance API key by server egress IP;
- use trading-only permissions;
- store secrets server-side;
- validate every signal through the risk engine;
- test in paper/testnet mode first.

## Reporting
Do not publish API keys, Telegram bot tokens, session cookies, private URLs, or other credentials in issues or pull requests. If a real secret is exposed, revoke/rotate it immediately and report the incident privately to the repository owner.

## Scope
CI security checks are a baseline, not a guarantee of system safety or profitability.

## Operational controls

Users, session revocations and the kill switch persist in private SQLite state.
Password/role changes revoke sessions; restore revokes all sessions and activates
the kill switch. Keep the DB, backups and `.env` out of Git. Requests have bounded
bodies, durable throttles and Host checks; arbitrary forwarded-IP headers are not trusted.

LIVE cannot be enabled by a boolean flag. Spot origins and read/validation-only
operations are allowlisted; redirects and withdrawals/transfers/real order submission
are blocked. The kill switch blocks new attempts, not liquidation or cancellation.
Read `docs/OPERATIONS_AR.md` for remaining infrastructure and trading gates.

PAPER accounts and CSV exports are user-isolated. Entry budgets and cash are
computed server-side; order/account/audit changes are atomic and idempotent.
No short selling, leverage or automatic stops are provided. The global kill
switch blocks new simulated fills including closing sells; it does not
guarantee liquidation. Recovery and Spot stream reject LIVE or unlabeled
clients, and event updates enforce mode/market and monotonic fill/state guards.
