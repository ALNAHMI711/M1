/**
 * Unit tests for the community batch 3 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  VolumeGatedTrendRibbon,
  ATRZLEMA,
  PivotBreakoutHighLowSignals,
  ScalpingToolDynamicTPSL,
  AbsoluteStrengthIndex,
  BuyingSellingPressure,
  LiquidityProximityHeatmap,
  AIBreakoutBands,
  LiquidReversalBands,
  TrendVolatilityIndex,
  AIWeightedRSI,
  VolatilityChannelOscillator,
  ZeroLagHMATrendSuite,
  PivotOscillator,
  CorrectedMovingAverage,
  RMAATRBands,
  VolatilityDrivenVWAPStructure,
  BullsVBears,
  DualEMATrendRibbon,
  SharpeRatioIndicator,
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
  ['volume-gated-trend-ribbon', VolumeGatedTrendRibbon, 'plot0'],
  ['atr-zlema', ATRZLEMA, 'plot0'],
  ['pivot-breakout-high-low-signals', PivotBreakoutHighLowSignals, 'plot0'],
  ['scalping-tool-dynamic-tp-sl', ScalpingToolDynamicTPSL, 'plot0'],
  ['absolute-strength-index', AbsoluteStrengthIndex, 'plot0'],
  ['buying-selling-pressure', BuyingSellingPressure, 'plot6'],
  ['liquidity-proximity-heatmap', LiquidityProximityHeatmap, 'h1'],
  ['ai-breakout-bands', AIBreakoutBands, 'plot0'],
  ['liquid-reversal-bands', LiquidReversalBands, 'plot0'],
  ['trend-volatility-index', TrendVolatilityIndex, 'plot0'],
  ['ai-weighted-rsi', AIWeightedRSI, 'plot0'],
  ['volatility-channel-oscillator', VolatilityChannelOscillator, 'plot0', { plot12: 2, plot13: 2 }],
  ['zero-lag-hma-trend-suite', ZeroLagHMATrendSuite, 'plot0'],
  ['pivot-oscillator', PivotOscillator, 'plot0'],
  ['corrected-moving-average', CorrectedMovingAverage, 'plot0'],
  ['rma-atr-bands', RMAATRBands, 'plot0'],
  ['volatility-driven-vwap-structure', VolatilityDrivenVWAPStructure, 'plot1'],
  ['bulls-v-bears', BullsVBears, 'plot0'],
  ['dual-ema-trend-ribbon', DualEMATrendRibbon, 'plot0'],
  ['sharpe-ratio-indicator', SharpeRatioIndicator, 'plot0'],
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
    const vals = (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});

describe('sharpe-ratio-indicator', () => {
  it('matches the formula on one bar and returns the 4 zone lines', () => {
    const lookback = 180;
    const result = SharpeRatioIndicator.calculate(bars);
    const i = 1000;
    const r = bars.slice(i - lookback + 1, i + 1).map((b, k) => {
      const prev = bars[i - lookback + k].close;
      return (b.close - prev) / prev;
    });
    const mean = r.reduce((a, b) => a + b, 0) / lookback;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - mean) ** 2, 0) / lookback);
    const expected = (mean * 365 - 0.04) / (sd * Math.sqrt(lookback));
    expect(result.plots.plot0[i].value).toBeCloseTo(expected, 10);
    expect(isNaN(result.plots.plot0[lookback - 1].value)).toBe(true);
    expect(result.hlines!.map((h) => h.value)).toEqual([5, -1, -3, 0]);
  });
});
