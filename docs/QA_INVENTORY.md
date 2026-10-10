# M1 release QA inventory

The release is a market-analysis, safety-control and cash-only PAPER simulation
application, not a live trading product.

## Functional coverage

- Market symbol and interval controls: successful fixture feed, network failure,
  invalid symbol, switching symbol while a previous request is in flight.
- Synthetic demo: 180 candles, visible synthetic/DEMO labels, interval changes,
  no market WebSocket, no exchange order API.
- Indicators: explicitly loaded on demand, search, selection, clearing, no matches.
- Export: download CSV, synthetic filename marker, six columns.
- Theme: light/dark/light cycle, matching chart colors, no browser persistent storage.
- Control panel: open/close/Escape, invalid login, valid login, state/audit refresh,
  kill-switch on/off, blocked signal while switched on, permitted validation after
  switched off, invalid JSON, logout and subsequent invalidated session.
- Backend: persistent sessions, revocation across reloads, issuer/audience/expiry,
  role enforcement, user changes invalidate sessions, bounded chunked bodies,
  throttling, atomic concurrent signal claims, database backup/restore.
- Exchange boundaries: live boolean bypass blocked, origin and operation
  allowlists, disabled withdrawals/transfers, kill switch prevents Testnet request.
- PAPER: exact decimal cash/cost/PnL/fees, partial closes, adverse spread/slippage
  assumptions, server-computed entry and portfolio risk including planned exit
  fees, daily realized loss budgets, no shorts/leverage, role and user isolation,
  atomic idempotency and spending, restart and backup/restore, private bounded
  formula-safe CSV. Browser: buy/replay/sell/export/invalid JSON/logout.
- Reconciliation: atomic compare-and-update, monotonic cumulative fills and
  clocks, semantic duplicates, terminal guards, concurrent REST/stream race,
  TESTNET/SPOT/USDM isolation, explicit quarantine retry, legacy market UNKNOWN.
- Spot REST recovery and stream consumption reject LIVE or unlabeled clients.

## Phase-two local verification

- Python 3.11: 307 tests passed, with one Starlette/httpx deprecation warning.
- Playwright: five tests passed against an isolated real local backend.
- TypeScript library tests: rerun results are recorded in the release report.
- Terminal/config typechecks and example build passed.
- Docker workflow and CI-only restart harness added; Docker is unavailable in
  the local sandbox. Remote status must be checked for the published commit.

## Visual coverage

- Desktop 1440×900: chart, toolbar, watchlist, indicator controls and status visible.
- Mobile 390×844: chart first, stacked watchlist, no horizontal page overflow.
- Both themes, failed market connection, explicit demo labels, open control dialog.
- Keyboard focus, labels, minimum 44px button targets, no text smaller than 12px.

## Exclusions requiring external infrastructure

- Authenticated Binance Testnet end-to-end requests and real stream recovery.
- Docker engine startup, real domain/TLS issuance, server backup rotation and alerts.
- Independent penetration testing, production user management, 2FA.
- COIN-M, margin, Alpha and stocks live adapters; all remain disabled.
