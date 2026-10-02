/**
 * Unit tests for the community batch 20 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  VolumeBarsColor,
  GammaHedgingPressure,
  Vega,
  EntropyBands,
  MacdXBbXStdevXRvi,
  DecodeMovingAverageToolkit,
  LiquiditySentimentProfileLupen,
  AdxWithShadedZone,
  LaguerreUltimateExplorationsMulticator,
  WilliamsBbdivSignal,
  Readyfor401ksJustTellMeWhen,
  TrendMasterProFekonomi,
  LiquidityFlowZones,
  AnchoredBollingerBandRange,
  SuppotAndResistanceBuySellSignals,
  FractalStrengthOscillator,
  KeltnerAroonEfiFlow,
  VcoFusion,
  RelativeAtrVolatility,
  MrCrypto731,
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
  ['volume-bars-color', VolumeBarsColor, 'plot0'],
  ['gamma-hedging-pressure', GammaHedgingPressure, 'plot0'],
  ['vega', Vega, 'plot0'],
  ['entropy-bands', EntropyBands, 'plot0'],
  ['macd-x-bb-x-stdev-x-rvi', MacdXBbXStdevXRvi, 'plot0'],
  ['decode-moving-average-toolkit', DecodeMovingAverageToolkit, 'plot0'],
  ['liquidity-sentiment-profile-lupen', LiquiditySentimentProfileLupen, 'plot0'],
  ['adx-with-shaded-zone', AdxWithShadedZone, 'plot0'],
  ['laguerre-ultimate-explorations-multicator', LaguerreUltimateExplorationsMulticator, 'plot0'],
  ['williams-bbdiv-signal', WilliamsBbdivSignal, 'plot0', { plot4: 1, plot5: 1 }],
  ['readyfor401ks-just-tell-me-when', Readyfor401ksJustTellMeWhen, 'plot0'],
  ['trendmasterpro-fekonomi', TrendMasterProFekonomi, 'plot0'],
  ['liquidity-flow-zones', LiquidityFlowZones, 'plot0'],
  ['anchored-bollinger-band-range', AnchoredBollingerBandRange, ''],
  ['suppot-and-resistance-buy-sell-signals', SuppotAndResistanceBuySellSignals, 'plot0'],
  ['fractal-strength-oscillator', FractalStrengthOscillator, 'plot0'],
  ['keltner-aroon-efi-flow', KeltnerAroonEfiFlow, 'plot0'],
  ['vco-fusion', VcoFusion, 'plot0', { plot8: 2, plot9: 2 }],
  ['relative-atr-volatility-indicator', RelativeAtrVolatility, 'plot0'],
  ['mr-crypto731', MrCrypto731, 'plot0'],
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
    // '': no value on the fixture with default inputs (anchored-bollinger-band-range: the default date is after the last bar)
    if (mainPlot === '') return;
    // 'candles': the main output is the plotcandle series
    const vals = mainPlot === 'candles'
      ? (Object.values(result.plotCandles)[0] as Array<{ close: number }>).map((c) => c.close).filter((v) => !isNaN(v))
      : (result.plots[mainPlot] as Array<{ value: number }>).map((p) => p.value).filter((v) => !isNaN(v));
    expect(vals.length).toBeGreaterThan(0);
    vals.forEach((v) => expect(isFinite(v)).toBe(true));
  });
});



describe('anchored-bollinger-band-range with a range inside the fixture', () => {
  it('draws the bands from the start of the range', () => {
    const start = Date.UTC(2015, 0, 1);
    const r = AnchoredBollingerBandRange.calculate(bars, { startTime: start, endTime: Date.UTC(2015, 2, 1) });
    const pts = r.plots.plot0 as Array<{ time: number; value: number }>;
    pts.forEach((p) => { if (p.time * 1000 < start) expect(isNaN(p.value)).toBe(true); });
    expect(pts.some((p) => isFinite(p.value))).toBe(true);
  });
});
