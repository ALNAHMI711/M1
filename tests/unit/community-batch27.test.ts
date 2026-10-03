/**
 * Unit tests for the community batch 27 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  AskWeightedAverages,
  DynamicTrendChannel,
  ReversalCorrelationPressure,
  WaveFunctionMacd,
  RegressionChannelOscillator,
  EnhancedVsaVolumeCandleColorsWithMaSelection,
  AdvancedMacdProT3Themed,
  StopTakeBounds,
  ScottgoAdvancedMacd,
  Ema926Cross,
  ObvAdOscillatorsWithDualSmoothingOptions,
  PremiumTradeZones,
  Sl4Emas2SmasCrossoverSignals,
  VwmacdMfiObvComposite,
  HthWdGannSquareRootLevels,
  NovaStatisticalFilteringOscillator,
  HarmonicSniperTriggerPyratime,
  NyOrbFakeoutDetector,
  VolumetricEntropyIndex,
  TaAdaptiveTrend,
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
  ['ask-weighted-averages', AskWeightedAverages, 'plot0'],
  ['dynamic-trend-channel', DynamicTrendChannel, 'plot0'],
  ['reversal-correlation-pressure', ReversalCorrelationPressure, 'plot0'],
  ['wavefunction-macd', WaveFunctionMacd, 'plot0'],
  ['regression-channel-oscillator', RegressionChannelOscillator, 'plot0'],
  ['enhanced-vsa-volume-candle-colors-with-ma-selection', EnhancedVsaVolumeCandleColorsWithMaSelection, 'plot0'],
  ['advanced-macd-pro-t3-themed', AdvancedMacdProT3Themed, 'plot0'],
  ['stop-take-bounds', StopTakeBounds, 'plot0'],
  ['scottgo-advanced-macd', ScottgoAdvancedMacd, 'plot0'],
  ['ema-9-26-cross', Ema926Cross, 'plot0'],
  ['obv-ad-oscillators-with-dual-smoothing-options', ObvAdOscillatorsWithDualSmoothingOptions, 'plot4'],
  ['premium-trade-zones', PremiumTradeZones, 'plot0'],
  ['sl-4-emas-2-smas-crossover-signals', Sl4Emas2SmasCrossoverSignals, 'plot0'],
  ['vwmacd-mfi-obv-composite', VwmacdMfiObvComposite, 'plot0'],
  ['hth-wd-gann-square-root-levels', HthWdGannSquareRootLevels, 'plot0'],
  ['nova-statistical-filtering-oscillator', NovaStatisticalFilteringOscillator, 'plot0'],
  ['harmonic-sniper-trigger-pyratime', HarmonicSniperTriggerPyratime, 'plot0'],
  ['volumetric-entropy-index', VolumetricEntropyIndex, 'plot0'],
  ['ta-adaptive-trend', TaAdaptiveTrend, 'plot0'],
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






describe('ny-orb-fakeout-detector (fixed range 03/06/2025 13:30 to 13:45 UTC)', () => {
  // 5-minute bars from 03/06/2025 13:00 UTC: the range covers the bars 13:30, 13:35, 13:40 and 13:45
  const start = Date.UTC(2025, 5, 3, 13, 0, 0) / 1000;
  const intraday = bars.slice(0, 40).map((b, i) => ({ ...b, time: start + i * 300 }));
  const result = NyOrbFakeoutDetector.calculate(intraday, {});

  it('is in the registry with the same overlay', () => {
    const entry = indicatorRegistry.find((e) => e.id === 'ny-orb-fakeout-detector');
    expect(entry).toBeDefined();
    expect(entry!.overlay).toBe(NyOrbFakeoutDetector.metadata.overlay);
  });

  it('gives the range high / low only inside the range', () => {
    const inRange = (i: number) => i >= 6 && i <= 9;
    result.plots.plot0.forEach((p: { value: number }, i: number) => expect(isNaN(p.value)).toBe(!inRange(i)));
    expect(result.plots.plot0[9].value).toBe(Math.max(...intraday.slice(6, 10).map((b) => b.high)));
    expect(result.plots.plot1[9].value).toBe(Math.min(...intraday.slice(6, 10).map((b) => b.low)));
  });

  it('gives no value on daily bars before the range', () => {
    const r = NyOrbFakeoutDetector.calculate(bars, {});
    expect(r.plots.plot0.every((p: { value: number }) => isNaN(p.value))).toBe(true);
  });
});
