# Trading Platform Integration Catalog — 2026-10-07

## Target
The integration target is ALNAHMI711/M1. It is the existing merge-oriented repository and already contains an Arabic RTL trading terminal example, Lightweight Charts integration, a large indicator registry, a renderer, tests, and GitHub Pages deployment.

## Selected upstream projects reviewed

| Project | Role | License / reuse decision |
|---|---|---|
| ALNAHMI711/M1 | Base indicator/chart terminal | Existing project |
| ALNAHMI711/MM | Python wrapper for Lightweight Charts | Keep as reference/optional Python adapter; do not mix Python runtime into the TS library |
| nettoai1977/chartforge | Multi-chart/watchlist/chart UX ideas | MIT; architectural reference |
| rizesky/trading_signal_bot | Binance Futures signals, MTF analysis, risk, rate limiting, chart generation | MIT; execution logic must be adapted behind a risk boundary |
| kuqitt/multi-symbol-ai-quant-platform | FastAPI + React + exchange adapters, approvals, RBAC, paper-first runtime, Telegram ops | MIT; strongest backend architecture reference |
| Creign/TradingBot | FastAPI + PostgreSQL + Next.js + Telegram baseline | Reviewed as a compact backend reference |
| Wlddzuk/TradingView-to-Telegram | TradingView webhook → FastAPI → Telegram | Reviewed for signal routing |
| Younesbenzouai/telegram-binance-bot | Telegram signal parsing → Binance | Reviewed; parser must never bypass validation/risk |
| GitLab Binance-topic projects | Market-data/order-book and self-hosted trading references | Architecture reference; no code copied without license verification |

## Architecture chosen

Browser / Arabic RTL terminal
→ Market Data Gateway
→ Indicator/Signal Engine
→ Validation
→ Risk Engine
→ Approval Gate
→ Execution Adapter
→ Binance

Side channels:
- Telegram is an operator/signal input, never a direct execution bypass.
- TradingView webhooks are normalized into the same validation path.
- Charts use the existing M1 indicator registry/renderer.
- Live execution stays disabled by default.

## Merge rules
1. No API keys or Telegram tokens in source control.
2. No withdrawal/transfer permissions for trading credentials.
3. Live mode requires explicit arming and a server-side risk gate.
4. Telegram/AI/strategy code cannot call the exchange directly.
5. Testnet/paper mode is the default.
6. Every order requires an audit record.
7. Preserve upstream licenses/notices when code is actually copied.
8. Never claim guaranteed profit.
