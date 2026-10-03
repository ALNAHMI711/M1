/**
 * Unit tests for the community batch 25 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  IchimokuWHeikinAshi,
  FastWma,
  SmcStatisticalLiquidityWalls,
  VolumeBarRange,
  VortexProWithMovingAverage,
  MidTermRibbon,
  BitcoinMayerMultiple,
  RsiAlternativeDerivation,
  BreakoutAnReversalSignalDetectorWithColoredInBarTrends,
  MaCrossWithDisplacement,
  GuppyWave,
  RossCameronInspiredDayTradingStrategy,
  MacdVWithVolatilityNormalisation,
  KalmanExponentialyWeightedMovingAverageMisinkomaster,
  CycleSyncedChannelBreakout,
  AllInOneRsiSystem,
  BollingerHeatmap,
  BarsSinceMaTest,
  SwingSupportAndResistance,
  Smiiol,
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
  ['ichimoku-w-heikin-ashi', IchimokuWHeikinAshi, 'plot0', undefined, { plot2: 25, plot3: 25, plot4: 25 }],
  ['fast-wma', FastWma, 'plot0'],
  ['smc-statistical-liquidity-walls', SmcStatisticalLiquidityWalls, 'plot0'],
  ['volume-bar-range', VolumeBarRange, 'plot0'],
  ['vortex-pro-with-moving-average', VortexProWithMovingAverage, 'plot0'],
  ['mid-term-ribbon', MidTermRibbon, 'plot0'],
  ['bitcoin-mayer-multiple', BitcoinMayerMultiple, 'plot0'],
  ['rsi-alternative-derivation', RsiAlternativeDerivation, 'plot0'],
  ['breakout-an-reversal-signal-detector-with-colored-in-bar-trends', BreakoutAnReversalSignalDetectorWithColoredInBarTrends, 'plot0'],
  ['ma-cross-with-displacement', MaCrossWithDisplacement, 'plot0'],
  ['guppy-wave', GuppyWave, 'plot0'],
  ['ross-cameron-inspired-day-trading-strategy', RossCameronInspiredDayTradingStrategy, 'plot0'],
  ['macd-v-with-volatility-normalisation', MacdVWithVolatilityNormalisation, 'plot0'],
  ['kalman-exponentialy-weighted-moving-average-misinkomaster', KalmanExponentialyWeightedMovingAverageMisinkomaster, 'plot0'],
  ['cycle-synced-channel-breakout', CycleSyncedChannelBreakout, 'plot0'],
  ['all-in-one-rsi-system', AllInOneRsiSystem, 'plot0', { plot4: 5, plot5: 5, plot6: 5, plot7: 5 }],
  ['bollinger-heatmap', BollingerHeatmap, 'plot0'],
  ['is-it-time-for-a-pullback-check-bars-since-ma-test', BarsSinceMaTest, 'plot0'],
  ['swing-support-and-resistance', SwingSupportAndResistance, 'plot0', { plot0: 10, plot1: 10 }],
  ['smiiol', Smiiol, 'plot0'],
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





