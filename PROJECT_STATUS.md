# M1 Project Status — v1.0.0 Testnet-Ready

## What works
- Safety layer and server-side risk/permission checks.
- Spot Testnet order path restricted to **BUY LIMIT only**, with Testnet disabled by default.
- Atomic reservation/idempotency protections.
- UNKNOWN order-state handling and reconciliation.
- Encrypted secret storage; encryption key is supplied outside the repository.
- Administrative UI and audit/control flows.
- Automated Python, Node, and Playwright test suites (see release PR and Actions for exact commit-specific results).

## What does not work / is intentionally blocked
- LIVE trading.
- SELL orders.
- MARKET orders.
- Margin trading.
- USDⓈ-M Futures.
- COIN-M Futures.
- Encryption-key rotation.

## Not yet tested
- A real authenticated connection and signed order lifecycle against Binance Spot Testnet. Do not treat the path as exchange-verified until that test has been performed separately with dedicated Testnet credentials.

## How to run
- Local Docker setup: see [LOCAL_DEV.md](LOCAL_DEV.md).
- Oracle Cloud staging preparation: see [DEPLOYMENT_STAGING.md](DEPLOYMENT_STAGING.md). This is documentation only; no server deployment is performed by this release.

## Permanent security notes
- Never commit real exchange keys, passwords, tokens, or cloud credentials to any repository file.
- Keep the encryption key outside the repository and inject it through the local/server environment.
- Disconnect Vercel manually under **Settings → Git → Disconnect**. vercel.json is only an additional defensive layer, not a replacement for disconnecting Vercel.
- Do not enable LIVE until a real Spot Testnet end-to-end validation has been completed and independently reviewed.
- Testnet is disabled by default. No server deployment or Testnet activation is part of this release.
ملاحظة: وجود vercel.json لا يعني أن Vercel مفصول. الفصل الفعلي يتم يدوياً من إعدادات Vercel (Settings → Git → Disconnect). تحقق من حالة الفصل قبل اعتبار هذه النقطة مكتملة.
