/**
 * Unit tests for the community batch 2 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  GaussianFilterTrend,
  CandleBreakoutOscillator,
  DirectionalLogisticOscillator,
  DynamicFlowRibbons,
  FractalsTrend,
  RocWeightedMAOscillator,
  SavitzkyFlowBands,
  MACDV,
  RangeTighteningIndicator,
  ATRRope,
  RedKMagicRibbon,
  VolumePositiveNegative,
  ATRHEMA,
  DynamicVolumeClusters,
  DynamicTrendBands,
  PriceVolumeValueHistogram,
  FractalExhaustionBand,
  SmartMoneyFlowSignals,
  LinearPredictiveFilters,
  TradingActivityIndex,
  indicatorRegistry,
} from '../../src/index';

/** 3200 daily bars (seeded random walk with up and down phases): Wavelet-Trend needs 3000+ bars */
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
const ports: Array<[string, Port]> = [
  ['gaussian-filter-trend', GaussianFilterTrend],
  ['candle-breakout-oscillator', CandleBreakoutOscillator],
  ['directional-logistic-oscillator', DirectionalLogisticOscillator],
  ['dynamic-flow-ribbons', DynamicFlowRibbons],
  ['fractals-trend', FractalsTrend],
  ['roc-weighted-ma-oscillator', RocWeightedMAOscillator],
  ['savitzky-flow-bands', SavitzkyFlowBands],
  ['macd-v', MACDV],
  ['range-tightening-indicator', RangeTighteningIndicator],
  ['atr-rope', ATRRope],
  ['redk-magic-ribbon', RedKMagicRibbon],
  ['volume-positive-negative', VolumePositiveNegative],
  ['atr-hema', ATRHEMA],
  ['dynamic-volume-clusters', DynamicVolumeClusters],
  ['dynamic-trend-bands', DynamicTrendBands],
  ['price-volume-value-histogram', PriceVolumeValueHistogram],
  ['fractal-exhaustion-band', FractalExhaustionBand],
  ['smart-money-flow-signals', SmartMoneyFlowSignals],
  ['linear-predictive-filters', LinearPredictiveFilters],
  ['trading-activity-index', TradingActivityIndex],
];

describe.each(ports)('%s', (id, port) => {
  const result = port.calculate(bars);

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === id);
    expect(entry).toBeDefined();
    expect(entry!.group).toBe('community');
    expect(entry!.overlay).toBe(port.metadata.overlay);
    expect(result.metadata.overlay).toBe(port.metadata.overlay);
  });

  it('returns one point per bar in every plot (and points after the last bar only for offsets)', () => {
    const last = bars[bars.length - 1].time;
    for (const points of Object.values(result.plots as Record<string, Array<{ time: number; value: number }>>)) {
      const inBars = points.filter((p) => p.time <= last);
      expect(inBars).toHaveLength(bars.length);
      inBars.forEach((p, i) => expect(p.time).toBe(bars[i].time));
    }
  });

  it('produces finite values in its first plot with values', () => {
    const plots = Object.values(result.plots as Record<string, Array<{ value: number }>>);
    const main = plots.find((p) => p.some((pt) => !isNaN(pt.value)));
    expect(main).toBeDefined();
    main!.filter((p) => !isNaN(p.value)).forEach((p) => expect(isFinite(p.value)).toBe(true));
  });
});
