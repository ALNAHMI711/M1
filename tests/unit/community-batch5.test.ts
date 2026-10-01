/**
 * Unit tests for the community batch 5 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  KalmanFlowLyroRs,
  WeightedRegressionBands,
  RsiModified,
  DynamicTrailing,
  DualBayesianForLoop,
  RSIMultiLevels,
  Fsvzo,
  LaguerreFilter,
  PriceActionBreakoutTrend,
  Rsi50StepLine,
  RedKVolWeightedRsi,
  VolumeCandleHighlighter,
  IctFvgBuySellSignals,
  TascCyberneticOscillator,
  RollingTrendline,
  QuantumTrendSwiftEdge,
  AdaptiveMLTrailingStop,
  InsideBars,
  BigTradesBubbles,
  MacdOverlayV1,
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
const ports: Array<[string, Port, string, Record<string, number>?]> = [
  ['kalman-flow-lyro-rs', KalmanFlowLyroRs, 'plot0'],
  ['weighted-regression-bands', WeightedRegressionBands, 'plot0'],
  ['rsi-modified', RsiModified, 'plot2'],
  ['dynamic-trailing', DynamicTrailing, 'plot0'],
  ['dual-bayesian-for-loop', DualBayesianForLoop, 'plot0'],
  ['rsi-multi-levels', RSIMultiLevels, 'plot0'],
  ['fsvzo', Fsvzo, 'plot0', { plot9: 1, plot10: 1, plot11: 1, plot12: 1 }],
  ['laguerre-filter', LaguerreFilter, 'plot0'],
  ['price-action-breakout-trend', PriceActionBreakoutTrend, 'plot0'],
  ['rsi-50-step-line', Rsi50StepLine, 'plot0'],
  ['redk-vol-weighted-rsi', RedKVolWeightedRsi, 'plot0'],
  ['volume-candle-highlighter', VolumeCandleHighlighter, 'candles'],
  ['ict-fvg-buy-sell-signals', IctFvgBuySellSignals, 'plot0'],
  ['tasc-2025-06-cybernetic-oscillator', TascCyberneticOscillator, 'plot0'],
  ['rolling-trendline', RollingTrendline, 'plot0'],
  ['quantumtrend-swiftedge', QuantumTrendSwiftEdge, 'plot2'],
  ['adaptive-ml-trailing-stop', AdaptiveMLTrailingStop, 'plot0'],
  ['inside-bars', InsideBars, 'plot0'],
  ['big-trades-bubbles', BigTradesBubbles, 'plot0'],
  ['macd-overlay-v1', MacdOverlayV1, 'plot0'],
];

describe.each(ports)('%s', (id, port, mainPlot, leftOffsets) => {
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
      expect(points).toHaveLength(bars.length - skip);
      points.forEach((p, i) => expect(p.time).toBe(bars[i].time));
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
