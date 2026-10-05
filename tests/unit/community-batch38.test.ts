/**
 * Unit tests for the community batch 38 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  CandlestickPatternsIdentified,
  RallyBaseDropSignals,
  BigTradesWhaleDetector,
  BodyCandle50,
  PocketPivotBreakout,
  CustomBuySellBodyRatioRsi,
  AdvancedVolumeDrivenBreakoutSignals,
  RbtStrategy,
  CandleState,
  MarubozuDetector,
  StrongBurstFader,
  TrendPro,
  EngulfingSweepsMilanaTrades,
  SweepEngulfChoch,
  BigTradesDetectorByHf,
  RcycBullishBearishIndicator,
  EngulfingSweepV6BarsOnly,
  T1WyckoffAggressiveADSetup,
  LiquiditySweepConfirmation,
  AbusuhilBullishCandles,
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
  // events for the pattern scripts: every 41st bar a strong green bar (+8 %, no lower wick, volume 50,000),
  // every 59th bar a doji with a long upper wick
  for (let i = 1; i < bars.length; i++) {
    const o = bars[i - 1].close;
    if (i % 41 === 20) bars[i] = { ...bars[i], open: o, low: o, close: o * 1.08, high: o * 1.08 * 1.002, volume: 50000 };
    else if (i % 59 === 30) bars[i] = { ...bars[i], open: o, close: o + 0.01, high: o + 12, low: o - 0.05 };
  }
  return bars;
}

const bars = makeFixture();
const barTimes = new Set(bars.map((b) => b.time));

type Port = { calculate: (b: typeof bars, inputs?: any) => any; metadata: { overlay: boolean } };
/** id, port, main output (a plot id, 'candles', 'markers', 'barColors' or 'bgColors'), plots drawn with a negative
 * offset (first bars left out), plots drawn with a positive offset, plots with Pine show_last = 1, inputs (for scripts
 * whose default filters draw nothing on this fixture) */
const ports: Array<[string, Port, string, Record<string, number>?, Record<string, number>?, string[]?, Record<string, unknown>?]> = [
  ['candlestick-patterns-identified', CandlestickPatternsIdentified, 'markers'],
  ['rally-base-drop-signals', RallyBaseDropSignals, 'markers'],
  ['big-trades-whale-detector-by-hk', BigTradesWhaleDetector, 'markers'],
  ['50-body-candle', BodyCandle50, 'markers'],
  ['pocket-pivot-breakout', PocketPivotBreakout, 'markers'],
  ['custom-buy-and-sell-signal-with-body-ratio-and-rsi', CustomBuySellBodyRatioRsi, 'markers'],
  ['advanced-volume-driven-breakout-signals', AdvancedVolumeDrivenBreakoutSignals, 'markers'],
  ['rbt-strategy', RbtStrategy, 'markers'],
  ['candle-state', CandleState, 'markers'],
  ['marubozu-detector', MarubozuDetector, 'markers'],
  ['strong-burst-fader-projectsyndicate', StrongBurstFader, 'markers'],
  ['trend-pro', TrendPro, 'candles'],
  ['engulfing-sweeps-milana-trades', EngulfingSweepsMilanaTrades, 'barColors'],
  ['sweep-engulf-choch', SweepEngulfChoch, 'markers'],
  ['big-trades-detector-by-hf', BigTradesDetectorByHf, 'markers'],
  ['rcyc-bullish-bearish-indicator', RcycBullishBearishIndicator, 'candles'],
  ['engulfing-sweep-v6-bars-only', EngulfingSweepV6BarsOnly, 'barColors'],
  ['t1-wyckoff-aggressive-a-d-setup', T1WyckoffAggressiveADSetup, 'markers'],
  ['liquidity-sweep-confirmation', LiquiditySweepConfirmation, 'markers'],
  ['abusuhil-bullish-candles', AbusuhilBullishCandles, 'markers'],
];

describe.each(ports)('%s', (id, port, mainOutput, leftOffsets, rightOffsets, singlePoint, inputs) => {
  const result = port.calculate(bars, inputs ?? {});

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

  it('draws markers, bar colours and background colours on bar times', () => {
    for (const key of ['markers', 'barColors', 'bgColors'] as const) {
      for (const m of (result[key] ?? []) as Array<{ time: number; color?: string }>) {
        expect(barTimes.has(m.time)).toBe(true);
        if (key !== 'markers') expect(typeof m.color).toBe('string');
      }
    }
  });

  it('produces its main output', () => {
    if (mainOutput === 'candles') {
      const closes = (Object.values(result.plotCandles) as Array<Array<{ close: number }>>)
        .flat().map((c) => c.close).filter((v) => !isNaN(v));
      expect(closes.length).toBeGreaterThan(0);
      closes.forEach((v) => expect(isFinite(v)).toBe(true));
    } else if (mainOutput === 'markers' || mainOutput === 'barColors' || mainOutput === 'bgColors') {
      expect((result[mainOutput] ?? []).length).toBeGreaterThan(0);
    } else {
      const vals = (result.plots[mainOutput] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
      expect(vals.length).toBeGreaterThan(0);
      vals.forEach((v) => expect(isFinite(v)).toBe(true));
    }
  });
});
