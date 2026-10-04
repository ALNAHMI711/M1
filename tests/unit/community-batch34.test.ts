/**
 * Unit tests for the community batch 34 ports (Pine v6 sources).
 */

import { describe, it, expect } from 'vitest';
import {
  FibsyncDynamicfibsupport,
  EliteOscillatorPro,
  VolumeWeightedRsi,
  WeisWaveCandle,
  PurpleCloud20Atp,
  HarsiCbc,
  AegisPrimeFlow,
  E9BollingerRange,
  ComboOscillatorMacdStochRsiEma,
  DmiDeltaBy0xjcf,
  AuraSentimentRiskFlow,
  RadiantMeanReversionChannels,
  WyckoffEffortVsResult,
  RsiMacdSuite,
  PringSpecialKA2m,
  EntryTpSlAlertBands,
  GideonsGoldAdxWatchman,
  RenkoCompressionIndex,
  Bitcoin2ySmaBandsAstralVision,
  KaufmanTrendStrengthSignal,
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
  ['fibsync-dynamicfibsupport', FibsyncDynamicfibsupport, 'plot0'],
  ['elite-oscillator-pro', EliteOscillatorPro, 'plot0'],
  ['volume-weighted-rsi', VolumeWeightedRsi, 'plot0'],
  ['weis-wave-candle', WeisWaveCandle, 'plot0'],
  ['asdqwe123-2-0', PurpleCloud20Atp, 'plot0'],
  ['harsi-cbc', HarsiCbc, 'plot0'],
  ['aegis-prime-flow', AegisPrimeFlow, 'plot0'],
  ['e9-bollinger-range', E9BollingerRange, 'plot0'],
  ['combo-oscillator-macd-stoch-rsi-ema', ComboOscillatorMacdStochRsiEma, 'plot0'],
  ['dmi-delta-by-0xjcf', DmiDeltaBy0xjcf, 'plot0'],
  ['aura-sentiment-risk-flow', AuraSentimentRiskFlow, 'plot0'],
  ['radiant-mean-reversion-channels', RadiantMeanReversionChannels, 'plot0'],
  ['wyckoff-effort-vs-result', WyckoffEffortVsResult, 'plot0'],
  ['rsi-macd-suite', RsiMacdSuite, 'plot0'],
  ['pring-special-k-a2m', PringSpecialKA2m, 'plot0'],
  ['entry-tp-sl-alert-bands', EntryTpSlAlertBands, 'plot3'],
  ['gideons-gold-adx-watchman', GideonsGoldAdxWatchman, 'plot0'],
  ['renko-compression-index', RenkoCompressionIndex, 'plot0'],
  ['bitcoin-2y-sma-bands-astral-vision', Bitcoin2ySmaBandsAstralVision, 'plot0'],
  ['kaufman-trend-strength-signal', KaufmanTrendStrengthSignal, 'plot0'],
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





