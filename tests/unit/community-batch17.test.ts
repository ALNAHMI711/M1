/**
 * Unit tests for the community batch 17 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  AnchoredVwapPro,
  WeierstrassFunction,
  QuantileRegressionBands,
  VarisZones,
  ArnaudLegouxGaussianFlowAlphanatt,
  AdaptivePivotZones,
  TrimmedMeanAtrBands,
  RetailVsBankerNetPositionsSymmetryBreak,
  DominanceSignalApex,
  EmaRsiAutotradeWebhookVarun,
  CrosbyRatioQuantumresearch,
  RangeChannelByAtillaYurtseven,
  KalmanHullBandsForLoopRakoquant,
  GranvilleEntryGuide,
  RsMacd,
  VisualisationTendances,
  CompositeIndicator,
  ForcePulse,
  QImpulseEntry,
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
  ['anchored-vwap-pro', AnchoredVwapPro, ''],
  ['weierstrass-function', WeierstrassFunction, 'plot0'],
  ['quantile-regression-bands', QuantileRegressionBands, 'plot0'],
  ['varis-zones', VarisZones, 'plot0'],
  ['arnaud-legoux-gaussian-flow-alphanatt', ArnaudLegouxGaussianFlowAlphanatt, 'plot0'],
  ['adaptive-pivot-zones', AdaptivePivotZones, 'plot0'],
  ['trimmed-mean-atr-bands', TrimmedMeanAtrBands, 'plot0'],
  ['retail-vs-banker-net-positions-symmetry-break', RetailVsBankerNetPositionsSymmetryBreak, 'plot0'],
  ['dominance-signal-apex', DominanceSignalApex, 'plot0'],
  ['ema-rsi-autotrade-webhook-varun', EmaRsiAutotradeWebhookVarun, 'plot0'],
  ['crosby-ratio-quantumresearch', CrosbyRatioQuantumresearch, 'plot0'],
  ['range-channel-by-atilla-yurtseven', RangeChannelByAtillaYurtseven, 'plot0'],
  ['kalman-hull-bands-for-loop-rakoquant', KalmanHullBandsForLoopRakoquant, 'plot0'],
  ['granville-entry-guide', GranvilleEntryGuide, 'plot0'],
  ['rs-macd', RsMacd, 'plot0'],
  ['visualisation-tendances', VisualisationTendances, 'plot0', undefined, { plot0: 3 }],
  ['composite-indicator', CompositeIndicator, 'plot1'],
  ['force-pulse', ForcePulse, 'plot0', { plot13: 3, plot14: 3 }],
  ['q-impulse-entry', QImpulseEntry, 'plot0'],
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
    // '': no value on the fixture with default inputs (anchored-vwap-pro: the default anchor is after the last bar)
    if (mainPlot === '') return;
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('anchored-vwap-pro with an anchor inside the fixture', () => {
  it('is na before the anchor and finite from the anchor', () => {
    const r = AnchoredVwapPro.calculate(bars, { anchorYear: 2015, anchorMonth: 1, anchorDay: 1 });
    const anchor = Date.UTC(2015, 0, 1) / 1000;
    const vwap = r.plots.plot0 as Array<{ time: number; value: number }>;
    vwap.forEach((p) => expect(p.time < anchor ? isNaN(p.value) : isFinite(p.value)).toBe(true));
  });
});
