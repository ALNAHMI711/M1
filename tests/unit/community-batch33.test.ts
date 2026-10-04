/**
 * Unit tests for the community batch 33 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  GoldTrendSignalIndicator,
  EhlersMaclaurinUltimateSmoother,
  ApexVolatilitySqueezeBreakout,
  OrderFlowImbalanceOscillator,
  AtrTrailingStopWithAtrTargets,
  AdrContractionTightness,
  VolumeWeightedMoneyFlow,
  VulkanProfit,
  SRBreakoutAtrConfirmation,
  BeepBoop,
  FunctionSavitzkyGolayFilterWith7VectorsV0,
  Sharpshooter30EmaDistance,
  AllInOneMaStackScalper,
  FvgBreakoutBreakdown,
  HuntersReversalV23,
  PivotBreakoutWithTrendZones,
  WlsmaFastApproximation,
  PriceActionEngulfingPatterns,
  VolumeWeightedPivotBands,
  QtechlabsMachineLearningLogisticRegressionIndicator,
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
  ['gold-trend-signal-indicator', GoldTrendSignalIndicator, 'plot0'],
  ['ehlers-maclaurin-ultimate-smoother', EhlersMaclaurinUltimateSmoother, 'plot0'],
  ['apex-volatility-squeeze-breakout', ApexVolatilitySqueezeBreakout, 'plot0'],
  ['order-flow-imbalance-oscillator', OrderFlowImbalanceOscillator, 'plot0'],
  ['atr-trailing-stop-with-atr-targets', AtrTrailingStopWithAtrTargets, 'plot0'],
  ['adr-contraction-tightness', AdrContractionTightness, 'plot0'],
  ['volume-weighted-money-flow', VolumeWeightedMoneyFlow, 'plot0'],
  ['vulkan-profit', VulkanProfit, 'plot0'],
  ['s-r-breakout-atr-confirmation', SRBreakoutAtrConfirmation, 'plot0'],
  ['beep-boop', BeepBoop, 'plot0'],
  ['function-savitzky-golay-filter-with-7-vectors-v0', FunctionSavitzkyGolayFilterWith7VectorsV0, 'plot0'],
  ['sharpshooter-30-ema-distance', Sharpshooter30EmaDistance, 'plot0'],
  ['all-in-one-ma-stack-scalper', AllInOneMaStackScalper, 'plot0'],
  ['hunters-reversal-v2-3', HuntersReversalV23, 'plot0'],
  ['pivot-breakout-with-trend-zones', PivotBreakoutWithTrendZones, 'plot0', { plot0: 9, plot1: 9 }],
  ['wlsma-fast-approximation', WlsmaFastApproximation, 'plot0'],
  ['price-action-engulfing-patterns', PriceActionEngulfingPatterns, 'plot0'],
  ['volume-weighted-pivot-bands', VolumeWeightedPivotBands, 'plot0'],
  ['qtechlabs-machine-learning-logistic-regression-indicator', QtechlabsMachineLearningLogisticRegressionIndicator, 'plot0'],
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






describe('fvg-breakout-breakdown (NWOG levels need a bar at 01/01/2024 15:59 UTC)', () => {
  const result = FvgBreakoutBreakdown.calculate(bars, {});

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === 'fvg-breakout-breakdown');
    expect(entry).toBeDefined();
    expect(entry!.overlay).toBe(FvgBreakoutBreakdown.metadata.overlay);
  });

  it('returns one point per bar, na without the NWOG bar', () => {
    for (const points of Object.values(result.plots as Record<string, Array<{ value: number }>>)) {
      expect(points).toHaveLength(bars.length);
      expect(points.every((p) => isNaN(p.value))).toBe(true);
    }
  });

  it('marks fair value gaps on the bars', () => {
    expect(Array.isArray(result.markers)).toBe(true);
    expect((result.markers ?? []).length).toBeGreaterThan(0);
  });
});
