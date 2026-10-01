/**
 * Unit tests for the community batch 11 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  BuyersSellersRange,
  LaguerreKalmanAdaptiveFilterAlphanatt,
  VpsaVtd,
  PivotMarketStructure,
  ConsecutiveCandlesDevisso,
  SigmoidRsiNal,
  AiInfinity,
  PriceActionSignalsFilteredEma,
  LogitRsi,
  PeakReversalV2,
  LongShortDom,
  RsiConfirmTrendWithWilliams,
  AdjustedRsi,
  RsiZoneStepLines,
  HmaBreakdown,
  AiAdaptiveOscillator,
  BuySellHullCrossoverSignals,
  SslHybridScalper,
  MachineLearningKnnTrendPredictor,
  TenkanCloudSignals,
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
  ['buyers-sellers-range', BuyersSellersRange, 'plot0'],
  ['laguerre-kalman-adaptive-filter-alphanatt', LaguerreKalmanAdaptiveFilterAlphanatt, 'plot0'],
  ['vpsa-vtd', VpsaVtd, 'plot0'],
  ['pivot-market-structure', PivotMarketStructure, 'plot0', { plot2: 5, plot3: 5 }],
  ['consecutive-candles-devisso', ConsecutiveCandlesDevisso, 'plot0'],
  ['sigmoid-rsi-nal', SigmoidRsiNal, 'plot0'],
  ['ai-infinity', AiInfinity, 'plot3'],
  ['price-action-signals-filtered-ema', PriceActionSignalsFilteredEma, 'plot0'],
  ['logit-rsi', LogitRsi, 'plot0'],
  ['peak-reversal-v2', PeakReversalV2, 'plot3'],
  ['long-short-dom', LongShortDom, 'plot0'],
  ['rsi-confirm-trend-with-williams', RsiConfirmTrendWithWilliams, 'plot0'],
  ['adjusted-rsi', AdjustedRsi, 'plot0'],
  ['rsi-zone-step-lines', RsiZoneStepLines, 'plot0'],
  ['hma-breakdown', HmaBreakdown, 'plot0'],
  ['ai-adaptive-oscillator', AiAdaptiveOscillator, 'plot0'],
  ['buy-sell-hull-crossover-signals', BuySellHullCrossoverSignals, 'plot0'],
  ['ssl-hybrid-scalper', SslHybridScalper, 'plot0'],
  ['machine-learning-knn-trend-predictor', MachineLearningKnnTrendPredictor, 'plot0'],
  ['tenkan-cloud-signals', TenkanCloudSignals, 'plot0', undefined, { plot2: 22, plot3: 22 }],
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
