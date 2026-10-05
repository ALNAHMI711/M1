# ALNAHMI Unified Trading Terminal

This branch consolidates the useful browser-side charting work from `ALNAHMI711/M1` with the chart/drawing ideas present in `ALNAHMI711/MM`.

## What was retained

- `M1` remains the technical-analysis core: standard indicators, community indicators, candlestick patterns, Pine-compatible result shapes, and the renderer.
- `MM` was audited as two separate concerns: the Python `lightweight-charts` wrapper and its TypeScript interactive drawing primitives.
- The browser terminal uses `M1` + Lightweight Charts 5 as the base because it is already aligned with the current browser build and indicator renderer.
- The interactive drawing concepts from `MM` should not be copied verbatim: `MM` pins an older Lightweight Charts dependency and its plugin API differs. Direct copying would create version-coupling and maintenance risk.

## Trading page

The Vite demo entry point is `example/index.html`; the deployed GitHub Pages site uses the repository root path.

It provides Arabic RTL dark terminal layout, symbol search, watchlist, 1m/5m/15m/1h/4h/1d intervals, Binance Spot public candles over REST, Binance kline WebSocket updates, indicator search using the M1 registry, one active indicator rendered through the M1 renderer, responsive mobile layout, and a market-analysis-first interface. Execution controls are intentionally absent until a secure server-side trading backend and risk engine exist.

## Security boundary

The page does not contain API keys, signing secrets, or live-order code. Live execution should be connected later to the server-side trading backend and risk engine. The browser must never be trusted with exchange secrets.

## Licensing

Both source repositories currently declare MIT licenses, but their copyright notices must be preserved for copied substantial portions. TradingView Lightweight Charts is Apache 2.0; it is separate from TradingView's proprietary Advanced Charts and Trading Platform libraries. Community indicator sources may have additional attribution/reuse requirements and must be reviewed before redistribution or commercial use.
