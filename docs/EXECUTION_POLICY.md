# Execution policy boundary

All trade requests must pass through `ExecutionRequest -> authorize_execution -> adapter mode check -> submit`.

## Safety invariants
- Strategy, AI, Telegram, webhooks, and dashboard components must create an intent/request only; they must not call exchange APIs directly.
- The risk gate is mandatory. Rejected decisions never call the adapter.
- Adapter execution mode must exactly match request mode.
- `TESTNET` and `LIVE` are fail-closed until authenticated adapters, exchange metadata validation, persistence, idempotency, reconciliation/recovery, audit logging, Trusted IP verification, and withdrawal/transfer permission checks are implemented and validated.
- Adapter exceptions are converted to a generic failure result; exchange response bodies and secrets must not be exposed.
- The current interface does not claim to provide a real Binance adapter or paper fills. Test adapters exist only for policy tests.
- Never store exchange credentials in browser code, Telegram, logs, or source control.

## Before enabling a real adapter
1. Validate symbol filters, step size, tick size, min quantity/notional and precision from official exchange metadata.
2. Make client order IDs durable and idempotent; persist intent before submission.
3. Handle ambiguous network timeouts by querying the exchange with the client order ID before any retry.
4. Validate server-side IP allowlisting and explicitly confirm withdrawal/transfer permissions are disabled.
5. Exercise authenticated Testnet flows, restart recovery, stale/duplicate event handling, rate limits, and kill-switch tests.
6. Require successful CI/security checks and human review before any live enablement.
