/**
 * Unit tests for the community batch 22 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  MyAutoDualAvwapWithAutoSwingLowPivotLowFinder,
  FxShareCcReversal,
  ShockPercentileMovingAverageNal,
  LiquidityIndicator,
  InstantaneousTrendlineWithCloud,
  TrueRangeExpansion,
  RelativeStrengthHeatmap,
  SceGannPredictions,
  RsiEmaMzonesWithDivergences,
  BiggestVolume,
  ThreeInOneCustomMovingAverageIndicator,
  CrossoverEmmm,
  MesaPhaseAdaptiveBandTrend,
  EqualhighJapaneseTripleRci,
  CycleFlowIndicatorDQuant,
  BuySellImtiazhV2,
  RsiGames12,
  WhaleVolumeAbsorptionAggression,
  KdNewAutoTrade,
  CycleLowRsiStochRsi,
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
  ['my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder', MyAutoDualAvwapWithAutoSwingLowPivotLowFinder, ''],
  ['fxshare-cc-reversal', FxShareCcReversal, 'plot0'],
  ['shock-percentile-moving-average-nal', ShockPercentileMovingAverageNal, 'plot0'],
  ['liquidity-indicator', LiquidityIndicator, 'plot0'],
  ['instantaneous-trendline-with-cloud', InstantaneousTrendlineWithCloud, 'plot0'],
  ['true-range-expansion', TrueRangeExpansion, 'plot0'],
  ['relative-strength-heatmap', RelativeStrengthHeatmap, 'plot0'],
  ['sce-gann-predictions', SceGannPredictions, 'plot0'],
  ['rsi-ema-mzones-with-divergences', RsiEmaMzonesWithDivergences, 'plot0', { plot2: 5, plot3: 5, plot4: 5, plot5: 5 }],
  ['biggest-volume', BiggestVolume, 'plot0'],
  ['3-in-1-custom-moving-average-indicator', ThreeInOneCustomMovingAverageIndicator, 'plot0'],
  ['crossover-emmm', CrossoverEmmm, 'plot0'],
  ['mesa-phase-adaptive-band-trend', MesaPhaseAdaptiveBandTrend, 'plot0'],
  ['equalhigh-japanese-triple-rci', EqualhighJapaneseTripleRci, 'plot0'],
  ['cycle-flow-indicator-d-quant', CycleFlowIndicatorDQuant, 'plot0'],
  ['buysell-imtiazh-v2', BuySellImtiazhV2, 'plot0'],
  ['rsi-games-1-2', RsiGames12, 'plot0', { plot5: 5, plot6: 5 }],
  ['whale-volume-absorption-aggression-maxmaserati-3-0', WhaleVolumeAbsorptionAggression, 'plot0'],
  ['kd-newautotrade-for-future-trading-heikin-ashi-candles', KdNewAutoTrade, 'plot0'],
  ['cycle-low-v5-john-k', CycleLowRsiStochRsi, ''],
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
    // '': no value on the fixture with default inputs (my-auto-dual-avwap: default anchor dates after the last bar; cycle-low-v5: the anchor plot is off, the output is markers)
    if (mainPlot === '') return;
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});





describe('my-auto-dual-avwap with anchors inside the fixture', () => {
  it('draws the first VWAP from its start time', () => {
    const start = Date.UTC(2015, 0, 1);
    const r = MyAutoDualAvwapWithAutoSwingLowPivotLowFinder.calculate(bars, {
      startTime: start, endTime: Date.UTC(2016, 0, 1), secondStartTime: Date.UTC(2016, 6, 1), secondEndTime: Date.UTC(2017, 0, 1),
    });
    const finite = Object.values(r.plots as Record<string, Array<{ time: number; value: number }>>)
      .flat().filter((p) => isFinite(p.value));
    expect(finite.length).toBeGreaterThan(0);
    finite.forEach((p) => expect(p.time * 1000).toBeGreaterThanOrEqual(start));
  });
});
