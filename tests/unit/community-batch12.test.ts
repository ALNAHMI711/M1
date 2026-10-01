/**
 * Unit tests for the community batch 12 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  KalmanHullKijun,
  InterpolatedMedianVolatilityLSMAOtto,
  ZeroLagGarchBandsNal,
  PullbackScalpTradeV2,
  MovingAverageCrossoverWithShadingSignals,
  FibonacciWeightedMovingAverage,
  RsiFibonacciHhLlSupportResistance,
  ZScoreOscillator,
  RSIStochRSIMarxCapital,
  CommunityMoneyline,
  GannLevel,
  RollingLiquidityClustersChannel,
  WaveletTransformTrend,
  IUMeanReversionSystem,
  ScalpmapEmaPivotTargets,
  IntradayVsOvernightChangeTracker,
  FourierSeriesModelOfTheMarket,
  UptrickRsiMaSignals,
  MarketStructureTrend,
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
  ['kalman-hull-kijun', KalmanHullKijun, 'plot0'],
  ['interpolated-median-volatility-lsma-otto', InterpolatedMedianVolatilityLSMAOtto, 'plot0'],
  ['zero-lag-garch-bands-nal', ZeroLagGarchBandsNal, 'plot0'],
  ['pullback-scalp-trade-v2', PullbackScalpTradeV2, 'plot0'],
  ['moving-average-crossover-with-shading-signals', MovingAverageCrossoverWithShadingSignals, 'plot0'],
  ['fibonacci-weighted-moving-average', FibonacciWeightedMovingAverage, 'plot0'],
  ['rsi-fibonacci-hh-ll-support-resistance', RsiFibonacciHhLlSupportResistance, 'plot0'],
  ['z-score-oscillator', ZScoreOscillator, 'plot4', { plot0: 5, plot1: 5, plot2: 5, plot3: 5 }],
  ['rsi-stoch-rsi-marx-capital', RSIStochRSIMarxCapital, 'plot0'],
  ['community-moneyline', CommunityMoneyline, 'plot0'],
  ['gann-level', GannLevel, 'plot0'],
  ['rolling-liquidity-clusters-channel', RollingLiquidityClustersChannel, 'plot0'],
  ['wavelet-transform-trend', WaveletTransformTrend, 'plot10'],
  ['iu-mean-reversion-system', IUMeanReversionSystem, 'plot0'],
  ['scalpmap-ema-pivot-targets', ScalpmapEmaPivotTargets, 'plot0'],
  ['intraday-vs-overnight-change-tracker', IntradayVsOvernightChangeTracker, 'plot0'],
  ['fourier-series-model-of-the-market', FourierSeriesModelOfTheMarket, 'plot0'],
  ['uptrick-rsi-ma-buying-selling-signals', UptrickRsiMaSignals, 'plot0'],
  ['market-structure-trend', MarketStructureTrend, 'plot0'],
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
