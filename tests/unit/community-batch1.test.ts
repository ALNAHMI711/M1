/**
 * Unit tests for the community batch 1 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import { barInterval } from '../../src/bar-time';
import {
  TrendFilter,
  ZeroLagSignalsForLoop,
  RangeOscillator,
  TrendWaveBands,
  BreakoutIndicator,
  BernoulliProcessEntropy,
  VolumeWeightedTrend,
  NadarayaWatsonTrend,
  EntrySignalsLongShort,
  PivotTrend,
  AISourceSwitchingMovingAverage,
  GradientTrendFilter,
  CandleRangeTrading,
  SuperSmootherMAOscillator,
  DynamicSupportResistance,
  DynamicVolumeProfileOscillator,
  HaPMACD,
  AggressivePullbackIndicator,
  JurikMovingAverage,
  WaveletTrendMLIntegration,
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
const ports: Array<[string, Port, string, Record<string, unknown>?]> = [
  ['trend-filter', TrendFilter, 'plot0'],
  ['zero-lag-signals-for-loop', ZeroLagSignalsForLoop, 'plot0'],
  ['range-oscillator', RangeOscillator, 'plot0'],
  ['trendwave-bands', TrendWaveBands, 'plot0'],
  ['breakout-indicator', BreakoutIndicator, 'plot0', { longBreakout: 120, shortBreakout: 80 }],
  ['bernoulli-process-entropy', BernoulliProcessEntropy, 'plot1'],
  ['volume-weighted-trend', VolumeWeightedTrend, 'plot2'],
  ['nadaraya-watson-trend', NadarayaWatsonTrend, 'plot0'],
  ['entry-signals-long-short', EntrySignalsLongShort, 'plot0'],
  ['pivot-trend', PivotTrend, 'plot2'],
  ['ai-source-switching-moving-average', AISourceSwitchingMovingAverage, 'plot0'],
  ['gradient-trend-filter', GradientTrendFilter, 'plot0'],
  ['candle-range-trading', CandleRangeTrading, 'plot0'],
  ['supersmoother-ma-oscillator', SuperSmootherMAOscillator, 'plot0'],
  ['dynamic-support-resistance', DynamicSupportResistance, 'plot0'],
  ['dynamic-volume-profile-oscillator', DynamicVolumeProfileOscillator, 'plot0'],
  ['hap-macd', HaPMACD, 'plot1'],
  ['aggressive-pullback-indicator', AggressivePullbackIndicator, 'plot0'],
  ['jurik-moving-average', JurikMovingAverage, 'plot0'],
  ['wavelet-trend-ml-integration', WaveletTrendMLIntegration, 'plot9'],
];

describe.each(ports)('%s', (id, port, mainPlot, inputs) => {
  const result = port.calculate(bars, inputs ?? {});

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

  it('produces finite values in its main output', () => {
    const vals = (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('breakout-indicator offset', () => {
  it('draws the values 5 bars to the right, with 5 points after the last bar', () => {
    const result = BreakoutIndicator.calculate(bars, { longBreakout: 120 });
    const plot = result.plots.plot0 as Array<{ time: number; value: number }>;
    expect(plot).toHaveLength(bars.length + 5);
    const step = barInterval(bars);
    plot.slice(bars.length).forEach((p, k) => expect(p.time).toBe(bars[bars.length - 1].time + (k + 1) * step));
    expect(plot.slice(0, 5).every((p) => isNaN(p.value))).toBe(true);
    expect(plot[5].value).toBe(120);
  });

  it('draws nothing with the default inputs (prices 0)', () => {
    const result = BreakoutIndicator.calculate(bars);
    expect((result.plots.plot0 as Array<{ value: number }>).every((p) => isNaN(p.value))).toBe(true);
  });
});
