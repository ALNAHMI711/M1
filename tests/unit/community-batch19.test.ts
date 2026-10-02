/**
 * Unit tests for the community batch 19 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  MultipleRsi,
  AlphaTradingSignalUpSideDown,
  X5SmoothEma,
  CmoForLoopQuantlapse,
  CvdRupward,
  WaeSniperScalpXauusdM1Tuned,
  TremorTracker,
  TrendFlowOscillatorAdx,
  PercentOffAllTimeHigh,
  BuyersVsSellers,
  BacapPriceStructure21EmaTrend,
  FlowControlOscillator,
  IndicadorMilloSma20Sma200AoRsiM1,
  VwapDualMaRibbonTrackerPro,
  VolumeSurgeDetector,
  SuperSma5813Ema20200RegimeFilter,
  PrismMovingAverageTrend,
  TripleRsiMisinkoMaster,
  PolyphaseMacd,
  AdvancedLinesPaskal,
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
  ['multiple-rsi', MultipleRsi, 'plot0'],
  ['alpha-trading-signal-up-side-down', AlphaTradingSignalUpSideDown, 'plot0'],
  ['x5-smooth-ema', X5SmoothEma, 'plot0'],
  ['cmo-for-loop-quantlapse', CmoForLoopQuantlapse, 'plot0'],
  ['cvd-rupward', CvdRupward, 'plot0'],
  ['wae-sniper-scalp-xauusd-m1-tuned', WaeSniperScalpXauusdM1Tuned, 'plot0'],
  ['tremor-tracker', TremorTracker, 'plot0'],
  ['trend-flow-oscillator-adx', TrendFlowOscillatorAdx, 'plot0'],
  ['percent-off-all-time-high', PercentOffAllTimeHigh, 'plot0'],
  ['buyers-vs-sellers', BuyersVsSellers, 'plot0'],
  ['bacap-price-structure-21-ema-trend', BacapPriceStructure21EmaTrend, 'plot0'],
  ['flow-control-oscillator', FlowControlOscillator, 'plot0'],
  ['indicador-millo-sma20-sma200-ao-rsi-m1', IndicadorMilloSma20Sma200AoRsiM1, 'plot0'],
  ['vwap-dual-ma-ribbon-tracker-pro', VwapDualMaRibbonTrackerPro, 'plot0'],
  ['volume-surge-detector', VolumeSurgeDetector, 'plot0'],
  ['super-sma-5-8-13-ema-20-200-regime-filter', SuperSma5813Ema20200RegimeFilter, 'plot0'],
  ['prism-moving-average-trend', PrismMovingAverageTrend, 'plot0'],
  ['triple-rsi-misinkomaster', TripleRsiMisinkoMaster, 'plot0'],
  ['polyphase-macd', PolyphaseMacd, 'plot0'],
  ['advancedlines-paskal', AdvancedLinesPaskal, 'plot0'],
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


describe('vwap-dual-ma-ribbon-tracker-pro timeframe limit', () => {
  it('throws on intraday bars (ta.vwap needs the exchange session there)', () => {
    const hourly = bars.slice(0, 200).map((b, i) => ({ ...b, time: 1262304000 + i * 3600 }));
    expect(() => VwapDualMaRibbonTrackerPro.calculate(hourly, {})).toThrow();
  });

  it('accepts weekly bars', () => {
    const weekly = bars.slice(0, 200).map((b, i) => ({ ...b, time: 1262304000 + i * 7 * 86400 }));
    expect(() => VwapDualMaRibbonTrackerPro.calculate(weekly, {})).not.toThrow();
  });
});
