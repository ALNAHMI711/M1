# TradingView regression suite

Compares every indicator that has TradingView reference data with the outputs TradingView computed for its Pine
source, on the same price bars. It detects regressions: a check fails when an indicator gives fewer bars equal to
TradingView than when the reference was accepted.

```
npm run test:tv
```

The data is local only (`tests/tv-regression/data/`, git-ignored): it holds TradingView outputs and the price bars
they were computed on, so it is not published. Without this folder the suite is skipped.

## What is compared

Each fixture (`data/fixtures/<id>.json.gz`, one per registry id) holds, per dataset (BITSTAMP:BTCUSD 1D and
NASDAQ:AAPL 1D, full history; NASDAQ:AAPL 1D 2,000 bars, compared from bar 500), the TradingView outputs already
paired with the port outputs, and the number of equal bars accepted for each check:

| Check | Port output | Equal when |
|---|---|---|
| value | a plot (plus the Pine plot offset as a shift) | na on both sides, or within 1e-12 / 1e-6 relative |
| colour | plot, fill, bar, background or candle colours | same RGB, alpha within 1; na, transparent and alpha 0 are equal |
| gradient | gradient fill values and colours | as value / colour |
| markers | port markers on the bar (plus shift) of each TradingView shape | same shape (when the series has one) and colour |
| extra markers | port markers no TradingView shape explains | not more than accepted |

The accepted counts include the known differences of each port (for example the warm-up of the 2,000-bar run, or a
documented library difference), so the suite passes on the current code and fails only when a result gets worse.
More equal bars than accepted is an improvement and passes.

The candlestick patterns (`data/candlestick/<script>.json.gz`, 45 scripts, all input variants) must stay fully equal:
detection bars of each alert, labels (bar, text, style, colour, tooltip), background colours and alertconditions.

## Updating the reference

After an intended change (a fixed port, a library fix), rebuild the fixtures of the changed indicators from the
TradingView runs so that the new, better counts become the accepted ones. The fixture builder is a local research
tool (it needs the raw TradingView runs and the Pine sources); it is not part of this repository.
