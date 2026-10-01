/**
 * Unit tests for the community batch 15 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  PriceActionBandsTrendVolatility,
  MedianGaussianTrendNal,
  GuppyMMA,
  STHUnrealizedProfitLossRatio,
  KERPDNoiseFilter,
  BuyLowSellHighCompositeUpgradedV6,
  MacdSniper,
  TrueMomentumOscillator,
  CandleRangeTheoryByLucas,
  TascAdaptiveSuperSmoother,
  Mpo4LinesModalEngine,
  FilterWave,
  CarrierVolatility,
  AuraAdaptiveStatisticalSmoother,
  SavitzkyGolayHampelFilterAlphanatt,
  InverseDistanceWeightedMovingAverage,
  MovingAveragesWithContinuousPeriods,
  TheMeanGooseV1,
  EnhancedKLSEBankerFlowOscillator,
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
  ['price-action-bands-trend-volatility', PriceActionBandsTrendVolatility, 'plot0'],
  ['median-gaussian-trend-nal', MedianGaussianTrendNal, 'plot0'],
  ['guppy-mma', GuppyMMA, 'plot0'],
  ['sth-unrealized-profit-loss-ratio', STHUnrealizedProfitLossRatio, 'plot0'],
  ['kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density', KERPDNoiseFilter, 'plot0'],
  ['buy-low-sell-high-composite-upgraded-v6', BuyLowSellHighCompositeUpgradedV6, 'plot0'],
  ['macd-sniper', MacdSniper, 'plot1'],
  ['tmo', TrueMomentumOscillator, 'plot0'],
  ['candle-range-theory-by-lucas', CandleRangeTheoryByLucas, 'plot0'],
  ['tasc-2026-09-adaptive-supersmoother', TascAdaptiveSuperSmoother, 'plot0'],
  ['mpo4-lines-modal-engine', Mpo4LinesModalEngine, 'plot0', { plot11: 2, plot12: 2 }],
  ['filter-wave', FilterWave, 'plot0'],
  ['carrier-volatility', CarrierVolatility, 'plot0', { plot1: 1, plot4: 1 }],
  ['aura-adaptive-statistical-smoother', AuraAdaptiveStatisticalSmoother, 'plot0'],
  ['savitzky-golay-hampel-filter-alphanatt', SavitzkyGolayHampelFilterAlphanatt, 'plot0'],
  ['inverse-distance-weighted-moving-average', InverseDistanceWeightedMovingAverage, 'plot0'],
  ['moving-averages-with-continuous-periods', MovingAveragesWithContinuousPeriods, 'plot0'],
  ['the-mean-goose-v1', TheMeanGooseV1, 'plot0'],
  ['enhanced-klse-banker-flow-oscillator', EnhancedKLSEBankerFlowOscillator, 'plot0'],
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
