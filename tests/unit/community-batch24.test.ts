/**
 * Unit tests for the community batch 24 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  RhokeoVwRsiHistogram,
  DeltaVolumeRsi,
  FlowshiftOscillator,
  RsiTrendBias,
  CciHashCapital,
  HighVolumeArrowSignals,
  RsiMacdV32,
  ZScoreStdemaBands,
  RenkoSniperPro,
  ClusteringVolatility,
  CardwellRsiByTq,
  SpMacdWithDivergence,
  PolynomialRegressionMovingAverage,
  VolatilityBigMarketMoves,
  BtcLogarithmicRegressionQuantileBandsAstralVision,
  ParabolicStochSarVisualizer,
  MacdDynamicSqueezePro,
  MacdIrtov,
  BuyingVsSellingMovingAverages,
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
const ports: Array<[string, Port, string, Record<string, number>?, Record<string, number>?]> = [
  ['rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman', RhokeoVwRsiHistogram, 'plot0'],
  ['delta-volume-rsi', DeltaVolumeRsi, 'plot0'],
  ['flowshift-oscillator', FlowshiftOscillator, 'plot0'],
  ['rsi-trend-bias', RsiTrendBias, 'plot0'],
  ['cci-hash-capital', CciHashCapital, 'plot0', { plot5: 5, plot6: 5 }],
  ['high-volume-arrow-signals', HighVolumeArrowSignals, 'plot0'],
  ['rsi-macd-v3-2', RsiMacdV32, 'plot0'],
  ['z-score-stdema-bands', ZScoreStdemaBands, 'plot0'],
  ['renko-sniper-pro', RenkoSniperPro, 'plot0'],
  ['clustering-volatility', ClusteringVolatility, 'plot0'],
  ['cardwell-rsi-by-tq', CardwellRsiByTq, 'plot0'],
  ['sp-macd-with-divergence', SpMacdWithDivergence, 'plot0', { plot3: 5, plot4: 5 }],
  ['polynomial-regression-moving-average', PolynomialRegressionMovingAverage, 'plot0'],
  ['volatility-big-market-moves', VolatilityBigMarketMoves, 'plot0'],
  ['btc-logarithmic-regression-quantile-bands-astral-vision', BtcLogarithmicRegressionQuantileBandsAstralVision, 'plot0'],
  ['parabolic-stoch-sar-visualizer', ParabolicStochSarVisualizer, 'plot0'],
  ['macd-dynamic-squeeze-pro', MacdDynamicSqueezePro, 'plot0'],
  ['macd-irtov', MacdIrtov, 'plot0'],
  ['buying-vs-selling-moving-averages', BuyingVsSellingMovingAverages, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets, rightOffsets) => {
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






describe('clustering-volatility Zscore with a changing window', () => {
  it('throws for Zscore with the auto window on intraday bars (ta.sma / ta.stdev with a series length)', () => {
    const hourly = bars.slice(0, 600).map((b, i) => ({ ...b, time: 1262304000 + i * 3600 }));
    expect(() => ClusteringVolatility.calculate(hourly, { clustMethod: 'Zscore', autoWindow: true })).toThrow(/series length/);
  });

  it('runs Zscore with the auto window on daily bars (window 20 on every bar)', () => {
    expect(() => ClusteringVolatility.calculate(bars, { clustMethod: 'Zscore', autoWindow: true })).not.toThrow();
  });
});
