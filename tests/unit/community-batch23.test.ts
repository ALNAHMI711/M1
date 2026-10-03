/**
 * Unit tests for the community batch 23 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  PullbackDepth,
  MacdPro,
  AverageBullishBearishPercentageChange,
  VolatilityBands,
  UserDefinedRangeSelector,
  PipstocratMarketParticipantAnalysis,
  PrometheusTopologicalPersistentEntropy,
  VoldRatioHistogram,
  PriceChangeSentimentIndex,
  GabrielsAndeanOscillator,
  Ema21PullbackBuy,
  CandleChannel,
  HpdrBandsIndicator,
  LunarPhase,
  AtrScaledDeviationOscillator,
  DynamicStopLossTakeProfit,
  GammaFibonacciEmaBands,
  SmaSqueezeOscillator,
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
  ['breakdown-or-buyable-dip-pullback-depth-can-help', PullbackDepth, 'plot0'],
  ['macd-pro', MacdPro, 'plot0'],
  ['average-bullish-bearish-percentage-change', AverageBullishBearishPercentageChange, 'plot0'],
  ['volatility-bands', VolatilityBands, 'plot0'],
  ['user-defined-range-selector-and-color-changing-ema-line', UserDefinedRangeSelector, 'plot0'],
  ['pipstocrat-market-participant-analysis', PipstocratMarketParticipantAnalysis, 'plot0'],
  ['prometheus-topological-persistent-entropy', PrometheusTopologicalPersistentEntropy, 'plot0'],
  ['vold-ratio-histogram', VoldRatioHistogram, 'plot0'],
  ['price-change-sentiment-index', PriceChangeSentimentIndex, 'plot0'],
  ['gabriel-s-andean-oscillator', GabrielsAndeanOscillator, 'plot0'],
  ['ema21-pullback-buy', Ema21PullbackBuy, 'plot0'],
  ['candle-channel', CandleChannel, 'plot0'],
  ['hpdr-bands-indicator', HpdrBandsIndicator, 'plot0'],
  ['lunar-phase', LunarPhase, 'plot0'],
  ['atr-scaled-deviation-oscillator', AtrScaledDeviationOscillator, 'plot0'],
  ['dynamic-stop-loss-take-profit', DynamicStopLossTakeProfit, 'plot0'],
  ['gamma-fibonacci-ema-bands', GammaFibonacciEmaBands, 'plot0'],
  ['sma-squeeze-oscillator', SmaSqueezeOscillator, 'plot0', { plot3: 2, plot4: 2 }],
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





