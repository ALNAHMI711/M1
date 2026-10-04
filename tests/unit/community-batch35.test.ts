/**
 * Unit tests for the community batch 35 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  QgParticleOscillator,
  EffectiveVolumeZScore,
  Abdullah,
  PriceAccelerationIndicator,
  CandleCountRsi,
  VwrsiCrossoversExtremes,
  MoneyFlowPulse,
  NOrderEma,
  TrendScalper,
  EarlyPivotAlertV1a,
  TrendPulseOscillator,
  PriceFlowBuySell,
  VolatilityBandCloudWithOverextensionSignals,
  Bnf2550MaPullbackScreener,
  RsiPotential,
  VolumeVariationIndexIndicator,
  CvdPolarityIndicator,
  LeveragedLiquidationZones,
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
  ['qg-particle-oscillator', QgParticleOscillator, 'plot0'],
  ['effective-volume-z-score', EffectiveVolumeZScore, 'plot0', { plot2: 5, plot3: 5 }],
  ['abdullah', Abdullah, 'plot0'],
  ['price-acceleration-indicator', PriceAccelerationIndicator, 'plot0'],
  ['candle-count-rsi', CandleCountRsi, 'plot0'],
  ['vwrsi-crossovers-extremes', VwrsiCrossoversExtremes, 'plot0'],
  ['money-flow-pulse', MoneyFlowPulse, 'plot0'],
  ['n-order-ema', NOrderEma, 'plot0'],
  ['trend-scalper', TrendScalper, 'plot0'],
  ['early-pivot-alert-v1a', EarlyPivotAlertV1a, 'plot0'],
  ['trend-pulse-oscillator', TrendPulseOscillator, 'plot0'],
  ['price-flow-buy-sell', PriceFlowBuySell, 'plot0'],
  ['volatility-band-cloud-with-overextension-signals', VolatilityBandCloudWithOverextensionSignals, 'plot0'],
  ['bnf-25-50-ma-pullback-screener', Bnf2550MaPullbackScreener, 'plot0'],
  ['rsi-potential', RsiPotential, 'plot0'],
  ['volume-variation-index-indicator', VolumeVariationIndexIndicator, 'plot0'],
  ['cvd-polarity-indicator', CvdPolarityIndicator, 'plot0'],
  ['leveraged-liquidation-zones', LeveragedLiquidationZones, 'plot0'],
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





