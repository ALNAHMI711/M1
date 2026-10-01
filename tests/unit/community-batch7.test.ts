/**
 * Unit tests for the community batch 7 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  CurvedTrendChannels,
  TripleMaForLoop,
  BuySellAccurateSignals,
  SuperBands,
  MAZones,
  PulsewaveDivergence,
  LuminousMeanReversionChannels,
  PureCoca,
  QKamaClarityTrend,
  HInfinityVolatilityFilter,
  PercentileBasedBbTrendMattes,
  GaussianRsiNal,
  IuSmartFlowSystem,
  TascSyntheticOscillator,
  KineticSlippageIndex,
  Setup91Ema50,
  DemaFlow,
  VolumeRsiMaDifferential,
  AroonWithRsiConfirmation,
  DirectionalIndicatorCrossoversV1,
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
  ['curved-trend-channels', CurvedTrendChannels, 'plot0'],
  ['triple-ma-for-loop', TripleMaForLoop, 'plot0'],
  ['buy-sell-accurate-signals', BuySellAccurateSignals, 'plot0'],
  ['superbands', SuperBands, 'plot0'],
  ['ma-zones', MAZones, 'plot0'],
  ['pulsewave-divergence', PulsewaveDivergence, 'plot0', { plot8: 5, plot9: 5 }],
  ['luminous-mean-reversion-channels', LuminousMeanReversionChannels, 'plot0'],
  ['pure-coca', PureCoca, 'plot0'],
  ['q-kama-clarity-trend', QKamaClarityTrend, 'plot0'],
  ['h-infinity-volatility-filter', HInfinityVolatilityFilter, 'plot0'],
  ['percentile-based-bb-trend-mattes', PercentileBasedBbTrendMattes, 'plot0'],
  ['gaussian-rsi-nal', GaussianRsiNal, 'plot0'],
  ['iu-smart-flow-system', IuSmartFlowSystem, 'plot0'],
  ['tasc-2026-04-a-synthetic-oscillator', TascSyntheticOscillator, 'plot0'],
  ['kinetic-slippage-index', KineticSlippageIndex, 'plot0'],
  ['setup-9-1-ema-50', Setup91Ema50, 'plot0'],
  ['dema-flow', DemaFlow, 'plot0'],
  ['volume-rsi-ma-differential', VolumeRsiMaDifferential, 'plot0'],
  ['aroon-with-rsi-confirmation', AroonWithRsiConfirmation, 'plot0'],
  ['directional-indicator-crossovers-v1', DirectionalIndicatorCrossoversV1, 'plot0'],
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
