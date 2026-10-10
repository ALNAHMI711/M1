# Security Policy

## Trading safety
This repository is a chart/indicator foundation. The browser demo must not be treated as a live-trading control plane.

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
