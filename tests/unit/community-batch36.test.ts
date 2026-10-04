/**
 * Unit tests for the community batch 36 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  VolatilityBreakoutPulse,
  GaussianAccelerationArray,
  TrendsyncBuySell,
  RvolEffortMatrix,
  GoldenDeathCrossHighlighter,
  ThreeLinesRciPsySignal,
  BollingerFreeBars,
  MadTrendDetector,
  NovaFlowLite,
  QWave,
  CandleSpreadOscillator,
  GbrMicroKernelTrend,
  KijunSenWithAlerts,
  VolumeBasedMovingAverage,
  NormalizedVolumeTrueRange,
  SqueezeMomentumScalper,
  OpalLines,
  EhlersReverseEma,
  AdvancedDualHullCrossSuite,
  GuppyOscillatorREvans993,
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
  ['volatility-breakout-pulse', VolatilityBreakoutPulse, 'plot0'],
  ['gaussian-acceleration-array', GaussianAccelerationArray, 'plot0'],
  ['trendsync-buy-sell-by-simply-dante-fx', TrendsyncBuySell, 'plot0'],
  ['rvol-effort-matrix', RvolEffortMatrix, 'plot0', { plot3: 1 }],
  ['golden-death-cross-highlighter', GoldenDeathCrossHighlighter, 'plot0'],
  ['3-lines-rci-psy-signal-rsi-background', ThreeLinesRciPsySignal, 'plot0'],
  ['bollinger-free-bars', BollingerFreeBars, 'plot0'],
  ['mad-trend-detector-c-h-i-p-a', MadTrendDetector, 'plot0'],
  ['nova-flow-lite', NovaFlowLite, 'plot0'],
  ['q-wave', QWave, 'plot0'],
  ['candle-spread-oscillator', CandleSpreadOscillator, 'plot0'],
  ['gbr-micro-kernel-trend', GbrMicroKernelTrend, 'plot0'],
  ['kijun-sen-with-buy-sell-labels-alerts-ichimoku-simplified', KijunSenWithAlerts, 'plot0'],
  ['volume-based-moving-average', VolumeBasedMovingAverage, 'plot1'],
  ['normalized-volume-true-range', NormalizedVolumeTrueRange, 'plot0'],
  ['15-minute-squeeze-scalper', SqueezeMomentumScalper, 'plot0'],
  ['opal', OpalLines, 'plot7'],
  ['ehlers-reverse-ema', EhlersReverseEma, 'plot0'],
  ['advanced-dual-hull-cross-suite-v6-precision-signals', AdvancedDualHullCrossSuite, 'plot0'],
  ['guppy-oscillator-revans993', GuppyOscillatorREvans993, 'plot0'],
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





