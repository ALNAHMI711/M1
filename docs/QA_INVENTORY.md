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
- Docker workflow and CI-only restart harness passed on code SHA
  `78a00ba568ff71d0517db87a31d35405c48f1711`:
  [Compose verification](https://github.com/ALNAHMI711/M1/actions/runs/38018329088).
  Local sandbox has no Docker engine; CI is isolated, not production hosting.
- PAPER dialog inspected at desktop 1440px and mobile 390px, light/dark,
  with real local login and a successful simulated fill; no horizontal overflow.
- Updated private preview checked through cloud browser: real preview login,
  PAPER account and accepted simulated BUY, no exchange order.

## Visual coverage

- Desktop 1440×900: chart, toolbar, watchlist, indicator controls and status visible.
- Mobile 390×844: chart first, stacked watchlist, no horizontal page overflow.
- Both themes, failed market connection, explicit demo labels, open control dialog.
- Keyboard focus, labels, minimum 44px button targets, no text smaller than 12px.

## Exclusions requiring external infrastructure

- Authenticated Binance Testnet end-to-end requests and real stream recovery.
- Real domain/TLS issuance, production server backup rotation and alerts.
- Independent penetration testing, production user management, 2FA.
- COIN-M, margin, Alpha and stocks live adapters; all remain disabled.

## Phase-three preflight

- Python 3.11: 365 tests passed, one existing Starlette/httpx warning.
- Spot symbol status/mode/type, exact decimal LOT/MARKET_LOT/PRICE increments
  and bounds, LIMIT notional, zero-disabled bounds, deferred dynamic checks.
- Invalid/missing/duplicate/unknown metadata fails closed; fresh metadata fetch
  before signed order validation; kill during fetch prevents signed validation.
- API refuses caller metadata and mismatched LIMIT signal/price; VIEWER public
  preflight uses no exchange keys; errors are redacted, no real order route.
- CLI probe loads no credentials, performs only GET, and returns stable failures.
- Actual public Testnet access returned HTTP 451. Authenticated exchange and
  dynamic/account/asset filters remain unverified; no regional circumvention.
