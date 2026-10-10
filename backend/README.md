# M1 Trading Control Plane

## تحديث التسليم

راجع [دليل التشغيل](../docs/OPERATIONS_AR.md) و
[نطاق التسليم](../docs/RELEASE_DELIVERY_AR.md).
الجلسات وإبطالها ومفتاح الإيقاف محفوظة في SQLite.
LIVE مغلق. يوجد محاكي PAPER نقدي محفوظ للأرصدة والمراكز والرسوم،
بأسعار افتراضية يحددها المستخدم، دون اتصال تنفيذ ببورصة.
راجع [دليل PAPER](../docs/PAPER_SIMULATION_AR.md)؛ ليس تداولًا حقيقيًا
ولا محاكاة لتعبئة سوق موثقة أو أوامر وقف تلقائية.

This service is the server-side boundary for future trading automation. It accepts normalized signals, validates them, applies hard risk gates, and must not expose Binance credentials to the browser.

## Current state

- FastAPI control plane, authentication primitives, persistence, audit events, execution contracts/policies, risk gate and gated-executor modules exist.
- Spot REST/User Data Stream and USDⓈ-M state/recovery/reconciliation components have tests.
- Spot Testnet static preflight checks fresh exchangeInfo for symbol status,
  order type, quantity step/bounds, LIMIT tick/bounds and notional. Dynamic
  reference-price/account/asset filters are not locally certified; signed
  `/order/test` is validation-only and requires Testnet keys on your own backend.
- See [Testnet preflight guide](../docs/TESTNET_PREFLIGHT_AR.md). Public Testnet
  access from the delivery sandbox returned HTTP 451; no circumvention or
  authenticated integration was attempted.
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
