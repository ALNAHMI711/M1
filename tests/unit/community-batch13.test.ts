/**
 * Unit tests for the community batch 13 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  TrendContinuationSslBb,
  AdaptiveRsiLyroRs,
  SineWeightedMovingAverage,
  AdxExtremeZonesDivergences,
  GaussianRibbon,
  AdaptiveHeikinAshi,
  SmoothedSourceWeightedEma,
  RollingSharpeRatioOscillatorAstralVision,
  EdwardSmartChannelReversal,
  GScoreNal,
  AverageCandleBodiesRange,
  VolumeProfileHeatmap,
  MultipleExponentialFibnonacciMovingAverages,
  RenkoMod,
  BadV04,
  RelativeVolumeIndicator,
  PulseRange,
  InfiniteEmaWithAlphaControl,
  FixedRangeVolumeProfileZones,
  TerminalVelocityStopLyroRs,
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
  ['1m-trend-continuation-signals-ssl-bb-filter', TrendContinuationSslBb, 'plot0'],
  ['adaptive-rsi-lyro-rs', AdaptiveRsiLyroRs, 'plot0'],
  ['sine-weighted-moving-average', SineWeightedMovingAverage, 'plot0'],
  ['adx-extreme-zones-divergences', AdxExtremeZonesDivergences, 'plot0', { plot4: 1, plot5: 1, plot6: 1, plot7: 1 }],
  ['gaussian-ribbon', GaussianRibbon, 'plot0', undefined, { plot0: 21, plot1: 21 }],
  ['adaptive-heikin-ashi', AdaptiveHeikinAshi, 'candles'],
  ['smoothed-source-weighted-ema', SmoothedSourceWeightedEma, 'plot0'],
  ['rolling-sharpe-ratio-oscillator-astral-vision', RollingSharpeRatioOscillatorAstralVision, 'plot0'],
  ['edward-smart-channel-reversal', EdwardSmartChannelReversal, 'plot0'],
  ['g-score-nal', GScoreNal, 'plot0'],
  ['average-candle-bodies-range', AverageCandleBodiesRange, 'plot0'],
  ['volume-profile-heatmap', VolumeProfileHeatmap, 'plot0'],
  ['multiple-exponential-fibnonacci-moving-averages', MultipleExponentialFibnonacciMovingAverages, 'plot0'],
  ['renko-mod', RenkoMod, 'plot0'],
  ['b-a-d-v0-4', BadV04, 'plot0'],
  ['relative-volume-indicator', RelativeVolumeIndicator, 'plot0'],
  ['pulse-range', PulseRange, 'plot0'],
  ['infinite-ema-with-alpha-control', InfiniteEmaWithAlphaControl, 'plot0'],
  ['fixed-range-volume-profile-zones', FixedRangeVolumeProfileZones, 'plot0'],
  ['terminal-velocity-stop-lyro-rs', TerminalVelocityStopLyroRs, 'plot0'],
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
