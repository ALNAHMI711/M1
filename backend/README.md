# M1 Trading Control Plane

This service is the server-side boundary for future trading automation. It accepts normalized signals, validates them, applies hard risk gates, and intentionally does not expose Binance credentials to the browser.

## Modes
DEVELOPMENT / BACKTEST / DRY_RUN / PAPER / LIVE

LIVE is blocked by default until the server-side execution adapter, authenticated sessions, persistence, audit trail, IP restriction checks, and testnet validation are implemented.

## Signal path
TradingView / Telegram / strategy → normalized signal → validation → risk gate → approval → execution adapter.

The current slice stops after the risk gate; no real order is sent.
