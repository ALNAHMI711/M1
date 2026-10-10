# Indicator Library Review and Integration Plan

Reviewed: 2026-10-10
Target: M1 trading platform, branch `integration/trading-platform-2026-10-07`

## Decision

Do not bulk-copy either upstream repository into the runtime. Treat upstreams as sources to audit and adapt; integrate only code whose license, runtime, data contract, correctness, and tests are verified.

## Candidates reviewed

### 1. shunjizhan/all-candlestick-pattern-indicators
- Upstream: https://github.com/shunjizhan/all-candlestick-pattern-indicators
- Main artifact: `all-patterns.pine`, a TradingView Pine Script v4 overlay.
- Contains common bullish, bearish, and neutral candle patterns including engulfing, hammer, shooting star, doji, stars, soldiers/crows, harami, and gap patterns.
- Fit: useful as a pattern checklist and reference for pattern definitions; not a drop-in Python/TypeScript library because it uses Pine Script series/history semantics and TradingView drawing/alert APIs.
- License: no LICENSE file was confirmed during this review. **Do not copy source code into M1 until license terms are verified.**
- Integration approach: implement independently specified, deterministic OHLCV pattern detectors with explicit lookback, warm-up, and confirmed-candle semantics; preserve attribution only where license permits and code is actually reused.

### 2. ZENG3LD/mylittleindicators
- Upstream: https://github.com/ZENG3LD/mylittleindicators
- README describes a Rust library with 559 bar indicators and 21 event primitives, including candle patterns, swing detection, divergence, line crosses, volume/volatility events, BOS, and FVG.
- README declares MIT license.
- Fit: potentially valuable for broad indicator/event coverage, but the library is Rust and its full-stream contract includes exchange/order-book types not currently represented by M1's browser indicator interface. Its exchange connector integration and large dependency surface need review before adoption.
- Integration approach: first evaluate build size, compile time, dependencies, API coverage, output semantics, and license notices in an isolated spike. Do not add the entire crate to production until the needed subset and performance are measured.

## Target M1 architecture

1. **OHLCV validation** — finite values; high >= max(open, close); low <= min(open, close); high >= low; monotonic timestamps; reject malformed bars.
2. **Indicator registry** — stable ID, name, category, required history, parameters, output type, source/license, version, test vectors.
3. **Candle-pattern detectors** — one-bar, two-bar, and multi-bar patterns; only emit final signals after candle close unless explicitly configured for provisional output.
4. **Trend/momentum/volatility** — EMA/SMA, RSI, MACD, ADX, ATR, VWAP, stochastic and ROC with documented warm-up behavior.
5. **Structure/events** — pivots/swing highs-lows, BOS/CHoCH, FVG, liquidity sweep, support/resistance and chart patterns, each with lookback and invalidation rules.
6. **Multi-timeframe layer** — align only completed higher-timeframe candles to avoid look-ahead leakage.
7. **Confluence engine** — combine independent evidence, track conflicting signals and missing data, enforce score/RR/spread/slippage/risk limits; a single indicator never guarantees a trade.
8. **Backtest contract** — deterministic fixtures, fees, slippage, stop gap-through, no look-ahead, and reproducible output.

## Integration acceptance criteria

- License and provenance reviewed before copying any upstream source.
- No new dependency without a concrete need and maintenance review.
- Unit tests for boundary cases, warm-up periods, NaN/Infinity, flat bars, zero range, gaps, and incomplete candles.
- Golden OHLCV fixtures cross-checked against an independent reference.
- Multi-timeframe tests prove no future candle data leaks into earlier decisions.
- UI labels and signal IDs come from one registry, not duplicated lists.
- Existing CI and security audit pass on the exact commit.
- Indicator output is informational and cannot call an exchange execution API.
- LIVE trading remains disabled until the separate server-side execution, authentication, persistence, recovery, and risk controls are verified.

## Scope note

This document records a source review and implementation decision; it does not claim that either upstream library has been integrated into the runtime. Keep the upstream repositories as references until the acceptance criteria are met.
