/**
 * Unit tests for the community batch 30 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  NavierCauchyMarketElasticity,
  DynamicVwapFairValueDivergenceSuite,
  SmartMcdxFinalPro,
  TrendHeatmap,
  HendersonWeightedMovingAverage,
  MedianVolumeWeightedDeviation,
  BitcoinBullBearMarketBands,
  UltraCleanSupportResistanceLevels,
  VolumetricTensegrity,
  UmEmaSmaWmaHmaWithDirectionalColorChange,
  Atr20SmaX35TrailingLine,
  JopaChannelV1,
  NormalizedSpmaNal,
  Paft,
  LadderStDev,
  IvRankVixFixHvProxy,
  FisherMPz,
  VolumeWithAlert,
  ProScalperAyoob,
  DoubleMedianSdBands,
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
  ['navier-cauchy-market-elasticity', NavierCauchyMarketElasticity, 'plot0'],
  ['dynamic-vwap-fair-value-divergence-suite', DynamicVwapFairValueDivergenceSuite, 'plot0'],
  ['smart-mcdx-final-pro', SmartMcdxFinalPro, 'plot0'],
  ['trend-heatmap', TrendHeatmap, 'plot0'],
  ['henderson-weighted-moving-average', HendersonWeightedMovingAverage, 'plot0'],
  ['median-volume-weighted-deviation', MedianVolumeWeightedDeviation, 'plot0'],
  ['bitcoin-bull-bear-market-support-resistance-bands', BitcoinBullBearMarketBands, 'plot0'],
  ['ultra-clean-support-resistance-levels', UltraCleanSupportResistanceLevels, 'plot2', { plot0: 6, plot1: 6 }],
  ['volumetric-tensegrity', VolumetricTensegrity, 'plot0'],
  ['um-ema-sma-wma-hma-with-directional-color-change', UmEmaSmaWmaHmaWithDirectionalColorChange, 'plot0'],
  ['atr20-sma-x3-5-trailing-line', Atr20SmaX35TrailingLine, 'plot0'],
  ['jopa-channel-v1', JopaChannelV1, 'plot0'],
  ['normalized-spma-nal', NormalizedSpmaNal, 'plot0'],
  ['paft', Paft, 'plot0'],
  ['ladder-stdev', LadderStDev, 'plot0'],
  ['iv-rank-vixfix-hv-proxy', IvRankVixFixHvProxy, 'plot0'],
  ['fisher-mpz', FisherMPz, 'plot0'],
  ['volume-with-alert', VolumeWithAlert, 'plot0'],
  ['pro-scalper-2-minutestf-by-ayoob', ProScalperAyoob, 'plot0'],
  ['double-median-sd-bands-misinkomaster', DoubleMedianSdBands, 'plot0'],
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





