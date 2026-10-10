# M1 Trading Control Plane

This service is the server-side boundary for future trading automation. It accepts normalized signals, validates them, applies hard risk gates, and must not expose Binance credentials to the browser.

## Current state

- FastAPI control plane, authentication primitives, persistence, audit events, execution contracts/policies, risk gate and gated-executor modules exist.
- Spot REST/User Data Stream and USDⓈ-M state/recovery/reconciliation components have tests.
- This is not yet approved for production or live trading. Review the current branch and GitHub Actions results before each release.

## Modes

DEVELOPMENT / BACKTEST / DRY_RUN / PAPER / TESTNET / LIVE

LIVE must remain blocked by default until authenticated sessions and authorization, persistent audit/idempotency, server-side IP allowlisting, withdrawal/transfer prohibition, exchange filters and signing, restart recovery, end-to-end Testnet validation, and successful CI/security checks are all verified.

## Required signal path

TradingView / Telegram / strategy / AI → normalized signal → validation → risk gate → approval → execution policy → gated executor → exchange adapter → persistent audit/reconciliation.

No input channel may call the exchange directly or bypass the risk gate. The kill switch must prevent new execution without blindly liquidating existing positions.

## Checks

From `backend/` run `python -m compileall app tests` and `pytest -q`. Run these on the current branch and verify GitHub Actions checks for the exact latest commit SHA. A previous green run does not validate a newer commit.

## Handoff and remaining work

See [Arabic project status and handoff plan](../docs/PROJECT_STATUS_AND_HANDOFF_AR.md) for verified scope, remaining security and test gates, cleanup rules, and the ordered completion plan.