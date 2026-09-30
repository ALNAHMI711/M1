/**
 * Unit tests for the community batch 4 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  AdaptiveEhlersFilteredPercentile,
  AdaptiveVolatilityScaledOscillator,
  DynamicVolatilityFilter,
  TrendStateSignals,
  AsymmetricVolatilityTrendLine,
  FractionalEmaKalmanFilter,
  UptrickVolatilityReversionBands,
  OaSmes,
  FilterRibbon,
  KalmanVwapFilter,
  MultiBandTrendLine,
  ProjectedCrossoverTrend,
  InstitutionalMacd,
  TrendCylinder,
  MultiOscillatorAdaptiveKernel,
  AdaptiveTrendChannel,
  RenkoBoxes,
  NlmsVolatilityTrail,
  SimplifiedPercentileClustering,
  AtrBasedZigzagWEma,
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
const ports: Array<[string, Port, string, Record<string, number>?]> = [
  ['adaptive-ehlers-filtered-percentile', AdaptiveEhlersFilteredPercentile, 'plot0'],
  ['adaptive-volatility-scaled-oscillator', AdaptiveVolatilityScaledOscillator, 'plot0'],
  ['dynamic-volatility-filter', DynamicVolatilityFilter, 'plot0'],
  ['trend-state-signals', TrendStateSignals, 'plot0'],
  ['asymmetric-volatility-trend-line', AsymmetricVolatilityTrendLine, 'plot0'],
  ['fractional-ema-kalman-filter', FractionalEmaKalmanFilter, 'plot2', { plot1: 1 }],
  ['uptrick-volatility-reversion-bands', UptrickVolatilityReversionBands, 'plot0'],
  ['oa-smes', OaSmes, 'plot0'],
  ['filter-ribbon', FilterRibbon, 'plot0'],
  ['kalman-vwap-filter', KalmanVwapFilter, 'plot0'],
  ['multi-band-trend-line', MultiBandTrendLine, 'plot0'],
  ['projected-crossover-trend', ProjectedCrossoverTrend, 'plot0'],
  ['institutional-macd', InstitutionalMacd, 'plot0'],
  ['trendcylinder', TrendCylinder, 'plot0'],
  ['multi-oscillator-adaptive-kernel-alphaalgos', MultiOscillatorAdaptiveKernel, 'plot0'],
  ['adaptive-trend-channel', AdaptiveTrendChannel, 'plot0'],
  ['renko-boxes', RenkoBoxes, 'plot0'],
  ['nlms-volatility-trail', NlmsVolatilityTrail, 'plot0'],
  ['simplified-percentile-clustering', SimplifiedPercentileClustering, 'plot0'],
  ['atr-based-zigzag-w-ema', AtrBasedZigzagWEma, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets) => {
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
      expect(points).toHaveLength(bars.length - skip);
      points.forEach((p, i) => expect(p.time).toBe(bars[i].time));
    }
  });

  it('produces finite values in its main output', () => {
    const vals = (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});
