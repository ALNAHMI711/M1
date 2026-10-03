/**
 * Unit tests for the community batch 29 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  Rsi5Up,
  MacdLiquidityTrackerSystem,
  AnchoredVwapWithBuySellSignals,
  MechartMovingAverageAndAboveV11,
  HarmonicPeriodicityMatrix,
  Vim,
  StockbeeComboBull,
  StockbeeReversalBullishV2,
  GhostEmaCloud,
  IchimokuScoreIndicator,
  RsiWithAutoZoneColorsOverboughtOversoldHighlighter,
  WaveletFilterWithAdaptiveUpsampling,
  EmaCrossSignals,
  FarazPerfectStructureScalperLongShort,
  MlDeepRegressionPro,
  KalmanFilterTrendBreakers,
  HighLowOfXBar,
  MaRibbon5ema20ema50sma200ema,
  WilliamsPercentRangeWithThreshold,
  TrueHighLowRsiForDivergence,
  indicatorRegistry,
} from '../../src/index';

/** 3200 daily bars (seeded random walk with up and down phases) */
function makeFixture() {
  const bars: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let price = 100;
  for (let i = 0; i < 3200; i++) {
    const drift = Math.sin(i / 150) * 0.4;
    const open = price;
    const close = Math.max(1, price + drift + (rand() - 0.5) * 4);
    const high = Math.max(open, close) + rand() * 2;
    const low = Math.max(0.5, Math.min(open, close) - rand() * 2);
    bars.push({ time: 1262304000 + i * 86400, open, high, low, close, volume: 500 + Math.floor(rand() * 1000) });
    price = close;
  }
  return bars;
}

const bars = makeFixture();

type Port = { calculate: (b: typeof bars, inputs?: any) => any; metadata: { overlay: boolean } };
/** id, port, main plot, plots drawn with a negative offset (first bars left out) */
/** 6th field: plots with Pine show_last = 1 (one point, drawn after the last bar) */
const ports: Array<[string, Port, string, Record<string, number>?, Record<string, number>?, string[]?]> = [
  ['rsi-5up', Rsi5Up, 'plot0', { plot5: 5, plot6: 5 }],
  ['macd-liquidity-tracker-system', MacdLiquidityTrackerSystem, 'plot0'],
  ['mechart-moving-average-and-above-v1-1', MechartMovingAverageAndAboveV11, 'plot0'],
  ['harmonic-periodicity-matrix', HarmonicPeriodicityMatrix, 'plot0'],
  ['vim', Vim, 'plot0'],
  ['stockbee-combobull', StockbeeComboBull, 'plot0'],
  ['stockbee-reversal-bullish-v2', StockbeeReversalBullishV2, 'plot0'],
  ['gho-t-ema-cloud', GhostEmaCloud, 'plot0'],
  ['ichimoku-score-indicator', IchimokuScoreIndicator, 'plot5', { plot2: 26 }, { plot3: 26, plot4: 26 }],
  ['rsi-with-auto-zone-colors-overbought-oversold-highlighter', RsiWithAutoZoneColorsOverboughtOversoldHighlighter, 'plot0'],
  ['wavelet-filter-with-adaptive-upsampling', WaveletFilterWithAdaptiveUpsampling, 'plot0'],
  ['ema-cross-signals', EmaCrossSignals, 'plot0'],
  ['faraz-perfect-structure-scalper-long-short', FarazPerfectStructureScalperLongShort, 'plot0'],
  ['ml-deep-regression-pro', MlDeepRegressionPro, 'plot0'],
  ['kalman-filter-trend-breakers', KalmanFilterTrendBreakers, 'plot0'],
  ['high-low-of-x-bar', HighLowOfXBar, 'plot0'],
  ['ma-ribbon-5ema-20ema-50sma-200ema', MaRibbon5ema20ema50sma200ema, 'plot0'],
  ['williams-percent-range-with-threshold', WilliamsPercentRangeWithThreshold, 'plot0'],
  ['true-high-low-rsi-for-divergence', TrueHighLowRsiForDivergence, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets, rightOffsets, singlePoint) => {
  const result = port.calculate(bars, {});

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === id);
    expect(entry).toBeDefined();
    expect(entry!.group).toBe('community');
    expect(entry!.overlay).toBe(port.metadata.overlay);
    expect(result.metadata.overlay).toBe(port.metadata.overlay);
  });

  it('returns one point per bar in every plot (bars left out only for negative offsets)', () => {
    for (const [key, points] of Object.entries(result.plots as Record<string, Array<{ time: number }>>)) {
      if (singlePoint?.includes(key)) {
        expect(points).toHaveLength(1);
        expect(points[0].time).toBeGreaterThan(bars[bars.length - 1].time);
        continue;
      }
      const skip = leftOffsets?.[key] ?? 0;
      // positive Pine offset k: the value of bar i is drawn on bar i + k, the last k points on future bar times
      const ahead = rightOffsets?.[key] ?? 0;
      expect(points).toHaveLength(bars.length - skip);
      points.forEach((p, i) => {
        if (i + ahead < bars.length) expect(p.time).toBe(bars[i + ahead].time);
        else expect(p.time).toBeGreaterThan(points[i - 1].time);
      });
    }
  });

  it('produces finite values in its main output', () => {
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});






describe('anchored-vwap-with-buy-sell-signals (anchor inside the fixture)', () => {
  // the default anchor (01/10/2023) is after the fixture: anchor = bar 1000 (Pine time input in ms)
  const result = AnchoredVwapWithBuySellSignals.calculate(bars, { anchorDate: bars[1000].time * 1000 });

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === 'anchored-vwap-with-buy-sell-signals');
    expect(entry).toBeDefined();
    expect(entry!.overlay).toBe(AnchoredVwapWithBuySellSignals.metadata.overlay);
  });

  it('gives na before the anchor and finite values from it', () => {
    const vals = (result.plots.plot0 as Array<{ value: number }>).map((p) => p.value);
    expect(vals.slice(0, 1000).every((v) => isNaN(v))).toBe(true);
    vals.slice(1000).forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('gives no value with the default anchor (after the fixture)', () => {
    const r = AnchoredVwapWithBuySellSignals.calculate(bars, {});
    expect(r.plots.plot0.every((p: { value: number }) => isNaN(p.value))).toBe(true);
  });
});
