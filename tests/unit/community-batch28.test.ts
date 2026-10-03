/**
 * Unit tests for the community batch 28 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  HurstBasedTrendPersistenceWPoissonPrediction,
  AutoAvwapWithBreakoutScreener,
  LgmmMultivariatePolyLatentStates,
  PocVolumeBar,
  EmaMacdStrategyWithSlTp,
  ReversalScalper20AdibNoorani,
  CovBands,
  ResSupWithConcavity,
  RapidExponentialMovingAverage,
  DoubleMedianAtrBands,
  Keyzone,
  LiquidityTrapReversalBot,
  ZvolZScoreVolumeHeatmap,
  FibonacciMovingAverages,
  EnhancedVfiBuyerSellerPressure,
  EmaRmaClouds,
  TrendWithAdxEmaBuySellSignals,
  MeasuredPatternMove,
  AllmaTrendRadar,
  RsiEmaCrossingWithDonchianStopLoss,
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
  ['hurst-based-trend-persistence-w-poisson-prediction', HurstBasedTrendPersistenceWPoissonPrediction, 'plot0'],
  ['auto-avwap-with-breakout-screener', AutoAvwapWithBreakoutScreener, 'plot0'],
  ['lgmm-multivariate-poly-latent-states', LgmmMultivariatePolyLatentStates, 'plot0'],
  ['poc-volume-bar', PocVolumeBar, 'plot0'],
  ['ema-macd-strategy-with-sl-tp', EmaMacdStrategyWithSlTp, 'plot0'],
  ['reversal-scalper-2-0-adib-noorani', ReversalScalper20AdibNoorani, 'plot0'],
  ['cov-bands-c-h-i-p-a', CovBands, 'plot0'],
  ['res-sup-with-concavity-increasing-decreasing-trend-analysis', ResSupWithConcavity, 'plot0'],
  ['rapid-exponential-moving-average', RapidExponentialMovingAverage, 'plot0'],
  ['double-median-atr-bands-misinkomaster', DoubleMedianAtrBands, 'plot0'],
  ['keyzone', Keyzone, 'plot0'],
  ['liquidity-trap-reversal-bot', LiquidityTrapReversalBot, 'plot0'],
  ['zvol-z-score-volume-heatmap', ZvolZScoreVolumeHeatmap, 'plot0'],
  ['fibonacci-moving-averages', FibonacciMovingAverages, 'plot0'],
  ['enhanced-vfi-buyer-seller-pressure', EnhancedVfiBuyerSellerPressure, 'plot0'],
  ['ema-rma-clouds-by-alpachino', EmaRmaClouds, 'plot0'],
  ['trend-with-adx-ema-buy-sell-signals', TrendWithAdxEmaBuySellSignals, 'plot0'],
  ['allma-trend-radar', AllmaTrendRadar, 'plot0'],
  ['rsi-ema-crossing-with-donchian-stop-loss', RsiEmaCrossingWithDonchianStopLoss, 'plot0'],
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






describe('measured-pattern-move (period A inside the fixture)', () => {
  // the default period (20/07/2022) is after the fixture: period A = bars 100..160 (Pine time inputs in ms)
  const inputs = { typ: 'Double Top', startTime: bars[100].time * 1000, endTime: bars[160].time * 1000 };
  const result = MeasuredPatternMove.calculate(bars, inputs);

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === 'measured-pattern-move');
    expect(entry).toBeDefined();
    expect(entry!.overlay).toBe(MeasuredPatternMove.metadata.overlay);
  });

  it('returns one point per bar in every plot', () => {
    for (const points of Object.values(result.plots as Record<string, Array<{ time: number }>>)) {
      expect(points).toHaveLength(bars.length);
    }
  });

  it('gives a finite target after period A', () => {
    const vals = (result.plots.plot0 as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });

  it('gives no value with the default period (after the fixture)', () => {
    const r = MeasuredPatternMove.calculate(bars, {});
    expect(r.plots.plot0.every((p: { value: number }) => isNaN(p.value))).toBe(true);
  });
});
