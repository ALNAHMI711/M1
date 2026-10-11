# Security Audit — 2026-10-07

## Scope
Static review of the current M1 repository plus first-pass review of selected upstream trading/chart repositories.

## Current M1 findings

### Positive
- Repository has .gitignore.
- CI, Pages deployment, and publish workflows exist.
- No obvious hard-coded API-secret patterns were returned by repository code search.
- No eval( matches were returned.
- No innerHTML matches were returned.
- No process.env usage was found in the current browser example.
- The current browser example consumes Binance public market-data endpoints and does not submit orders.
- Symbol input is validated before market-data requests.
- M1 package metadata declares MIT licensing.

### Required hardening
1. Browser Binance access is appropriate for public data only; authenticated order execution must be server-side.
2. M1 has no backend auth/execution layer yet.
3. Production WebSocket handling needs bounded reconnect/backoff and health monitoring.
4. A browser order button must never bypass a server-side risk gate.
5. CI should run dependency audit plus typecheck/tests.
6. Review upstream provenance and licenses before copying code.
7. Trading secrets must never reach the browser or Telegram messages.

## Production security model
- DEVELOPMENT / BACKTEST / DRY_RUN / PAPER / LIVE modes.
- LIVE disabled by default.
- Binance API key IP restriction required before LIVE.
- Trading-only permission; withdrawals/transfers prohibited.
- Encrypted server-side secret storage.
- RBAC, secure sessions, rate limits.
- Telegram allowlist/binding and command authorization.
- Risk engine cannot be bypassed by AI, Telegram, TradingView, or strategy.
- Order idempotency and duplicate-signal protection.
- Server-side SL/TP where supported.
- Immutable audit events for signal → validation → risk → approval → execution.
- Kill switch stops new automation and does not blindly liquidate positions.

## Result
Current M1 chart/demo surface is acceptable for public market-data visualization, but is NOT approved for live trading. Production approval requires a server-side execution service, authenticated API, persistence, integration tests, dependency scan results, and a testnet run.
