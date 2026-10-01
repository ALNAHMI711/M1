/**
 * Unit tests for the community batch 9 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  DoubleRsi,
  DynamicTesting,
  IirOnePolePriceFilter,
  VolatilityGatedTrendOscillator,
  AdaptiveAlma20,
  VwapDeviationOscillator,
  QuantumTrendSignal,
  LoacallyWeightedMaDirectionHistogram,
  VolumeWeightedMaCrossover,
  GoldenRatioTrendPersistence,
  DualMaSdOscillator,
  EmaCloudTrend,
  AndromedaTrendSync,
  AiVolumeSignals,
  SequentialPatternStrength,
  AuraTrendCandlestickMatrix,
  EfficiencyRatioTrend,
  LinearVolumeMacdLyroRs,
  MeanAngles,
  AdaptiveKineticRibbon,
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
  ['double-rsi', DoubleRsi, 'plot0'],
  ['dynamic-testing', DynamicTesting, 'plot0'],
  ['iir-one-pole-price-filter', IirOnePolePriceFilter, 'plot0'],
  ['volatility-gated-trend-oscillator', VolatilityGatedTrendOscillator, 'plot0'],
  ['adaptive-alma-2-0', AdaptiveAlma20, 'plot0'],
  ['vwap-deviation-oscillator', VwapDeviationOscillator, 'plot0'],
  ['quantum-trend-signal', QuantumTrendSignal, 'plot0'],
  ['loacally-weighted-ma-direction-histogram', LoacallyWeightedMaDirectionHistogram, 'plot0'],
  ['volume-weighted-ma-crossover', VolumeWeightedMaCrossover, 'plot0'],
  ['golden-ratio-trend-persistence', GoldenRatioTrendPersistence, 'plot0'],
  ['dual-ma-sd-oscillator', DualMaSdOscillator, 'plot0'],
  ['ema-cloud-trend', EmaCloudTrend, 'plot0'],
  ['andromeda-trendsync', AndromedaTrendSync, 'plot0'],
  ['ai-volume-signals', AiVolumeSignals, 'markers'],
  ['sequential-pattern-strength', SequentialPatternStrength, 'plot0'],
  ['aura-trend-candlestick-matrix', AuraTrendCandlestickMatrix, 'plot0'],
  ['efficiency-ratio-trend', EfficiencyRatioTrend, 'plot0'],
  ['linear-volume-macd-lyro-rs', LinearVolumeMacdLyroRs, 'plot0'],
  ['mean-angles', MeanAngles, 'plot0'],
  ['adaptive-kinetic-ribbon', AdaptiveKineticRibbon, 'plot0'],
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
    // 'markers': the main output is the signal markers (the plot is off by default). The fixture volume varies
    // between 500 and 1500, so a spike of 2 x the volume EMA (default) never happens: multiplier 1.2 here
    if (mainPlot === 'markers') {
      expect(port.calculate(bars, { volumeMultiplier: 1.2 }).markers.length).toBeGreaterThan(0);
      return;
    }
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});
